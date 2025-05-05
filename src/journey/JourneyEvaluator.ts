/**
 * JourneyEvaluator - 用户搜索旅程评估器
 * 评估模拟搜索旅程与真实用户行为的匹配度
 */
import { UserJourney, JourneyStep } from './UserJourneySim';
import { LLMServiceHub } from '../llm/LLMServiceHub';

// 评估指标接口
export interface JourneyEvaluationMetrics {
  patternSimilarity: number;        // 查询修改模式相似度 (0-1)
  intentTransitionAccuracy: number; // 意图转换准确性 (0-1)
  queryRelevance: number;           // 查询相关性评分 (0-1)
  overallScore: number;             // 综合得分 (0-1)
}

// 真实旅程数据接口
export interface RealJourneyData {
  queries: string[];                 // 查询序列
  refinementPatterns?: string[];     // 查询修改模式
  intentTransitions?: Array<{        // 意图转换点
    fromQuery: string;
    toQuery: string;
    fromIntent?: string;
    toIntent?: string;
  }>;
}

/**
 * 用户旅程评估器配置接口
 */
export interface JourneyEvaluatorConfig {
  llmService?: LLMServiceHub;     // LLM服务，用于语义相似度评估
  patternWeight?: number;         // 模式相似度权重
  intentWeight?: number;          // 意图转换权重
  relevanceWeight?: number;       // 查询相关性权重
  verbose?: boolean;              // 是否输出详细日志
}

/**
 * JourneyEvaluator是一个评估模拟旅程质量的组件
 * 它可以衡量模拟旅程与真实用户行为的匹配度
 */
export class JourneyEvaluator {
  private llmService?: LLMServiceHub;
  private patternWeight: number;
  private intentWeight: number;
  private relevanceWeight: number;
  private verbose: boolean;
  
  constructor(config: JourneyEvaluatorConfig = {}) {
    this.llmService = config.llmService;
    this.patternWeight = config.patternWeight || 0.3;
    this.intentWeight = config.intentWeight || 0.4;
    this.relevanceWeight = config.relevanceWeight || 0.3;
    this.verbose = config.verbose || false;
    
    // 确保权重总和为1
    const totalWeight = this.patternWeight + this.intentWeight + this.relevanceWeight;
    if (Math.abs(totalWeight - 1) > 0.01) {
      this.patternWeight /= totalWeight;
      this.intentWeight /= totalWeight;
      this.relevanceWeight /= totalWeight;
    }
    
    if (this.verbose) {
      console.info(`[JourneyEvaluator] 初始化完成，权重配置: 模式=${this.patternWeight}, 意图=${this.intentWeight}, 相关性=${this.relevanceWeight}`);
    }
  }
  
  /**
   * 评估模拟旅程与真实旅程的匹配度
   */
  evaluateJourney(simulatedJourney: UserJourney, realJourneyData: RealJourneyData): JourneyEvaluationMetrics {
    if (this.verbose) {
      console.info(`[JourneyEvaluator] 开始评估旅程，初始查询: "${simulatedJourney.initialQuery}"`);
    }
    
    // 计算模式相似度
    const patternSimilarity = this.evaluatePatternSimilarity(
      simulatedJourney.summary.refinementPatterns,
      realJourneyData.refinementPatterns || []
    );
    
    // 计算意图转换准确性
    const intentTransitionAccuracy = this.evaluateIntentTransitions(
      simulatedJourney.decisionPoints,
      realJourneyData.intentTransitions || []
    );
    
    // 计算查询相关性评分
    const queryRelevance = this.evaluateQueryRelevance(
      this.extractQueries(simulatedJourney),
      realJourneyData.queries
    );
    
    // 计算综合得分
    const overallScore = 
      this.patternWeight * patternSimilarity +
      this.intentWeight * intentTransitionAccuracy +
      this.relevanceWeight * queryRelevance;
    
    const metrics: JourneyEvaluationMetrics = {
      patternSimilarity,
      intentTransitionAccuracy,
      queryRelevance,
      overallScore
    };
    
    if (this.verbose) {
      console.info(`[JourneyEvaluator] 评估完成，综合得分: ${overallScore.toFixed(2)}`);
    }
    
    return metrics;
  }
  
  /**
   * 评估模式相似度
   */
  private evaluatePatternSimilarity(simulatedPatterns: string[], realPatterns: string[]): number {
    if (simulatedPatterns.length === 0 && realPatterns.length === 0) {
      return 1.0; // 都为空，视为完全匹配
    }
    
    if (simulatedPatterns.length === 0 || realPatterns.length === 0) {
      return 0.0; // 一个为空，一个不为空，视为完全不匹配
    }
    
    // 计算共有模式的数量
    const commonPatterns = simulatedPatterns.filter(pattern => 
      realPatterns.includes(pattern)
    );
    
    // 计算Jaccard相似度: 交集大小 / 并集大小
    const union = new Set([...simulatedPatterns, ...realPatterns]);
    return commonPatterns.length / union.size;
  }
  
