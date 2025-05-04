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
import { generateSessionId } from './sessionIdGenerator';

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
      
      // 使用统一的会话ID生成器（可选，此处保持为单次查询）
      const sessionId = generateSessionId('categorization', originalKeyword);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        sessionId, // 传入生成的会话ID
        'You are a keyword categorization expert capable of identifying different types of user intent. Categorize keywords into the following categories:\n\n1. Informational - User seeking information or answers (how, what, guide, tutorial)\n2. Commercial Investigation - User researching before purchase (best, top, review, vs, compare)\n3. Transactional - User ready to purchase or complete an action (buy, order, download, price)\n4. Navigational - User looking for a specific website or page (login, official, website)\n5. Problem-Solving - User trying to solve a specific issue (fix, solve, troubleshoot, error)\n6. Local - User seeking location-based information (near me, in [location])\n\nAdditionally, identify high-value keywords that indicate strong purchase intent or specific needs that could be easily monetized. Look for patterns in modifiers and qualifiers that reveal specific user needs.',
        true // 要求JSON响应
      );
      
      // 清理会话上下文（单次查询无需保留）
      this.llmService.clearSessionContext(sessionId);
      
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
      
      // 使用标准化的会话ID
      const sessionId = generateSessionId('query', originalKeyword);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        sessionId, // 使用生成的会话ID
        'You are a search optimization expert capable of generating effective queries to discover valuable long-tail keywords. When generating queries:\n\n1. Add intent modifiers to the original keyword (how to, best, vs, problems, guide)\n2. Create question-based queries that reveal specific user needs\n3. Add qualifiers that target specific segments (for beginners, for professionals, cheap, premium)\n4. Combine the original keyword with related concepts to explore topic intersections\n5. Use patterns observed in the current keyword list to develop new variations\n6. Explore commercial intent by adding purchase-related modifiers (buy, price, alternatives)\n7. Consider local or demographic qualifiers if applicable\n\nGenerate diverse queries that will uncover different types of user intent and reveal valuable long-tail keywords with specific needs and clear intent.',
        true // 要求JSON响应
      );
      
      // 清理会话（单次查询无需保留）
      this.llmService.clearSessionContext(sessionId);
      
      // 尝试解析响应为JSON
      try {
        // 使用通用解析方式
        const result = this.llmService.parseJsonResponse<any>(response);
        
        // 检查不同可能的结果结构
        let rawQueries: any[] = [];
        
        if (Array.isArray(result)) {
          // 如果直接返回了数组
          rawQueries = result;
        } else if (result.queries && Array.isArray(result.queries)) {
          // 标准格式 {queries: string[]}
          rawQueries = result.queries;
        } else if (result.recommendedQueries && Array.isArray(result.recommendedQueries)) {
          // 可能的替代格式 {recommendedQueries: string[]}
          rawQueries = result.recommendedQueries;
        } else if (result.suggestions && Array.isArray(result.suggestions)) {
          // 可能的替代格式 {suggestions: string[]}
          rawQueries = result.suggestions;
        } else {
          // 尝试从对象中提取字符串数组
          const possibleArrays = Object.values(result).filter(val => Array.isArray(val) && 
              val.length > 0);
          
          if (possibleArrays.length > 0) {
            // 使用第一个找到的数组
            rawQueries = possibleArrays[0] as any[];
          } else {
            // 找不到有效数组，返回空数组
            console.warn(`[INTENT_WARN] Could not find valid array in response`);
            return [];
          }
        }
        
        // 确保所有查询都是字符串
        let objectCount = 0;
        let usedField = "";
        let loggedSummary = false;
        
        const resultQueries = rawQueries.map(query => {
          // 如果不是字符串
          if (typeof query !== 'string') {
            objectCount++;
            // 尝试从对象中提取字符串值
            if (typeof query === 'object' && query !== null) {
              // 常见字段名称，按优先级排序
              const possibleFields = ['query', 'text', 'value', 'keyword', 'suggestion', 'q', 'term'];
              
              // 尝试从对象中提取字符串值
              for (const field of possibleFields) {
                if (query[field] && typeof query[field] === 'string') {
                  // 记录第一次找到的字段名称
                  if (objectCount === 1) {
                    usedField = field;
                  }
                  return query[field] as string;
                }
              }
              
              // 如果找不到特定字段，尝试JSON序列化
              try {
                console.warn(`[INTENT_WARN] 未能从对象提取字符串查询，尝试JSON序列化`);
                return JSON.stringify(query);
              } catch (e) {
                // 如果JSON序列化失败，使用默认值
                console.error(`[INTENT_ERROR] JSON序列化失败: ${(e as Error).message}`);
                return `${originalKeyword} query`;
              }
            } else {
              // 非对象非字符串，直接转换为字符串
              return String(query);
            }
          }
          return query;
        }).map(query => {
          // 添加一次性日志而不是每个元素单独日志
          if (objectCount > 0 && !loggedSummary) {
            console.info(`[INTENT_INFO] 转换了 ${objectCount} 个对象查询为字符串，使用字段: ${usedField}`);
            loggedSummary = true;
          }
          return query;
        });
        
        return resultQueries;
      } catch (error) {
        console.error(`[INTENT_ERROR] Failed to parse JSON response: ${(error as Error).message}`);
        
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
        keywordSamples: keywordSample.join('\n'),
        iterationNumber: iterationNumber // 添加迭代次数，帮助模型了解当前处于哪个阶段
      };
      
      // 获取提示模板
      const template = config.llm.promptTemplates.evaluateIteration;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送到LLM
      const response = await this.llmService.sendPrompt(
        prompt,
        undefined, // 不使用会话ID
        'You are a keyword analysis expert capable of evaluating the quality and value of keywords. When evaluating this iteration\'s keywords, assess the following dimensions:\n\n1. Relevance - How closely related are the keywords to the original topic\n2. Intent Clarity - How clear is the user intent behind each keyword\n3. Long-tail Value - How specific and niche are the keywords (longer, more specific terms often have higher conversion potential)\n4. Commercial Potential - Presence of buying intent or monetization opportunity\n5. Content Creation Value - Potential for creating valuable content that addresses user needs\n6. Competition Level - Likely competition difficulty based on specificity and phrasing\n7. Diversity - How well the keywords cover different user needs and intent types\n8. Domain Coverage - How well the keywords span across different industries, topics, or verticals\n9. Repetition Assessment - Measure and penalize excessive similarity or redundancy in keywords\n\nProvide a multi-dimensional assessment with specific recommendations for improving the next iteration. Identify patterns in the most valuable keywords to guide future discovery with emphasis on domain diversity.',
        true // 要求JSON响应
      );
      
      // 尝试解析响应为JSON
      const evaluationResult = this.llmService.parseJsonResponse<{
        dimensions: EvaluationDimensions;
        overallScore: number;
        analysis: string;
        recommendContinue: boolean;
        improvementSuggestions: string[];
      }>(response);
      
      // 确保所有必要的评分维度都存在
      if (!evaluationResult.dimensions.domainCoverage) {
        console.warn(`[评估] 警告：响应中缺少 domainCoverage 维度，使用默认值 5`);
        evaluationResult.dimensions.domainCoverage = 5;
      }
      
      if (!evaluationResult.dimensions.repetitionPenalty) {
        console.warn(`[评估] 警告：响应中缺少 repetitionPenalty 维度，使用默认值 0`);
        evaluationResult.dimensions.repetitionPenalty = 0;
      }
      
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
   * 规划下一轮迭代，使用会话上下文替代显式历史记录
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
    console.info(`[规划] 为迭代 #${nextIterationNumber} 生成查询策略，关键词: "${originalKeyword}", 已收集 ${allKeywords.length} 个关键词`);

    try {
      // 准备样本，最多使用100个关键词以避免提示过长
      const keywordSample = this.selectRepresentativeSample(allKeywords, 100);
      
      // 创建唯一的会话ID，使用标准化的生成器
      // 将迭代号作为后缀
      const sessionId = generateSessionId('iteration', originalKeyword, nextIterationNumber.toString());
      
      // 准备模板值，移除详细历史记录
      const templateValues = {
        originalKeyword,
        keywordCount: allKeywords.length,
        currentIteration: nextIterationNumber,
        keywordSamples: keywordSample.join('\n')
      };
      
      // 获取简化的提示模板
      const template = config.llm.promptTemplates.nextIterationSimplified;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送初始上下文消息
      // Send initial context message with iteration history summary
      let contextMessage = `We are planning iteration #${nextIterationNumber} for keyword "${originalKeyword}". `;
      
      if (iterationHistory.length > 0) {
        // 添加历史迭代的摘要信息
        const previousIterations = iterationHistory.map(iter => 
          `Iteration #${iter.iterationNumber}: Query "${iter.query}" found ${iter.newKeywordsCount} keywords, score: ${iter.satisfactionScore.toFixed(2)}`
        ).join('. ');
        
        contextMessage += `Previous iterations: ${previousIterations}. `;
      }
      
      contextMessage += `We currently have ${allKeywords.length} total keywords.`;
      
      // 发送上下文消息，利用增强的会话管理功能
      await this.llmService.sendPrompt(
        contextMessage,
        sessionId,
        'You are a keyword discovery strategist specialized in finding patterns and gaps in existing keyword collections. Your goal is to plan the next iteration of keyword queries to maximize new discoveries.',
        false,
        {
          temperature: 0.8, // 使用略高的温度以鼓励创新性
          language: 'en',   // 明确指定使用英文
          purpose: 'iteration_planning',
          originalKeyword: originalKeyword,
          iterationNumber: nextIterationNumber
        }
      );
      
      // 发送到LLM，传递会话ID以维持上下文
      const response = await this.llmService.sendPrompt(
        prompt,
        sessionId,
        'You are a keyword discovery strategist specialized in finding patterns and gaps in existing keyword collections. Your goal is to plan the next iteration of keyword queries to maximize new discoveries.',
        true,
        {
          temperature: 0.7, // 主要请求使用标准温度
          language: 'en'
        }
      );
      
      // 解析响应
      const planResult = this.llmService.parseJsonResponse<AnalysisPlanResult>(response);
      
      // 确保推荐查询都是字符串
      if (!planResult.recommendedQueries) {
        console.warn(`[规划] 警告: 响应中没有推荐查询，使用默认值`);
        planResult.recommendedQueries = [
          `${originalKeyword} how to`,
          `${originalKeyword} best`,
          `${originalKeyword} for beginners`,
          `${originalKeyword} vs`
        ];
      } else {
        // 修复：确保recommendedQueries中的每个元素都是字符串
        let objectCount = 0;
        let usedField = "";
        
        planResult.recommendedQueries = planResult.recommendedQueries.map(query => {
          // 如果不是字符串
          if (typeof query !== 'string') {
            objectCount++;
            // 尝试从对象中提取字符串值
            if (typeof query === 'object' && query !== null) {
              // 常见字段名称，按优先级排序
              const possibleFields = ['query', 'text', 'value', 'keyword', 'suggestion', 'q', 'term'];
              
              // 尝试从对象中提取字符串值
              for (const field of possibleFields) {
                if (query[field] && typeof query[field] === 'string') {
                  // 记录第一次找到的字段名称
                  if (objectCount === 1) {
                    usedField = field;
                  }
                  return query[field] as string;
                }
              }
              
              // 如果找不到特定字段，尝试JSON序列化
              try {
                console.warn(`[规划] 警告: 未能从对象提取字符串查询，尝试JSON序列化`);
                return JSON.stringify(query);
              } catch (e) {
                // 如果JSON序列化失败，使用默认值
                console.error(`[规划] 错误: JSON序列化失败: ${(e as Error).message}`);
                return `${originalKeyword} ${nextIterationNumber}`;
              }
            } else {
              // 非对象非字符串，直接转换为字符串
              return String(query);
            }
          }
          return query;
        });
        
        // 添加一个摘要日志，而不是为每个对象单独记录
        if (objectCount > 0) {
          console.info(`[规划] 转换了 ${objectCount} 个对象查询为字符串，使用字段: ${usedField}`);
        }
      }
      
      // 获取和记录会话信息，用于调试
      const sessionInfo = this.llmService.getSessionInfo(sessionId);
      if (sessionInfo.exists) {
        console.info(`[规划] 会话信息: ${sessionInfo.messageCount} 条消息, 最后活动: ${sessionInfo.lastUsedAt?.toISOString()}`);
      }
      
      // 完成后清理会话上下文，避免占用内存
      this.llmService.clearSessionContext(sessionId);
      
      console.info(`[规划] 成功生成 ${planResult.recommendedQueries.length} 个推荐查询`);
      return planResult;
    } catch (error) {
      console.error(`[规划] 错误: 规划失败: ${(error as Error).message}`);
      
      // 对于网络错误，提供更详细的信息
      if (error instanceof Error && 'code' in error) {
        console.error(`[规划] 网络错误: ${(error as any).code}`);
      }
      
      throw new AppError(
        `Next iteration planning failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 生成最终报告，使用会话上下文
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
      console.info(`[分析] 为 "${originalKeyword}" 生成最终分析报告，共 ${allKeywords.length} 个关键词`);
      
      // 准备样本，最多使用100个关键词以避免提示过长
      const keywordSample = this.selectRepresentativeSample(allKeywords, 100);
      
      // 创建一个新的唯一会话ID，使用标准化的生成器
      const sessionId = generateSessionId('report', originalKeyword);
      
      // 准备模板值，移除详细历史记录
      const templateValues = {
        originalKeyword,
        totalKeywords: allKeywords.length,
        iterationCount: iterationHistory.length - 1, // 不计算初始查询
        keywordSamples: keywordSample.join('\n')
      };
      
      // 获取简化的提示模板
      const template = config.llm.promptTemplates.finalReportSimplified;
      
      // 格式化提示
      const prompt = this.llmService.formatPrompt(template, templateValues);
      
      // 发送初始上下文信息
      // Build a comprehensive summary of all iterations to provide context
      let contextMessage = `We are generating a final analysis report for keyword "${originalKeyword}". `;
      contextMessage += `We have completed ${iterationHistory.length - 1} iterations and discovered ${allKeywords.length} keywords total. `;
      
      if (iterationHistory.length > 1) {
        // Add a summary of the most important iterations
        const iterationSummary = iterationHistory
          .filter(iter => iter.queryType === 'iteration') // Exclude the initial query
          .map(iter => 
            `Iteration #${iter.iterationNumber}: Query "${iter.query}" found ${iter.newKeywordsCount} keywords, score: ${iter.satisfactionScore.toFixed(2)}`
          )
          .join('. ');
        
        contextMessage += `Iteration summary: ${iterationSummary}.`;
      }
      
      // 发送上下文消息，利用增强的会话管理
      await this.llmService.sendPrompt(
        contextMessage,
        sessionId,
        'You are an SEO and content strategy expert capable of extracting valuable insights from keyword data. Your analysis should focus on identifying high commercial value keywords and content opportunities.',
        false,
        {
          temperature: 0.6, // 使用较低的温度以确保分析的准确性
          language: 'en',   // 明确指定使用英文
          purpose: 'final_report',
          originalKeyword: originalKeyword,
          iterationNumber: iterationHistory.length - 1
        }
      );
      
      // 发送到LLM，使用相同会话ID保持上下文
      const response = await this.llmService.sendPrompt(
        prompt,
        sessionId,
        'You are an SEO and content strategy expert capable of extracting valuable insights from keyword data. Your analysis should focus on identifying high commercial value keywords and content opportunities.',
        true,
        {
          temperature: 0.5,  // 使用较低的温度以获得更确定性的结果
          language: 'en'
        }
      );
      
      // 尝试解析为JSON
      try {
        // 使用LLMService的通用JSON解析方法
        const parsedResult = this.llmService.parseJsonResponse<any>(response);
        
        // 构建标准结果对象，使用灵活的字段映射
        const result: IntentAnalysisResult = {
          categories: this.extractField(parsedResult, ['categories', 'keywordCategories', 'category', 'categoryMap'], {}),
          highValueKeywords: this.extractArrayField(parsedResult, ['highValueKeywords', 'topKeywords', 'top_keywords', 'valueKeywords', 'recommendedKeywords']),
          intentDistribution: this.extractField(parsedResult, ['intentDistribution', 'intentAnalysis', 'intents', 'intent_distribution'], {}),
          contentOpportunities: this.extractArrayField(parsedResult, ['contentOpportunities', 'content_opportunities', 'contentIdeas', 'contentGaps']),
          commercialKeywords: this.extractArrayField(parsedResult, ['commercialKeywords', 'commercial_keywords', 'transactionalKeywords', 'highConversionKeywords']),
          summary: this.extractField(parsedResult, ['summary', 'overview', 'conclusion'], 'Analysis completed.'),
          insights: this.extractArrayField(parsedResult, ['insights', 'keyInsights', 'key_insights', 'findings']),
          bestPatterns: this.extractArrayField(parsedResult, ['bestPatterns', 'best_patterns', 'effectivePatterns', 'effective_patterns', 'topPatterns']),
          // 新增字段
          domainDistribution: this.extractField(parsedResult, ['domainDistribution', 'domain_distribution', 'industryDistribution', 'domains'], {}),
          underrepresentedDomains: this.extractArrayField(parsedResult, ['underrepresentedDomains', 'underrepresented_domains', 'gapDomains', 'missingDomains']),
          diversityAnalysis: this.extractField(parsedResult, ['diversityAnalysis', 'diversity_analysis', 'diversityAssessment'], {})
        };
        
        // 获取和记录会话信息，用于调试
        const sessionInfo = this.llmService.getSessionInfo(sessionId);
        if (sessionInfo.exists) {
          console.info(`[分析] 会话信息: ${sessionInfo.messageCount} 条消息, 最后活动: ${sessionInfo.lastUsedAt?.toISOString()}`);
        }
        
        // 导出会话上下文，便于将来分析或调试
        const sessionExport = this.llmService.exportSessionContext(sessionId);
        if (sessionExport) {
          console.info(`[分析] 会话导出: ${sessionExport.messages.length} 条消息`);
        }
        
        // 会话完成后清理，避免占用内存
        this.llmService.clearSessionContext(sessionId);
        
        console.info(`[分析] 最终报告生成完成，包含 ${result.highValueKeywords.length} 个高价值关键词和 ${Object.keys(result.domainDistribution || {}).length} 个领域分布`);
        return result;
      } catch (error) {
        console.error(`[分析] 错误: 解析报告失败: ${(error as Error).message}`);
        
        // 清理会话上下文
        this.llmService.clearSessionContext(sessionId);
        
        // 如果JSON解析失败，构建一个简化的响应
        return {
          categories: {},
          highValueKeywords: [],
          intentDistribution: {},
          contentOpportunities: [],
          commercialKeywords: [],
          summary: this.extractSummaryFromText(response) || `Analyzed ${allKeywords.length} keywords for "${originalKeyword}"`,
          insights: [
            `JSON parsing failed: ${(error as Error).message}`,
            `Discovered ${allKeywords.length} keywords over ${iterationHistory.length - 1} iterations`
          ],
          bestPatterns: [],
          // 新增字段的默认值
          domainDistribution: {},
          underrepresentedDomains: [],
          diversityAnalysis: {}
        };
      }
    } catch (error) {
      console.error(`[分析] 错误: 生成报告失败: ${(error as Error).message}`);
      throw new AppError(
        `Final report generation failed: ${(error as Error).message}`,
        ErrorType.API,
        error as Error
      );
    }
  }
  
  /**
   * 选择代表性样本
   * 确保样本多样性，混合长尾词、商业词和不同模式的关键词
   * @param keywords 所有关键词
   * @param maxCount 最大数量
   * @returns 样本数组
   */
  private selectRepresentativeSample(keywords: string[], maxCount: number): string[] {
    if (keywords.length <= maxCount) {
      return [...keywords];
    }
    
    // 确保样本多样性，混合不同类型的关键词
    const result: string[] = [];
    
    // 保留部分最长的关键词（可能是长尾词）
    const longestKeywords = [...keywords].sort((a, b) => b.length - a.length);
    const longTailSample = longestKeywords.slice(0, Math.floor(maxCount * 0.25));
    result.push(...longTailSample);
    
    // 保留部分可能商业性强的关键词（含特定词的）
    const commercialIndicators = ['best', 'buy', 'price', 'cheap', 'deal', 'vs', 'compare', 'top', 'review'];
    const commercialKeywords = keywords.filter(keyword => 
      commercialIndicators.some(indicator => keyword.toLowerCase().includes(indicator))
    );
    const commercialSample = this.getRandomElements(
      commercialKeywords,
      Math.min(Math.floor(maxCount * 0.25), commercialKeywords.length)
    );
    result.push(...commercialSample);
    
    // 保留部分无修饰的基础关键词（可能是核心词）
    const baseKeywords = keywords.filter(keyword => keyword.split(' ').length <= 2);
    const baseSample = this.getRandomElements(
      baseKeywords,
      Math.min(Math.floor(maxCount * 0.15), baseKeywords.length)
    );
    result.push(...baseSample);
    
    // 添加一些随机关键词填充余下的空间
    // 排除已经添加的关键词
    const alreadyAdded = new Set(result);
    const remainingKeywords = keywords.filter(keyword => !alreadyAdded.has(keyword));
    const randomSample = this.getRandomElements(
      remainingKeywords,
      Math.min(maxCount - result.length, remainingKeywords.length)
    );
    result.push(...randomSample);
    
    console.debug(`[分析] 从 ${keywords.length} 个关键词中选择了 ${result.length} 个代表性样本`);
    return result;
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
  
  /**
   * 从对象中提取字段，支持多个可能的字段名
   * @param obj 源对象
   * @param fieldNames 可能的字段名数组
   * @param defaultValue 默认值
   * @returns 提取的字段值或默认值
   */
  private extractField<T>(obj: any, fieldNames: string[], defaultValue: T): T {
    if (!obj || typeof obj !== 'object') return defaultValue;
    
    for (const fieldName of fieldNames) {
      if (obj[fieldName] !== undefined) {
        return obj[fieldName] as T;
      }
    }
    
    return defaultValue;
  }
  
  /**
   * 从对象中提取数组字段
   * @param obj 源对象
   * @param fieldNames 可能的字段名数组
   * @returns 字符串数组
   */
  private extractArrayField(obj: any, fieldNames: string[]): string[] {
    const result = this.extractField<any>(obj, fieldNames, []);
    
    // 确保返回的是字符串数组
    if (Array.isArray(result)) {
      return result.map(item => typeof item === 'string' ? item : String(item)).filter(Boolean);
    }
    
    return [];
  }
  
  /**
   * 从纯文本响应中提取摘要
   * @param text 文本响应
   * @returns 提取的摘要
   */
  private extractSummaryFromText(text: string): string | null {
    // 尝试找到第一行非空文本作为摘要
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    if (lines.length > 0) {
      // 使用第一行，但限制长度
      return lines[0].substring(0, 200);
    }
    
    return null;
  }
} 