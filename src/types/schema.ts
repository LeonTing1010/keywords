/**
 * State Schema - 多Agent系统的共享状态定义
 * 基于LangGraph架构，用于灵活的Agent协作和状态管理
 */
import { z } from 'zod';

/**
 * 关键词发现数据结构
 */
export const KeywordDiscoveryState = z.object({
  keyword: z.string(),
  discoveredKeywords: z.array(z.string()).default([]),
  potentialUnmetNeeds: z.array(z.object({
    keyword: z.string(),
    confidence: z.number(),
    reason: z.string()
  })).default([]),
  insights: z.array(z.object({
    title: z.string(),
    description: z.string()
  })).default([]),
  statistics: z.object({
    totalDiscovered: z.number().default(0),
    unmetNeedsCount: z.number().default(0),
    insightsCount: z.number().default(0),
    processingTimeMs: z.number().default(0)
  }).default({})
});

/**
 * 用户旅程模拟数据结构
 */
export const JourneySimulationState = z.object({
  startKeyword: z.string(),
  steps: z.array(z.object({
    query: z.string(),
    suggestions: z.array(z.string()).default([]),
    nextQueries: z.array(z.object({
      suggestion: z.string(),
      satisfaction: z.number(),
      reason: z.string()
    })).default([]),
    satisfaction: z.number()
  })).default([]),
  decisionPoints: z.array(z.object({
    currentQuery: z.string(),
    chosenOption: z.string(),
    reasonForChoice: z.string()
  })).default([]),
  painPoints: z.array(z.object({
    description: z.string(),
    severity: z.number(),
    relatedQueries: z.array(z.string()).default([]),
    possibleSolutions: z.array(z.string()).default([])
  })).default([]),
  opportunities: z.array(z.object({
    description: z.string(),
    potentialValue: z.number(),
    targetAudience: z.string(),
    implementationDifficulty: z.number()
  })).default([]),
  insights: z.array(z.string()).default([]),
  metrics: z.object({
    satisfactionScore: z.number().default(0),
    completionRate: z.number().default(0),
    averageStepCount: z.number().default(0),
    totalPainPoints: z.number().default(0),
    totalOpportunities: z.number().default(0)
  }).default({})
});

/**
 * 内容分析数据结构
 */
export const ContentAnalysisState = z.object({
  keyword: z.string(),
  unmetNeeds: z.array(z.object({
    keyword: z.string(),
    isUnmetNeed: z.boolean(),
    contentQuality: z.number(),
    reason: z.string(),
    marketGapSeverity: z.number()
  })).default([]),
  marketInsights: z.array(z.object({
    title: z.string(),
    description: z.string(),
    evidenceType: z.enum(['search-data', 'user-behavior', 'content-analysis']),
    confidenceScore: z.number(),
    relevantKeywords: z.array(z.string()).default([])
  })).default([]),
  concreteUnmetNeeds: z.array(z.object({
    keyword: z.string(),
    description: z.string(),
    painPointRelation: z.string(),
    trendRelevance: z.number(),
    marketGap: z.string(),
    potentialValue: z.number(),
    targetAudience: z.string(),
    possibleSolutions: z.array(z.string()).default([])
  })).default([]),
  statistics: z.object({
    unmetNeedsCount: z.number().default(0),
    insightsCount: z.number().default(0),
    concreteNeedsCount: z.number().default(0),
    averageContentQuality: z.number().default(0),
    averageMarketGapSeverity: z.number().default(0)
  }).default({})
});

/**
 * 报告生成数据结构
 */
export const ReportGenerationState = z.object({
  keyword: z.string(),
  reportContent: z.string().default(""),
  reportPath: z.string().default(""),
  format: z.enum(['markdown', 'json']).default('markdown'),
  metrics: z.object({
    wordCount: z.number().default(0),
    insightsCount: z.number().default(0),
    recommendationsCount: z.number().default(0),
    generationTimeMs: z.number().default(0)
  }).default({})
});

/**
 * 系统完整状态结构
 */
export const GraphState = z.object({
  // 输入数据
  input: z.object({
    keyword: z.string(),
    options: z.object({
      includeDetails: z.boolean().default(false),
      fast: z.boolean().default(false),
      maxKeywords: z.number().optional(),
      maxRetries: z.number().optional()
    }).default({})
  }),
  
  // 中间处理状态
  keywordDiscovery: KeywordDiscoveryState.optional(),
  journeySimulation: JourneySimulationState.optional(),
  contentAnalysis: ContentAnalysisState.optional(),
  reportGeneration: ReportGenerationState.optional(),
  
  // 处理控制
  executionMetadata: z.object({
    startTime: z.number().default(Date.now),
    endTime: z.number().optional(),
    elapsedTimeMs: z.number().optional(),
    currentNode: z.string().default("start"),
    previousNode: z.string().optional(),
    errors: z.array(z.object({
      node: z.string(),
      message: z.string(),
      timestamp: z.number()
    })).default([]),
    completedNodes: z.array(z.string()).default([]),
    nodeDecisions: z.record(z.string()).default({})
  }).default({}),
  
  // 输出结果
  output: z.object({
    success: z.boolean().default(true),
    error: z.string().optional(),
    timestamp: z.number().default(Date.now),
    keyword: z.string(),
    metrics: z.object({
      totalProcessingTimeMs: z.number().default(0),
      totalKeywordsDiscovered: z.number().default(0),
      totalUnmetNeeds: z.number().default(0),
      totalInsights: z.number().default(0),
      totalOpportunities: z.number().default(0)
    }).default({})
  }).optional()
});

// 导出类型
export type KeywordDiscoveryStateType = z.infer<typeof KeywordDiscoveryState>;
export type JourneySimulationStateType = z.infer<typeof JourneySimulationState>;
export type ContentAnalysisStateType = z.infer<typeof ContentAnalysisState>;
export type ReportGenerationStateType = z.infer<typeof ReportGenerationState>;
export type GraphStateType = z.infer<typeof GraphState>; 