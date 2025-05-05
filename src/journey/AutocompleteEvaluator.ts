/**
 * AutocompleteEvaluator - 自动补全评估器
 * 评估模拟旅程中自动补全建议的采纳行为与真实数据的匹配度
 */
import { UserJourney, JourneyStep } from './UserJourneySim';
import { 
  AutocompleteBehaviorMetrics, 
  AutocompleteAdoptionScore,
  AutocompleteSession
} from './AutocompleteParameters';

// 评估器配置接口
export interface AutocompleteEvaluatorConfig {
  weightOverallAdoption?: number;     // 总体采纳率权重
  weightPositionPreference?: number;  // 位置偏好权重
  weightSemanticDeviation?: number;   // 语义偏离权重
  weightQueryTypeInfluence?: number;  // 查询类型影响权重
  verbose?: boolean;                  // 是否输出详细日志
}

/**
 * 自动补全评估器类
 * 评估模拟旅程中自动补全建议的采纳行为
 */
export class AutocompleteEvaluator {
  private weightOverallAdoption: number;
  private weightPositionPreference: number;
  private weightSemanticDeviation: number;
  private weightQueryTypeInfluence: number;
  private verbose: boolean;
  
  constructor(config: AutocompleteEvaluatorConfig = {}) {
    this.weightOverallAdoption = config.weightOverallAdoption || 0.25;
    this.weightPositionPreference = config.weightPositionPreference || 0.3;
    this.weightSemanticDeviation = config.weightSemanticDeviation || 0.25;
    this.weightQueryTypeInfluence = config.weightQueryTypeInfluence || 0.2;
    this.verbose = config.verbose || false;
    
    // 确保权重总和为1
    const totalWeight = this.weightOverallAdoption + this.weightPositionPreference + 
                        this.weightSemanticDeviation + this.weightQueryTypeInfluence;
                        
    if (Math.abs(totalWeight - 1) > 0.01) {
      this.weightOverallAdoption /= totalWeight;
      this.weightPositionPreference /= totalWeight;
      this.weightSemanticDeviation /= totalWeight;
      this.weightQueryTypeInfluence /= totalWeight;
    }
    
    if (this.verbose) {
      console.info(`[AutocompleteEvaluator] 初始化完成，权重配置: 采纳率=${this.weightOverallAdoption}, 位置=${this.weightPositionPreference}, 语义=${this.weightSemanticDeviation}, 查询类型=${this.weightQueryTypeInfluence}`);
    }
  }
  
  /**
   * 评估模拟旅程中自动补全采纳行为与真实数据的匹配度
   */
  evaluateAutocompleteAdoption(
    simulatedJourneys: UserJourney[],
    realMetrics: AutocompleteBehaviorMetrics
  ): AutocompleteAdoptionScore {
    if (this.verbose) {
      console.info(`[AutocompleteEvaluator] 开始评估自动补全采纳行为，共 ${simulatedJourneys.length} 个旅程`);
    }
    
    // 从模拟旅程中提取自动补全采纳行为
    const simulatedBehavior = this.extractAutocompleteAdoptionBehavior(simulatedJourneys);
    
    // 计算各维度相似度
    const overallAdoptionSimilarity = 1 - Math.abs(
      simulatedBehavior.adoptionRate - realMetrics.adoptionRate
    );
    
    const positionPreferenceSimilarity = this.comparePositionPreferences(
      simulatedBehavior.positionPreference,
      realMetrics.positionPreference
    );
    
    const semanticDeviationSimilarity = this.compareDistributions(
      simulatedBehavior.semanticDeviationDistribution,
      realMetrics.semanticDeviationDistribution
    );
    
    const queryTypeInfluenceSimilarity = this.compareDistributions(
      simulatedBehavior.queryTypeInfluence,
      realMetrics.queryTypeInfluence
    );
    
    // 计算综合相似度
    const overallSimilarity = 
      this.weightOverallAdoption * overallAdoptionSimilarity +
      this.weightPositionPreference * positionPreferenceSimilarity +
      this.weightSemanticDeviation * semanticDeviationSimilarity +
      this.weightQueryTypeInfluence * queryTypeInfluenceSimilarity;
    
    const result: AutocompleteAdoptionScore = {
      overallAdoptionSimilarity,
      positionPreferenceSimilarity,
      semanticDeviationSimilarity,
      queryTypeInfluenceSimilarity,
      overallSimilarity
    };
    
    if (this.verbose) {
      console.info(`[AutocompleteEvaluator] 评估完成，综合相似度: ${overallSimilarity.toFixed(4)}`);
    }
    
    return result;
  }
  
