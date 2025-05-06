/**
 * UserJourneySim - 用户搜索旅程模拟器
 * 模拟用户在搜索引擎中的整个搜索旅程，识别决策点和查询修改模式
 */
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { SearchEngine } from '../providers/SearchEngine';
import { JourneyEvaluator, JourneyEvaluationMetrics, RealJourneyData } from './JourneyEvaluator';
import { AutocompleteService } from './AutocompleteService';
import { AutocompleteSuggestion } from './AutocompleteTypes';
import { 
  AutocompleteParameters, 
  DEFAULT_AUTOCOMPLETE_PARAMETERS,
  AutocompleteBehaviorMetrics
} from './AutocompleteParameters';
import { AutocompleteEvaluator } from './AutocompleteEvaluator';
import { logger } from '../core/logger';


// 旅程步骤接口
export interface JourneyStep {
  query: string;
  intentType: string;
  expectedResults: string[];
  userAction: string;
  reasoning: string;
  // 自动补全相关属性
  suggestedBy?: 'llm_only' | 'autocomplete' | 'enhanced_autocomplete'; // 查询来源
  originalQuery?: string;   // 如果被替换，原始查询
  position?: number;        // 如果来自自动补全，在建议列表中的位置
  suggestionsShown?: AutocompleteSuggestion[]; // 展示的自动补全建议
  semanticDeviation?: 'low' | 'medium' | 'high'; // 语义偏离程度
}

// 决策点接口
export interface DecisionPoint {
  step: number;
  fromQuery: string;
  toQuery: string;
  reason: string;
  intentShift: boolean;
  intentChange?: {
    from: string;
    to: string;
  };
}

// 用户旅程接口
export interface UserJourney {
  initialQuery: string;
  steps: JourneyStep[];
  decisionPoints: DecisionPoint[];
  finalQuery: string;
  summary: {
    totalSteps: number;
    intentShifts: number;
    refinementPatterns: string[];
    mainIntent: string;
    autocompleteInfluence?: number;
  };
}

// 模拟器配置接口
export interface UserJourneySimConfig {
  llmService: LLMServiceHub;
  searchEngine?: SearchEngine;
  maxSteps?: number;
  verbose?: boolean;
  evaluator?: JourneyEvaluator;
  autocompleteService?: AutocompleteService; // 自动补全服务
  autocompleteParams?: AutocompleteParameters; // 自动补全参数
  autocompleteEvaluator?: AutocompleteEvaluator; // 自动补全评估器
}

// 旅程评估结果接口
export interface JourneyEvaluationResult {
  journey: UserJourney;
  metrics?: JourneyEvaluationMetrics;
  realData?: RealJourneyData;
}

/**
 * UserJourneySim是一个用于模拟用户搜索行为的组件
 * 它可以基于初始查询模拟完整的用户搜索路径，识别决策点和意图变化
 */
export class UserJourneySim {
  private llmService: LLMServiceHub;
  private searchEngine?: SearchEngine;
  private maxSteps: number;
  private verbose: boolean;
  private evaluator?: JourneyEvaluator;
  private autocompleteService?: AutocompleteService;
  private autocompleteParams: AutocompleteParameters;
  private autocompleteEvaluator?: AutocompleteEvaluator;
  
  constructor(config: UserJourneySimConfig) {
    this.llmService = config.llmService;
    this.searchEngine = config.searchEngine;
    this.maxSteps = config.maxSteps || 5;
    this.verbose = config.verbose || false;
    this.evaluator = config.evaluator;
    this.autocompleteService = config.autocompleteService;
    this.autocompleteParams = config.autocompleteParams || DEFAULT_AUTOCOMPLETE_PARAMETERS;
    this.autocompleteEvaluator = config.autocompleteEvaluator;
    
    if (this.verbose) {
      logger.info(`初始化完成，最大步骤: ${this.maxSteps}`);
    }
  }
  