  /**
   * 评估意图转换准确性
   */
  private evaluateIntentTransitions(
    simulatedDecisionPoints: Array<any>,
    realTransitions: Array<any>
  ): number {
    if (simulatedDecisionPoints.length === 0 && realTransitions.length === 0) {
      return 1.0; // 都为空，视为完全匹配
    }
    
    if (simulatedDecisionPoints.length === 0 || realTransitions.length === 0) {
      return 0.0; // 一个为空，一个不为空，视为不匹配
    }
    
    // 从模拟决策点中提取转换
    const simulatedTransitions = simulatedDecisionPoints.map(dp => ({
      fromQuery: dp.fromQuery,
      toQuery: dp.toQuery,
      fromIntent: dp.intentChange?.from,
      toIntent: dp.intentChange?.to
    }));
    
    // 计算匹配的转换数量
    let matchCount = 0;
    
    for (const simTrans of simulatedTransitions) {
      // 在真实转换中寻找匹配项
      const matchingTransition = realTransitions.find(realTrans => 
        this.isTransitionSimilar(simTrans, realTrans)
      );
      
      if (matchingTransition) {
        matchCount++;
      }
    }
    
    // 计算匹配率
    return matchCount / Math.max(simulatedTransitions.length, realTransitions.length);
  }
  
  /**
   * 检查两个转换是否相似
   */
  private isTransitionSimilar(trans1: any, trans2: any): boolean {
    // 查询匹配标准: 相同或高度相似
    const queriesSimilar = this.areQueriesSimilar(trans1.fromQuery, trans2.fromQuery) &&
                          this.areQueriesSimilar(trans1.toQuery, trans2.toQuery);
    
    // 如果两者都有意图信息，则还需检查意图是否匹配
    if (trans1.fromIntent && trans1.toIntent && trans2.fromIntent && trans2.toIntent) {
      return queriesSimilar && 
             trans1.fromIntent === trans2.fromIntent &&
             trans1.toIntent === trans2.toIntent;
    }
    
    // 如果意图信息不完整，仅比较查询
    return queriesSimilar;
  }
  
  /**
   * 判断两个查询是否相似
   */
  private areQueriesSimilar(query1: string, query2: string): boolean {
    // 简单实现: 计算编辑距离或检查关键词重叠
    // 这里使用简化的字符串比较，实际应用中可以使用更复杂的语义相似度算法
    
    const words1 = query1.toLowerCase().split(/\s+/);
    const words2 = query2.toLowerCase().split(/\s+/);
    
    // 计算关键词重叠率
    const commonWords = words1.filter(word => words2.includes(word));
    const overlapRatio = commonWords.length / Math.max(words1.length, words2.length);
    
    return overlapRatio >= 0.5; // 50%的关键词重叠视为相似
  }
  
  /**
   * 评估查询相关性
   */
  private evaluateQueryRelevance(simulatedQueries: string[], realQueries: string[]): number {
    if (simulatedQueries.length === 0 && realQueries.length === 0) {
      return 1.0;
    }
    
    if (simulatedQueries.length === 0 || realQueries.length === 0) {
      return 0.0;
    }
    
    // 如果有LLM服务，可以使用嵌入计算相似度
    if (this.llmService) {
      // 实际项目中可以实现基于嵌入的相似度计算
      // 此处为简化实现
      return this.calculateQuerySetRelevance(simulatedQueries, realQueries);
    }
    
    // 回退方法：词汇重叠计算
    return this.calculateQuerySetRelevance(simulatedQueries, realQueries);
  }
  
  /**
   * 计算两组查询之间的相关性
   */
  private calculateQuerySetRelevance(queries1: string[], queries2: string[]): number {
    if (queries1.length === 0 || queries2.length === 0) {
      return 0;
    }
    
    // 将所有查询分解为词汇集合
    const words1 = new Set(
      queries1.flatMap(q => q.toLowerCase().split(/\s+/))
        .filter(word => word.length > 2) // 过滤掉短词
    );
    
    const words2 = new Set(
      queries2.flatMap(q => q.toLowerCase().split(/\s+/))
        .filter(word => word.length > 2) // 过滤掉短词
    );
    
    // 计算词汇重叠
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard相似度
    return intersection.size / union.size;
  }
  
  /**
   * 从旅程中提取查询序列
   */
  private extractQueries(journey: UserJourney): string[] {
    return journey.steps.map(step => step.query);
  }
  
  /**
   * 对一组模拟旅程进行批量评估
   */
  evaluateBatch(
    simulatedJourneys: UserJourney[], 
    realJourneyDataSet: RealJourneyData[]
  ): {individualScores: JourneyEvaluationMetrics[], averageScore: JourneyEvaluationMetrics} {
    const scores = simulatedJourneys.map((journey, index) => {
      // 获取对应的真实数据，如果没有对应数据则使用第一个
      const realData = index < realJourneyDataSet.length 
        ? realJourneyDataSet[index] 
        : realJourneyDataSet[0];
        
      return this.evaluateJourney(journey, realData);
    });
    
    // 计算平均分
    const averageScore: JourneyEvaluationMetrics = {
      patternSimilarity: this.average(scores.map(s => s.patternSimilarity)),
      intentTransitionAccuracy: this.average(scores.map(s => s.intentTransitionAccuracy)),
      queryRelevance: this.average(scores.map(s => s.queryRelevance)),
      overallScore: this.average(scores.map(s => s.overallScore))
    };
    
    return {
      individualScores: scores,
      averageScore
    };
  }
  
  /**
   * 计算数组平均值
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
} 