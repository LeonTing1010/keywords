/**
 * UserJourneySim - 用户搜索旅程模拟器
 * 模拟用户在搜索引擎中的整个搜索旅程，识别决策点和查询修改模式
 */
import { LLMServiceHub, AnalysisOptions } from '../llm/LLMServiceHub';
import { SearchEngine } from '../providers/SearchEngine';

// 旅程步骤接口
export interface JourneyStep {
  query: string;
  intentType: string;
  expectedResults: string[];
  userAction: string;
  reasoning: string;
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
  };
}

// 模拟器配置接口
export interface UserJourneySimConfig {
  llmService: LLMServiceHub;
  searchEngine?: SearchEngine;
  maxSteps?: number;
  verbose?: boolean;
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
  
  constructor(config: UserJourneySimConfig) {
    this.llmService = config.llmService;
    this.searchEngine = config.searchEngine;
    this.maxSteps = config.maxSteps || 5;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      console.info(`[UserJourneySim] 初始化完成，最大步骤: ${this.maxSteps}`);
    }
  }
  
  /**
   * 模拟用户搜索旅程
   */
  async simulateJourney(initialQuery: string): Promise<UserJourney> {
    if (this.verbose) {
      console.info(`[UserJourneySim] 开始模拟搜索旅程，初始查询: "${initialQuery}"`);
    }
    
    // 使用LLM模拟整个旅程
    const journeyData = await this.llmService.simulateUserJourney(initialQuery, {
      temperature: 0.7,
      format: 'json'
    });
    
    // 如果可用，使用实际搜索引擎数据增强模拟
    if (this.searchEngine) {
      return await this.enhanceWithRealSearchData(journeyData);
    }
    
    // 分析决策点
    const decisionPoints = this.identifyDecisionPoints(journeyData.steps);
    
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
      console.info(`[UserJourneySim] 搜索旅程模拟完成，共 ${journey.steps.length} 步，${journey.decisionPoints.length} 个决策点`);
    }
    
    return journey;
  }
  
  /**
   * 使用真实搜索引擎数据增强模拟
   */
  private async enhanceWithRealSearchData(journeyData: any): Promise<UserJourney> {
    // 这里可以实现与实际搜索引擎的交互
    // 获取真实的搜索结果和建议，增强模拟的真实性
    
    // 目前仅返回原始数据
    return {
      initialQuery: journeyData.initialQuery,
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
  }
  
  /**
   * 识别决策点
   */
  private identifyDecisionPoints(steps: JourneyStep[]): DecisionPoint[] {
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
      console.info(`[UserJourneySim] 开始分析多个用户旅程，共 ${initialQueries.length} 个初始查询`);
    }
    
    // 模拟多个旅程
    const journeys = await Promise.all(
      initialQueries.map(query => this.simulateJourney(query))
    );
    
    // 提取常见模式
    const patterns = this.extractCommonPatterns(journeys);
    
    if (this.verbose) {
      console.info(`[UserJourneySim] 多旅程分析完成，发现 ${Object.keys(patterns).length} 种常见模式`);
    }
    
    return {
      journeys,
      patterns,
      summary: {
        totalJourneys: journeys.length,
        averageSteps: journeys.reduce((sum, j) => sum + j.steps.length, 0) / journeys.length,
        commonRefinements: this.getMostCommonRefinements(journeys)
      }
    };
  }
  
  /**
   * 提取多个旅程中的共同模式
   */
  private extractCommonPatterns(journeys: UserJourney[]): Record<string, number> {
    const patternCounts: Record<string, number> = {};
    
    // 统计模式出现频率
    journeys.forEach(journey => {
      journey.summary.refinementPatterns.forEach(pattern => {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      });
    });
    
    return patternCounts;
  }
  
  /**
   * 获取最常见的查询精炼方式
   */
  private getMostCommonRefinements(journeys: UserJourney[]): string[] {
    const patterns = this.extractCommonPatterns(journeys);
    
    // 根据频率排序
    return Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .map(([pattern]) => pattern);
  }
} 