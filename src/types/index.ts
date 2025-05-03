/**
 * Google自动补全建议结果
 */
export interface AutocompleteSuggestion {
  /** 搜索关键词 */
  keyword: string;
  /** 建议数组 */
  suggestions: string[];
}

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
 * 搜索引擎配置接口
 */
export interface SearchEngineConfig {
  /** 搜索引擎名称 */
  name: string;
  /** 搜索引擎默认域名 */
  defaultDomain: string;
  /** 是否支持代理 */
  supportsProxy: boolean;
  /** 是否支持系统浏览器 */
  supportsSystemBrowser: boolean;
  /** 是否支持二次查询 */
  supportsSecondRound: boolean;
  /** 搜索引擎描述 */
  description: string;
}

/**
 * 搜索选项接口
 */
export interface SearchOptions {
  /** Google域名 */
  domain?: string;
  /** 代理服务器 */
  proxyServer?: string;
  /** 是否使用系统浏览器 */
  useSystemBrowser?: boolean;
  /** 是否启用二次查询 */
  enableSecondRound?: boolean;
  /** 其他选项 */
  [key: string]: any;
}

/**
 * 可用的搜索引擎类型
 */
export type SearchEngineType = 
  | 'google' 
  | 'baidu' 
  | 'youtube' 
  | 'bilibili' 
  | 'xiaohongshu' 
  | 'reddit' 
  | 'freepik'; 