  /**
   * 模拟用户搜索旅程
   */
  async simulateJourney(initialQuery: string): Promise<UserJourney> {
    if (this.verbose) {
      logger.info(`开始模拟搜索旅程`, { initialQuery });
    }
    
    try {
      logger.info(`调用LLM服务模拟用户旅程`);
      // 使用LLM模拟整个旅程，使用analyze方法替代旧的simulateUserJourney
      const journeyData = await this.llmService.analyze('journey_simulation', {
        initialQuery,
        maxSteps: this.maxSteps,
        task: 'Simulate a user search journey starting with the given query'
      }, {
        temperature: 0.7,
        format: 'json',
        systemPrompt: 'You are an expert user behavior analyst who simulates realistic search journeys.'
      });
      
      logger.info(`LLM服务返回数据，开始验证数据有效性`);
      // 验证journeyData是否有效
      if (!journeyData || typeof journeyData !== 'object') {
        logger.warn('LLM返回的旅程数据无效，使用默认结构');
        
        // 创建默认旅程
        return this.createDefaultJourney(initialQuery);
      }
      
      // 确保有steps属性
      if (!journeyData.steps || !Array.isArray(journeyData.steps) || journeyData.steps.length === 0) {
        logger.warn('LLM返回的旅程数据缺少有效的steps数组，添加默认步骤');
        
        // 添加默认步骤
        journeyData.steps = [{
          query: initialQuery,
          intentType: "informational",
          expectedResults: ["相关信息"],
          userAction: "搜索查询",
          reasoning: "初始查询"
        }];
      }
      
      logger.info(`数据验证完成，开始旅程增强处理`);
      // 初始化步骤并添加自动补全增强
      if (this.autocompleteService) {
        logger.info(`检测到自动补全服务，开始自动补全增强`);
        return await this.enhanceWithAutocomplete(journeyData);
      }
      
      // 如果可用，使用实际搜索引擎数据增强模拟
      if (this.searchEngine) {
        logger.info(`检测到搜索引擎，开始真实数据增强`);
        return await this.enhanceWithRealSearchData(journeyData);
      }
      
      logger.info(`开始分析决策点`);
      // 分析决策点
      const decisionPoints = this.identifyDecisionPoints(journeyData.steps);
      
      logger.info(`开始构建完整旅程`);
      // 构建完整旅程
      const journey: UserJourney = {
        initialQuery,
        steps: journeyData.steps,
        decisionPoints,
        finalQuery: journeyData.steps[journeyData.steps.length - 1].query,
        summary: {
          totalSteps: journeyData.steps.length,
          intentShifts: decisionPoints.filter(dp => dp.intentShift).length,
          refinementPatterns: this.identifyRefinementPatterns(journeyData.steps),
          mainIntent: journeyData.mainIntent || 'not specified'
        }
      };
      
      if (this.verbose) {
        logger.info(`搜索旅程模拟完成，共 ${journey.steps.length} 步，${journey.decisionPoints.length} 个决策点`);
      }
      
      return journey;
    } catch (error) {
      logger.error(`模拟旅程时发生错误: ${error}`);
      return this.createDefaultJourney(initialQuery);
    }
  }
  
  /**
   * 创建默认旅程
   * 当LLM返回的数据无效时使用
   */
  private createDefaultJourney(initialQuery: string): UserJourney {
    const defaultStep: JourneyStep = {
      query: initialQuery,
      intentType: "informational",
      expectedResults: ["相关信息"],
      userAction: "搜索查询",
      reasoning: "初始查询"
    };
    
    return {
      initialQuery,
      steps: [defaultStep],
      decisionPoints: [],
      finalQuery: initialQuery,
      summary: {
        totalSteps: 1,
        intentShifts: 0,
        refinementPatterns: [],
        mainIntent: "informational"
      }
    };
  }
  
