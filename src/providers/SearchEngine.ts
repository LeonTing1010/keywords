/**
 * KeywordIntent 搜索引擎接口
 * 定义所有搜索引擎必须实现的功能
 */
import { SearchOptions, AutocompleteSuggestion, SearchEngineConfig } from '../types';

/**
 * 搜索引擎接口
 * 所有搜索引擎提供者必须实现此接口
 */
export interface SearchEngine {
  /**
   * 获取搜索引擎配置
   */
  getConfig(): SearchEngineConfig;
  
  /**
   * 获取搜索建议
   * @param keyword 关键词
   * @param options 搜索选项
   */
  getSuggestions(keyword: string, options?: SearchOptions): Promise<AutocompleteSuggestion[]>;
  
  /**
   * 初始化搜索引擎
   * @param options 搜索选项
   */
  initialize(options?: SearchOptions): Promise<void>;
  
  /**
   * 关闭搜索引擎资源
   */
  close(): Promise<void>;
  
  /**
   * 设置代理服务器
   * @param proxyServer 代理服务器URL
   */
  setProxy(proxyServer: string): void;
  
  /**
   * 设置是否使用系统浏览器
   * @param useSystem 是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void;
  
  /**
   * 设置自定义域名
   * @param domain 自定义域名
   */
  setDomain(domain: string): void;

  /**
   * 获取搜索引擎类型
   * @returns 搜索引擎类型
   */
  getEngineType(): string;
} 