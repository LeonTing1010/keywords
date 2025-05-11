/**
 * 用户旅程模拟Agent (模拟者)
 * 
 * 问题发现框架中的"模拟者"角色
 * 通过模拟用户搜索旅程验证问题的真实性和流程
 */
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryAgentBase, DiscoveryAgentBaseConfig } from '../base/DiscoveryAgentBase';
import { 
  Problem, 
  AgentFeedback,
  Evidence 
} from '../../types/discovery';
import { logger } from '../../infra/logger';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SearchTools } from '../../tools/search/SearchTools';
import { SearchEngine } from '../../infra/search/SearchEngine';
import { AgentLLMService, AgentLLMServiceConfig } from '../../core/llm/AgentLLMService';
import { z } from 'zod';
import { SchemaValidator } from '../../core/llm/SchemaValidator';
import { AgentLLMServiceExtensions } from '../../core/llm/extensions';

// 用户旅程模拟Agent配置
export interface UserJourneySimulatorAgentConfig extends DiscoveryAgentBaseConfig {
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  maxSteps?: number;
  usePersonas?: boolean;
  detailedAnalysis?: boolean;
  includeScreenshots?: boolean;
  llmServiceConfig?: AgentLLMServiceConfig;
  advancedUserMode?: boolean;
}

// 搜索步骤接口
interface SearchStep {
  query: string;
  results?: any[];
  satisfaction: number;
  painPoints?: string[];
  nextAction: string;
  reasoning?: string;
}

// 用户旅程接口
interface UserJourney {
  problem: string;
  personaType?: string;
  searchSteps: SearchStep[];
  satisfactionReached: boolean;
  averageSatisfactionScore: number;
  painPoints: string[];
  insightsGained: string[];
}

// Define schemas for validation
const userPersonaSchema = z.object({
  type: z.string(),
  technicalLevel: z.string(),
  searchBehavior: z.string(),
  problemDescription: z.string(),
  expectations: z.string()
});

const searchResultsEvaluationSchema = z.object({
  satisfaction: z.number().min(0).max(1),
  painPoints: z.array(z.string()),
  nextAction: z.string(),
  nextQuery: z.string().optional(),
  reasoning: z.string()
});

const journeyInsightsSchema = z.array(z.string());

const validityScoreSchema = z.object({
  score: z.number().min(1).max(10)
});

const urgencyScoreSchema = z.object({
  urgencyScore: z.number().min(1).max(10)
});

const frequencyScoreSchema = z.object({
  frequencyScore: z.number().min(1).max(10)
});

const targetAudienceSchema = z.object({
  audiences: z.array(z.string())
});

const feedbackSchema = z.object({
  validationResults: z.object({
    isValid: z.boolean(),
    validationReasoning: z.string(),
    suggestions: z.array(z.string())
  }),
  suggestedChanges: z.array(z.object({
    fieldName: z.string(),
    suggestedValue: z.string().or(z.number()).or(z.array(z.string())),
    changeReasoning: z.string()
  })),
  confidenceScore: z.number().min(0).max(1),
  feedbackType: z.string()
});

/**
 * 用户旅程模拟Agent
 * 在问题发现框架中担任"模拟者"角色，模拟用户如何尝试解决问题
 */
export class UserJourneySimulatorAgent extends DiscoveryAgentBase {
  // 实现DiscoveryAgent接口
  public readonly type: 'simulator' = 'simulator';
  
  // 特定于此Agent的属性  
  private searchTools: SearchTools | null = null;
  private maxSteps: number;
  private usePersonas: boolean;
  private detailedAnalysis: boolean;
  private advancedUserMode: boolean;

  private llmService: AgentLLMService;
  
