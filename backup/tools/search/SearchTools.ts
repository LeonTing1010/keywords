/**
 * SearchTools.ts - 搜索工具集
 * 将SearchEngine封装为工具，便于Agent调用
 */
import { z } from "zod";
import { SearchEngine } from "../../infra/search/SearchEngine";
import { WebSearchEngine } from "../../infra/search/engines/WebSearchEngine";
import { BaiduSearchEngine } from "../../infra/search/engines/BaiduSearchEngine";
import { GoogleSearchEngine } from "../../infra/search/engines/GoogleSearchEngine";
import { logger } from "../../infra/logger";
import { StructuredTool } from "@langchain/core/tools";
import { MockSearchEngine } from "../../infra/search";

/**
 * 搜索工具配置
 */
export interface SearchToolsConfig {
  engineType?: 'google' | 'baidu' | 'web'|'mock';
  searchEngine?: SearchEngine;
  proxyServer?: string;
  mockMode?: boolean;
}

/**
 * 自定义工具类
 * 扩展LangChain的StructuredTool
 */
class CustomTool extends StructuredTool {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  returnDirect = false;
  verbose = false;
  
  get lc_namespace() {
    return ["keyword-tools"];
  }
  
  constructor(config: {
    name: string;
    description: string;
    schema: z.ZodObject<any>;
  }) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.schema = config.schema;
  }
  
  // 重写invoke方法以处理字符串输入
  async invoke(input: any): Promise<string> {
    if (typeof input === 'string') {
      try {
        input = JSON.parse(input);
      } catch (e) {
        // 如果无法解析为JSON，使用原始字符串
      }
    }
    return this._call(input);
  }
  
  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    throw new Error("Method not implemented");
  }
}

/**
 * 搜索工具提供者
 * 提供LangChain兼容的搜索工具，可直接用于Agent
 */
export class SearchTools {
  private static instance: SearchTools;
  private searchEngine: SearchEngine;
  
  /**
   * 获取单例实例
   */
  public static getInstance(config: SearchToolsConfig = {}): SearchTools {
    if (!SearchTools.instance) {
      SearchTools.instance = new SearchTools(config);
    }
    return SearchTools.instance;
  }
  
  /**
   * 初始化搜索工具
   */
  constructor(config: SearchToolsConfig = {}) {
    // 使用提供的SearchEngine实例或创建新的实例
    if (config.searchEngine) {
      this.searchEngine = config.searchEngine;
      logger.debug({ engineType: this.searchEngine.getEngineType() }, 'SearchTools initialized with provided engine');
    } else {
      // 创建默认的搜索引擎
      switch (config.engineType) {
        case 'google':
          this.searchEngine = new GoogleSearchEngine();
          break;
        case 'baidu':
          this.searchEngine = new BaiduSearchEngine();
          break;
        case 'mock':
          this.searchEngine = new MockSearchEngine();
          break;
        default:
          this.searchEngine = new WebSearchEngine();
      }
      
      logger.debug({ engineType: config.engineType || 'web' }, 'SearchTools initialized with new engine');
      
      // 设置代理服务器
      if (config.proxyServer) {
        this.searchEngine.setProxy(config.proxyServer);
      }
    }
  }
  
  /**
   * 获取底层的SearchEngine实例
   */
  getSearchEngine(): SearchEngine {
    return this.searchEngine;
  }
  
  /**
   * 获取搜索结果工具
   */
  getSearchResultsTool() {
    const searchEngine = this.searchEngine;
    
    const tool = new CustomTool({
      name: "get_search_results",
      description: "获取关键词的搜索结果，关键词必须限制在38个汉字以内",
      schema: z.object({
        keyword: z.string().max(38).describe("要搜索的关键词，严格限制最多38个汉字"),
        maxResults: z.number().optional().describe("最大返回结果数量，默认为10")
      })
    });
    
    tool._call = async ({ keyword, maxResults = 10 }: { keyword: string; maxResults?: number }) => {
      try {
        // 确保关键词长度不超过38个字符
        if (keyword.length > 38) {
          logger.warn({ keyword, length: keyword.length }, 'Keyword exceeds 38 character limit, truncating');
          keyword = keyword.substring(0, 38);
        }
        
        logger.debug({ keyword, maxResults }, 'Tool: Getting search results');
        const results = await searchEngine.getSearchResults(keyword, { maxResults });
        return JSON.stringify(results);
      } catch (error) {
        logger.error({ keyword, error }, 'Tool: Error getting search results');
        return JSON.stringify([]);
      }
    };
    
    return tool;
  }
  
