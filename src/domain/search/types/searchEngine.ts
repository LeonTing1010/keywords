import { SearchOptions, AutocompleteSuggestion, SearchEngineConfig } from '../../../types';

/**
 * 搜索引擎接口
 * 定义所有搜索引擎必须实现的方法
 */
export interface SearchEngine {
  /**
   * 获取搜索引擎配置
   */
  getConfig(): SearchEngineConfig;

  /**
   * 设置代理服务器
   */
  setProxy(proxyServer: string): void;

  /**
   * 设置是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void;

  /**
   * 设置自定义域名
   */
  setDomain(domain: string): void;

  /**
   * 获取搜索引擎类型
   */
  getEngineType(): string;

  /**
   * 初始化搜索引擎
   */
  initialize(options?: SearchOptions): Promise<void>;

  /**
   * 获取搜索建议
   */
  getSuggestions(keyword: string, options?: SearchOptions): Promise<AutocompleteSuggestion[]>;

  /**
   * 获取搜索结果
   */
  getSearchResults(keyword: string, options?: { maxResults?: number }): Promise<{
    title: string;
    snippet: string;
    url: string;
  }[]>;

  /**
   * 关闭搜索引擎
   */
  close(): Promise<void>;
} 