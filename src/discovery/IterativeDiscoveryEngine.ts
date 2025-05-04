/**
 * KeywordNova 迭代发现引擎
 * 核心关键词挖掘组件
 */
import { SearchEngine } from '../providers/SearchEngine';
import { LLMService } from '../intent/LLMService';
import { IntentAnalyzer } from '../intent/IntentAnalyzer';
import { 
  SearchOptions, 
  DiscoveryResult,
  IterationHistory,
  IterationResult,
  AnalysisPlanResult,
  IntentAnalysisResult
} from '../types';
import { config } from '../config';
import { ErrorType, AppError, handleError } from '../core/errorHandler';

/**
 * 迭代发现引擎
 * 通过多轮迭代查询发现长尾关键词
 */
export class IterativeDiscoveryEngine {
  private searchEngine: SearchEngine;
  private llmService: LLMService | null = null;
  private intentAnalyzer: IntentAnalyzer | null = null;
  private discoveredKeywords: Set<string> = new Set();
  private iterationHistory: IterationHistory[] = [];

  /**
   * 创建迭代发现引擎实例
   * @param searchEngine 搜索引擎实例
   */
  constructor(searchEngine: SearchEngine) {
    this.searchEngine = searchEngine;
  }

  /**
   * 开始关键词发现过程
   * @param initialKeyword 初始关键词
   * @param options 搜索选项
   * @returns 发现结果
   */
  async startDiscovery(
    initialKeyword: string, 
    options: SearchOptions
  ): Promise<DiscoveryResult> {
    this.discoveredKeywords = new Set();
    this.iterationHistory = [];
    
    // 初始化LLM服务（如果启用）
    if (options.useLLM) {
      this.llmService = new LLMService({
        model: options.llmModel || config.llm.defaultModel
      });
      this.intentAnalyzer = new IntentAnalyzer(this.llmService);
    }
    
    // 确定迭代参数
    const maxIterations = options.maxIterations || config.iterativeEngine.maxIterations;
    const satisfactionThreshold = options.satisfactionThreshold || 
      config.iterativeEngine.defaultSatisfactionThreshold;
    
    // 执行初始查询
    console.log(`Executing initial query: "${initialKeyword}"`);
    let currentKeywords: string[] = [];
    let queryType: 'initial' | 'iteration' = 'initial';
    let currentQuery = initialKeyword;
    
    try {
      // 执行初始搜索
      const initialSuggestions = await this.searchEngine.getSuggestions(initialKeyword, options);
      currentKeywords = initialSuggestions.suggestions;
      
      // 添加到已发现关键词集合
      currentKeywords.forEach(keyword => this.discoveredKeywords.add(keyword));
      
      // 记录初始迭代历史
      this.iterationHistory.push({
        iterationNumber: 0,
        query: initialKeyword,
        queryType: 'initial',
        keywords: [...currentKeywords],
        newKeywordsCount: currentKeywords.length,
        satisfactionScore: 1.0, // 初始查询默认满意度为1.0
        analysis: 'Initial query',
        recommendedQueries: []
      });
      
      // 执行迭代查询
      let iterationCount = 0;
      let continueFetching = true;
      
      while (iterationCount < maxIterations && continueFetching) {
        iterationCount++;
        queryType = 'iteration';
        console.log(`\nExecuting iteration #${iterationCount}`);
        
        // 确定下一轮查询
        if (this.intentAnalyzer && this.llmService) {
          // 使用LLM分析规划下一轮查询
          const planResult = await this.planNextIteration(
            initialKeyword,
            currentKeywords,
            iterationCount
          );
          
          // 如果有推荐查询，使用第一个作为下一轮查询
          if (planResult.recommendedQueries.length > 0) {
            currentQuery = planResult.recommendedQueries[0];
            console.log(`Selected query based on analysis: "${currentQuery}"`);
          } else {
            // 使用初始关键词加变种
            currentQuery = `${initialKeyword} best`;
            console.log(`Using default query: "${currentQuery}"`);
          }
        } else {
          // 不使用LLM分析，使用简单变种
          const variants = ['how', 'best', 'tutorial', 'problems', 'compare'];
          currentQuery = `${initialKeyword} ${variants[iterationCount % variants.length]}`;
          console.log(`Using default query variant: "${currentQuery}"`);
        }
        
        // 执行迭代查询
        const iterationResult = await this.executeIteration(currentQuery, options);
        const newKeywords = iterationResult.allSuggestions;
        
        // 计算新发现的关键词
        const newDiscoveredKeywords = newKeywords.filter(
          keyword => !this.discoveredKeywords.has(keyword)
        );
        
        // 添加新关键词到发现集合
        newDiscoveredKeywords.forEach(keyword => this.discoveredKeywords.add(keyword));
        
        // 计算满意度分数
        let satisfactionScore = newDiscoveredKeywords.length / 
          Math.max(config.iterativeEngine.minNewKeywordsPerIteration, 1);
        satisfactionScore = Math.min(satisfactionScore, 1.0);
        
        // 创建当前迭代分析
        let iterationAnalysis = `Discovered ${newDiscoveredKeywords.length} new keywords`;
        let recommendedQueries: string[] = [];
        
        // 如果启用了LLM分析，评估迭代结果
        if (this.intentAnalyzer && this.llmService) {
          try {
            const evaluationResult = await this.intentAnalyzer.evaluateIteration(
              initialKeyword,
              newDiscoveredKeywords,
              iterationCount,
              [`Discover long-tail keywords`, `Increase coverage for ${initialKeyword} related areas`]
            );
            
            // 使用评估结果更新满意度
            satisfactionScore = evaluationResult.overallScore / 10;
            iterationAnalysis = evaluationResult.analysis;
            
            // 获取下一轮推荐查询
            const planResult = await this.planNextIteration(
              initialKeyword,
              [...this.discoveredKeywords],
              iterationCount + 1
            );
            recommendedQueries = planResult.recommendedQueries;
            
            // 调整是否继续迭代
            continueFetching = 
              satisfactionScore < satisfactionThreshold && 
              evaluationResult.recommendContinue;
          } catch (error) {
            console.error(`LLM analysis evaluation failed: ${(error as Error).message}`);
            // 评估失败时使用默认满意度计算
          }
        } else {
          // 没有LLM分析时基于新发现关键词数量决定是否继续
          continueFetching = 
            satisfactionScore < satisfactionThreshold && 
            newDiscoveredKeywords.length >= config.iterativeEngine.minNewKeywordsPerIteration;
        }
        
        // 记录迭代历史
        this.iterationHistory.push({
          iterationNumber: iterationCount,
          query: currentQuery,
          queryType: 'iteration',
          queryResults: iterationResult.queryResults,
          keywords: newDiscoveredKeywords,
          newKeywordsCount: newDiscoveredKeywords.length,
          satisfactionScore,
          analysis: iterationAnalysis,
          recommendedQueries
        });
        
        console.log(`Iteration #${iterationCount} completed. New keywords discovered: ${newDiscoveredKeywords.length}`);
        console.log(`Satisfaction score: ${(satisfactionScore * 100).toFixed(1)}%`);
        
        // 如果满意度达到阈值或没有新关键词，停止迭代
        if (
          satisfactionScore >= satisfactionThreshold || 
          newDiscoveredKeywords.length === 0
        ) {
          console.log(`Satisfaction threshold reached or no new keywords found. Stopping iterations.`);
          continueFetching = false;
        }
      }
      
      // 转换为结果对象
      const allKeywords = [...this.discoveredKeywords];
      
      // 生成发现结果
      const discoveryResult: DiscoveryResult = {
        originalKeyword: initialKeyword,
        totalIterations: this.iterationHistory.length - 1, // 不计算初始查询
        totalKeywordsDiscovered: allKeywords.length,
        keywordsByIteration: {},
        satisfactionByIteration: {},
        keywords: allKeywords,
        highValueKeywords: [],
        intentAnalysis: null,
        iterationHistory: this.iterationHistory,
        summary: `Executed ${this.iterationHistory.length - 1} iterations and discovered ${allKeywords.length} keywords.`
      };
      
      // 添加每次迭代的关键词
      this.iterationHistory.forEach(iteration => {
        discoveryResult.keywordsByIteration[iteration.iterationNumber] = iteration.keywords;
        discoveryResult.satisfactionByIteration[iteration.iterationNumber] = iteration.satisfactionScore;
      });
      
      // 如果启用了LLM分析，生成最终分析报告
      if (this.intentAnalyzer && this.llmService) {
        try {
          console.log(`Generating final intent analysis report...`);
          const finalAnalysis = await this.intentAnalyzer.generateFinalReport(
            initialKeyword,
            allKeywords,
            this.iterationHistory
          );
          discoveryResult.intentAnalysis = finalAnalysis;
          discoveryResult.highValueKeywords = finalAnalysis.highValueKeywords;
          discoveryResult.summary = finalAnalysis.summary;
        } catch (error) {
          console.error(`Failed to generate final analysis report: ${(error as Error).message}`);
        }
      }
      
      return discoveryResult;
    } catch (error) {
      handleError(error);
      throw new AppError(
        `Keyword discovery process failed: ${(error as Error).message}`,
        ErrorType.UNKNOWN,
        error as Error
      );
    }
  }
  