  /**
   * 从模拟旅程中提取自动补全采纳行为
   */
  extractAutocompleteAdoptionBehavior(journeys: UserJourney[]): AutocompleteBehaviorMetrics {
    let totalSteps = 0;
    let adoptedSteps = 0;
    const positionCounts: number[] = Array(10).fill(0);
    const semanticDeviationCounts = {
      low: 0,
      medium: 0,
      high: 0
    };
    const queryTypeCounts: Record<string, {total: number, adopted: number}> = {};
    
    // 遍历所有旅程的步骤
    journeys.forEach(journey => {
      journey.steps.forEach((step, index) => {
        // 跳过最后一步，因为没有下一步
        if (index >= journey.steps.length - 1) return;
        
        totalSteps++;
        
        // 记录查询类型
        const intentType = step.intentType;
        if (!queryTypeCounts[intentType]) {
          queryTypeCounts[intentType] = { total: 0, adopted: 0 };
        }
        queryTypeCounts[intentType].total++;
        
        // 检查是否采用了自动补全建议
        if (step.suggestedBy === 'autocomplete' || step.suggestedBy === 'enhanced_autocomplete') {
          adoptedSteps++;
          
          // 记录位置信息
          if (typeof step.position === 'number' && step.position < positionCounts.length) {
            positionCounts[step.position]++;
          }
          
          // 记录查询类型采纳
          queryTypeCounts[intentType].adopted++;
          
          // 记录语义偏离度
          if (step.semanticDeviation) {
            semanticDeviationCounts[step.semanticDeviation as keyof typeof semanticDeviationCounts]++;
          }
        }
      });
    });
    
    // 计算总体采纳率
    const adoptionRate = totalSteps > 0 ? adoptedSteps / totalSteps : 0;
    
    // 计算位置偏好分布
    const totalAdopted = positionCounts.reduce((sum, count) => sum + count, 0);
    const positionPreference = positionCounts.map(count => 
      totalAdopted > 0 ? count / totalAdopted : 0
    );
    
    // 计算语义偏离分布
    const totalDeviations = semanticDeviationCounts.low + semanticDeviationCounts.medium + semanticDeviationCounts.high;
    const semanticDeviationDistribution = {
      low: totalDeviations > 0 ? semanticDeviationCounts.low / totalDeviations : 0.33,
      medium: totalDeviations > 0 ? semanticDeviationCounts.medium / totalDeviations : 0.33,
      high: totalDeviations > 0 ? semanticDeviationCounts.high / totalDeviations : 0.33
    };
    
    // 计算查询类型影响
    const queryTypeInfluence: Record<string, number> = {};
    Object.entries(queryTypeCounts).forEach(([type, counts]) => {
      queryTypeInfluence[type] = counts.total > 0 ? counts.adopted / counts.total : 0;
    });
    
    return {
      adoptionRate,
      positionPreference,
      semanticDeviationDistribution,
      queryTypeInfluence
    };
  }
  
  /**
   * 比较位置偏好分布
   */
  private comparePositionPreferences(dist1: number[], dist2: number[]): number {
    // 确保两个分布长度一致
    const maxLength = Math.max(dist1.length, dist2.length);
    const normalizedDist1 = [...dist1, ...Array(maxLength - dist1.length).fill(0)];
    const normalizedDist2 = [...dist2, ...Array(maxLength - dist2.length).fill(0)];
    
    // 计算欧几里德距离
    let sumSquaredDiff = 0;
    for (let i = 0; i < maxLength; i++) {
      const diff = normalizedDist1[i] - normalizedDist2[i];
      sumSquaredDiff += diff * diff;
    }
    
    // 转换为相似度分数(0-1)
    const distance = Math.sqrt(sumSquaredDiff);
    return Math.max(0, 1 - distance);
  }
  
  /**
   * 比较两个分布的相似度
   */
  private compareDistributions(
    dist1: Record<string, number>, 
    dist2: Record<string, number>
  ): number {
    // 获取所有键
    const allKeys = new Set([...Object.keys(dist1), ...Object.keys(dist2)]);
    
    // 计算差异
    let totalDifference = 0;
    let keyCount = 0;
    
    allKeys.forEach(key => {
      const value1 = dist1[key] || 0;
      const value2 = dist2[key] || 0;
      totalDifference += Math.abs(value1 - value2);
      keyCount++;
    });
    
    // 计算平均差异并转换为相似度
    const averageDifference = keyCount > 0 ? totalDifference / keyCount : 0;
    return Math.max(0, 1 - averageDifference);
  }
  
