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
  LLMServiceOptions
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
   */
  async generateNextIterationStrategy(
    evaluation: IterationEvaluation,
    originalKeyword: string,
    currentKeywords: string[]
  ): Promise<AnalysisPlanResult> {
    try {
      // 识别弱项
      const dimensionEntries = Object.entries(evaluation.dimensions)
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.value - b.value);
      
      const weakestDimensions = dimensionEntries
        .slice(0, 2)
        .map(entry => entry.key);
      
      const promptData = {
        originalKeyword,
        evaluation: JSON.stringify(evaluation, null, 2),
        weakestDimensions: weakestDimensions.join(', '),
        keywordSamples: currentKeywords.slice(0, 15).join('\n')
      };
      
      const prompt = `基于以下关键词迭代评估，为下一轮迭代设计最优策略。

原始关键词: ${originalKeyword}
当前迭代评分: ${evaluation.overallScore.toFixed(2)}
需要改进的维度: ${weakestDimensions.join(', ')}
评估分析: ${evaluation.analysis}

当前关键词样本:
${currentKeywords.slice(0, 15).join('\n')}

请设计下一轮迭代策略，包括:
1. 3-5个具体的查询关键词，能弥补当前弱项
2. 每个查询的具体目标和预期
3. 应专注挖掘的子主题或角度
4. 应使用的查询修饰词(如问题词、商业词等)

以JSON格式返回完整策略，包含以下字段:
- gaps: 发现的关键词空缺(字符串数组)
- patterns: 识别的模式(字符串数组)
- targetGoals: 下一轮目标(字符串数组)
- recommendedQueries: 推荐的查询(字符串数组)`;
      
      const result = await this.callOpenAI(prompt);
      
      return {
        gaps: result.gaps || [],
        patterns: result.patterns || [],
        targetGoals: result.targetGoals || [],
        recommendedQueries: result.recommendedQueries || []
      };
    } catch (error) {
      this.logger.error(`生成迭代策略失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回基本策略
      return {
        gaps: ["商业意图关键词不足", "问题型关键词不足"],
        patterns: ["用户倾向于查询具体问题"],
        targetGoals: ["发现更多商业意图关键词", "探索更多问题型关键词"],
        recommendedQueries: [
          `${originalKeyword} 购买`,
          `${originalKeyword} 价格`,
          `${originalKeyword} 如何`,
          `${originalKeyword} 问题`
        ]
      };
    }
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
    }
  ): Promise<FinalReport> {
    try {
      const promptData = {
        originalKeyword,
        totalKeywords: allKeywords.length,
        iterationCount: metadata.iterationCount,
        keywordSamples: allKeywords.slice(0, 100).join('\n') // 提供前100个关键词
      };
      
      const prompt = this.compilePrompt('finalReport', promptData);
      const result = await this.callOpenAI(prompt);
      
      return {
        categories: result.categories || {},
        topKeywords: result.topKeywords || [],
        intentAnalysis: result.intentAnalysis || {},
        contentOpportunities: result.contentOpportunities || [],
        commercialKeywords: result.commercialKeywords || [],
        summary: result.summary || ""
      };
    } catch (error) {
      this.logger.error(`生成最终报告失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 返回基本报告
      return {
        categories: {
          informational: allKeywords.slice(0, 5),
          commercial: []
        },
        topKeywords: allKeywords.slice(0, 10),
        intentAnalysis: {},
        contentOpportunities: [],
        commercialKeywords: [],
        summary: "无法生成详细分析。请检查API密钥或重试。"
      };
    }
  }
} 