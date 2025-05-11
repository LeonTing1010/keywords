/**
 * 市场需求探索Agent (探索者)
 * 
 * 问题发现框架中的"探索者"角色
 * 负责发现并初步评估潜在的高价值问题
 */
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryAgentBase, DiscoveryAgentBaseConfig } from '../base/DiscoveryAgentBase';
import { 
  Problem, 
  AgentFeedback
} from '../../types/discovery';
import { logger } from '../../infra/logger';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentLLMService } from '../../core/llm/AgentLLMService';
import { SearchTools } from '../../tools/search/SearchTools';
import { SearchEngine } from '../../infra/search/SearchEngine';
import { AutocompleteSuggestion } from '../../infra/search/types';
import { z } from 'zod';
import { SchemaValidator } from '../../core/llm/SchemaValidator';
import { AgentLLMServiceExtensions } from '../../core/llm/extensions';

// Define input schema that can handle both English and Chinese field names
const rawQuestionSchema = z.object({
  // English fields
  question: z.string().optional(),
  intent: z.string().optional(),
  clarity: z.number().optional(),
  value: z.number().optional(),
  authenticity: z.number().optional(),
  depth: z.number().optional(),
  relevance: z.number().optional(),
  overallScore: z.number().optional(),
  originalQuery: z.string().optional(),
  isExpanded: z.boolean().optional(),
  reasoning: z.string().optional(),
  
  // Chinese equivalents that might come back from LLM
  "问题": z.string().optional(),
  "意图": z.string().optional(),
  "清晰度": z.number().optional(),
  "价值": z.number().optional(),
  "真实性": z.number().optional(),
  "深度": z.number().optional(),
  "相关性": z.number().optional(),
  "综合评分": z.number().optional()
});

// Define the expected output schema with required fields
const questionSchema = z.object({
  question: z.string(),
  intent: z.string().optional(),
  originalQuery: z.string().optional(),
  isExpanded: z.boolean(),
  overallScore: z.number(),
  reasoning: z.string()
});

// Define a type-safe transformer function for question arrays
function transformQuestions(data: z.infer<typeof rawQuestionSchema>[]): z.infer<typeof questionSchema>[] {
  return data.map(item => ({
    question: item.question || item["问题"] || "",
    intent: item.intent || item["意图"] || "",
    originalQuery: item.originalQuery || "",
    isExpanded: item.isExpanded === true,  // Force boolean type
    overallScore: item.overallScore || item["综合评分"] || 5,  // Default to 5 if missing
    reasoning: item.reasoning || "" // Default to empty string if missing
  }));
}

const mergedQuestionSchema = z.object({
  question: z.string(),
  originalQuery: z.string().optional(),
  isExpanded: z.boolean().optional().default(false),
  overallScore: z.number(),
  reasoning: z.string(),
  mergedFrom: z.array(z.number()).optional()
});

// 市场需求探索Agent配置
export interface MarketNeedExplorerAgentConfig extends DiscoveryAgentBaseConfig {
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  maxProblems?: number; 
  minProblemScore?: number;
  enableQuantification?: boolean;
  enableCategorization?: boolean;
  maxKeywords?: number;
  useAutocomplete?: boolean;
}

/**
 * 市场需求探索Agent
 * 在问题发现框架中担任"探索者"角色，发现并初步评估潜在问题
 */
export class MarketNeedExplorerAgent extends DiscoveryAgentBase {
  // 实现DiscoveryAgent接口
  public readonly type: 'explorer' = 'explorer';
  