  /**
   * 执行单次迭代
   * @param query 查询关键词
   * @param options 搜索选项
   * @returns 迭代结果
   */
  private async executeIteration(
    query: string, 
    options: SearchOptions
  ): Promise<IterationResult> {
    try {
      // 获取主查询的建议
      const mainQueryResult = await this.searchEngine.getSuggestions(query, options);
      const queryResults: Record<string, string[]> = {
        [query]: mainQueryResult.suggestions
      };
      
      // 如果建议数量足够，从中挑选一些有潜力的进行二级查询
      let secondaryQueries: string[] = [];
      if (mainQueryResult.suggestions.length > 0) {
        // 选择一些最具潜力的建议进行二级查询
        secondaryQueries = this.selectSecondaryQueries(
          mainQueryResult.suggestions,
          options.maxSecondaryKeywords || config.searchDefaults.maxSecondaryKeywords || 10
        );
      }
      
      // 执行二级查询
      for (const secondaryQuery of secondaryQueries) {
        try {
          // 添加随机延迟以避免被封锁
          await this.randomDelay(options);
          
          // 执行二级查询
          const secondaryResult = await this.searchEngine.getSuggestions(
            secondaryQuery, 
            options
          );
          
          // 存储二级查询结果
          queryResults[secondaryQuery] = secondaryResult.suggestions;
        } catch (error) {
          console.error(`Secondary query "${secondaryQuery}" failed: ${(error as Error).message}`);
          // 继续下一个查询
        }
      }
      
      // 汇总所有建议
      const allSuggestions = [
        ...mainQueryResult.suggestions,
        ...Object.values(queryResults)
          .slice(1) // 跳过主查询结果（已经包含）
          .flat()
      ];
      
      // 去重
      const uniqueSuggestions = [...new Set(allSuggestions)];
      
      // 查找最有效的查询
      let mostEffectiveQuery = query;
      let maxResults = mainQueryResult.suggestions.length;
      
      for (const [queryKey, results] of Object.entries(queryResults)) {
        if (results.length > maxResults) {
          maxResults = results.length;
          mostEffectiveQuery = queryKey;
        }
      }
      
      return {
        allSuggestions: uniqueSuggestions,
        queryResults,
        mostEffectiveQuery,
        newKeywordsCount: uniqueSuggestions.length
      };
    } catch (error) {
      throw new AppError(
        `Iteration execution failed: ${(error as Error).message}`,
        ErrorType.UNKNOWN,
        error as Error
      );
    }
  }
  
