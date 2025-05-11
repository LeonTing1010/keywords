/**
 * 搜索引擎相关类型定义
 */

/**
 * 搜索引擎配置
 */
export interface SearchEngineConfig {
  name: string;
  defaultDomain: string;
  supportsProxy: boolean;
  supportsSystemBrowser: boolean;
  description: string;
  retryAttempts: number;
  timeout: number;
  waitTime: number;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  proxyServer?: string;
  domain?: string;
  customFilters?: ((suggestion: string) => boolean)[];
}

/**
 * 自动补全建议
 */
export interface AutocompleteSuggestion {
  query: string;
  position: number;
  source: string;
  timestamp: number;
} 