  /**
   * 获取关键词发现工具
   */
  getSearchSuggestionsTool() {
    const searchEngine = this.searchEngine;
    
    const tool = new CustomTool({
      name: "get_search_suggestions",
      description: "通过搜索引擎自动补全发现更多相关关键词，主关键词必须限制在38个汉字以内",
      schema: z.object({
        keyword: z.string().max(38).describe("主关键词，严格限制最多38个汉字"),
        maxResults: z.number().optional().describe("最大返回结果数量，默认为30")
      })
    });
    
    tool._call = async ({ keyword, maxResults = 30 }: { keyword: string; maxResults?: number }) => {
      try {
        logger.debug({ keyword }, 'Tool: search suggestions');
        
        // 获取关键词的自动补全建议
        const allSuggestions: string[] = [];
        try {
          const suggestions = await searchEngine.getSuggestions(keyword);
          if (Array.isArray(suggestions)) {
            allSuggestions.push(...suggestions
              .map(s => (s && typeof s.query === 'string' ? s.query : undefined))
              .filter((s): s is string => typeof s === 'string')
            );
          }
        } catch (e) {
          logger.warn({ keyword, error: e }, 'Error getting suggestions for keyword');
        }
        // 过滤掉 undefined 和空字符串
        const filteredSuggestions = allSuggestions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
        // 去重和过滤
        const uniqueSuggestions = [...new Set(filteredSuggestions)]
          .filter(s => s.toLowerCase().includes(keyword.toLowerCase()))
          .slice(0, maxResults);
        
        return JSON.stringify(uniqueSuggestions);
      } catch (error) {
        logger.error({ keyword, error }, 'Tool: Error search suggestions');
        return JSON.stringify([]);
      }
    };
    
    return tool;
  }
  
  /**
   * 获取网页内容工具
   */
  getWebpageContentTool() {
    const searchEngine = this.searchEngine;
    
    const tool = new CustomTool({
      name: "get_webpage_content",
      description: "获取指定URL的网页完整内容，用于分析和提取信息",
      schema: z.object({
        url: z.string().describe("要获取内容的网页URL"),
        options: z.object({
          proxyServer: z.string().optional().describe("代理服务器地址")
        }).optional().describe("可选配置参数")
      })
    });
    
    tool._call = async ({ url, options }: { url: string; options?: { proxyServer?: string } }) => {
      try {
        logger.debug({ url }, 'Tool: Getting webpage content');
        
        const searchOptions = options ? { proxyServer: options.proxyServer } : undefined;
        const content = await searchEngine.getWebpageContent(url, searchOptions);
        
        // 为避免返回过大的内容，这里可以选择返回部分内容或内容长度
        const contentLength = content.length;
        const previewLength = 1000; // 预览长度
        const preview = content.substring(0, previewLength) + 
          (contentLength > previewLength ? `...(共${contentLength}字符)` : '');
        
        return JSON.stringify({
          url,
          contentLength,
          preview,
          content // 完整内容
        });
      } catch (error) {
        logger.error({ url, error }, 'Tool: Error getting webpage content');
        return JSON.stringify({
          url,
          error: `获取网页内容失败: ${(error as Error).message}`,
          content: null
        });
      }
    };
    
    return tool;
  }
  
  /**
   * 获取所有搜索工具
   */
  getAllTools() {
    try {
      return [
        this.getSearchSuggestionsTool(),
        this.getSearchResultsTool(),
        this.getWebpageContentTool(),
      ];
    } catch (error) {
      logger.error({ error }, 'Error getting all tools');
      return []; // Return empty array instead of throwing
    }
  }
  
  /**
   * 静态方法: 获取所有工具
   * 方便直接引用所有工具而不需要创建实例
   */
  static getTools(config: SearchToolsConfig = {}): StructuredTool[] {
    return SearchTools.getInstance(config).getAllTools();
  }
  
  /**
   * 静态方法: 获取搜索结果工具
   */
  static getSearchResultsTool(config: SearchToolsConfig = {}): StructuredTool {
    return SearchTools.getInstance(config).getSearchResultsTool();
  }
  
  /**
   * 静态方法: 获取搜索建议工具
   */
  static getSearchSuggestionsTool(config: SearchToolsConfig = {}): StructuredTool {
    return SearchTools.getInstance(config).getSearchSuggestionsTool();
  }
  
  /**
   * 静态方法: 获取网页内容工具
   */
  static getWebpageContentTool(config: SearchToolsConfig = {}): StructuredTool {
    return SearchTools.getInstance(config).getWebpageContentTool();
  }
  
  /**
   * 关闭搜索引擎资源
   */
  async close(): Promise<void> {
    return this.searchEngine.close();
  }
  
  /**
   * 静态方法: 关闭搜索引擎资源
   */
  static async close(): Promise<void> {
    if (SearchTools.instance) {
      await SearchTools.instance.close();
    }
  }
} 