/**
 * KeywordNova LLM相关类型定义
 */

// LLM专用类型，如果有扩展需要可在此添加
// 当前所有类型已在主types文件中定义，此文件为未来扩展预留

// 这个导出是为了确保此模块被正确导入
export const __LLM_TYPES_LOADED__ = true;

/**
 * LLM分析目的
 */
export type LLMAnalysisPurpose = 
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
 * 记录每次迭代的详细信息，用于LLM分析
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
 * 迭代查询选项
 */
export interface IterativeQueryOptions {
  maxIterations?: number;          // 最大迭代次数
  satisfactionThreshold?: number;  // 满意度阈值
  minNewKeywords?: number;         // 最小新关键词数量
  llmModel?: string;               // LLM模型
  [key: string]: any;              // 其他选项
}

/**
 * 迭代查询结果
 */
export interface IterativeQueryResult {
  originalKeyword: string;         // 原始关键词
  totalIterations: number;         // 总迭代次数
  totalKeywordsDiscovered: number; // 发现的总关键词数
  keywordsByIteration: Record<number, string[]>; // 每次迭代的关键词
  satisfactionByIteration: Record<number, number>; // 每次迭代的满意度
  keywords: string[];              // 所有关键词
  finalReport: any;                // 最终报告
  iterationHistory: IterationHistory[]; // 完整迭代历史
}

/**
 * 最终报告
 */
export interface FinalReport {
  categories: KeywordCategories;   // 关键词类别
  topKeywords: string[];           // 顶级关键词
  intentAnalysis: any;             // 意图分析
  contentOpportunities: string[];  // 内容机会
  commercialKeywords: string[];    // 商业关键词
  summary: string;                 // 总结
  iterationInsights?: string[];    // 迭代过程洞察
  bestPatterns?: string[];         // 最佳查询模式
} 