  /**
   * 构造函数
   */
  constructor(config: UserJourneySimulatorAgentConfig = {}) {
    super(config);
    
    this.maxSteps = config.advancedUserMode ? 8 : (config.maxSteps || 3);
    this.usePersonas = config.usePersonas !== false;
    this.detailedAnalysis = config.detailedAnalysis !== false;
    this.advancedUserMode = config.advancedUserMode || false;
    this.llmService=this.model as AgentLLMService;
    logger.debug({ advancedUserMode: this.advancedUserMode }, 'UserJourneySimulatorAgent initialized with AgentLLMService');
    
    // 初始化搜索工具
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具
   */
  private initializeSearchTools(config: UserJourneySimulatorAgentConfig): void {
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
   * 实现DiscoveryAgent.process方法
   * 处理输入并模拟用户旅程
   */
  public async process(input: any): Promise<any> {
    logger.info({}, 'UserJourneySimulatorAgent processing input');
    
    if (!input.problems || !Array.isArray(input.problems) || input.problems.length === 0) {
      throw new Error('Valid problems array is required for UserJourneySimulatorAgent');
    }
    
    try {
      // 模拟用户旅程以验证问题
      const problemValidations = await this.validateProblemsWithJourneys(input.problems);
      
      logger.info({ count: problemValidations.length }, `UserJourneySimulatorAgent completed validations for ${problemValidations.length} problems`);
      
      return {
        problemValidations,
        sourceKeyword: input.sourceKeyword || '',
        metadata: {
          completedJourneys: problemValidations.length,
          averageValidationScore: problemValidations.reduce(
            (sum, p) => sum + (p.validityScore || 0), 0) / problemValidations.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      logger.error({ error }, `Error in UserJourneySimulatorAgent.process: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 验证输入并清理数据
   */
  private validateAndCleanInput(input: any): any {
    logger.debug({ input }, 'Validating and cleaning input');
    
    if (!input) {
      logger.error({}, 'Input is missing');
      throw new Error('Input is required');
    }
    
    // 如果输入是Graph状态，提取问题数据
    if (input.data && input.data.highValueProblems) {
      return {
        problems: input.data.highValueProblems,
        sourceKeyword: input.data.keyword || ''
      };
    }
    
    // 如果输入已经包含problems，直接返回
    if (input.problems) {
      return input;
    }
    
    // 如果输入包含其他字段但没有problems，尝试适配
    if (input.highValueProblems) {
      return {
        problems: input.highValueProblems,
        sourceKeyword: input.keyword || ''
      };
    }
    
    logger.error({ input }, 'Invalid input format: cannot find problems to validate');
    throw new Error('Invalid input format: cannot find problems to validate');
  }
  
  /**
   * 为每个问题模拟用户旅程并验证
   */
  private async validateProblemsWithJourneys(problems: Problem[]): Promise<any[]> {
    logger.debug({}, `Validating ${problems.length} problems with user journeys`);
    
    // 创建验证结果数组
    const validations = [];
    
    // 为每个问题创建用户旅程
    for (const problem of problems) {
      logger.debug({}, `Simulating journey for problem: ${problem.id}`);
      
      try {
        // 模拟用户旅程
        const journey = await this.simulateUserJourney(problem);
        
        if (journey) {
          // 基于旅程分析问题有效性
          const validation = {
            id: problem.id,
            originalFormulation: problem.originalFormulation || problem.currentFormulation,
            currentFormulation: problem.currentFormulation,
            validityScore: await this.calculateValidityScore(journey),
            userJourney: journey,
            validation: {
              isValid: journey.satisfactionReached === false, // 问题有效 = 用户未找到满意解决方案
              validationReasoning: this.generateValidationReasoning(journey),
              userValidations: await this.extractUserValidations(journey)
            },
            targetAudience: await this.inferTargetAudience(journey, problem)
          };
          
          validations.push(validation);
        }
      } catch (error: any) {
        logger.error({}, `Error validating problem ${problem.id}: ${error.message}`);
      }
    }
    
    return validations;
  }
  
  /**
   * 模拟用户尝试解决问题的搜索旅程
   */
  private async simulateUserJourney(problem: Problem): Promise<UserJourney | null> {
    logger.debug({}, `Simulating user journey for problem: ${problem.currentFormulation}`);
    
    try {
      // 生成用户角色（如果启用）
      const persona = this.usePersonas ? await this.generateUserPersona(problem) : undefined;
      
      // 创建初始搜索查询
      const initialQuery = await this.generateInitialSearchQuery(problem, persona);
      
      // 执行搜索旅程
      const searchSteps = await this.executeSearchJourney(initialQuery, problem.currentFormulation, this.maxSteps);
      
      if (!searchSteps || searchSteps.length === 0) {
        logger.warn({}, 'No valid search steps were generated for the journey');
        return null;
      }
      
      // 计算满意度指标
      const satisfactionScores = searchSteps.map(step => step.satisfaction);
      const averageSatisfaction = satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length;
      const satisfactionReached = searchSteps.some(step => step.satisfaction >= 0.8);
      
      // 收集痛点
      const painPoints = this.collectPainPoints(searchSteps);
      
      // 获取旅程洞察
      const insights = await this.analyzeJourneyInsights(searchSteps, problem.currentFormulation);
      
      // 构建用户旅程结果
      const userJourney: UserJourney = {
        problem: problem.currentFormulation,
        personaType: persona?.type,
        searchSteps,
        satisfactionReached,
        averageSatisfactionScore: averageSatisfaction,
        painPoints,
        insightsGained: insights || []
      };
      
      return userJourney;
    } catch (error: any) {
      logger.error({}, `Error simulating user journey: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 生成用户角色
   */
  private async generateUserPersona(problem: Problem): Promise<any | null> {
    try {
      // 如果是高级用户模式，直接返回搜索专家角色
      if (this.advancedUserMode) {
        return {
          type: "资深搜索专家",
          technicalLevel: "高级",
          searchBehavior: "精通各类搜索技巧，擅长使用高级运算符、布尔逻辑、引号精确匹配、站点限定符等。能够深入分析搜索结果质量，跨多个平台比对信息，验证不同来源的权威性和可靠性，持续迭代搜索策略直至找到最佳答案。",
          problemDescription: problem.currentFormulation || "",
          expectations: "寻找全面、准确且权威的解决方案，不接受片面或浅层次的答案，持续质疑和验证每个可能的解决方案"
        };
      }

      // 创建提示
      const prompt = `
        作为搜索专家，为以下问题创建一个搜索专家角色模型:
        "${problem.currentFormulation || ''}"
        
        你需要模拟一位极其专业的搜索专家，他将:
        1. 使用各种高级搜索技巧验证问题的真实性
        2. 不断质疑搜索结果，探索更深层次的解决方案
        3. 反复验证问题的前提假设是否成立
        
        以JSON格式返回:
        {
          "type": "搜索专家角色类型",
          "technicalLevel": "技术水平(必须为高级)",
          "searchBehavior": "详细描述专家级搜索行为和策略",
          "problemDescription": "从专业角度重新描述问题",
          "expectations": "对解决方案的严格期望"
        }
      `;
      
      // 创建默认值
      const defaultValue = {
        type: "一般用户",
        technicalLevel: "中级",
        searchBehavior: "直接在搜索引擎中查询问题",
        problemDescription: problem.currentFormulation || "",
        expectations: "简单易用的解决方案"
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      return await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '2-generate-user-persona',
        userPersonaSchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
    } catch (error) {
      logger.error({}, 'Error generating user persona');
      
      // 如果是高级用户模式，即使出错也返回高级用户角色
      if (this.advancedUserMode) {
        return {
          type: "高级搜索专家",
          technicalLevel: "高级",
          searchBehavior: "使用高级搜索技巧，能够深入研究问题",
          problemDescription: problem.currentFormulation || "",
          expectations: "寻找全面、准确且权威的解决方案"
        };
      }
      
      return null;
    }
  }
  
  /**
   * 生成初始搜索查询
   */
  private async generateInitialSearchQuery(problem: Problem, persona?: any): Promise<string> {
    try {
      logger.debug({}, `Generating initial search query for problem: ${problem.currentFormulation}`);
      
      // 准备persona信息
      let personaInfo = '';
      if (persona) {
        personaInfo = `用户角色信息:\n` +
                     `- 类型: ${persona.type || '一般用户'}\n` +
                     `- 技术水平: ${persona.technicalLevel || '中级'}\n` +
                     `- 搜索行为: ${persona.searchBehavior || '直接搜索问题'}\n`;
      } else {
        personaInfo = '用户角色: 一般用户，具有中等技术水平';
      }
      
      // 高级搜索专家视角的提示
      const promptTemplate = `
        你是一位资深搜索专家，需要通过搜索旅程验证以下问题的真实性和有效解决方案:
        
        问题: "${problem.currentFormulation || ''}"
        
        ${personaInfo}
        
        作为专业搜索专家，你的首要任务是设计一个初始搜索查询，该查询将:
        1. 精确定位问题核心，不带任何先入为主的假设
        2. 使用高级搜索语法(精确引号、布尔运算符、站点限定等)
        3. 优先考虑权威来源
        4. 设计用于验证问题是否真实存在的查询，而非假设问题已存在
        
        请直接返回专业的搜索查询文本。不需要解释，只返回查询内容。
      `;
      
      // 创建schema
      const querySchema = z.object({
        searchQuery: z.string()
      });
      
      // 创建默认值
      const defaultValue = {
        searchQuery: problem.currentFormulation || ""
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        promptTemplate,
        '2-generate-search-query',
        querySchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
      
      return result.searchQuery;
    } catch (error) {
      logger.error({}, 'Error generating initial search query');
      
      // 失败时返回简化的问题描述作为查询
      let query = problem.currentFormulation || '';
      
      // 简化查询（删除长的介绍性词语）
      query = query.replace(/如何解决|如何处理|怎样|为什么|是否可能|能否|能够|为何|在哪里|什么样的/g, '');
      
      // 确保查询长度适中
      if (query.length > 50) {
        query = query.substring(0, 50);
      }
      
      return query.trim();
    }
  }
  
  /**
   * 执行搜索旅程
   */
  private async executeSearchJourney(initialQuery: string, problemDesc: string, maxSteps: number): Promise<SearchStep[]> {
    const steps: SearchStep[] = [];
    let currentQuery = initialQuery;
    
    try {
      // 查找搜索工具
      const searchTool = this.tools.find(t => t.name === 'get_search_results');
      
      if (!searchTool) {
        logger.error({}, 'No get_search_results tool found, cannot execute search journey');
        return [];
      }
      
      // 高级用户模式下增加搜索结果数量
      const numResults = this.advancedUserMode ? 5 : 3;
      
      for (let step = 0; step < maxSteps; step++) {
        logger.debug({}, `Executing search step ${step + 1}/${maxSteps} with query: ${currentQuery}`);
        
        // 执行搜索
        let searchResults;
        try {
          const searchResponse = await searchTool.invoke({ keyword: currentQuery, numResults });
          searchResults = JSON.parse(searchResponse);
        } catch (error) {
          logger.error({ error }, 'Search tool failed');
          return steps.length > 0 ? steps : [];
        }
        
        // 评估搜索结果
        const evaluation = await this.evaluateSearchResults(searchResults, currentQuery, problemDesc);
        
        if (!evaluation) {
          logger.warn({}, 'Failed to evaluate search results');
          return steps.length > 0 ? steps : [];
        }
        
        // 记录搜索步骤
        const searchStep: SearchStep = {
          query: currentQuery,
          results: this.detailedAnalysis ? searchResults : undefined,
          satisfaction: evaluation.satisfaction,
          painPoints: evaluation.painPoints,
          nextAction: evaluation.nextAction,
          reasoning: evaluation.reasoning
        };
        
        steps.push(searchStep);
        
        // 高级用户模式下，仅当非常确定找到解决方案时才结束
        const satisfactionThreshold = this.advancedUserMode ? 0.9 : 0.8;
        
        // 检查是否达到满意度或终止条件
        if (evaluation.satisfaction >= satisfactionThreshold || evaluation.nextAction === 'stop_searching') {
          break;
        }
        
        // 确定下一个搜索查询
        if (evaluation.nextAction === 'refine_query' && evaluation.nextQuery) {
          currentQuery = evaluation.nextQuery;
        } else {
          break;
        }
      }
      
      return steps;
    } catch (error: any) {
      logger.error({}, `Error executing search journey: ${error.message}`);
      
      // 如果已经有步骤，返回现有步骤
      return steps.length > 0 ? steps : [];
    }
  }
  
  /**
   * 评估搜索结果
   */
  private async evaluateSearchResults(
    results: any[], 
    query: string, 
    problemDesc: string
  ): Promise<any> {
    try {
      logger.debug({}, `Evaluating search results for query: ${query}`);
      
      // 确保results有值
      const searchResults = results && results.length > 0 ? results : [];
      
      // 准备结果数据供LLM分析
      const resultsFormatted = searchResults.map((r, i) => 
        `${i+1}. ${r.title || ''}\n   摘要: ${r.snippet || ''}\n   URL: ${r.url || ''}`
      ).join('\n\n');
      
      // 创建提示 - 搜索专家视角的深度评估提示
      const promptTemplate = `
        你是一位资深搜索专家，正在进行深度问题验证旅程的关键阶段。
        
        待验证问题: "${problemDesc}"
        
        当前搜索查询: "${query}"
        
        搜索结果:
        ${resultsFormatted || '(无搜索结果)'}
        
        作为专业搜索专家，你需要:
        
        1. 严格质疑搜索结果，考虑它们是否真正解决了问题
        2. 评估信息来源的权威性、全面性和准确性
        3. 识别搜索结果中的假设、偏见或信息缺口
        4. 探索结果是否验证了问题的真实存在性
        5. 分析是否需要重新定义问题或质疑问题的基本假设
        6. 确定下一步应该是继续深入挖掘还是转向新方向
        
        请以下面的JSON格式回答:
        {
          "satisfaction": 0.3, // 对当前结果的满意度(0-1)，高度怀疑精神，除非找到完美解决方案
          "painPoints": ["当前结果的具体问题点1", "当前结果的具体问题点2"],
          "nextAction": "refine_query", // 是否需要继续深入："refine_query"继续搜索 或 "stop_searching"找到答案
          "nextQuery": "更深入或不同角度的下一步查询", 
          "reasoning": "详细的批判性分析，包括对问题假设的质疑"
        }
      `;
      
      // 创建默认值
      const defaultValue = {
        satisfaction: 0.5,
        painPoints: ["搜索结果相关性不高"],
        nextAction: "refine_query",
        nextQuery: query,
        reasoning: "默认分析"
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      return await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        promptTemplate,
        '2-evaluate-search-results',
        searchResultsEvaluationSchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
    } catch (error) {
      logger.error({}, 'Failed to evaluate search results');
      return null;
    }
  }
  
  /**
   * 收集所有搜索步骤中的痛点
   */
  private collectPainPoints(steps: SearchStep[]): string[] {
    const allPainPoints = new Set<string>();
    
    steps.forEach(step => {
      if (step.painPoints && step.painPoints.length > 0) {
        step.painPoints.forEach(point => allPainPoints.add(point));
      }
    });
    
    return Array.from(allPainPoints);
  }
  
  /**
   * 分析用户旅程获得的洞察 - 简化版
   */
  private async analyzeJourneyInsights(steps: SearchStep[], problemDesc: string): Promise<string[]> {
    try {
      logger.debug({}, `Analyzing journey insights for problem: ${problemDesc}`);
      
      // 准备步骤数据
      const stepsFormatted = steps.map((step, i) => {
        return `步骤 ${i+1}:\n` +
               `- 查询: "${step.query}"\n` +
               `- 满意度: ${step.satisfaction.toFixed(2)}/1.0\n` +
               `- 痛点: ${step.painPoints?.join(', ') || '无'}\n` + 
               `- 下一行动: ${step.nextAction}\n` +
               `- 推理: ${step.reasoning || '无推理'}\n`;
      }).join('\n\n');
      
      // 构建更加批判性和反思性的洞察分析提示
      const prompt = `
        作为搜索专家，请深入分析以下搜索旅程，重点关注问题的真实性验证。
        
        待验证问题:
        "${problemDesc}"
        
        搜索旅程详细记录:
        ${stepsFormatted}
        
        请进行批判性分析:
        1. 此问题是否真实存在？有什么证据？
        2. 搜索过程中的哪些发现支持或反驳了问题的存在？
        3. 搜索旅程中的哪些回退和重定向最有启发性？
        4. 问题的核心假设是否得到了验证或被推翻？
        5. 如果存在问题，为什么现有解决方案不够完善？
        6. 如果问题不存在或被误解，正确的理解是什么？
        
        返回JSON数组格式，列出5-7条关键洞察:
        [
          "洞察1：对问题真实性的批判性分析",
          "洞察2：搜索过程中发现的关键证据",
          "洞察3：对问题假设的挑战或验证"
        ]
      `;
      
      // 创建默认值
      const defaultValue = [
        "用户在搜索过程中遇到了障碍",
        "现有解决方案未能完全满足用户需求",
        "存在潜在的商业机会"
      ];
      
      // 使用AgentLLMServiceExtensions的analyzeWithArraySchema方法
      return await AgentLLMServiceExtensions.analyzeWithArraySchema(
        this.llmService,
        prompt,
        '2-analyze-journey-insights',
        z.array(z.string()),
        {
          temperature: 0.7,
          defaultValue
        }
      );
    } catch (error) {
      logger.error({}, 'Error analyzing journey insights');
      return [];
    }
  }
  
  /**
   * 计算问题有效性分数
   * 使用大模型评估问题有效性
   */
  private async calculateValidityScore(journey: UserJourney): Promise<number> {
    try {
      logger.debug({}, `Calculating validity score with LLM for journey related to problem`);
      
      // 准备旅程摘要
      const journeySummary = `
        Problem: "${journey.problem}"
        User found satisfactory solution: ${journey.satisfactionReached ? 'Yes' : 'No'}
        Average satisfaction score: ${journey.averageSatisfactionScore.toFixed(2)}/1.0
        Search steps: ${journey.searchSteps.length}
        Pain points: ${journey.painPoints.join(', ')}
        ${this.advancedUserMode ? 'Search performed by: Advanced user with expert search skills' : ''}
      `;
      
      // 准备旅程详情
      const journeyDetails = journey.searchSteps.map((step, i) => 
        `Step ${i+1}:
         - Query: "${step.query}"
         - Satisfaction: ${step.satisfaction.toFixed(2)}/1.0
         - Next action: ${step.nextAction}`
      ).join('\n\n');
      
      // 构建评分任务 - 更加严格的问题真实性验证标准
      const scoringTask = `
        作为问题验证专家，你需要严格评估这个问题的真实性和有效性。
        
        评分标准(1-10分):
        - 10分 = 问题绝对真实存在，即使是顶级搜索专家也找不到完整解决方案
        - 7-9分 = 问题可能存在，但证据不够充分，或现有解决方案有明显缺陷
        - 4-6分 = 问题部分存在，但可能被误解或夸大，或已有较好解决方案
        - 1-3分 = 问题很可能不存在，是基于错误假设，或已有完善解决方案
        
        评分考虑因素:
        1. 搜索专家是否穷尽了所有可能的搜索策略
        2. 搜索过程中对问题假设的质疑是否充分
        3. 搜索结果是否提供了反面证据
        4. 是否探索了足够深度的解决方案
        5. 是否尝试了重新定义问题
        
        根据搜索旅程证据，以JSON格式给出你的评分:
        {
          "score": 6,
          "justification": "简要说明评分理由"
        }
      `;
      
      const prompt = `As an expert in problem validation, analyze this user journey and score the validity of the underlying problem.
        
        ## User Journey Summary
        ${journeySummary}
        
        ## Journey Details
        ${journeyDetails}
        
        ## Scoring Task
        ${scoringTask}`;
      
      // 创建默认值 - 高级用户模式下，默认分数更可信
      const defaultScore = this.advancedUserMode ? 
        this.fallbackValidityScoreCalculation(journey) * 1.2 : // 高级用户模式下，分数更高
        this.fallbackValidityScoreCalculation(journey);
        
      const defaultValue = {
        score: Math.min(10, defaultScore) // 确保不超过10
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '2-calculate-validity-score',
        validityScoreSchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
      
      return result.score;
    } catch (error) {
      logger.error({error}, `Error calculating validity score with LLM: ${error}`);
      return this.fallbackValidityScoreCalculation(journey);
    }
  }
  
  /**
   * Fallback calculation for validity score if LLM fails
   */
  private fallbackValidityScoreCalculation(journey: UserJourney): number {
    // Base score
    let score = 5;
    
    // No satisfactory solution found adds points
    if (!journey.satisfactionReached) {
      score += 2;
    }
    
    // Adjust score based on average satisfaction (lower satisfaction = more valid problem)
    score += (1 - journey.averageSatisfactionScore) * 3;
    
    // Pain points increase score
    if (journey.painPoints.length > 0) {
      score += Math.min(journey.painPoints.length, 3);
    }
    
    // 高级用户模式下，如果找不到解决方案，分数更高
    if (this.advancedUserMode && !journey.satisfactionReached) {
      score += 1.5;
    }
    
    // Ensure score is within 1-10 range
    return Math.min(10, Math.max(1, score));
  }
  
  /**
   * 生成验证理由
   */
  private generateValidationReasoning(journey: UserJourney): string {
    const userTypePrefix = this.advancedUserMode ? 
      "即使是拥有高级搜索技能的专业用户" : 
      "用户";
      
    if (!journey.satisfactionReached && journey.painPoints.length > 0) {
      return `${userTypePrefix}在搜索过程中未找到满意的解决方案，并遇到了多个痛点: ${journey.painPoints.join(', ')}。这强烈表明问题真实存在且尚未被很好地解决。`;
    } else if (!journey.satisfactionReached) {
      return `${userTypePrefix}在搜索过程中未找到满意的解决方案，表明此问题尚未被很好地解决。`;
    } else if (journey.painPoints.length > 0) {
      return `尽管${userTypePrefix}找到了解决方案，但仍然遇到了痛点: ${journey.painPoints.join(', ')}，表明现有解决方案存在改进空间。`;
    } else {
      return `${userTypePrefix}能够找到满意的解决方案，且未遇到明显痛点，表明此问题可能已有较好的解决方案。`;
    }
  }
  
  /**
   * 从用户旅程提取用户验证数据
   */
  private async extractUserValidations(journey: UserJourney): Promise<any[]> {
    const validations = [];
    
    // 高级用户模式下，验证权重更高
    const advancedModeMultiplier = this.advancedUserMode ? 1.2 : 1.0;
    
    // 添加基于旅程的验证
    validations.push({
      type: this.advancedUserMode ? 'advanced_user_search_journey' : 'search_journey',
      satisfactionReached: journey.satisfactionReached,
      averageSatisfaction: journey.averageSatisfactionScore,
      stepsCount: journey.searchSteps.length,
      painPointsCount: journey.painPoints.length,
      urgencyScore: await this.estimateUrgencyFromJourney(journey),
      frequencyScore: await this.estimateFrequencyFromJourney(journey),
      painPointScore: journey.painPoints.length > 0 ? 
        Math.min(10, 5 + journey.painPoints.length * advancedModeMultiplier) : 5,
      advancedUserMode: this.advancedUserMode
    });
    
    return validations;
  }
  
  /**
   * 从旅程估计问题紧急度
   * 使用大模型评估紧急度 - 简化版
   */
  private async estimateUrgencyFromJourney(journey: UserJourney): Promise<number> {
    try {
      logger.debug({}, `Estimating urgency with LLM for journey`);
      
      // 构建紧急度评估提示
      const prompt = `
        As an expert in problem prioritization, analyze this user journey and score the urgency of the underlying problem.
        
        ## User Journey Summary
        Problem: "${journey.problem}"
        User found satisfactory solution: ${journey.satisfactionReached ? 'Yes' : 'No'}
        Average satisfaction score: ${journey.averageSatisfactionScore.toFixed(2)}/1.0
        Search steps: ${journey.searchSteps.length}
        Pain points: ${journey.painPoints.join(', ')}
        
        ## Journey Details
        ${journey.searchSteps.map((step, i) => 
          `Step ${i+1}:
           - Query: "${step.query}"
           - Satisfaction: ${step.satisfaction.toFixed(2)}/1.0
           - Next action: ${step.nextAction}`
        ).join('\n\n')}
        
        ## Scoring Task
        Score this problem's urgency on a scale of 1-10, where:
        - 10 = Extremely urgent, requires immediate solution
        - 7-9 = Highly urgent, should be prioritized
        - 4-6 = Moderately urgent
        - 1-3 = Low urgency, can be addressed later
        
        Consider:
        1. Language indicating time pressure in queries
        2. Emotional frustration evident in the search journey
        3. Intensity of pain points
        4. Search persistence despite low satisfaction
        5. Impact of not solving the problem
        
        Return a JSON object with the following format:
        {
          "urgencyScore": 7
        }
        
        Where the urgencyScore is a number between 1-10 representing your assessment.
      `;
      
      // 创建默认值
      const defaultValue = {
        urgencyScore: this.fallbackUrgencyCalculation(journey)
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '2-estimate-urgency-score',
        urgencyScoreSchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
      
      return result.urgencyScore;
    } catch (error) {
      logger.error({error}, `Error estimating urgency with LLM: ${error}`);
      return this.fallbackUrgencyCalculation(journey);
    }
  }
  
  /**
   * Fallback calculation for urgency if LLM fails
   */
  private fallbackUrgencyCalculation(journey: UserJourney): number {
    // Default medium urgency
    let urgencyScore = 5; 
    
    // Multiple search steps indicate more urgency
    if (journey.searchSteps.length >= this.maxSteps) {
      urgencyScore += 1;
    }
    
    // Multiple pain points indicate more urgency
    if (journey.painPoints.length >= 3) {
      urgencyScore += 2;
    } else if (journey.painPoints.length > 0) {
      urgencyScore += 1;
    }
    
    // Low satisfaction indicates more urgency
    if (journey.averageSatisfactionScore < 0.3) {
      urgencyScore += 2;
    } else if (journey.averageSatisfactionScore < 0.6) {
      urgencyScore += 1;
    }
    
    // Ensure score is within 1-10 range
    return Math.min(10, Math.max(1, urgencyScore));
  }
  
  /**
   * 从旅程估计问题频率
   * 使用大模型评估频率 - 简化版
   */
  private async estimateFrequencyFromJourney(journey: UserJourney): Promise<number> {
    try {
      logger.debug({}, `Estimating frequency with LLM for journey`);
      
      // 构建频率评估提示
      const prompt = `
        As an expert in market analysis, analyze this user journey and estimate how frequently this problem occurs among users.
        
        ## User Journey Summary
        Problem: "${journey.problem}"
        User found satisfactory solution: ${journey.satisfactionReached ? 'Yes' : 'No'}
        Average satisfaction score: ${journey.averageSatisfactionScore.toFixed(2)}/1.0
        Search steps: ${journey.searchSteps.length}
        Pain points: ${journey.painPoints.join(', ')}
        
        ## Journey Details
        ${journey.searchSteps.map((step, i) => 
          `Step ${i+1}:
           - Query: "${step.query}"
           - Satisfaction: ${step.satisfaction.toFixed(2)}/1.0`
        ).join('\n\n')}
        
        ## Insights
        ${journey.insightsGained?.join('\n') || 'No specific insights available'}
        
        ## Scoring Task
        Score this problem's frequency on a scale of 1-10, where:
        - 10 = Extremely common problem affecting most users in the domain
        - 7-9 = Very common problem affecting many users
        - 4-6 = Moderately common problem
        - 1-3 = Relatively rare problem
        
        Consider:
        1. Search query language indicating commonality (e.g., "always", "everyone")
        2. Generality/specificity of the problem and searches
        3. Simplicity of the search terms (simpler terms often indicate more common problems)
        4. Breadth of potential user base indicated by the problem
        
        Return a JSON object with the following format:
        {
          "frequencyScore": 7
        }
        
        Where the frequencyScore is a number between 1-10 representing your assessment.
      `;
      
      // 创建默认值
      const defaultValue = {
        frequencyScore: this.fallbackFrequencyCalculation(journey)
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '2-estimate-frequency-score',
        frequencyScoreSchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
      
      return result.frequencyScore;
    } catch (error) {
      logger.error({error}, `Error estimating frequency with LLM: ${error}`);
      return this.fallbackFrequencyCalculation(journey);
    }
  }
  
  /**
   * Fallback calculation for frequency if LLM fails
   */
  private fallbackFrequencyCalculation(journey: UserJourney): number {
    // Default medium frequency
    let frequencyScore = 5; 
    
    // Very low satisfaction might indicate common problem
    if (journey.averageSatisfactionScore < 0.2) {
      frequencyScore += 2;
    }
    
    // Check if pain points suggest common problem
    if (journey.painPoints.some(p => 
      p.toLowerCase().includes('常见') || 
      p.toLowerCase().includes('普遍') ||
      p.toLowerCase().includes('大多数用户')
    )) {
      frequencyScore += 2;
    }
    
    // Simple query terms might indicate more common problem
    const simpleQueryCount = journey.searchSteps.filter(s => 
      s.query.split(' ').length <= 3
    ).length;
    
    if (simpleQueryCount >= 2) {
      frequencyScore += 1;
    }
    
    // Ensure score is within 1-10 range
    return Math.min(10, Math.max(1, frequencyScore));
  }
  
  /**
   * 从旅程推断目标受众
   * 使用大模型推断目标受众 - 简化版
   */
  private async inferTargetAudience(journey: UserJourney, problem: Problem): Promise<string[]> {
    // 首先使用问题已有的目标受众
    if (problem.targetAudience && problem.targetAudience.length > 0) {
      return problem.targetAudience;
    }
    
    // 从persona获取
    if (journey.personaType) {
      return [journey.personaType];
    }
    
    try {
      logger.debug({}, `Inferring target audience with LLM for journey`);
      
      // 构建目标受众推断提示
      const prompt = `
        As an expert in user research, analyze this search journey and identify the most likely target audience for this problem.
        
        ## Problem
        "${journey.problem}"
        
        ## Journey Details
        ${journey.searchSteps.map((step, i) => 
          `Step ${i+1}:
           - Query: "${step.query}"
           - Satisfaction: ${step.satisfaction.toFixed(2)}/1.0
           - Pain points: ${step.painPoints?.join(', ') || 'None'}`
        ).join('\n\n')}
        
        ## Pain Points
        ${journey.painPoints.join('\n')}
        
        ## Task
        Based on the search behavior, queries used, and pain points experienced:
        1. Identify 3-5 specific audience segments most likely to have this problem
        2. For each audience segment, include demographic, behavioral, or professional characteristics
        3. Prioritize these segments from primary to secondary audiences
        
        Return your response as a JSON object with the following format:
        {
          "audiences": ["Digital marketers at SMBs", "E-commerce store owners", "Content creators", "Social media managers"]
        }
      `;
      
      // 创建默认值
      const defaultValue = {
        audiences: ['有此问题的普通用户']
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '2-infer-target-audience',
        targetAudienceSchema,
        {
          temperature: 0.8,
          defaultValue
        }
      );
      
      return result.audiences;
    } catch (error) {
      logger.error({}, `Error inferring target audience with LLM: ${error}`);
      return ['有此问题的普通用户'];
    }
  }
  
  /**
   * 为问题生成反馈 - 简化版
   */
  protected async generateFeedback(problem: Problem): Promise<AgentFeedback> {
    logger.debug({}, `Generating feedback for problem: ${problem.id}`);
    
    try {
      // 先模拟用户旅程（如果需要）
      let userJourney;
      const existingJourney = problem.evidence.find(e => e.type === 'user_journey');
      
      if (existingJourney && existingJourney.metadata) {
        // 从已有证据中使用旅程信息
        userJourney = {
          satisfactionReached: existingJourney.metadata.satisfactionReached,
          painPoints: existingJourney.metadata.painPoints || [],
          averageSatisfactionScore: existingJourney.metadata.averageSatisfaction || 0.5
        };
      } else {
        // 创建新的用户旅程
        userJourney = await this.simulateUserJourney(problem);
      }
      
      if (!userJourney) {
        logger.error({}, 'Failed to get user journey for feedback');
        return this.createDefaultFeedback(problem, new Error('Failed to simulate user journey'));
      }
      
      // 构建反馈生成提示 - 更加批判性和质疑性
      const prompt = `
        作为搜索专家和问题验证师，请对以下"问题"进行严格的批判性分析:
        
        问题: "${problem.currentFormulation || ''}"
        
        搜索旅程分析:
        - 搜索专家是否找到满意解决方案: ${userJourney.satisfactionReached ? '是' : '否'}
        - 平均搜索满意度: ${userJourney.averageSatisfactionScore}/1.0
        - 搜索过程中发现的痛点: ${userJourney.painPoints.join(', ')}
        
        请提供严格的批判性反馈:
        1. 彻底质疑问题的存在前提：此问题是否真实存在？还是基于错误假设？
        2. 分析搜索旅程中每一步的质量：是否足够深入？是否错过关键信息？
        3. 提出至少3个不同的问题重新定义方向
        4. 建议如何进一步验证问题的真实性
        
        以JSON格式返回:
        {
          "validationResults": {
            "isValid": true/false,
            "validationReasoning": "详细的批判性分析，包括对问题假设的质疑",
            "suggestions": ["建议1：重新定义问题", "建议2：进一步验证方向", "建议3：替代假设"]
          },
          "suggestedChanges": [
            {
              "fieldName": "currentFormulation",
              "suggestedValue": "问题的批判性重新表述",
              "changeReasoning": "详细说明为何需要这样重新表述问题"
            }
          ],
          "confidenceScore": 0.7,
          "feedbackType": "validation"
        }
      `;
      
      // 创建默认值
      const defaultValue = {
        validationResults: {
          isValid: true,
          validationReasoning: "用户未找到完全满意的解决方案，表明问题真实存在",
          suggestions: ["继续探索问题的不同方面"]
        },
        suggestedChanges: [],
        confidenceScore: this.feedbackConfidence,
        feedbackType: "validation"
      };
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const feedbackResponse = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '2-generate-journey-feedback',
        feedbackSchema,
        {
          temperature: 0.7,
          defaultValue
        }
      );
      
      // 构建反馈
      const feedbackType = feedbackResponse.feedbackType === 'validation' || 
                          feedbackResponse.feedbackType === 'refinement' || 
                          feedbackResponse.feedbackType === 'branch_suggestion' || 
                          feedbackResponse.feedbackType === 'rejection' ? 
                          feedbackResponse.feedbackType : 'validation';
      
      const feedback: AgentFeedback = {
        id: uuidv4(),
        agentId: this.id,
        agentType: this.type,
        problemId: problem.id,
        timestamp: new Date().toISOString(),
        feedbackType: feedbackType,
        confidenceScore: feedbackResponse.confidenceScore || this.feedbackConfidence,
        validationResults: feedbackResponse.validationResults,
        suggestedChanges: feedbackResponse.suggestedChanges
      };
      
      return feedback;
    } catch (error: any) {
      logger.error({}, `Error generating feedback: ${error.message}`);
      return this.createDefaultFeedback(problem, error);
    }
  }
} 