import { SearchEngine } from '../engines/SearchEngine';
import { LLMService } from './llmService';
import { KeywordAnalyzer } from './keywordAnalyzer';
import { Logger } from './logger';
import { config } from '../config';
import { 
  IterativeQueryOptions, 
  IterativeQueryResult, 
  IterationResult, 
  IterationEvaluation,
  AnalysisPlanResult,
  SearchOptions,
  IterationHistory
} from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from './fileUtils';

/**
 * 迭代查询引擎
 * 实现基于LLM评估的持续优化迭代查询
 */
export class IterativeQueryEngine {
  private engine: SearchEngine;
  private llmService: LLMService;
  private keywordAnalyzer: KeywordAnalyzer;
  private logger: Logger;
  private iteration: number = 0;
  private maxIterations: number = 5;
  private allDiscoveredKeywords: Set<string> = new Set();
  private keywordsByIteration: Map<number, string[]> = new Map();
  private satisfactionScores: Map<number, number> = new Map();
  private iterationHistory: IterationHistory[] = [];
  private outputDir: string;
  
  constructor(engine: SearchEngine) {
    this.engine = engine;
    this.llmService = new LLMService();
    this.keywordAnalyzer = new KeywordAnalyzer(this.llmService);
    this.logger = new Logger('IterativeEngine');
    this.outputDir = ensureOutputDirectory();
  }
  
