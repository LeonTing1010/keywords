import axios from 'axios';
import { config } from '../config';
import { AppError, ErrorType } from './errorHandler';
import { Logger } from './logger';
import { 
  LLMAnalysisPurpose, 
  IterationEvaluation, 
  KeywordCategories, 
  AnalysisPlanResult,
  FinalReport,
  LLMServiceOptions,
  IterationHistory
} from '../types';
import Handlebars from 'handlebars';

/**
 * LLM服务类
 * 处理与大语言模型的所有交互
 */
export class LLMService {
  private apiKey: string;
  private model: string;
  private logger: Logger;
  private timeout: number;
  private maxRetries: number;
  
  constructor(options?: LLMServiceOptions) {
    this.apiKey = options?.apiKey || config.llm.apiKey;
    this.model = options?.model || config.llm.defaultModel;
    this.timeout = options?.timeout || config.llm.timeout;
    this.maxRetries = options?.maxRetries || config.llm.maxRetries;
    this.logger = new Logger('LLMService');
    
    if (!this.apiKey) {
      this.logger.warn('未设置OpenAI API密钥，LLM功能将不可用');
    }
  }
  
  /**
   * 编译提示模板
   */
  private compilePrompt(templateName: string, data: any): string {
    try {
      const promptTemplates = config.llm.promptTemplates as Record<string, string>;
      const templateString = promptTemplates[templateName];
      if (!templateString) {
        throw new Error(`模板"${templateName}"不存在`);
      }
      
      const template = Handlebars.compile(templateString);
      return template(data);
    } catch (error) {
      this.logger.error(`编译提示模板失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(
        `编译提示模板失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.VALIDATION
      );
    }
  }
  