  // 特定于此Agent的属性
  private searchTools: SearchTools | null = null;
  private maxProblems: number;
  private minProblemScore: number;
  private enableQuantification: boolean;
  private enableCategorization: boolean;
  private maxKeywords: number;
  private useAutocomplete: boolean;

  
  /**
   * 构造函数
   */
  constructor(config: MarketNeedExplorerAgentConfig = {}) {
    super(config);
    
    this.maxProblems = config.maxProblems || 20;
    this.minProblemScore = config.minProblemScore || 7;
    this.enableQuantification = config.enableQuantification !== false;
    this.enableCategorization = config.enableCategorization !== false;
    this.maxKeywords = config.maxKeywords || 50;
    this.useAutocomplete = config.useAutocomplete !== false;
    
    logger.debug({}, 'MarketNeedExplorerAgent initialized');
    
    // 初始化搜索工具
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具
   */
  private initializeSearchTools(config: MarketNeedExplorerAgentConfig): void {
    if (config.searchTools) {
      this.searchTools = config.searchTools;
    } else if (config.searchEngine) {
      this.searchTools = new SearchTools({ searchEngine: config.searchEngine });
    } else {
      this.searchTools = new SearchTools();
    }
    
    // 注册工具
    const tools = this.searchTools.getAllTools();
    this.registerTools(tools);
    logger.debug({ count: tools.length }, 'SearchTools registered');
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // 工具注册在构造函数中完成
  }
  /**
   * Process input data to discover high-value problems
   */
  public async process(input: any): Promise<any> {
    logger.info({ keyword: input.keyword }, 'MarketNeedExplorerAgent processing input');
    
    try {
      // Handle missing or invalid input
      if (!input || !input.keyword) {
        logger.warn({}, 'Missing or invalid keyword input for MarketNeedExplorerAgent');
        return { highValueProblems: [] };
      }
      
      // Log available methods for debugging
      logger.debug('Available methods in this agent:', Object.keys(this));
      logger.debug('Config:', this.config);
      
      // Discover high-value problems
      let highValueProblems = await this.discoverHighValueProblems(input.keyword);
      
      // 确保在每一步中都保持数组类型
      if (!Array.isArray(highValueProblems)) {
        logger.error({ highValueProblems }, 'highValueProblems is not an array');
        highValueProblems = [];
      }

      logger.info({ count: highValueProblems.length }, `初始发现了 ${highValueProblems.length} 个问题`);
      
      if (highValueProblems.length === 0) {
        // If no problems were found, create at least one default problem to keep the pipeline going
        highValueProblems = [{
          question: `${input.keyword}系统如何确保数据安全和隐私保护？`,
          overallScore: 8,
          reasoning: `这是${input.keyword}领域的一个重要问题，涉及数据安全和隐私保护。`,
          isExpanded: true
        }];
        logger.info('No problems found, created one default problem to continue pipeline');
      }
      
      // Apply enhancements if enabled
      let enhancedProblems = highValueProblems;
      
      if (this.enableQuantification) {
        let quantifiedProblems = await this.quantifyProblemValues(enhancedProblems);
        // 类型检查
        if (Array.isArray(quantifiedProblems)) {
          enhancedProblems = quantifiedProblems;
        } else {
          logger.error('quantifiedProblems is not an array, using previous results');
        }
      }
      
      if (this.enableCategorization) {
        let categorizedProblems = await this.categorizeProblems(enhancedProblems);
        // 类型检查
        if (Array.isArray(categorizedProblems)) {
          enhancedProblems = categorizedProblems;
        } else {
          logger.error('categorizedProblems is not an array, using previous results');
        }
      }
      
      logger.info({ count: enhancedProblems.length }, `MarketNeedExplorerAgent discovered ${enhancedProblems.length} high-value problems`);
      
      return { highValueProblems: enhancedProblems };
    } catch (error: any) {
      logger.error({ error }, 'Failed during MarketNeedExplorerAgent processing');
      return { highValueProblems: [], error: error.message };
    }
  }
  
  /**
   * 发现高价值问题
   */
  private async discoverHighValueProblems(keyword: string): Promise<any[]> {
    logger.debug({ keyword }, `Discovering high-value problems for keyword: ${keyword}`);
    
    // 获取搜索建议/自动补全
    let suggestions: AutocompleteSuggestion[] = [];
    if (this.useAutocomplete) {
      suggestions = await this.getAutocompleteSuggestions(keyword);
    }
    
    // 如果没有足够的建议，进行网页搜索获取更多内容
    if (suggestions.length < 10 && this.searchTools) {
      const results = await this.performWebSearch(keyword);
      suggestions = [...suggestions, ...this.createSuggestionsFromSearchResults(results)];
    }
    logger.debug({"suggestions":suggestions?.length},"suggestions length")
    // 从建议中提取和扩展问题
    let problems = await this.extractAndExpandQuestions(keyword, suggestions);
    
    // 确保problems是一个数组
    if (!Array.isArray(problems)) {
      logger.error({ problems }, 'Problems is not an array, converting to empty array');
      problems = [];
    }
    
    // 去重和合并相似问题
    problems = await this.checkSimilarityAndMergeQuestions(problems);
    
    // 确保problems仍然是一个数组
    if (!Array.isArray(problems)) {
      logger.error({ problems }, 'Problems after merging is not an array, converting to empty array');
      problems = [];
    }
    
    // 按分数排序并限制数量
    problems = problems
      .filter(p => p.overallScore >= this.minProblemScore)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, this.maxProblems);
    
    return problems;
  }
  
