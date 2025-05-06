/**
 * KeywordIntent 类型定义索引文件
 * 导出所有类型定义，方便其他模块引用
 */

// 搜索提供商相关类型
export type SearchEngineType = 'google' | 'baidu' | string;

/**
 * 搜索引擎配置接口
 */
export interface SearchEngineConfig {
  /** 搜索引擎名称 */
  name: string;
  /** 搜索引擎默认域名 */
  defaultDomain: string;
  /** 是否支持代理 */
  supportsProxy: boolean;
  /** 是否支持使用系统浏览器 */
  supportsSystemBrowser: boolean;
  /** 搜索引擎描述 */
  description: string;
  /** 重试次数 */
  retryAttempts?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 等待时间（毫秒） */
  waitTime?: number;
}

/**
 * 搜索选项接口
 */
export interface SearchOptions {
  /** 搜索域名 */
  domain?: string;
  /** 代理服务器地址 */
  proxyServer?: string;
  /** 是否使用系统浏览器 */
  useSystemBrowser?: boolean;
  /** 最大结果数量 */
  maxResults?: number;
  /** 最大二级查询关键词数量 */
  maxSecondaryKeywords?: number;
  /** 查询间延迟 */
  delayBetweenQueries?: {
    min: number;
    max: number;
  };
  /** 自定义过滤器 */
  customFilters?: ((keyword: string) => boolean)[];
  /** 使用LLM进行分析 */
  useLLM?: boolean;
  /** LLM模型 */
  llmModel?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 满意度阈值 */
  satisfactionThreshold?: number;
}

/**
 * 自动补全建议结果
 */
export interface AutocompleteSuggestion {
  query: string;
  position: number;
  source: string;
  timestamp: number;
}

// 如果需要返回带 keyword 的对象，单独定义
export interface AutocompleteSuggestionResult {
  keyword: string;
  suggestions: AutocompleteSuggestion[];
}

// 意图分析相关类型
/**
 * LLM分析目的
 */
export type AnalysisPurpose = 
  | 'identify_categories'   // 识别关键词类别
  | 'extract_patterns'      // 提取模式
  | 'generate_queries'      // 生成查询
  | 'evaluate_iteration'    // 评估迭代
  | 'plan_next_iteration'   // 规划下一次迭代
  | 'final_analysis';       // 最终分析

/**
 * 关键词类别
 */
export interface KeywordCategories {
  informational?: string[];    // 信息查询类
  problemSolving?: string[];   // 问题解决类
  commercial?: string[];       // 商业交易类
  tutorial?: string[];         // 教程指南类
  definitional?: string[];     // 定义解释类
  [key: string]: string[] | undefined; // 其他自定义类别
}

/**
 * 评分维度
 */
export interface EvaluationDimensions {
  relevance: number;            // 相关性
  longTailValue: number;        // 长尾价值
  commercialValue: number;      // 商业价值
  diversity: number;            // 多样性
  novelty: number;              // 新颖性
  searchVolumePotential: number; // 搜索量潜力
  goalAchievement: number;      // 目标达成率
  domainCoverage: number;       // 领域覆盖度（跨行业/主题领域的广度）
  repetitionPenalty: number;    // 重复度惩罚（降低重复关键词的价值）
}

/**
 * 迭代评估结果
 */
export interface IterationEvaluation {
  dimensions: EvaluationDimensions;
  overallScore: number;           // 总体评分
  analysis: string;               // 分析说明
  recommendContinue: boolean;     // 是否建议继续
  improvementSuggestions: string[]; // 改进建议
  newKeywordsCount?: number;      // 新关键词数量
}

/**
 * 迭代规划分析结果
 */
export interface AnalysisPlanResult {
  gaps: string[];                 // 发现的关键词空缺
  patterns: string[];             // 识别的模式
  targetGoals: string[];          // 下一轮目标
  recommendedQueries: string[];   // 推荐的查询
  domainRotationPlan?: {          // 领域轮换计划（可选）
    dominantDomain: string;       // 主导领域
    focusPercentage: number;      // 主导领域集中度
    forbiddenDomains: string[];   // 禁用领域
    underrepresentedDomains: string[]; // 未充分探索的领域
    rotationStrategy: string;     // 轮换策略
    excessiveFocus: boolean;      // 是否存在过度集中
  };
}

/**
 * 单次迭代结果
 */
export interface IterationResult {
  allSuggestions: string[];                // 所有建议
  queryResults: Record<string, string[]>;  // 每个查询的结果
  mostEffectiveQuery: string;              // 最有效的查询
  newKeywordsCount: number;                // 新关键词数量
}

/**
 * 迭代历史记录
 */
export interface IterationHistory {
  iterationNumber: number;                // 迭代次数
  query: string;                          // 使用的查询词
  queryType: 'initial' | 'iteration';     // 查询类型
  queryResults?: Record<string, string[]>; // 每个查询的结果（可选）
  keywords: string[];                     // 发现的关键词
  newKeywordsCount: number;               // 新发现关键词数量
  satisfactionScore: number;              // 满意度评分
  analysis: string;                       // 分析结果
  evaluationDimensions?: EvaluationDimensions; // 评估维度（可选）
  recommendedQueries: string[];           // 推荐的查询
}

/**
 * 意图分析结果
 */
export interface IntentAnalysisResult {
  categories: KeywordCategories;   // 关键词类别
  highValueKeywords: string[];     // 高价值关键词
  intentDistribution: Record<string, number>; // 意图分布百分比
  contentOpportunities: string[];  // 内容机会
  commercialKeywords: string[];    // 商业关键词
  summary: string;                 // 总结
  insights: string[];              // 关键洞察
  bestPatterns: string[];          // 最佳查询模式
  domainDistribution: Record<string, number>; // 领域分布百分比
  underrepresentedDomains: string[]; // 未充分探索的领域
  diversityAnalysis: Record<string, any>; // 多样性分析
}

/**
 * 发现引擎结果
 */
export interface DiscoveryResult {
  originalKeyword: string;         // 原始关键词
  totalIterations: number;         // 总迭代次数
  totalKeywordsDiscovered: number; // 发现的总关键词数
  keywordsByIteration: Record<number, string[]>; // 每次迭代的关键词
  satisfactionByIteration: Record<number, number>; // 每次迭代的满意度
  keywords: string[];              // 所有关键词
  highValueKeywords: string[];     // 高价值关键词
  intentAnalysis: IntentAnalysisResult | null; // 意图分析结果
  iterationHistory: IterationHistory[]; // 迭代历史
  summary: string;                 // 总结
}

// 重新导出搜索引擎相关类型
export * from './searchEngineTypes';
export * from './llmTypes';

// 其他类型定义

/**
 * Google Trends结果
 */
export interface TrendsResult {
  keyword: string;
  csvPath: string;
}

/**
 * SEMrush关键词数据
 */
export interface SemrushData {
  keyword: string;
  volume: string;
}

/**
 * SimilarWeb流量数据
 */
export interface SimilarWebData {
  domain: string;
  monthlyTraffic: string;
}

/**
 * 需要认证的服务的凭证
 */
export interface Credentials {
  email: string;
  password: string;
}

/**
 * Type definitions index file
 * Re-exports all types from the keyword types file
 */

// Re-export all types from keywordTypes.ts
export * from './keywordTypes';