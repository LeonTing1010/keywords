/**
 * KeywordNova 搜索引擎接口
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
  getSuggestions(keyword: string, options?: SearchOptions): Promise<AutocompleteSuggestion>;
  
  /**
   * 初始化搜索引擎
   * @param options 搜索选项
   */
  initialize(options?: SearchOptions): Promise<void>;
  
  /**
   * 关闭搜索引擎资源
   */
  close(): Promise<void>;
} 