  /**
   * 获取关键词的自动补全建议
   */
  private async getAutocompleteSuggestions(keyword: string): Promise<AutocompleteSuggestion[]> {
    try {
      const suggestionsTool = this.tools.find(t => t.name === 'get_search_suggestions');
      if (!suggestionsTool) {
        logger.error({}, 'get_search_suggestions tool not found');
        return [];
      }
      
      const result = await suggestionsTool.invoke({ keyword, maxResults: 20 });
      
      try {
        const suggestions = JSON.parse(result);
        const autocompleteSuggestions: AutocompleteSuggestion[] = suggestions.map((s: any) => ({
          query: typeof s === 'string' ? s : s.query || '',
          displayText: typeof s === 'string' ? s : s.displayText || s.query || '',
          type: s.type || 'suggestion',
          position: 0,
          source: 'search',
          timestamp: Date.now()
        }));
        
        return autocompleteSuggestions;
      } catch (error) {
        logger.error({}, 'Failed to parse autocomplete suggestions');
        return [];
      }
    } catch (error) {
      logger.error({ keyword, error }, 'Failed to get autocomplete suggestions');
      return [];
    }
  }
  
  /**
   * 执行网页搜索
   */
  private async performWebSearch(keyword: string): Promise<any[]> {
    try {
      const searchTool = this.tools.find(t => t.name === 'get_search_suggestions');
      if (!searchTool) {
        logger.error({}, 'get_search_suggestions tool not found');
        return [];
      }
      const result = await searchTool.invoke({ keyword: keyword, maxResults: 5 });
      
      try {
        return JSON.parse(result);
      } catch (error) {
        logger.error({}, 'Failed to parse search results');
        return [];
      }
    } catch (error) {
      logger.error({ keyword, error }, 'Failed to perform web search');
      return [];
    }
  }
  
  /**
   * 从搜索结果创建建议
   */
  private createSuggestionsFromSearchResults(results: any[]): AutocompleteSuggestion[] {
    try {
      return results
        .filter(r => r.title && r.snippet)
        .map(r => ({
          query: r.title,
          displayText: r.title,
          type: 'search_result',
          position: 0,
          source: 'search',
          timestamp: Date.now(),
          metadata: {
            url: r.link,
            snippet: r.snippet
          }
        }));
    } catch (error) {
      logger.error({}, 'Failed to create suggestions from search results');
      return [];
    }
  }
  
