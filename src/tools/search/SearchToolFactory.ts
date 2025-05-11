/**
 * SearchToolFactory.ts - 搜索工具工厂
 * 
 * 用于创建和管理各种搜索相关工具的工厂类
 */

import { Tool } from '../Tool';
import { SearchSuggestionsTool, SearchSuggestionEngine } from './SearchSuggestionsTool';
import { SearchResultsTool, SearchResultsEngine } from './SearchResultsTool';
import { WebpageContentTool, WebpageContentEngine } from './WebpageContentTool';

/**
 * 统一搜索引擎接口
 * 
 * 集成所有搜索功能的统一接口
 */
export interface UnifiedSearchEngine extends 
  SearchSuggestionEngine, 
  SearchResultsEngine,
  WebpageContentEngine {
  // 可以添加其他搜索引擎特定方法
  getEngineType(): string;
  initialize?(options?: any): Promise<void>;
}

/**
 * 搜索工具工厂配置
 */
export interface SearchToolFactoryConfig {
  engine?: UnifiedSearchEngine;
  enableCache?: boolean;
  cacheTimeMs?: number;
}

/**
 * 搜索工具工厂
 * 
 * 管理和创建搜索相关工具
 */
export class SearchToolFactory {
  private engine: UnifiedSearchEngine;
  private toolInstances: Map<string, Tool> = new Map();
  private config: SearchToolFactoryConfig;

  /**
   * 构造函数
   * 
   * @param engine 搜索引擎实例
   * @param config 工厂配置
   */
  constructor(engine: UnifiedSearchEngine, config: SearchToolFactoryConfig = {}) {
    this.engine = engine;
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTimeMs: config.cacheTimeMs ?? 60 * 1000, // 默认缓存1分钟
      ...config
    };
  }

  /**
   * 获取搜索自动补全工具
   * 
   * @returns 搜索自动补全工具实例
   */
  getSearchSuggestionsTool(): Tool {
    // 如果已创建，返回缓存的实例
    if (this.toolInstances.has('searchSuggestions')) {
      return this.toolInstances.get('searchSuggestions')!;
    }

    // 创建新实例
    const tool = new SearchSuggestionsTool(this.engine);
    this.toolInstances.set('searchSuggestions', tool);
    return tool;
  }

  /**
   * 获取搜索结果工具
   * 
   * @returns 搜索结果工具实例
   */
  getSearchResultsTool(): Tool {
    // 如果已创建，返回缓存的实例
    if (this.toolInstances.has('searchResults')) {
      return this.toolInstances.get('searchResults')!;
    }

    // 创建新实例
    const tool = new SearchResultsTool(this.engine);
    this.toolInstances.set('searchResults', tool);
    return tool;
  }

  /**
   * 获取网页内容工具
   * 
   * @returns 网页内容工具实例
   */
  getWebpageContentTool(): Tool {
    // 如果已创建，返回缓存的实例
    if (this.toolInstances.has('webpageContent')) {
      return this.toolInstances.get('webpageContent')!;
    }

    // 创建新实例
    const tool = new WebpageContentTool(this.engine);
    this.toolInstances.set('webpageContent', tool);
    return tool;
  }

  /**
   * 获取所有搜索工具
   * 
   * @returns 搜索工具数组
   */
  getAllTools(): Tool[] {
    return [
      this.getSearchSuggestionsTool(),
      this.getSearchResultsTool(),
      this.getWebpageContentTool()
    ];
  }
} 