  /**
   * 启动迭代查询流程
   */
  async startIterativeQuery(
    seedKeyword: string, 
    options: IterativeQueryOptions = {}
  ): Promise<IterativeQueryResult> {
    this.maxIterations = options.maxIterations || config.iterativeEngine.maxIterations;
    const satisfactionThreshold = options.satisfactionThreshold || 
                                config.iterativeEngine.defaultSatisfactionThreshold;
    const minNewKeywords = options.minNewKeywords || 
                          config.iterativeEngine.minNewKeywordsPerIteration;
    
    this.logger.info(`启动迭代查询引擎，关键词: "${seedKeyword}", 最大迭代次数: ${this.maxIterations}`);
    
    // 重置状态
    this.iteration = 0;
    this.allDiscoveredKeywords.clear();
    this.keywordsByIteration.clear();
    this.satisfactionScores.clear();
    this.iterationHistory = [];
    
    let currentKeyword = seedKeyword;
    let continueIteration = true;
    
    // 准备搜索选项
    const searchOptions: SearchOptions = {
      ...config.searchDefaults,
      ...options,
      enableSecondRound: false // 关闭内置的二次查询，由迭代引擎控制
    };
    
    // 初始查询
    let result = await this.executeInitialQuery(currentKeyword, searchOptions);
    this.recordIterationResults(result, 0);
    
    // 记录初始查询的历史
    this.iterationHistory.push({
      iterationNumber: 0,
      query: currentKeyword,
      queryType: 'initial',
      newKeywordsCount: result.length,
      keywords: result,
      satisfactionScore: 0,
      analysis: '初始字母组合查询',
      recommendedQueries: []
    });
    
    // 创建迭代进度文件
    const progressFilePath = this.createProgressFile(seedKeyword);
    
    // 迭代查询循环
    while (continueIteration && this.iteration < this.maxIterations) {
      this.iteration++;
      this.logger.info(`开始第${this.iteration}次迭代查询`);
      
      // 1. 分析当前结果并生成下一轮查询策略
      const analysisResult = await this.analyzeAndPlan(
        currentKeyword, 
        Array.from(this.allDiscoveredKeywords),
        this.iterationHistory
      );
      
      // 更新进度文件
      this.updateProgressFile(progressFilePath, {
        step: 'analysis_completed',
        analysis: analysisResult
      });
      
      // 2. 执行下一轮查询
      const iterationResults = await this.executeIterationQueries(
        analysisResult.recommendedQueries,
        searchOptions
      );
      
      // 3. 记录结果
      this.recordIterationResults(iterationResults.allSuggestions, this.iteration);
      
      // 更新进度文件
      this.updateProgressFile(progressFilePath, {
        step: 'iteration_completed',
        newKeywordsCount: iterationResults.newKeywordsCount
      });
      
      // 4. 评估满意度
      const satisfactionScore = await this.evaluateIterationSatisfaction(
        iterationResults.allSuggestions,
        analysisResult.targetGoals
      );
      this.satisfactionScores.set(this.iteration, satisfactionScore.overallScore);
      
      // 记录本次迭代历史
      this.iterationHistory.push({
        iterationNumber: this.iteration,
        query: iterationResults.mostEffectiveQuery || '多查询组合',
        queryType: 'iteration',
        queryResults: iterationResults.queryResults,
        newKeywordsCount: iterationResults.newKeywordsCount,
        keywords: iterationResults.allSuggestions,
        satisfactionScore: satisfactionScore.overallScore,
        analysis: satisfactionScore.analysis,
        evaluationDimensions: satisfactionScore.dimensions,
        recommendedQueries: analysisResult.recommendedQueries
      });
      
      // 更新进度文件
      this.updateProgressFile(progressFilePath, {
        step: 'evaluation_completed',
        evaluation: satisfactionScore
      });
      
      // 5. 确定是否继续迭代
      const iterationDecision = this.shouldContinueIteration(
        satisfactionScore, 
        {
          minScore: satisfactionThreshold,
          minNewKeywords: minNewKeywords,
          maxIterations: this.maxIterations,
          currentIteration: this.iteration
        }
      );
      
      continueIteration = iterationDecision.continue;
      this.logger.info(`迭代${this.iteration}决策: ${iterationDecision.continue ? '继续' : '停止'}, 原因: ${iterationDecision.reason}`);
      
      // 更新当前关键词为最有效的查询
      if (continueIteration && iterationResults.mostEffectiveQuery) {
        currentKeyword = iterationResults.mostEffectiveQuery;
        this.logger.info(`下一轮迭代使用的种子关键词: "${currentKeyword}"`);
      }
    }
    
    // 6. 生成最终分析报告
    const finalReport = await this.generateFinalReport(seedKeyword);
    
    // 保存最终结果
    const finalResult = this.createFinalResult(seedKeyword, finalReport);
    this.saveFinalResult(seedKeyword, finalResult);
    
    // 删除进度文件
    try {
      fs.unlinkSync(progressFilePath);
    } catch (error) {
      this.logger.warn(`删除进度文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return finalResult;
  }
  
  /**
   * 执行初始查询
   */
  private async executeInitialQuery(
    keyword: string, 
    options: SearchOptions
  ): Promise<string[]> {
    try {
      this.logger.info(`执行初始查询: "${keyword}"`);
      
      // 使用字母组合模式进行全覆盖查询
      const outputFilename = `${this.engine.getName().toLowerCase()}_${keyword.replace(/\s+/g, '_')}_initial_alphabets.json`;
      const outputPath = await this.engine.fetchAutocompleteWithAlphabets(keyword, options, outputFilename);
      
      // 解析结果文件
      const result = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      
      this.logger.info(`初始查询完成，获取到 ${result.suggestions.length} 条建议`);
      return result.suggestions;
    } catch (error) {
      this.logger.error(`初始查询失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 如果字母组合查询失败，尝试使用基本查询
      try {
        const result = await this.engine.fetchAutocomplete(keyword, options);
        this.logger.info(`使用基本查询获取到 ${result.suggestions.length} 条建议`);
        return result.suggestions;
      } catch (secondError) {
        this.logger.error(`基本查询也失败: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
        return [];
      }
    }
  }
  
  /**
   * 分析当前结果并规划下一步查询
   */
  private async analyzeAndPlan(
    originalKeyword: string,
    currentKeywords: string[],
    iterationHistory: IterationHistory[] = []
  ): Promise<AnalysisPlanResult> {
    this.logger.info(`分析${currentKeywords.length}个关键词并规划下一轮查询...`);
    
    try {
      // 使用关键词分析器规划下一步，传递迭代历史
      return await this.keywordAnalyzer.planNextIteration(
        originalKeyword, 
        currentKeywords,
        iterationHistory
      );
    } catch (error) {
      this.logger.error(`规划失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回基本规划
      return {
        gaps: ["未能识别具体空缺"],
        patterns: ["基本搜索模式"],
        targetGoals: ["发现更多长尾关键词"],
        recommendedQueries: [
          `${originalKeyword} 如何`,
          `${originalKeyword} 价格`,
          `${originalKeyword} 问题`,
          `${originalKeyword} 教程`,
          `${originalKeyword} 推荐`
        ]
      };
    }
  }
  
  /**
   * 执行迭代查询
   */
  private async executeIterationQueries(
    queries: string[],
    options: SearchOptions
  ): Promise<IterationResult> {
    const previousKeywordsCount = this.allDiscoveredKeywords.size;
    const queryResults = new Map<string, string[]>();
    const allSuggestions: string[] = [];
    
    this.logger.info(`执行${queries.length}个迭代查询...`);
    
    // 为每个推荐的查询执行搜索
    for (const query of queries) {
      this.logger.info(`执行查询: "${query}"`);
      
      try {
        // 执行单个关键词查询
        const result = await this.engine.fetchAutocomplete(query, {
          ...options,
          enableSecondRound: false
        });
        
        // 记录结果
        queryResults.set(query, result.suggestions);
        allSuggestions.push(...result.suggestions);
        
        this.logger.info(`查询"${query}"获取到${result.suggestions.length}条建议`);
      } catch (error) {
        this.logger.error(`查询"${query}"失败: ${error instanceof Error ? error.message : String(error)}`);
        queryResults.set(query, []);
      }
      
      // 随机延迟，避免请求过快
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // 找出产生最多新关键词的查询
    let mostEffectiveQuery = '';
    let maxNewKeywords = 0;
    
    for (const [query, suggestions] of queryResults.entries()) {
      const newKeywords = suggestions.filter(s => !this.allDiscoveredKeywords.has(s));
      if (newKeywords.length > maxNewKeywords) {
        maxNewKeywords = newKeywords.length;
        mostEffectiveQuery = query;
      }
    }
    
    this.logger.info(`最有效的查询是"${mostEffectiveQuery}"，产生了${maxNewKeywords}个新关键词`);
    
    // 计算新发现的关键词数量
    const newKeywordsCount = allSuggestions.filter(s => !this.allDiscoveredKeywords.has(s)).length;
    
    return {
      allSuggestions,
      queryResults: Object.fromEntries(queryResults),
      mostEffectiveQuery,
      newKeywordsCount
    };
  }
  
  /**
   * 评估迭代满意度
   */
  private async evaluateIterationSatisfaction(
    newSuggestions: string[], 
    goals: string[]
  ): Promise<IterationEvaluation> {
    this.logger.info(`评估第${this.iteration}次迭代结果...`);
    
    // 筛选出新发现的关键词
    const newKeywords = newSuggestions.filter(s => !this.allDiscoveredKeywords.has(s));
    
    // 获取上一次迭代的关键词作为比较基准
    const previousKeywords = this.keywordsByIteration.get(this.iteration - 1) || [];
    
    try {
      // 使用LLM评估满意度
      return await this.llmService.evaluateIterationQuality(
        newKeywords,
        previousKeywords,
        Array.from(this.allDiscoveredKeywords)[0], // 原始关键词
        goals
      );
    } catch (error) {
      this.logger.error(`评估失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回基本评估
      return {
        dimensions: {
          relevance: 7,
          longTailValue: 7,
          commercialValue: 6,
          diversity: 6,
          novelty: 7,
          searchVolumePotential: 6,
          goalAchievement: 6
        },
        overallScore: 0.65,
        analysis: "由于无法使用LLM评估，使用基本评分。",
        recommendContinue: true,
        improvementSuggestions: ["尝试更多商业意图查询", "探索更多问题型关键词"],
        newKeywordsCount: newKeywords.length
      };
    }
  }
  
  /**
   * 决定是否继续迭代
   */
  private shouldContinueIteration(
    evaluation: IterationEvaluation, 
    options: {
      minScore: number;
      minNewKeywords: number;
      maxIterations: number;
      currentIteration: number;
    }
  ): { continue: boolean; reason: string } {
    // 一定停止的条件
    if (options.currentIteration >= options.maxIterations) {
      return { 
        continue: false, 
        reason: `已达到最大迭代次数(${options.maxIterations})`
      };
    }
    
    // 评分达到阈值则停止
    if (evaluation.overallScore >= options.minScore) {
      return {
        continue: false,
        reason: `评分(${evaluation.overallScore.toFixed(2)})已达到满意阈值(${options.minScore})`
      };
    }
    
    // 新发现关键词过少则停止
    if (evaluation.newKeywordsCount !== undefined && 
        evaluation.newKeywordsCount <= options.minNewKeywords) {
      return {
        continue: false,
        reason: `新发现关键词数量(${evaluation.newKeywordsCount})低于最小要求(${options.minNewKeywords})`
      };
    }
    
    // 新颖性评分过低则停止
    if (evaluation.dimensions.novelty < 3) {
      return {
        continue: false,
        reason: `新颖性评分过低(${evaluation.dimensions.novelty})，继续迭代价值不大`
      };
    }
    
    // 默认继续
    return {
      continue: true,
      reason: `当前评分(${evaluation.overallScore.toFixed(2)})低于目标(${options.minScore})，且仍有发现潜力`
    };
  }
  
  /**
   * 记录迭代结果
   */
  private recordIterationResults(suggestions: string[], iterationNumber: number): void {
    // 记录当前迭代的关键词
    const previousSize = this.allDiscoveredKeywords.size;
    
    // 记录新建议
    const newKeywords: string[] = [];
    
    suggestions.forEach(suggestion => {
      if (!this.allDiscoveredKeywords.has(suggestion)) {
        this.allDiscoveredKeywords.add(suggestion);
        newKeywords.push(suggestion);
      }
    });
    
    // 保存到迭代映射
    this.keywordsByIteration.set(iterationNumber, newKeywords);
    
    this.logger.info(`迭代${iterationNumber}发现${newKeywords.length}个新关键词，总计${this.allDiscoveredKeywords.size}个`);
  }
  
  /**
   * 生成最终报告
   */
  private async generateFinalReport(originalKeyword: string): Promise<any> {
    try {
      this.logger.info('生成最终分析报告...');
      
      // 准备报告数据
      const allKeywords = Array.from(this.allDiscoveredKeywords);
      const iterationScores = Object.fromEntries(this.satisfactionScores);
      
      // 使用LLM服务生成最终报告
      const finalReport = await this.llmService.generateFinalKeywordReport(
        originalKeyword,
        allKeywords,
        {
          iterationCount: this.iteration,
          satisfactionScores: iterationScores,
          iterationHistory: this.iterationHistory // 传递完整的迭代历史
        }
      );
      
      this.logger.info('最终分析报告生成完成');
      return finalReport;
    } catch (error) {
      this.logger.error(`生成最终报告失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 如果LLM分析失败，创建基本报告
      return {
        summary: `完成了对"${originalKeyword}"的关键词分析，共发现${this.allDiscoveredKeywords.size}个关键词，经过${this.iteration}轮迭代。`,
        categories: {
          informational: [],
          problemSolving: [],
          commercial: [],
          tutorial: []
        },
        topKeywords: Array.from(this.allDiscoveredKeywords).slice(0, 20),
        intentAnalysis: "无法生成详细的意图分析",
        contentOpportunities: ["建议基于发现的关键词创建内容"],
        commercialKeywords: []
      };
    }
  }
  
  /**
   * 创建最终结果对象
   */
  private createFinalResult(
    originalKeyword: string, 
    finalReport: any
  ): IterativeQueryResult {
    return {
      originalKeyword,
      totalIterations: this.iteration,
      totalKeywordsDiscovered: this.allDiscoveredKeywords.size,
      keywordsByIteration: Object.fromEntries(this.keywordsByIteration),
      satisfactionByIteration: Object.fromEntries(this.satisfactionScores),
      keywords: Array.from(this.allDiscoveredKeywords),
      finalReport,
      iterationHistory: this.iterationHistory
    };
  }
  
  /**
   * 保存最终结果
   */
  private saveFinalResult(originalKeyword: string, result: IterativeQueryResult): string {
    const safeKeyword = originalKeyword.replace(/\s+/g, '_');
    const jsonPath = path.join(this.outputDir, `${this.engine.getName().toLowerCase()}_${safeKeyword}_iterative_results.json`);
    
    // 保存JSON结果
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
    this.logger.info(`结果已保存到: ${jsonPath}`);
    
    // 保存CSV结果
    const csvPath = jsonPath.replace('.json', '.csv');
    const csvContent = this.convertKeywordsToCSV(result.keywords);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    this.logger.info(`CSV结果已保存到: ${csvPath}`);
    
    // 保存Markdown报告
    const mdPath = jsonPath.replace('.json', '_report.md');
    const mdContent = this.generateMarkdownReport(result);
    fs.writeFileSync(mdPath, mdContent, 'utf-8');
    this.logger.info(`分析报告已保存到: ${mdPath}`);
    
    return jsonPath;
  }
  
  /**
   * 创建进度文件
   */
  private createProgressFile(keyword: string): string {
    const safeKeyword = keyword.replace(/\s+/g, '_');
    const progressPath = path.join(
      this.outputDir, 
      `${this.engine.getName().toLowerCase()}_${safeKeyword}_iterative.progress`
    );
    
    const progressData = {
      keyword,
      engine: this.engine.getName(),
      startTime: new Date().toISOString(),
      status: 'started',
      currentIteration: 0,
      totalKeywords: 0
    };
    
    fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2), 'utf-8');
    return progressPath;
  }
  
  /**
   * 更新进度文件
   */
  private updateProgressFile(filePath: string, updateData: any): void {
    try {
      // 读取现有数据
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // 更新数据
      const updatedData = {
        ...data,
        ...updateData,
        lastUpdated: new Date().toISOString(),
        currentIteration: this.iteration,
        totalKeywords: this.allDiscoveredKeywords.size,
        status: this.iteration >= this.maxIterations ? 'completed' : 'in_progress'
      };
      
      // 写回文件
      fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
    } catch (error) {
      this.logger.warn(`更新进度文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 将关键词转换为CSV格式
   */
  private convertKeywordsToCSV(keywords: string[]): string {
    // 添加表头
    const headers = ['序号', '关键词'];
    const rows = keywords.map((keyword, index) => [
      (index + 1).toString(),
      keyword
    ]);
    
    // 生成CSV内容
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => row.join(','));
    
    return [headerLine, ...dataLines].join('\n');
  }
  
  /**
   * 生成Markdown格式报告
   */
  private generateMarkdownReport(result: IterativeQueryResult): string {
    const { originalKeyword, totalIterations, totalKeywordsDiscovered, finalReport } = result;
    
    let report = `# "${originalKeyword}" 长尾关键词分析报告\n\n`;
    
    report += `## 概述\n\n`;
    report += `- **原始关键词**: ${originalKeyword}\n`;
    report += `- **迭代次数**: ${totalIterations}\n`;
    report += `- **发现关键词总数**: ${totalKeywordsDiscovered}\n`;
    report += `- **分析日期**: ${new Date().toLocaleDateString()}\n\n`;
    
    // 添加最有价值的关键词
    if (finalReport && finalReport.topKeywords) {
      report += `## 最有价值的长尾关键词\n\n`;
      finalReport.topKeywords.forEach((keyword: string, index: number) => {
        report += `${index + 1}. ${keyword}\n`;
      });
      report += `\n`;
    }
    
    // 添加关键词分类
    if (finalReport && finalReport.categories) {
      report += `## 关键词分类\n\n`;
      
      Object.entries(finalReport.categories).forEach(([category, keywords]) => {
        if (Array.isArray(keywords) && keywords.length > 0) {
          const categoryName = this.formatCategoryName(category);
          report += `### ${categoryName} (${keywords.length}个)\n\n`;
          
          keywords.slice(0, 10).forEach((keyword: string) => {
            report += `- ${keyword}\n`;
          });
          
          if (keywords.length > 10) {
            report += `- *(另外还有 ${keywords.length - 10} 个)*\n`;
          }
          
          report += `\n`;
        }
      });
    }
    
    // 添加意图分析
    if (finalReport && finalReport.intentAnalysis) {
      report += `## 搜索意图分析\n\n`;
      report += `${finalReport.summary || '未提供详细分析'}\n\n`;
    }
    
    // 添加内容机会
    if (finalReport && finalReport.contentOpportunities && finalReport.contentOpportunities.length > 0) {
      report += `## 内容创作机会\n\n`;
      finalReport.contentOpportunities.forEach((opportunity: string, index: number) => {
        report += `${index + 1}. ${opportunity}\n`;
      });
      report += `\n`;
    }
    
    // 添加迭代数据
    report += `## 迭代数据\n\n`;
    report += `| 迭代 | 发现的关键词数 | 满意度评分 |\n`;
    report += `|------|--------------|----------|\n`;
    
    for (let i = 0; i <= totalIterations; i++) {
      const keywords = result.keywordsByIteration[i] || [];
      const score = result.satisfactionByIteration[i] || '-';
      const scoreFormatted = typeof score === 'number' ? score.toFixed(2) : score;
      
      report += `| ${i} | ${keywords.length} | ${scoreFormatted} |\n`;
    }
    
    return report;
  }
  
  /**
   * 格式化类别名称
   */
  private formatCategoryName(category: string): string {
    const categoryMap: Record<string, string> = {
      'informational': '信息查询类',
      'commercial': '商业交易类',
      'problemSolving': '问题解决类',
      'tutorial': '教程指南类',
      'definitional': '定义解释类'
    };
    
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }
} 