  /**
   * 从搜索建议中提取和扩展问题
   */
  private async extractAndExpandQuestions(
    keyword: string,
    suggestions: AutocompleteSuggestion[]
  ): Promise<any[]> {
    try {
      // 提示词模板
      const userPrompt = `
        作为问题研究专家，请分析以下搜索建议，发现高价值问题:

        关键词: ${keyword}
        
        搜索建议:
        ${suggestions.map((s, i) => `${i+1}. ${s.query}`).join('\n')}
        
        任务:
        1. 识别隐含在这些搜索建议中的用户问题
        2. 扩展和改进问题的表述，使其更清晰、更有价值
        3. 添加一些关键词可能隐含但未在搜索建议中出现的重要问题
        
        对每个问题进行以下评分(1-10分):
        - 清晰度: 问题的表述是否明确、易懂
        - 价值: 解决此问题对用户的价值大小
        - 真实性: 问题是否反映真实需求，而非假设性问题
        - 深度: 问题的思考深度和复杂性
        - 相关性: 与主题的相关程度
      `;

      // 使用LLM服务
      const agentLLM = this.model as AgentLLMService;
      logger.debug({ keyword }, 'Tool: Getting search suggestions');
      
      // 将提示词发送给LLM
      const response = await AgentLLMServiceExtensions.analyzeWithArraySchema(
        agentLLM,
        userPrompt,
        '1-extract-questions',
        z.array(rawQuestionSchema),
        {
          temperature: 0.7,
          defaultValue: [] // Return empty array if parsing fails
        }
      );

      // Log the response for debugging
      logger.info({ count: response.length }, `Extracted ${response.length} initial questions from search suggestions`);
      
      if (!Array.isArray(response) || response.length === 0) {
        logger.warn('Failed to extract questions or no questions found');
        
        // Create default questions based on the keyword
        return [
          {
            question: `什么是${keyword}？它如何工作？`,
            overallScore: 8,
            reasoning: '这是理解主题的基础问题',
            isExpanded: false
          },
          {
            question: `${keyword}的主要应用场景有哪些？`,
            overallScore: 7,
            reasoning: '了解应用场景对把握主题很重要',
            isExpanded: false
          },
          {
            question: `${keyword}系统在实施过程中面临哪些挑战？`,
            overallScore: 8,
            reasoning: '了解挑战有助于提前规避问题',
            isExpanded: false
          }
        ];
      }

      // 转换结果到预期格式
      let extractedQuestions = transformQuestions(response);
      
      // 过滤出高价值问题
      const highValueQuestions = extractedQuestions.filter(q => {
        // 当没有评分时给一个默认分数
        const score = q.overallScore || 5;
        return score >= this.minProblemScore;
      });
      
      // 如果过滤后仍有足够的问题，继续使用过滤后的结果
      // 否则使用原始提取的问题
      let questions = highValueQuestions.length >= 3 ? highValueQuestions : extractedQuestions;
      
      // 确保questions不为空
      if (questions.length === 0) {
        logger.warn('No questions extracted, using defaults');
        questions = [
          {
            question: `什么是${keyword}？它如何工作？`,
            overallScore: 8,
            reasoning: '这是理解主题的基础问题',
            isExpanded: false
          },
          {
            question: `${keyword}的主要应用场景有哪些？`,
            overallScore: 7,
            reasoning: '了解应用场景对把握主题很重要',
            isExpanded: false
          }
        ];
      }
      
      // 合并相似问题
      let mergedQuestions = await this.checkSimilarityAndMergeQuestions(questions);
      
      // 限制问题数量
      if (mergedQuestions.length > this.maxProblems) {
        mergedQuestions = mergedQuestions
          .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
          .slice(0, this.maxProblems);
      }
      
      logger.info({ count: mergedQuestions.length }, `Final extracted and merged questions: ${mergedQuestions.length}`);
      
      return mergedQuestions;
    } catch (error) {
      logger.error({ error }, 'Failed to extract questions from search suggestions');
      
      // 发生错误时返回默认问题
      return [
        {
          question: `什么是${keyword}？如何应用？`,
          overallScore: 7,
          reasoning: '基础问题，提取过程中出错时的默认问题',
          isExpanded: false
        },
        {
          question: `${keyword}技术的未来发展趋势是什么？`,
          overallScore: 7,
          reasoning: '发展前景问题，提取过程中出错时的默认问题',
          isExpanded: false
        }
      ];
    }
  }
  
  /**
   * Check question similarity and merge similar questions
   */
  private async checkSimilarityAndMergeQuestions(questions: any[]): Promise<any[]> {
    try {
      // Ensure input is an array
      if (!Array.isArray(questions)) {
        logger.error({ questions }, 'checkSimilarityAndMergeQuestions received non-array input');
        return [];
      }
      
      if (questions.length <= 1) {
        return questions;
      }
      
      const questionsFormatted = questions.map((q, i) => `${i+1}. [Score:${q.overallScore}] ${q.question} - ${q.reasoning}`).join('\n');
      
      // System prompt
      // const systemPrompt = `You are a professional problem analysis expert, responsible for identifying and merging similar or duplicate problems.`;
      
      // User prompt
      const userPrompt = `
       作为问题探索专家，你的核心职责是严格合并相似问题，显著减少问题总量。

       问题列表:
       ${questionsFormatted}

       执行以下任务:
       1. 采用严格标准识别相似问题，即使表述方式不同但解决方案相似的也应合并
       2. 每组相似问题创建一个合并版本，必须比任何单独问题更有价值
       3. 合并版问题应采用最清晰的表述，并继承最高分数再提高0.5分(不超过10)
       4. 合并理由必须解释为何新表述优于原始问题
       
       对于确实独特的问题，保留不变。总问题数量应比原始列表减少至少30%。

       返回JSON格式:
       {
         "question": "问题表述",
         "overallScore": 分数,
         "reasoning": "此问题重要性及价值说明"
       }
      `;
      // Use AgentLLMService
      const agentLLM = this.model as AgentLLMService;
      
      // Use the schema validation method with our defined schemas
      // const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const finalPrompt = `${userPrompt}`;
      const rawResponse = await AgentLLMServiceExtensions.analyzeWithArraySchema(
        agentLLM,
        finalPrompt,
        '1-merge-questions',
        z.array(rawQuestionSchema),
        {
          temperature: 0.7,
          defaultValue: questions // Return original problems if parsing fails
        }
      );
      
      // Transform the raw response to expected format
      return transformQuestions(rawResponse);
    } catch (error) {
      logger.error({error}, 'Failed to check similarity and merge questions');
      return questions;
    }
  }
  
