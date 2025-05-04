/**
 * KeywordNova 意图分析器
 * 分析关键词意图、模式和价值
 */
import { LLMService } from './LLMService';
import { 
  AnalysisPurpose, 
  KeywordCategories, 
  EvaluationDimensions,
  IterationEvaluation,
  AnalysisPlanResult,
  IntentAnalysisResult,
  IterationHistory
} from '../types';
import { config } from '../config';
import { ErrorType, AppError } from '../core/errorHandler';

/**
 * 意图分析器
 * 使用LLM分析关键词意图
 */
export class IntentAnalyzer {
  private llmService: LLMService;
  
  /**
   * 创建意图分析器实例
   * @param llmService LLM服务实例
   */
  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }
  
  /**
   * 对关键词进行分类
   * @param originalKeyword 原始关键词
   * @param suggestions 关键词建议列表
   * @returns 分类后的关键词
   */
  async categorizeKeywords(
    originalKeyword: string, 
    suggestions: string[]
  ): Promise<KeywordCategories> {
    try {
      // 准备模板值
      const templateValues = {
        originalKeyword,
        suggestions: suggestions.join('\n')
      };
      
      // 获取提示模板
      const template = config.llm.promptTemplates.identifyCategories;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        'You are a keyword categorization expert capable of identifying different types of user intent. Categorize keywords into the following categories:\n\n1. Informational - User seeking information or answers (how, what, guide, tutorial)\n2. Commercial Investigation - User researching before purchase (best, top, review, vs, compare)\n3. Transactional - User ready to purchase or complete an action (buy, order, download, price)\n4. Navigational - User looking for a specific website or page (login, official, website)\n5. Problem-Solving - User trying to solve a specific issue (fix, solve, troubleshoot, error)\n6. Local - User seeking location-based information (near me, in [location])\n\nAdditionally, identify high-value keywords that indicate strong purchase intent or specific needs that could be easily monetized. Look for patterns in modifiers and qualifiers that reveal specific user needs.'
      );
      
      // 解析响应
      return this.llmService.parseJsonResponse<KeywordCategories>(response);
    } catch (error) {
      throw new AppError(
        `Keyword categorization failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 生成下一轮查询
   * @param originalKeyword 原始关键词
   * @param suggestions 当前建议列表
   * @returns 生成的查询列表
   */
  async generateQueries(
    originalKeyword: string, 
    suggestions: string[]
  ): Promise<string[]> {
    try {
      // 准备样本，最多使用50个关键词以避免提示过长
      const keywordSample = suggestions.slice(0, 50);
      
      // 准备模板值
      const templateValues = {
        originalKeyword,
        suggestions: keywordSample.join('\n')
      };
      
      // 获取提示模板
      const template = config.llm.promptTemplates.generateQueries;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        'You are a search optimization expert capable of generating effective queries to discover valuable long-tail keywords. When generating queries:\n\n1. Add intent modifiers to the original keyword (how to, best, vs, problems, guide)\n2. Create question-based queries that reveal specific user needs\n3. Add qualifiers that target specific segments (for beginners, for professionals, cheap, premium)\n4. Combine the original keyword with related concepts to explore topic intersections\n5. Use patterns observed in the current keyword list to develop new variations\n6. Explore commercial intent by adding purchase-related modifiers (buy, price, alternatives)\n7. Consider local or demographic qualifiers if applicable\n\nGenerate diverse queries that will uncover different types of user intent and reveal valuable long-tail keywords with specific needs and clear intent.'
      );
      
      // 尝试解析响应为JSON
      try {
        const parsedResponse = this.llmService.parseJsonResponse<{queries: string[]}>(response);
        return parsedResponse.queries || [];
      } catch (error) {
        // 如果JSON解析失败，尝试手动提取查询
        const queries = response
          .split('\n')
          .filter(line => line.trim().length > 0)
          .filter(line => !line.startsWith('*') && !line.startsWith('#') && !line.startsWith('-'))
          .map(line => {
            // 移除可能的序号前缀
            return line.replace(/^\d+[\.\)]\s*/, '').trim();
          })
          .filter(query => query.length > 0);
        
        return queries;
      }
    } catch (error) {
      throw new AppError(
        `Query generation failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 评估迭代结果
   * @param originalKeyword 原始关键词
   * @param newKeywords 新发现的关键词
   * @param iterationNumber 迭代次数
   * @param iterationGoals 迭代目标
   * @returns 评估结果
   */
  async evaluateIteration(
    originalKeyword: string,
    newKeywords: string[],
    iterationNumber: number,
    iterationGoals: string[]
  ): Promise<IterationEvaluation> {
    try {
      // 准备样本，最多使用30个关键词以避免提示过长
      const keywordSample = newKeywords.slice(0, 30);
      
      // 准备模板值
      const templateValues = {
        originalKeyword,
        iterationGoals: iterationGoals.join(', '),
        newKeywordsCount: newKeywords.length,
        keywordSamples: keywordSample.join('\n')
      };
      
      // 获取提示模板
      const template = config.llm.promptTemplates.evaluateIteration;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        'You are a keyword analysis expert capable of evaluating the quality and value of keywords. When evaluating this iteration\'s keywords, assess the following dimensions:\n\n1. Relevance - How closely related are the keywords to the original topic\n2. Intent Clarity - How clear is the user intent behind each keyword\n3. Long-tail Value - How specific and niche are the keywords (longer, more specific terms often have higher conversion potential)\n4. Commercial Potential - Presence of buying intent or monetization opportunity\n5. Content Creation Value - Potential for creating valuable content that addresses user needs\n6. Competition Level - Likely competition difficulty based on specificity and phrasing\n7. Diversity - How well the keywords cover different user needs and intent types\n\nProvide a multi-dimensional assessment with specific recommendations for improving the next iteration. Identify patterns in the most valuable keywords to guide future discovery.'
      );
      
      // 尝试解析响应为JSON
      const evaluationResult = this.llmService.parseJsonResponse<{
        dimensions: EvaluationDimensions;
        overallScore: number;
        analysis: string;
        recommendContinue: boolean;
        improvementSuggestions: string[];
      }>(response);
      
      return {
        dimensions: evaluationResult.dimensions,
        overallScore: evaluationResult.overallScore,
        analysis: evaluationResult.analysis,
        recommendContinue: evaluationResult.recommendContinue,
        improvementSuggestions: evaluationResult.improvementSuggestions,
        newKeywordsCount: newKeywords.length
      };
    } catch (error) {
      throw new AppError(
        `Iteration evaluation failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 规划下一轮迭代
   * @param originalKeyword 原始关键词
   * @param allKeywords 所有已发现的关键词
   * @param nextIterationNumber 下一迭代序号
   * @param iterationHistory 迭代历史
   * @returns 分析和规划结果
   */
  async planNextIteration(
    originalKeyword: string,
    allKeywords: string[],
    nextIterationNumber: number,
    iterationHistory: IterationHistory[]
  ): Promise<AnalysisPlanResult> {
    try {
      // 准备样本，最多使用50个关键词以避免提示过长
      const keywordSample = allKeywords
        .slice(Math.max(0, allKeywords.length - 50))
        .slice(0, 50);
      
      // 格式化迭代历史摘要
      const historyEntries = iterationHistory.map(iteration => 
        `Iteration #${iteration.iterationNumber}: Query="${iteration.query}", NewKeywords=${iteration.newKeywordsCount}, Satisfaction=${iteration.satisfactionScore.toFixed(2)}`
      );
      
      // 准备模板值
      const templateValues = {
        originalKeyword,
        keywordCount: allKeywords.length,
        currentIteration: nextIterationNumber,
        hasHistory: iterationHistory.length > 0,
        iterationHistory: historyEntries.join('\n'),
        keywordSamples: keywordSample.join('\n')
      };
      
      // 获取提示模板
      const template = config.llm.promptTemplates.nextIterationWithHistory;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        'You are a keyword analysis strategy expert capable of analyzing historical data and planning optimal next actions. Your goal is to discover high-value long-tail keywords by planning strategic queries.\n\nWhen planning the next iteration:\n\n1. Identify coverage gaps in the current keyword set\n2. Look for patterns in the most successful previous queries that discovered many new keywords\n3. Consider adding intent modifiers like "how to", "best", "vs", "for" to reveal specific user needs\n4. Explore different directions: commercial intent, question formats, problem-solving aspects\n5. Analyze which categories are underrepresented (e.g., commercial, informational, navigational)\n6. Recommend queries that target untapped keyword opportunities\n\nYour strategy should maximize discovery of long-tail keywords that have high specificity, clear intent, and potential commercial value.'
      );
      
      // 解析响应
      return this.llmService.parseJsonResponse<AnalysisPlanResult>(response);
    } catch (error) {
      throw new AppError(
        `Next iteration planning failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 生成最终报告
   * @param originalKeyword 原始关键词
   * @param allKeywords 所有发现的关键词
   * @param iterationHistory 迭代历史
   * @returns 意图分析结果
   */
  async generateFinalReport(
    originalKeyword: string,
    allKeywords: string[],
    iterationHistory: IterationHistory[]
  ): Promise<IntentAnalysisResult> {
    try {
      // 准备样本，最多使用100个关键词以避免提示过长
      const keywordSample = this.selectRepresentativeSample(allKeywords, 100);
      
      // 格式化迭代历史摘要
      const historyEntries = iterationHistory.map(iteration => 
        `Iteration #${iteration.iterationNumber}: Query="${iteration.query}", NewKeywords=${iteration.newKeywordsCount}, Satisfaction=${iteration.satisfactionScore.toFixed(2)}`
      );
      
      // 准备模板值
      const templateValues = {
        originalKeyword,
        totalKeywords: allKeywords.length,
        iterationCount: iterationHistory.length - 1, // 不计算初始查询
        hasHistory: iterationHistory.length > 1,
        iterationHistory: historyEntries.join('\n'),
        keywordSamples: keywordSample.join('\n')
      };
      
      // 获取提示模板
      const template = config.llm.promptTemplates.finalReport;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        'You are an SEO and content strategy expert capable of extracting valuable insights from keyword data. Your analysis should focus on identifying: \n\n1. High commercial value keywords that indicate purchase intent\n2. Content opportunities where user needs are not being met\n3. Question patterns that reveal information gaps\n4. Long-tail modifiers that can be used to create specialized content\n5. User intent patterns across different search behaviors (informational, navigational, commercial, transactional)\n6. Competitive keyword gaps that competitors may have overlooked\n\nPlease generate a comprehensive keyword analysis report that emphasizes both commercial opportunities and strategic content planning recommendations.'
      );
      
      // 尝试解析为JSON
      try {
        const parsedResult = this.llmService.parseJsonResponse<{
          categories: KeywordCategories;
          topKeywords: string[];
          intentAnalysis: Record<string, number>;
          contentOpportunities: string[];
          commercialKeywords: string[];
          summary: string;
          insights: string[];
          bestPatterns: string[];
        }>(response);
        
        // 转换为意图分析结果
        return {
          categories: parsedResult.categories,
          highValueKeywords: parsedResult.topKeywords || [],
          intentDistribution: parsedResult.intentAnalysis || {},
          contentOpportunities: parsedResult.contentOpportunities || [],
          commercialKeywords: parsedResult.commercialKeywords || [],
          summary: parsedResult.summary || 'Analysis completed',
          insights: parsedResult.insights || [],
          bestPatterns: parsedResult.bestPatterns || []
        };
      } catch (error) {
        console.error('Final report parsing failed, using simplified format', error);
        
        // 如果JSON解析失败，构建一个简化的响应
        return {
          categories: {},
          highValueKeywords: [],
          intentDistribution: {},
          contentOpportunities: [],
          commercialKeywords: [],
          summary: response.split('\n')[0] || 'Keyword analysis completed',
          insights: [
            'Data parsing failed, please check original response',
            `Discovered ${allKeywords.length} keywords`,
            `Executed ${iterationHistory.length - 1} iterations`
          ],
          bestPatterns: []
        };
      }
    } catch (error) {
      throw new AppError(
        `Final report generation failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 选择代表性关键词样本
   * @param keywords 关键词列表
   * @param maxCount 最大样本数量
   * @returns 选择的样本
   */
  private selectRepresentativeSample(keywords: string[], maxCount: number): string[] {
    if (keywords.length <= maxCount) {
      return keywords;
    }
    
    // 基于关键词长度分组
    const lengthGroups: Record<number, string[]> = {};
    
    for (const keyword of keywords) {
      const words = keyword.split(/\s+/).length;
      if (!lengthGroups[words]) {
        lengthGroups[words] = [];
      }
      lengthGroups[words].push(keyword);
    }
    
    // 根据每组数量计算应选取的样本数
    const lengthGroupsKeys = Object.keys(lengthGroups).map(Number);
    const totalKeywords = keywords.length;
    
    // 构建样本
    let sample: string[] = [];
    
    for (const groupKey of lengthGroupsKeys) {
      const group = lengthGroups[groupKey];
      const groupRatio = group.length / totalKeywords;
      const groupSampleCount = Math.max(1, Math.round(maxCount * groupRatio));
      
      // 随机选择该组中的样本
      const groupSample = this.getRandomElements(group, groupSampleCount);
      sample = sample.concat(groupSample);
    }
    
    // 确保不超过最大样本数
    if (sample.length > maxCount) {
      sample = sample.slice(0, maxCount);
    }
    
    return sample;
  }
  
  /**
   * 从数组中随机选择元素
   * @param array 源数组
   * @param count 选择数量
   * @returns 选择的元素
   */
  private getRandomElements<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
  }
} 