  /**
   * 选择二级查询关键词
   * @param suggestions 候选建议列表
   * @param maxCount 最大选择数量
   * @returns 选择的二级查询关键词
   */
  private selectSecondaryQueries(suggestions: string[], maxCount: number): string[] {
    if (suggestions.length <= maxCount) {
      return suggestions;
    }
    
    // 优先选择较长且包含特定意图词的关键词
    const scoredSuggestions = suggestions.map(suggestion => {
      // 计算基础分数（长度）
      let score = suggestion.length;
      
      // 意图指示词加分
      const intentWords = [
        'how', 'best', 'recommended', 'problems', 'compare', 
        'tutorial', 'guide', 'method', 'steps', 'tips'
      ];
      
      for (const word of intentWords) {
        if (suggestion.includes(word)) {
          score += 5;
        }
      }
      
      return { suggestion, score };
    });
    
    // 按分数排序
    scoredSuggestions.sort((a, b) => b.score - a.score);
    
    // 返回分数最高的 maxCount 个建议
    return scoredSuggestions
      .slice(0, maxCount)
      .map(item => item.suggestion);
  }
  
  /**
   * 规划下一轮迭代
   * @param originalKeyword 原始关键词
   * @param currentKeywords 当前已发现的关键词
   * @param nextIterationNumber 下一迭代序号
   * @returns 分析和规划结果
   */
  private async planNextIteration(
    originalKeyword: string,
    currentKeywords: string[],
    nextIterationNumber: number
  ): Promise<AnalysisPlanResult> {
    if (!this.intentAnalyzer) {
      throw new AppError(
        'Cannot plan iteration: Intent analyzer not initialized',
        ErrorType.VALIDATION
      );
    }
    
    try {
      return await this.intentAnalyzer.planNextIteration(
        originalKeyword,
        currentKeywords,
        nextIterationNumber,
        this.iterationHistory
      );
    } catch (error) {
      console.error(`Failed to plan next iteration: ${(error as Error).message}`);
      // 返回默认规划结果
      return {
        gaps: ['Gaps could not be identified through LLM analysis'],
        patterns: [],
        targetGoals: [`Discover more long-tail keywords for "${originalKeyword}"`],
        recommendedQueries: [
          `${originalKeyword} how`,
          `${originalKeyword} best`,
          `${originalKeyword} tutorial`,
          `${originalKeyword} problems`,
          `${originalKeyword} compare`
        ]
      };
    }
  }
  
  /**
   * 添加随机延迟
   * @param options 搜索选项
   */
  private async randomDelay(options: SearchOptions): Promise<void> {
    // 获取延迟范围
    const delayRange = options.delayBetweenQueries || 
      config.searchDefaults.delayBetweenQueries || 
      { min: 1000, max: 3000 };
    
    // 生成随机延迟时间
    const delay = Math.floor(
      Math.random() * (delayRange.max - delayRange.min + 1) + delayRange.min
    );
    
    // 等待
    await new Promise(resolve => setTimeout(resolve, delay));
  }
} 