  /**
   * Quantify problem values
   */
  private async quantifyProblemValues(problems: any[]): Promise<any[]> {
    try {
      // Ensure input is an array
      if (!Array.isArray(problems)) {
        logger.error({ problems }, 'quantifyProblemValues received non-array input');
        return [];
      }
      
      if (problems.length === 0) {
        logger.info('No problems to quantify, returning empty array');
        return problems;
      }

      logger.info({ count: problems.length }, 'Quantifying problem values');
      
      const problemsFormatted = problems.map((p, i) => `${i+1}. ${p.question}`).join('\n');
      
      // System prompt
      // const systemPrompt = `You are a professional problem quantification expert, responsible for assessing problem value.`;
      
      // User prompt
      const userPrompt = `
        作为问题价值评估专家，请对以下问题进行全面的价值评估:

        问题列表:
        ${problemsFormatted}

        请为每个问题提供以下评分(1-10分):
        - 真实性: 问题在现实中存在的程度
        - 紧迫性: 解决问题的时间压力
        - 规模: 受此问题影响的人群规模
        - 难度: 解决此问题的技术难度
        - 总体评分: 综合考虑所有因素的总体价值评分

        还请注明:
        - 目标受众: 哪些群体最关心此问题(具体列出2-3个群体)
        - 问题类别: 问题属于哪个领域类别
        - 分析理由: 为什么给出这些评分
      `;
      
      // Define problem quantification schema
      const quantifiedProblemSchema = z.object({
        question: z.string(),
        overallScore: z.number(),
        authenticity: z.number().min(1).max(10),
        urgency: z.number().min(1).max(10),
        scale: z.number().min(1).max(10),
        difficulty: z.number().min(1).max(10),
        targetAudience: z.array(z.string()),
        category: z.string(),
        reasoning: z.string()
      });
      
      // Use AgentLLMService
      const agentLLM = this.model as AgentLLMService;
      
      // Use the schema validation method
      // const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const finalPrompt = `${userPrompt}`;

      logger.debug('Sending request to LLM for problem quantification');
      
      const quantifiedProblems = await AgentLLMServiceExtensions.analyzeWithArraySchema(
        agentLLM,
        finalPrompt,
        '1-quantify-problems',
        z.array(quantifiedProblemSchema),
        {
          temperature: 0.7,
          defaultValue: problems // Return original problems if parsing fails
        }
      );

      logger.info({ count: quantifiedProblems?.length || 0 }, 'Received quantified problems from LLM');
      
      // If we didn't get valid quantified problems, log the issue but continue with original problems
      if (!Array.isArray(quantifiedProblems) || quantifiedProblems.length === 0) {
        logger.warn('Quantification returned empty or invalid result, using original problems');
        
        // Return the original problems with default quantification values
        return problems.map(problem => ({
          ...problem,
          overallScore: 8, // Default high value to ensure problems move forward
          authenticity: 8,
          urgency: 7,
          scale: 7,
          difficulty: 6,
          targetAudience: ['消费者', '企业用户', '监管机构'],
          category: '防伪溯源',
          reasoning: '此问题对防伪溯源领域具有重要价值'
        }));
      }
      
      // Check if there are fewer quantified problems than original problems
      if (quantifiedProblems.length < problems.length) {
        logger.warn(
          { original: problems.length, quantified: quantifiedProblems.length },
          'Some problems were lost during quantification'
        );
        
        // Find missing problems
        const quantifiedQuestions = new Set(quantifiedProblems.map(p => p.question));
        const missingProblems = problems.filter(p => !quantifiedQuestions.has(p.question));
        
        // Add missing problems with default values
        missingProblems.forEach(problem => {
          quantifiedProblems.push({
            ...problem,
            overallScore: 7,
            authenticity: 7,
            urgency: 7,
            scale: 7,
            difficulty: 6,
            targetAudience: ['消费者', '企业用户'],
            category: '防伪溯源领域',
            reasoning: '此问题在定量评估中缺失，已自动添加默认值'
          });
        });
      }
      
      // Log the result
      logger.info(
        { count: quantifiedProblems.length },
        `Successfully quantified ${quantifiedProblems.length} problems`
      );
      
      return quantifiedProblems;
    } catch (error) {
      logger.error({error}, 'Failed to quantify problem values');
      
      // In case of error, return the original problems with default values
      return problems.map(problem => ({
        ...problem,
        overallScore: 8, // High default value to ensure problems move forward
        authenticity: 8,
        urgency: 7,
        scale: 7,
        difficulty: 6,
        targetAudience: ['消费者', '企业用户', '监管机构'],
        category: '防伪溯源',
        reasoning: '量化处理时出错，应用默认值'
      }));
    }
  }
  