  /**
   * 使用自动补全建议增强旅程
   */
  private async enhanceWithAutocomplete(journeyData: any): Promise<UserJourney> {
    if (!this.autocompleteService) {
      throw new Error("自动补全服务未配置");
    }
    
    if (this.verbose) {
      logger.info(`使用自动补全建议增强旅程`);
    }
    
    const initialQuery = journeyData.initialQuery || journeyData.steps[0].query;
    
    // 初始化增强后的步骤列表
    const enhancedSteps: JourneyStep[] = [];
    
    // 处理第一步
    const firstStep = journeyData.steps[0];
    firstStep.suggestedBy = 'llm_only'; // 第一步总是由LLM生成
    firstStep.originalQuery = firstStep.query;
    enhancedSteps.push(firstStep);
    
    // 为接下来的每一步获取自动补全建议
    for (let i = 0; i < journeyData.steps.length - 1; i++) {
      const currentStep = enhancedSteps[i];
      const nextStepFromLLM = journeyData.steps[i + 1];
      
      // 获取当前查询的自动补全建议
      const suggestions = await this.autocompleteService.getSuggestions(currentStep.query);
      
      // 记录显示的建议
      currentStep.suggestionsShown = suggestions;
      
      // 使用自动补全调整下一步
      const nextStep = await this.adjustNextStepWithAutocomplete(
        currentStep,
        nextStepFromLLM,
        suggestions
      );
      
      enhancedSteps.push(nextStep);
    }
    
    // 分析决策点
    const decisionPoints = this.identifyDecisionPoints(enhancedSteps);
    
    // 构建完整旅程
    const journey: UserJourney = {
      initialQuery,
      steps: enhancedSteps,
      decisionPoints,
      finalQuery: enhancedSteps[enhancedSteps.length - 1].query,
      summary: {
        totalSteps: enhancedSteps.length,
        intentShifts: decisionPoints.filter(dp => dp.intentShift).length,
        refinementPatterns: this.identifyRefinementPatterns(enhancedSteps),
        mainIntent: journeyData.mainIntent || 'not specified',
        autocompleteInfluence: this.calculateAutocompleteInfluence(enhancedSteps)
      }
    };
    
    if (this.verbose) {
      const adoptedSteps = enhancedSteps.filter(step => 
        step.suggestedBy === 'autocomplete' || step.suggestedBy === 'enhanced_autocomplete'
      ).length;
      
      logger.info(`自动补全增强完成，共 ${journey.steps.length} 步，采纳了 ${adoptedSteps} 个自动补全建议`);
    }
    
    return journey;
  }
  
  /**
   * 根据自动补全建议调整下一步
   */
  private async adjustNextStepWithAutocomplete(
    currentStep: JourneyStep,
    nextStepFromLLM: JourneyStep,
    suggestions: AutocompleteSuggestion[]
  ): Promise<JourneyStep> {
    logger.info(`开始调整下一步，当前查询: "${currentStep.query}"`);

    // 如果没有建议，使用LLM预测的下一步
    if (!suggestions || suggestions.length === 0) {
      logger.info(`无自动补全建议，使用LLM预测的下一步`);
      return {
        ...nextStepFromLLM,
        suggestedBy: 'llm_only',
        originalQuery: nextStepFromLLM.query
      };
    }
    
    // 决定是否采用建议
    if (Math.random() > this.autocompleteParams.overallAdoptionRate) {
      logger.info(`随机决定不采用自动补全建议，使用LLM预测`);
      return {
        ...nextStepFromLLM,
        suggestedBy: 'llm_only',
        originalQuery: nextStepFromLLM.query
      };
    }
    
    logger.info(`开始对 ${suggestions.length} 个建议进行评分`);

    // 对建议进行评分
    const scoredSuggestions = await Promise.all(suggestions.map(async (suggestion, index) => {
      const llmResult = await this.llmScoreSuggestion(currentStep.query, suggestion.query, nextStepFromLLM.intentType);
      const positionWeight = index < this.autocompleteParams.positionWeights.length
        ? this.autocompleteParams.positionWeights[index]
        : this.autocompleteParams.positionWeights[this.autocompleteParams.positionWeights.length - 1];
      const queryTypeMultiplier = this.autocompleteParams.queryTypeMultipliers[llmResult.intentType] || 1.0;
      const deviationScore = this.autocompleteParams.semanticDeviation[llmResult.semanticDeviation];
      const totalScore = positionWeight * llmResult.relevance * deviationScore * queryTypeMultiplier;
      return {
        suggestion,
        score: totalScore,
        deviationType: llmResult.semanticDeviation
      };
    }));
    
    // 按得分排序
    scoredSuggestions.sort((a, b) => b.score - a.score);
    
    // 选择最高得分的建议
    const bestSuggestion = scoredSuggestions[0];
    
    logger.info(`最佳建议: "${bestSuggestion.suggestion.query}"，得分: ${bestSuggestion.score}`);
    
    // 如果最高得分低于阈值，使用LLM预测
    if (bestSuggestion.score < this.autocompleteParams.relevanceThreshold) {
      logger.info(`最佳建议得分低于阈值 ${this.autocompleteParams.relevanceThreshold}，使用LLM预测`);
      return {
        ...nextStepFromLLM,
        suggestedBy: 'llm_only',
        originalQuery: nextStepFromLLM.query
      };
    }
    
    logger.info(`采用自动补全建议: "${bestSuggestion.suggestion.query}"`);
    
    // 使用自动补全建议
    return {
      ...nextStepFromLLM,
      query: bestSuggestion.suggestion.query,
      reasoning: `${nextStepFromLLM.reasoning} (受到自动补全建议影响)`,
      suggestedBy: 'autocomplete',
      originalQuery: nextStepFromLLM.query,
      position: bestSuggestion.suggestion.position,
      semanticDeviation: bestSuggestion.deviationType
    };
  }
  
