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

/**
 * 搜索工具配置
 */
export interface SearchToolsConfig {
  engineType?: 'google' | 'baidu' | 'web';
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
  private searchEngine: SearchEngine;
  
  /**
   * 初始化搜索工具
   */
  constructor(config: SearchToolsConfig = {}) {
    // 使用提供的SearchEngine实例或创建新的实例
    if (config.searchEngine) {
      this.searchEngine = config.searchEngine;
      logger.debug('SearchTools initialized with provided engine', {
        engineType: this.searchEngine.getEngineType()
      });
    } else {
      // 创建默认的搜索引擎
      switch (config.engineType) {
        case 'google':
          this.searchEngine = new GoogleSearchEngine();
          break;
        case 'baidu':
          this.searchEngine = new BaiduSearchEngine();
          break;
        default:
          this.searchEngine = new WebSearchEngine();
      }
      
      logger.debug('SearchTools initialized with new engine', {
        engineType: config.engineType || 'web'
      });
      
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
   * 获取搜索建议工具
   */
  getSearchSuggestionsTool() {
    try {
      const searchEngine = this.searchEngine;
      
      const tool = new CustomTool({
        name: "get_search_suggestions",
        description: "获取关键词的搜索建议和自动完成结果",
        schema: z.object({
          keyword: z.string().describe("要获取搜索建议的关键词"),
          maxResults: z.number().optional().describe("最大返回结果数量，默认为10")
        })
      });
      
      tool._call = async ({ keyword, maxResults = 10 }: { keyword: string; maxResults?: number }) => {
        try {
          logger.debug('Tool: Getting search suggestions', { keyword });
          const suggestions = await searchEngine.getSuggestions(keyword);
          const limitedResults = suggestions.slice(0, maxResults);
          return JSON.stringify(limitedResults);
        } catch (error) {
          logger.error('Tool: Error getting search suggestions', { keyword, error });
          return JSON.stringify([]);
        }
      };
      
      return tool;
    } catch (error) {
      logger.error('Error creating search suggestions tool', { error });
      // 返回一个空工具，用来防止程序崩溃
      const fallbackTool = new CustomTool({
        name: "get_search_suggestions",
        description: "获取关键词的搜索建议和自动完成结果",
        schema: z.object({
          keyword: z.string().describe("要获取搜索建议的关键词"),
          maxResults: z.number().optional().describe("最大返回结果数量，默认为10")
        })
      });
      
      fallbackTool._call = async () => {
        return JSON.stringify([]);
      };
      
      return fallbackTool;
    }
  }
  
  /**
   * 获取搜索结果工具
   */
  getSearchResultsTool() {
    const searchEngine = this.searchEngine;
    
    const tool = new CustomTool({
      name: "get_search_results",
      description: "获取关键词的搜索结果",
      schema: z.object({
        keyword: z.string().describe("要搜索的关键词"),
        maxResults: z.number().optional().describe("最大返回结果数量，默认为3")
      })
    });
    
    tool._call = async ({ keyword, maxResults = 3 }: { keyword: string; maxResults?: number }) => {
      try {
        logger.debug('Tool: Getting search results', { keyword, maxResults });
        const results = await searchEngine.getSearchResults(keyword, { maxResults });
        return JSON.stringify(results);
      } catch (error) {
        logger.error('Tool: Error getting search results', { keyword, error });
        return JSON.stringify([]);
      }
    };
    
    return tool;
  }
  
  /**
   * 获取关键词发现工具
   */
  getKeywordDiscoveryTool() {
    const searchEngine = this.searchEngine;
    
    const tool = new CustomTool({
      name: "discover_keywords",
      description: "通过搜索引擎自动补全发现更多相关关键词",
      schema: z.object({
        keyword: z.string().describe("主关键词"),
        maxResults: z.number().optional().describe("最大返回结果数量，默认为30")
      })
    });
    
    tool._call = async ({ keyword, maxResults = 30 }: { keyword: string; maxResults?: number }) => {
      try {
        logger.debug('Tool: Discovering keywords', { keyword });
        
        // 使用字母前缀策略发现更多相关关键词
        const letters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
        const queries = letters.map(letter => `${keyword} ${letter}`);
        
        // 获取自动补全结果
        const allSuggestions: string[] = [];
        for (const query of queries) {
          try {
            const suggestions = await searchEngine.getSuggestions(query);
            allSuggestions.push(...suggestions.map(s => s.query));
            
            // 添加延迟，避免API限制
            await new Promise(r => setTimeout(r, 500));
          } catch (e) {
            logger.warn('Error getting suggestions for keyword', { query, error: e });
          }
        }
        
        // 去重和过滤
        const uniqueSuggestions = [...new Set(allSuggestions)]
          .filter(s => s.toLowerCase().includes(keyword.toLowerCase()))
          .slice(0, maxResults);
        
        return JSON.stringify(uniqueSuggestions);
      } catch (error) {
        logger.error('Tool: Error discovering keywords', { keyword, error });
        return JSON.stringify([]);
      }
    };
    
    return tool;
  }
  
  /**
   * 获取内容分析工具
   */
  getContentAnalysisTool() {
    const searchEngine = this.searchEngine;
    
    const tool = new CustomTool({
      name: "analyze_search_content",
      description: "获取并分析关键词的搜索结果内容",
      schema: z.object({
        keyword: z.string().describe("要分析的关键词"),
        maxResults: z.number().optional().describe("最大分析结果数量，默认为5")
      })
    });
    
    tool._call = async ({ keyword, maxResults = 5 }: { keyword: string; maxResults?: number }) => {
      try {
        logger.debug('Tool: Analyzing search content', { keyword });
        
        // 获取搜索结果
        const results = await searchEngine.getSearchResults(keyword, { maxResults });
        
        // 格式化分析数据
        const analysisData = {
          keyword,
          resultCount: results.length,
          searchResults: results,
          formattedContent: results.map((r, i) => {
            return `Result ${i+1}:\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`;
          }).join('\n\n')
        };
        
        return JSON.stringify(analysisData);
      } catch (error) {
        logger.error('Tool: Error analyzing search content', { keyword, error });
        return JSON.stringify({ keyword, resultCount: 0, searchResults: [], formattedContent: "" });
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
        this.getKeywordDiscoveryTool(),
        this.getContentAnalysisTool()
      ];
    } catch (error) {
      logger.error('Error getting all tools', { error });
      return []; // Return empty array instead of throwing
    }
  }
  
  /**
   * 关闭搜索引擎资源
   */
  async close(): Promise<void> {
    return this.searchEngine.close();
  }
} 