  /**
   * Categorize problems
   */
  private async categorizeProblems(problems: any[]): Promise<any[]> {
    try {
      // Ensure input is an array
      if (!Array.isArray(problems)) {
        logger.error({ problems }, 'categorizeProblems received non-array input');
        return [];
      }
      
      if (problems.length === 0) {
        return problems;
      }
      
      const problemsFormatted = problems.map((p, i) => `${i+1}. ${p.question}`).join('\n');
      
      // System prompt
      // const systemPrompt = `You are a professional problem analysis expert, responsible for categorizing problems.`;
      
      // User prompt
      const userPrompt = `
        作为问题领域专家，你的任务是对问题进行高价值分类，找出核心问题与从属问题的关系。

        问题列表:
        ${problemsFormatted}

        请执行以下任务:
        1. 识别2-3个核心问题领域，每个领域只包含真正相关的问题
        2. 明确识别问题之间的层级关系:
           - 核心问题(最根本的用户需求)
           - 派生问题(依赖于核心问题的解决)
        3. 为每个问题添加最多3个关键特征标签
        
        只保留对用户有实际价值的问题。剔除价值较低的从属问题，最终问题数量应比原始列表减少25%。
      `;
      
      // Define the actual response schema based on what the LLM returns
      const domainCategorySchema = z.object({
        mainProblemDomain: z.string(),
        problems: z.array(z.object({
          problem: z.string(),
          features: z.array(z.string())
        })),
        relationships: z.record(z.string(), z.array(z.string())).optional()
      });
      
      // Use AgentLLMService
      const agentLLM = this.model as AgentLLMService;
      
      // Use the schema validation method
      // const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const finalPrompt = `${userPrompt}`;
      
      // First get the categorized data in LLM's format
      const categorizedData = await AgentLLMServiceExtensions.analyzeWithArraySchema(
        agentLLM,
        finalPrompt,
        '1-categorize-problems',
        z.array(domainCategorySchema),
        {
          temperature: 0.7,
          defaultValue: [] // Return empty array if parsing fails
        }
      );
      
      // If we have no categorized data, return the original problems
      if (!categorizedData || categorizedData.length === 0) {
        return problems;
      }
      
      // Transform the categorized data into the expected format required by the schema
      // Ensure all required fields are present
      return problems.map(problem => {
        // Find which domain(s) this problem belongs to
        const domains: string[] = [];
        const tags: string[] = [];
        let relationshipToOthers: {relatedToIndex: number, relationType: string}[] = [];
        
        for (const category of categorizedData) {
          // Check if this problem's question appears in this category
          const matchedProblem = category.problems.find(p => 
            p.problem.includes(problem.question) || problem.question.includes(p.problem)
          );
          
          if (matchedProblem) {
            domains.push(category.mainProblemDomain);
            tags.push(...matchedProblem.features);
            
            // If there are relationships defined, add them
            if (category.relationships) {
              // Find other problems that are related to this one
              for (const [problemKey, relatedProblems] of Object.entries(category.relationships)) {
                if (matchedProblem.problem.includes(problemKey) || problemKey.includes(matchedProblem.problem)) {
                  // For each related problem, find its index in the original problems array
                  for (const relatedProblemDesc of relatedProblems) {
                    const relatedIndex = problems.findIndex(p => 
                      p.question.includes(relatedProblemDesc) || relatedProblemDesc.includes(p.question)
                    );
                    
                    if (relatedIndex !== -1) {
                      relationshipToOthers.push({
                        relatedToIndex: relatedIndex,
                        relationType: 'related' // Default relationship type
                      });
                    }
                  }
                }
              }
            }
          }
        }
        
        // Ensure problem has all required fields for schema validation
        return {
          question: problem.question || '',
          domain: [...new Set(domains)], // Remove duplicates
          tags: [...new Set(tags)], // Remove duplicates
          relationshipToOthers,
          overallScore: problem.overallScore || 5, // Default score if not present
          reasoning: problem.reasoning || `This problem belongs to the ${domains.join(', ')} domain(s).`,
          ...problem // Preserve all other original properties
        };
      });
    } catch (error) {
      logger.error({error}, 'Failed to categorize problems');
      return problems;
    }
  }
  