  /**
   * 使用LLM评分建议
   */
  private async llmScoreSuggestion(query: string, suggestion: string, intentType: string): Promise<{
    relevance: number,
    semanticDeviation: 'low' | 'medium' | 'high',
    intentType: string
  }> {
    // 构建提示
    const prompt = `Query: "${query}"\nSuggestion: "${suggestion}"\nCurrent Intent: "${intentType}"\n\nEvaluate the suggestion's relevance on a scale of 0-10, its semantic deviation (low/medium/high), and the intent type of the suggestion.`;
    
    // 使用新的analyze方法替代sendPrompt
    const response = await this.llmService.analyze('suggestion_scoring', {
      query,
      suggestion,
      currentIntent: intentType,
      task: 'Evaluate the suggestion relevance, semantic deviation, and intent type'
    }, {
      temperature: 0.3,
      format: 'json',
      systemPrompt: 'You are an expert search behavior analyst evaluating search suggestions.'
    });
    
    // 处理响应
    if (response && typeof response === 'object') {
      return {
        relevance: response.relevance || 5,
        semanticDeviation: response.semanticDeviation || 'medium',
        intentType: response.intentType || intentType
      };
    }
    
    // 默认响应
    return {
      relevance: 5,
      semanticDeviation: 'medium',
      intentType: intentType
    };
  }
  
  /**
   * 计算自动补全对旅程的影响度
   */
  private calculateAutocompleteInfluence(steps: JourneyStep[]): number {
    const influencedSteps = steps.filter(step => 
      step.suggestedBy === 'autocomplete' || step.suggestedBy === 'enhanced_autocomplete'
    );
    
    return steps.length > 1 ? influencedSteps.length / (steps.length - 1) : 0;
  }
  
  /**
   * 使用真实搜索引擎数据增强模拟
   */
  private async enhanceWithRealSearchData(journeyData: any): Promise<UserJourney> {
    logger.info(`开始使用真实搜索引擎数据增强模拟`);
    
    // 这里可以实现与实际搜索引擎的交互
    // 获取真实的搜索结果和建议，增强模拟的真实性
    
    // 检查journeyData结构是否完整
    if (!journeyData || !journeyData.steps || !Array.isArray(journeyData.steps) || journeyData.steps.length === 0) {
      logger.warn('无效的旅程数据，使用默认结构');
      
      // 创建默认步骤
      const defaultSteps: JourneyStep[] = [{
        query: journeyData?.initialQuery || "default query",
        intentType: "informational",
        expectedResults: ["相关信息"],
        userAction: "搜索查询",
        reasoning: "初始查询"
      }];
      
      logger.info(`创建默认旅程，初始查询: "${defaultSteps[0].query}"`);
      
      // 返回默认旅程
      return {
        initialQuery: journeyData?.initialQuery || "default query",
        steps: defaultSteps,
        decisionPoints: [],
        finalQuery: defaultSteps[0].query,
        summary: {
          totalSteps: 1,
          intentShifts: 0,
          refinementPatterns: [],
          mainIntent: "informational"
        }
      };
    }
    
    logger.info(`开始处理有效旅程数据，共 ${journeyData.steps.length} 步`);
    
    // 正常处理有效数据
    const enhancedJourney = {
      initialQuery: journeyData.initialQuery || journeyData.steps[0].query,
      steps: journeyData.steps,
      decisionPoints: this.identifyDecisionPoints(journeyData.steps),
      finalQuery: journeyData.steps[journeyData.steps.length - 1].query,
      summary: {
        totalSteps: journeyData.steps.length,
        intentShifts: this.identifyDecisionPoints(journeyData.steps).filter(dp => dp.intentShift).length,
        refinementPatterns: this.identifyRefinementPatterns(journeyData.steps),
        mainIntent: journeyData.mainIntent || 'not specified'
      }
    };
    
    logger.info(`真实数据增强完成，最终查询: "${enhancedJourney.finalQuery}"`);
    logger.info(`旅程统计: ${enhancedJourney.summary.totalSteps} 步，${enhancedJourney.summary.intentShifts} 次意图转换`);
    
    return enhancedJourney;
  }
  
