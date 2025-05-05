/**
 * AutocompleteParameters - 自动补全采纳参数
 * 控制用户旅程模拟中自动补全建议的采纳策略
 */

/**
 * 自动补全采纳参数接口
 */
export interface AutocompleteParameters {
  overallAdoptionRate: number;        // 总体采纳概率(0-1)
  positionWeights: number[];          // 各位置权重，索引对应建议位置
  relevanceThreshold: number;         // 相关性阈值(0-1)
  semanticDeviation: {                // 语义偏离倾向
    low: number,                      // 微调权重
    medium: number,                   // 相关但不同权重
    high: number                      // 完全不同方向权重
  };
  intentInfluence: number;            // 意图对采纳的影响权重(0-1)
  queryTypeMultipliers: {             // 不同查询类型的采纳倍率
    [queryType: string]: number;      // 如informational: 0.8, commercial: 1.2等
  };
}

/**
 * 默认自动补全参数
 */
export const DEFAULT_AUTOCOMPLETE_PARAMETERS: AutocompleteParameters = {
  overallAdoptionRate: 0.65,          // 65%的概率会采纳自动补全建议
  positionWeights: [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.01],
  relevanceThreshold: 0.5,            // 相关性需达到0.5以上才考虑采纳
  semanticDeviation: {
    low: 0.8,                         // 微调类型建议的权重
    medium: 0.5,                      // 相关但方向不同的建议权重
    high: 0.2                         // 完全不同方向的建议权重
  },
  intentInfluence: 0.7,               // 意图匹配度的影响权重
  queryTypeMultipliers: {
    // 不同查询类型对采纳率的影响
    informational: 0.9,               // 信息查询，采纳率略低
    navigational: 0.7,                // 导航查询，采纳率较低
    commercial: 1.2,                  // 商业查询，采纳率较高
    transactional: 1.3,               // 交易查询，采纳率最高
    comparison: 1.1,                  // 比较查询，采纳率较高
    research: 0.8                     // 研究查询，采纳率略低
  }
};

/**
 * 自动补全行为指标接口
 */
export interface AutocompleteBehaviorMetrics {
  adoptionRate: number;                // 总体采纳率
  positionPreference: number[];        // 各位置采纳概率分布
  semanticDeviationDistribution: {     // 语义偏离度分布
    low: number,                       // 微调采纳率
    medium: number,                    // 相关但不同采纳率 
    high: number                       // 完全不同方向采纳率
  };
  queryTypeInfluence: Record<string, number>; // 不同查询类型的采纳率
}

/**
 * 自动补全采纳评估分数接口
 */
export interface AutocompleteAdoptionScore {
  overallAdoptionSimilarity: number;       // 总体采纳率相似度
  positionPreferenceSimilarity: number;    // 位置偏好相似度
  semanticDeviationSimilarity: number;     // 语义偏离相似度
  queryTypeInfluenceSimilarity: number;    // 查询类型影响相似度
  overallSimilarity: number;               // 综合相似度
}

/**
 * 自动补全会话接口
 */
export interface AutocompleteSession {
  query: string;                        // 用户查询
  suggestionsShown: string[];           // 展示的自动补全建议
  nextQuery: string;                    // 用户下一个查询
  suggestionAdopted: boolean;           // 是否采用了建议
  adoptedSuggestionPosition?: number;   // 如果采用，建议的位置
  timestamp: number;                    // 会话时间戳
} 