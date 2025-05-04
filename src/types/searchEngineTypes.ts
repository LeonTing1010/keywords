/**
 * 搜索引擎类型定义文件
 * 集中管理所有与搜索引擎相关的类型定义
 */

/**
 * 支持的搜索引擎类型
 */
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
  /** 是否支持二次查询 */
  supportsSecondRound: boolean;
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
 * 同时适用于初次查询和二次查询，减少复杂性
 */
export interface SearchOptions {
  /** 搜索域名 */
  domain?: string;
  /** 代理服务器地址 */
  proxyServer?: string;
  /** 是否使用系统浏览器 */
  useSystemBrowser?: boolean;
  /** 是否启用二次查询 */
  enableSecondRound?: boolean;
  /** 是否使用持久化浏览器（复用浏览器实例） */
  persistBrowser?: boolean;
  /** 批量处理的大小（每次处理多少查询后重启浏览器） */
  batchSize?: number;
  /** 最大结果数量 */
  maxResults?: number;
  /** 最大提取关键词数量 */
  maxSecondaryKeywords?: number;
  /** 最小关键词长度 */
  minKeywordLength?: number;
  /** 失败重试次数 */
  retryCount?: number;
  /** 查询间延迟 */
  delayBetweenQueries?: {
    min: number;
    max: number;
  };
  /** 自定义过滤器 */
  customFilters?: ((keyword: string) => boolean)[];
}

/**
 * 自动补全建议结果
 */
export interface AutocompleteSuggestion {
  /** 搜索关键词 */
  keyword: string;
  /** 建议数组 */
  suggestions: string[];
  /** 二次查询建议数组（可选） */
  secondarySuggestions?: string[];
}

/**
 * 搜索引擎工厂接口
 */
export interface SearchEngineFactory {
  /** 注册搜索引擎 */
  register(name: SearchEngineType, engineClass: any): void;
  /** 创建搜索引擎实例 */
  create(type: SearchEngineType): any;
  /** 获取已注册的搜索引擎列表 */
  getRegisteredEngines(): string[];
  /** 检查搜索引擎是否已注册 */
  isRegistered(type: SearchEngineType): boolean;
}