  /**
   * 发送请求到OpenAI API
   */
  private async callOpenAI(
    prompt: string, 
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'json_object' | 'text';
    }
  ): Promise<any> {
    if (!this.apiKey) {
      throw new AppError(
        '未设置OpenAI API密钥，请设置OPENAI_API_KEY环境变量或在配置中提供',
        ErrorType.VALIDATION
      );
    }
    
    const {
      temperature = 0.3,
      maxTokens = 1500,
      responseFormat = 'json_object'
    } = options || {};
    
    let retries = 0;
    let lastError: any = null;
    
    while (retries <= this.maxRetries) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: this.model,
            messages: [
              { 
                role: "system", 
                content: "你是专业的SEO和关键词分析专家，擅长分析长尾关键词和搜索意图。你的回答必须是JSON格式。" 
              },
              { role: "user", content: prompt }
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: responseFormat }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: this.timeout
          }
        );
        
        const content = response.data.choices[0].message?.content;
        
        if (responseFormat === 'json_object') {
          try {
            return JSON.parse(content);
          } catch (parseError) {
            this.logger.error(`解析JSON响应失败: ${content}`);
            throw new AppError(
              '解析LLM响应失败: 无效的JSON格式',
              ErrorType.API
            );
          }
        }
        
        return content;
      } catch (error) {
        lastError = error;
        this.logger.warn(`调用OpenAI API失败(尝试 ${retries + 1}/${this.maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`);
        
        // 如果是4xx错误(除429)，不再重试
        if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
          break;
        }
        
        retries++;
        if (retries <= this.maxRetries) {
          // 指数退避
          const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
          this.logger.info(`等待 ${Math.round(delay / 1000)} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new AppError(
      `调用OpenAI API失败: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      ErrorType.API,
      lastError
    );
  }
  
  /**
   * 分析关键词
   */
  async analyzeKeywords(
    originalKeyword: string, 
    suggestions: string[], 
    purpose: LLMAnalysisPurpose
  ): Promise<any> {
    try {
      this.logger.info(`使用LLM分析关键词(目的:${purpose})，共${suggestions.length}条建议`);
      
      // 根据分析目的选择不同的提示模板
      let promptTemplate = '';
      let promptData: any = {
        originalKeyword,
        suggestions: suggestions.slice(0, 100).join('\n') // 限制数量避免超token
      };
      
      switch(purpose) {
        case 'identify_categories':
          promptTemplate = 'identifyCategories';
          break;
        case 'generate_queries':
          promptTemplate = 'generateQueries';
          break;
        case 'evaluate_iteration':
          promptTemplate = 'evaluateIteration';
          promptData.iterationGoals = '发现具有商业价值的长尾关键词'; // 默认目标
          promptData.newKeywordsCount = suggestions.length;
          promptData.keywordSamples = suggestions.slice(0, 15).join('\n');
          break;
        case 'final_analysis':
          promptTemplate = 'finalReport';
          promptData.totalKeywords = suggestions.length;
          promptData.iterationCount = 1; // 默认值
          break;
        default:
          promptTemplate = 'generateQueries'; // 默认使用生成查询模板
      }
      
      // 编译提示
      const prompt = this.compilePrompt(promptTemplate, promptData);
      
      // 调用API
      const result = await this.callOpenAI(prompt);
      
      this.logger.info(`LLM分析完成(${purpose})`);
      return result;
    } catch (error) {
      this.logger.error(`LLM分析失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(
        `LLM分析失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.API,
        error
      );
    }
  }
  
  /**
   * 评估迭代质量
   */
  async evaluateIterationQuality(
    newKeywords: string[],
    previousKeywords: string[],
    originalKeyword: string,
    iterationGoals: string[]
  ): Promise<IterationEvaluation> {
    const promptData = {
      originalKeyword,
      iterationGoals: iterationGoals.join(', '),
      newKeywordsCount: newKeywords.length,
      keywordSamples: newKeywords.slice(0, 20).join('\n') // 提供样本以供评估
    };
    
    const prompt = this.compilePrompt('evaluateIteration', promptData);
    
    try {
      const result = await this.callOpenAI(prompt);
      
      // 计算加权分数
      const weightedScore = this.calculateWeightedScore(result.dimensions || {});
      
      return {
        dimensions: result.dimensions || {},
        overallScore: weightedScore,
        analysis: result.analysis || "",
        recommendContinue: weightedScore < 0.85, // 低于85%建议继续迭代
        improvementSuggestions: result.improvements || [],
        newKeywordsCount: newKeywords.length
      };
    } catch (error) {
      this.logger.error(`评估迭代质量失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回默认评估
      return {
        dimensions: {
          relevance: 7,
          longTailValue: 7,
          commercialValue: 6,
          diversity: 6,
          novelty: 6,
          searchVolumePotential: 6,
          goalAchievement: 6
        },
        overallScore: 0.65, // 中等分数
        analysis: "LLM评估失败，使用默认评估。",
        recommendContinue: true,
        improvementSuggestions: ["尝试使用更多商业意图词", "探索更多问题型关键词"],
        newKeywordsCount: newKeywords.length
      };
    }
  }
  
  /**
   * 计算加权评分
   */
  private calculateWeightedScore(dimensions: any): number {
    const weights = config.iterativeEngine.evaluationWeights;
    
    let totalScore = 0;
    let weightSum = 0;
    
    for (const [dimension, weight] of Object.entries(weights)) {
      if (dimensions[dimension] !== undefined) {
        totalScore += (dimensions[dimension] as number) * weight;
        weightSum += weight;
      }
    }
    
    // 如果所有维度都有评分，则weightSum应该等于1
    return weightSum > 0 ? totalScore / (weightSum * 10) : 0.5; // 除以10转换为0-1之间
  }
  
  /**
   * 生成下一轮迭代策略
   * 使用迭代历史进行更智能的规划
   */
  async generateNextIterationStrategy(
    originalKeyword: string,
    currentKeywords: string[],
    iterationHistory: IterationHistory[] = []
  ): Promise<AnalysisPlanResult> {
    try {
      this.logger.info(`生成下一轮迭代策略，考虑 ${iterationHistory.length} 轮历史数据`);

      // 准备历史迭代数据摘要
      const historySummary = this.prepareIterationHistorySummary(iterationHistory);

      // 准备提示数据
      const promptData = {
        originalKeyword,
        keywordCount: currentKeywords.length,
        keywordSamples: currentKeywords.slice(0, 20).join('\n'), // 提供样本
        currentIteration: iterationHistory.length,
        iterationHistory: historySummary,
        hasHistory: iterationHistory.length > 0
      };

      // 使用专门的历史感知提示模板
      const prompt = this.compilePrompt('nextIterationWithHistory', promptData);

      // 调用API
      const result = await this.callOpenAI(prompt);

      // 确保返回格式正确
      if (!result.recommendedQueries || !Array.isArray(result.recommendedQueries)) {
        throw new Error('LLM响应格式不正确，缺少推荐查询');
      }

      return {
        gaps: result.gaps || ["未指定"],
        patterns: result.patterns || ["未指定"],
        targetGoals: result.targetGoals || ["发现更多长尾关键词"],
        recommendedQueries: result.recommendedQueries.slice(0, 10) // 限制查询数量
      };
    } catch (error) {
      this.logger.error(`生成迭代策略失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(
        `生成迭代策略失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.API
      );
    }
  }

  /**
   * 准备迭代历史摘要
   * 将迭代历史转换为有用的提示输入
   */
  private prepareIterationHistorySummary(iterationHistory: IterationHistory[]): string {
    if (iterationHistory.length === 0) {
      return "无历史数据。";
    }

    let summary = "";
    
    // 创建每轮历史的摘要
    iterationHistory.forEach((iteration, index) => {
      // 查询和结果摘要
      summary += `\n迭代${iteration.iterationNumber} [${iteration.queryType}]:\n`;
      summary += `- 查询: "${iteration.query}"\n`;
      summary += `- 发现新关键词: ${iteration.newKeywordsCount} 个\n`;
      
      // 添加满意度评分（如果有）
      if (iteration.queryType === 'iteration') {
        summary += `- 满意度评分: ${iteration.satisfactionScore.toFixed(2)}/1.0\n`;
        
        // 添加评估维度（如果有）
        if (iteration.evaluationDimensions) {
          const dimensions = iteration.evaluationDimensions;
          summary += `- 评估维度: 相关性(${dimensions.relevance}/10), 长尾价值(${dimensions.longTailValue}/10), 商业价值(${dimensions.commercialValue}/10), 多样性(${dimensions.diversity}/10)\n`;
        }
      }
      
      // 添加使用的推荐查询（如果有）
      if (iteration.recommendedQueries && iteration.recommendedQueries.length > 0) {
        summary += `- 使用的推荐查询: ${iteration.recommendedQueries.slice(0, 3).join(', ')}${iteration.recommendedQueries.length > 3 ? '...' : ''}\n`;
      }
      
      // 添加分析摘要（如果有）
      if (iteration.analysis) {
        summary += `- 分析: ${iteration.analysis.substring(0, 100)}${iteration.analysis.length > 100 ? '...' : ''}\n`;
      }
      
      // 添加关键词样本
      if (iteration.keywords && iteration.keywords.length > 0) {
        summary += `- 关键词样本: ${iteration.keywords.slice(0, 5).join(', ')}${iteration.keywords.length > 5 ? '...' : ''}\n`;
      }
    });
    
    return summary;
  }
  
  /**
   * 生成最终关键词报告
   */
  async generateFinalKeywordReport(
    originalKeyword: string,
    allKeywords: string[],
    metadata: {
      iterationCount: number;
      satisfactionScores: Record<number, number>;
      iterationHistory?: IterationHistory[];
    }
  ): Promise<FinalReport> {
    try {
      this.logger.info(`生成最终关键词报告，分析 ${allKeywords.length} 个关键词`);
      
      // 准备历史迭代数据摘要（如果有）
      let historySummary = "";
      if (metadata.iterationHistory && metadata.iterationHistory.length > 0) {
        historySummary = this.prepareIterationHistorySummary(metadata.iterationHistory);
      }
      
      // 准备模板数据
      const promptData = {
        originalKeyword,
        totalKeywords: allKeywords.length,
        iterationCount: metadata.iterationCount,
        keywordSamples: allKeywords.slice(0, 50).join('\n'), // 提供样本
        hasHistory: !!historySummary,
        iterationHistory: historySummary
      };
      
      // 使用增强的最终报告模板
      const prompt = this.compilePrompt('finalReport', promptData);
      
      // 调用API
      const result = await this.callOpenAI(prompt);
      
      this.logger.info('最终报告生成完成');
      return result as FinalReport;
    } catch (error) {
      this.logger.error(`生成最终报告失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回基本报告
      return {
        categories: {
          informational: [],
          commercial: [],
          tutorial: [],
          problemSolving: [],
          definitional: []
        },
        topKeywords: allKeywords.slice(0, 15),
        intentAnalysis: { 
          primary: "信息查询", 
          secondary: "商业意图" 
        },
        contentOpportunities: ["创建基于这些关键词的内容"],
        commercialKeywords: [],
        summary: `共分析了${allKeywords.length}个关键词，涵盖多种搜索意图。`
      };
    }
  }
} 