  /**
   * 从真实会话数据中提取行为指标
   */
  extractMetricsFromSessions(sessions: AutocompleteSession[]): AutocompleteBehaviorMetrics {
    if (this.verbose) {
      console.info(`[AutocompleteEvaluator] 从 ${sessions.length} 个会话提取行为指标`);
    }
    
    let totalQueries = 0;
    let adoptedQueries = 0;
    const positionCounts: number[] = Array(10).fill(0);
    const semanticDeviationCounts = {
      low: 0,
      medium: 0,
      high: 0
    };
    const queryTypeCounts: Record<string, {total: number, adopted: number}> = {};
    
    // 遍历会话
    sessions.forEach(session => {
      totalQueries++;
      
      // 分析查询类型(简化实现)
      const queryType = this.analyzeQueryType(session.query);
      if (!queryTypeCounts[queryType]) {
        queryTypeCounts[queryType] = { total: 0, adopted: 0 };
      }
      queryTypeCounts[queryType].total++;
      
      // 检查是否采用了建议
      if (session.suggestionAdopted) {
        adoptedQueries++;
        
        // 记录位置
        const position = session.adoptedSuggestionPosition;
        if (typeof position === 'number' && position < positionCounts.length) {
          positionCounts[position]++;
        }
        
        // 记录查询类型采纳
        queryTypeCounts[queryType].adopted++;
        
        // 分析语义偏离度
        const deviationType = this.analyzeSemanticDeviation(session.query, session.nextQuery);
        semanticDeviationCounts[deviationType]++;
      }
    });
    
    // 计算总体采纳率
    const adoptionRate = totalQueries > 0 ? adoptedQueries / totalQueries : 0;
    
    // 计算位置偏好分布
    const totalAdopted = positionCounts.reduce((sum, count) => sum + count, 0);
    const positionPreference = positionCounts.map(count => 
      totalAdopted > 0 ? count / totalAdopted : 0
    );
    
    // 计算语义偏离分布
    const totalDeviations = semanticDeviationCounts.low + semanticDeviationCounts.medium + semanticDeviationCounts.high;
    const semanticDeviationDistribution = {
      low: totalDeviations > 0 ? semanticDeviationCounts.low / totalDeviations : 0.33,
      medium: totalDeviations > 0 ? semanticDeviationCounts.medium / totalDeviations : 0.33,
      high: totalDeviations > 0 ? semanticDeviationCounts.high / totalDeviations : 0.33
    };
    
    // 计算查询类型影响
    const queryTypeInfluence: Record<string, number> = {};
    Object.entries(queryTypeCounts).forEach(([type, counts]) => {
      queryTypeInfluence[type] = counts.total > 0 ? counts.adopted / counts.total : 0;
    });
    
    return {
      adoptionRate,
      positionPreference,
      semanticDeviationDistribution,
      queryTypeInfluence
    };
  }
  
  /**
   * 简单分析查询类型(实际应用中可能需要更复杂的实现)
   */
  private analyzeQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.match(/比较|vs|对比|versus/)) {
      return 'comparison';
    }
    if (lowerQuery.match(/买|价格|多少钱|优惠|促销|购买|shop|price/)) {
      return 'transactional';
    }
    if (lowerQuery.match(/推荐|排名|排行|best|top|评价|review/)) {
      return 'commercial';
    }
    if (lowerQuery.match(/如何|怎么|教程|方法|步骤|指南|how|guide/)) {
      return 'informational';
    }
    if (lowerQuery.match(/官网|网站|登录|login|site|官方/)) {
      return 'navigational';
    }
    
    // 默认为信息查询
    return 'informational';
  }
  
  /**
   * 分析语义偏离度
   */
  private analyzeSemanticDeviation(originalQuery: string, nextQuery: string): 'low' | 'medium' | 'high' {
    // 将查询词拆分为词汇
    const words1 = originalQuery.toLowerCase().split(/\s+/);
    const words2 = nextQuery.toLowerCase().split(/\s+/);
    
    // 计算词汇重叠
    const commonWords = words1.filter(word => words2.includes(word));
    const overlapRatio = commonWords.length / Math.max(words1.length, words2.length);
    
    // 根据重叠率判断偏离度
    if (overlapRatio >= 0.7) {
      return 'low';        // 高度相似，微调
    } else if (overlapRatio >= 0.3) {
      return 'medium';     // 中度相似，相关但不同
    } else {
      return 'high';       // 低度相似，完全不同方向
    }
  }
} 