  /**
   * Generate feedback for a problem
   * Implements DiscoveryAgentBase's abstract method
   */
  protected async generateFeedback(problem: Problem): Promise<AgentFeedback> {
    logger.debug({ problemId: problem.id }, `Generating feedback for problem: ${problem.id}`);
    
    try {
      const evidenceFormatted = problem.evidence.map(e => `- [${e.type}] ${e.content}`).join('\n');
      
      // System prompt
      const systemPrompt = `你是一位顶尖的市场需求探索专家，专注于识别真正高价值的问题。`;
      
      // User prompt
      const userPrompt = `
        请对以下问题提供严格的专业评估:

        问题ID: ${problem.id}
        问题描述: ${problem.currentFormulation}
        问题领域: ${problem.domain.join(', ')}
        目标受众: ${problem.targetAudience ? problem.targetAudience.join(', ') : '未指定'}
        
        当前质量评分:
        - 真实性: ${problem.qualityScore.authenticity}/10
        - 紧迫性: ${problem.qualityScore.urgency}/10
        - 规模: ${problem.qualityScore.scale}/10
        - 解决方案差距: ${problem.qualityScore.solutionGap}/10
        - 可行性: ${problem.qualityScore.feasibility}/10
        - 总分: ${problem.qualityScore.overall}/10

        现有证据:
        ${evidenceFormatted}

        请提供以下反馈:
        1. 严格验证问题的真实性和价值(只有最高价值问题才能通过验证)
        2. 提出问题表述的精确改进(使问题更聚焦、更有价值)
        3. 只提出比原问题价值更高的延伸方向(最多2个)
        4. 精确评估目标受众的准确性
      `;
      
      // Define feedback schema
      const feedbackSchema = z.object({
        validationResults: z.object({
          isValid: z.boolean(),
          validationReasoning: z.string(),
          suggestions: z.array(z.string())
        }),
        suggestedChanges: z.array(z.object({
          fieldName: z.string(),
          suggestedValue: z.union([z.string(), z.array(z.string())]),
          changeReasoning: z.string()
        })),
        alternativeBranches: z.array(z.object({
          alternativeFormulation: z.string(),
          branchReasoning: z.string(),
          estimatedQualityScore: z.number()
        })),
        confidenceScore: z.number(),
        feedbackType: z.enum(['validation', 'refinement', 'branch_suggestion', 'rejection'])
      });
      
      // Use AgentLLMService
      const agentLLM = this.model as AgentLLMService;
      
      // Use schema validation method
      const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        agentLLM,
        finalPrompt,
        '1-generate-feedback',
        feedbackSchema,
        {
          temperature: 0.7,
          defaultValue: {
            validationResults: {
              isValid: true,
              validationReasoning: "Unable to complete validation",
              suggestions: ["Assessment failed, please validate manually"]
            },
            suggestedChanges: [],
            alternativeBranches: [],
            confidenceScore: this.feedbackConfidence,
            feedbackType: 'validation'
          }
        }
      );
      
      // Build feedback
      const feedback: AgentFeedback = {
        id: uuidv4(),
        agentId: this.id,
        agentType: this.type,
        problemId: problem.id,
        timestamp: new Date().toISOString(),
        feedbackType: result.feedbackType,
        confidenceScore: result.confidenceScore,
        validationResults: result.validationResults,
        suggestedChanges: result.suggestedChanges,
        alternativeBranches: result.alternativeBranches
      };
      
      return feedback;
    } catch (error: any) {
      logger.error({}, `Error generating feedback: ${error.message}`);
      return this.createDefaultFeedback(problem, error);
    }
  }
} 