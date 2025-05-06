/**
 * 搜索引擎类型
 */
export type SearchEngineType = 'google' | 'baidu' | string;

/**
 * 搜索引擎配置接口
 */
export interface SearchEngineConfig {
  /** 搜索引擎名称 */
  name: string;
  /** 默认域名 */
  defaultDomain: string;
  /** 是否支持代理 */
  supportsProxy: boolean;
  /** 是否支持系统浏览器 */
  supportsSystemBrowser: boolean;
  /** 搜索引擎描述 */
  description: string;
  /** 重试次数 */
  retryAttempts?: number;
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 等待时间(毫秒) */
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
  /** 最大结果数 */
  maxResults?: number;
  /** 最大二级关键词数量 */
  maxSecondaryKeywords?: number;
  /** 查询间隔延迟 */
  delayBetweenQueries?: {
    min: number;
    max: number;
  };
  /** 自定义过滤器 */
  customFilters?: ((keyword: string) => boolean)[];
  /** 使用LLM分析 */
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
  /** 查询关键词 */
  query: string;
  /** 在建议列表中的位置 */
  position: number;
  /** 来源搜索引擎 */
  source: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  /** 标题 */
  title: string;
  /** 摘要 */
  snippet: string;
  /** URL */
  url: string;
}

/**
 * 未满足需求接口
 */
export interface UnmetNeed {
  /** 关键词 */
  keyword: string;
  /** 是否未满足 */
  isUnmetNeed: boolean;
  /** 内容质量评分 (0-1) */
  contentQuality: number;
  /** 未满足原因 */
  reason: string;
}

/**
 * 分析目的类型
 */
export type AnalysisPurpose = 
  | 'identify_categories'   // 识别关键词类别
  | 'extract_patterns'      // 提取模式
  | 'generate_queries'      // 生成查询
  | 'evaluate_iteration'    // 评估迭代
  | 'plan_next_iteration'   // 规划下一轮迭代
  | 'final_analysis';       // 最终分析 