  /**
   * 识别决策点
   */
  private identifyDecisionPoints(steps: JourneyStep[]): DecisionPoint[] {
    // 添加步骤验证，防止undefined或空数组导致错误
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      logger.warn('无效的步骤数组，无法识别决策点');
      return [];
    }
    
    const decisionPoints: DecisionPoint[] = [];
    
    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i - 1];
      const currentStep = steps[i];
      
      // 检查查询是否发生变化
      if (prevStep.query !== currentStep.query) {
        // 检查意图是否发生变化
        const intentShift = prevStep.intentType !== currentStep.intentType;
        
        decisionPoints.push({
          step: i,
          fromQuery: prevStep.query,
          toQuery: currentStep.query,
          reason: currentStep.reasoning,
          intentShift,
          ...(intentShift ? {
            intentChange: {
              from: prevStep.intentType,
              to: currentStep.intentType
            }
          } : {})
        });
      }
    }
    
    return decisionPoints;
  }
  
  /**
   * 识别查询精炼模式
   */
  private identifyRefinementPatterns(steps: JourneyStep[]): string[] {
    // 添加步骤验证，防止undefined或空数组导致错误
    if (!steps || !Array.isArray(steps) || steps.length <= 1) {
      logger.warn('无效的步骤数组或步骤数量不足，无法识别查询精炼模式');
      return [];
    }
    
    const patterns: Set<string> = new Set();
    
    for (let i = 1; i < steps.length; i++) {
      const prevQuery = steps[i - 1].query.toLowerCase();
      const currentQuery = steps[i].query.toLowerCase();
      
      // 添加特定词
      if (currentQuery.length > prevQuery.length && currentQuery.includes(prevQuery)) {
        patterns.add('addingSpecificity');
      }
      
      // 重新表述
      if (!currentQuery.includes(prevQuery) && prevQuery.split(' ').length === currentQuery.split(' ').length) {
        patterns.add('rephrasing');
      }
      
      // 缩短查询
      if (currentQuery.length < prevQuery.length) {
        patterns.add('simplifying');
      }
      
      // 添加问题词
      if (!prevQuery.match(/^(how|what|why|when|where|who|which)/i) && 
          currentQuery.match(/^(how|what|why|when|where|who|which)/i)) {
        patterns.add('addingQuestionWords');
      }
      
      // 添加商业意图词
      if (currentQuery.match(/(buy|price|review|best|vs|compare)/i) && 
          !prevQuery.match(/(buy|price|review|best|vs|compare)/i)) {
        patterns.add('addingCommercialIntent');
      }
    }
    
    return Array.from(patterns);
  }
  
  /**
   * 获取查询演变路径
   */
  getQueryEvolutionPath(journey: UserJourney): string[] {
    return journey.steps.map(step => step.query);
  }
  
  /**
   * 获取意图变化路径
   */
  getIntentEvolutionPath(journey: UserJourney): string[] {
    return journey.steps.map(step => step.intentType);
  }
  
  /**
   * 分析多个用户旅程以识别共同模式
   */
  async analyzeMultipleJourneys(initialQueries: string[]): Promise<any> {
    if (this.verbose) {
      logger.info(`开始分析多个用户旅程，共 ${initialQueries.length} 个初始查询`);
    }
    
    // 模拟多个旅程
    const journeys = await Promise.all(
      initialQueries.map(query => this.simulateJourney(query))
    );
    
    // 提取常见模式
    const patterns = this.extractCommonPatterns(journeys);
    
    if (this.verbose) {
      logger.info(`多旅程分析完成，发现 ${Object.keys(patterns).length} 种常见模式`);
    }
    
    return {
      journeys,
      patterns,
      summary: {
        totalJourneys: journeys.length,
        averageSteps: this.average(journeys.map(j => j.steps.length)),
        commonIntents: this.getMostCommonIntents(journeys),
        commonRefinements: this.getMostCommonRefinements(journeys)
      }
    };
  }
  
  /**
   * 提取共同模式
   */
  private extractCommonPatterns(journeys: UserJourney[]): Record<string, number> {
    const patternCounts: Record<string, number> = {};
    
    // 计算各种模式的出现频率
    journeys.forEach(journey => {
      journey.summary.refinementPatterns.forEach(pattern => {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      });
    });
    
    return patternCounts;
  }
  
  /**
   * 获取最常见的查询精炼模式
   */
  private getMostCommonRefinements(journeys: UserJourney[]): string[] {
    const patternCounts = this.extractCommonPatterns(journeys);
    
    // 按出现频率排序
    return Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([pattern]) => pattern);
  }
  
  /**
   * 获取最常见的意图类型
   */
  private getMostCommonIntents(journeys: UserJourney[]): string[] {
    const intentCounts: Record<string, number> = {};
    
    // 收集所有步骤中的意图类型
    journeys.forEach(journey => {
      journey.steps.forEach(step => {
        intentCounts[step.intentType] = (intentCounts[step.intentType] || 0) + 1;
      });
    });
    
    // 按出现频率排序
    return Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([intent]) => intent);
  }
  
  /**
   * 计算平均值
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * 评估模拟旅程与真实数据的匹配度
   * @param simulatedJourney 模拟生成的旅程
   * @param realJourneyData 真实旅程数据
   * @returns 评估指标
   */
  evaluateJourney(simulatedJourney: UserJourney, realJourneyData: RealJourneyData): JourneyEvaluationMetrics {
    if (!this.evaluator) {
      this.evaluator = new JourneyEvaluator({
        llmService: this.llmService,
        verbose: this.verbose
      });
    }
    
    return this.evaluator.evaluateJourney(simulatedJourney, realJourneyData);
  }
  
  /**
   * 模拟并评估用户旅程
   * @param initialQuery 初始查询词
   * @param realJourneyData 用于评估的真实旅程数据
   * @returns 包含旅程和评估指标的结果
   */
  async simulateAndEvaluateJourney(initialQuery: string, realJourneyData?: RealJourneyData): Promise<JourneyEvaluationResult> {
    // 模拟旅程
    const journey = await this.simulateJourney(initialQuery);
    
    // 如果没有提供真实数据或未设置评估器，则仅返回旅程
    if (!realJourneyData || !this.evaluator) {
      return { journey };
    }
    
    // 评估模拟旅程
    const metrics = this.evaluateJourney(journey, realJourneyData);
    
    return {
      journey,
      metrics,
      realData: realJourneyData
    };
  }
  
  /**
   * 批量模拟并评估多个用户旅程
   * @param initialQueries 初始查询词列表
   * @param realJourneyDataSet 用于评估的真实旅程数据集
   * @returns 包含所有旅程和评估结果的数组，以及整体评估指标
   */
  async batchSimulateAndEvaluate(
    initialQueries: string[], 
    realJourneyDataSet?: RealJourneyData[]
  ): Promise<{
    results: JourneyEvaluationResult[],
    averageMetrics?: JourneyEvaluationMetrics
  }> {
    // 模拟所有旅程
    const journeys = await Promise.all(
      initialQueries.map(query => this.simulateJourney(query))
    );
    
    // 如果没有提供真实数据或未设置评估器，则仅返回旅程
    if (!realJourneyDataSet || !this.evaluator) {
      return { 
        results: journeys.map(journey => ({ journey }))
      };
    }
    
    // 批量评估
    const batchResults = this.evaluator.evaluateBatch(journeys, realJourneyDataSet);
    
    // 构建结果
    const results = journeys.map((journey, index) => ({
      journey,
      metrics: batchResults.individualScores[index],
      realData: index < realJourneyDataSet.length ? realJourneyDataSet[index] : undefined
    }));
    
    return {
      results,
      averageMetrics: batchResults.averageScore
    };
  }
  
  /**
   * 评估模拟旅程中自动补全采纳行为与真实数据的匹配度
   */
  evaluateAutocompleteAdoption(
    simulatedJourneys: UserJourney[],
    realMetrics: AutocompleteBehaviorMetrics
  ) {
    if (!this.autocompleteEvaluator) {
      this.autocompleteEvaluator = new AutocompleteEvaluator({
        verbose: this.verbose
      });
    }
    
    return this.autocompleteEvaluator.evaluateAutocompleteAdoption(
      simulatedJourneys,
      realMetrics
    );
  }
  
  /**
   * 模拟并评估用户旅程的自动补全采纳行为
   */
  async simulateAndEvaluateAutocompleteAdoption(
    initialQueries: string[],
    realMetrics: AutocompleteBehaviorMetrics
  ) {
    // 模拟旅程
    const journeys = await Promise.all(
      initialQueries.map(query => this.simulateJourney(query))
    );
    
    // 评估自动补全采纳行为
    const evaluationResult = this.evaluateAutocompleteAdoption(
      journeys,
      realMetrics
    );
    
    return {
      journeys,
      evaluationResult
    };
  }
} 