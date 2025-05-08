/**
 * MultiSearchTools.ts - 增强型多搜索引擎工具集
 * 允许Agent自主选择或自动选择最适合的搜索引擎
 */
import { z } from "zod";
import { SearchEngine } from "../../infra/search/SearchEngine";
import { WebSearchEngine } from "../../infra/search/engines/WebSearchEngine";
import { BaiduSearchEngine } from "../../infra/search/engines/BaiduSearchEngine";
import { GoogleSearchEngine } from "../../infra/search/engines/GoogleSearchEngine";
import { MockSearchEngine } from "../../infra/search/engines/MockSearchEngine";
import { logger } from "../../infra/logger";
import { StructuredTool } from "@langchain/core/tools";
import { SearchTools } from "./SearchTools";

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
 * 多搜索引擎工具配置
 */
export interface MultiSearchToolsConfig {
  enabledEngines?: string[]; // 例如 ['baidu', 'google', 'web']
  defaultEngine?: string;
  proxyServer?: string;
  mockMode?: boolean;
}

/**
 * 增强型多搜索引擎工具提供者
 * 支持多搜索引擎管理和智能选择
 */
export class MultiSearchTools {
  private engines: Map<string, SearchEngine> = new Map();
  private defaultEngine: string;
  private searchTools: Map<string, SearchTools> = new Map();
  private searchHistory: Map<string, {engine: string, success: boolean, time: number}[]> = new Map();
  
  /**
   * 初始化多搜索引擎工具
   */
  constructor(config: MultiSearchToolsConfig = {}) {
    // 设置默认引擎
    this.defaultEngine = config.defaultEngine || 'baidu';
    
    // 确定要启用的引擎
    const enabledEngines = config.enabledEngines || ['baidu'];
    
    // 创建每个引擎实例
    for (const engineType of enabledEngines) {
      try {
        let searchEngine: SearchEngine;
        
        switch (engineType.toLowerCase()) {
          case 'baidu':
            searchEngine = new BaiduSearchEngine();
            break;
          case 'google':
            searchEngine = new GoogleSearchEngine();
            break;
          case 'web':
          case 'web-search':
            searchEngine = new WebSearchEngine();
            break;
          case 'mock':
            searchEngine = new MockSearchEngine();
            break;
          default:
            logger.warn(`未知的搜索引擎类型: ${engineType}，将使用默认引擎`);
            continue;
        }
        
        // 设置代理服务器（如果提供）
        if (config.proxyServer) {
          searchEngine.setProxy(config.proxyServer);
        }
        
        // 存储引擎实例
        this.engines.set(engineType.toLowerCase(), searchEngine);
        
        // 为每个引擎创建独立的SearchTools实例
        this.searchTools.set(
          engineType.toLowerCase(), 
          new SearchTools({ searchEngine })
        );
        
        logger.info(`搜索引擎已注册: ${engineType}`);
      } catch (error) {
        logger.error(`初始化搜索引擎失败: ${engineType}`, { error });
      }
    }
    
    // 确保至少有一个引擎可用
    if (this.engines.size === 0) {
      logger.warn('没有可用的搜索引擎，将使用默认WebSearchEngine');
      const defaultSearchEngine = new WebSearchEngine();
      this.engines.set('web', defaultSearchEngine);
      this.searchTools.set('web', new SearchTools({ searchEngine: defaultSearchEngine }));
      this.defaultEngine = 'web';
    }
    
    logger.info(`MultiSearchTools初始化完成，共${this.engines.size}个引擎`, {
      engines: Array.from(this.engines.keys()),
      defaultEngine: this.defaultEngine
    });
  }
  
  /**
   * 初始化所有搜索引擎
   */
  async initialize(): Promise<void> {
    const initPromises = Array.from(this.engines.entries()).map(async ([name, engine]) => {
      try {
        await engine.initialize();
        logger.info(`搜索引擎初始化成功: ${name}`);
        return true;
      } catch (error) {
        logger.error(`搜索引擎初始化失败: ${name}`, { error });
        return false;
      }
    });
    
    await Promise.all(initPromises);
  }
  
  /**
   * 获取默认搜索引擎
   */
  getDefaultEngine(): SearchEngine {
    return this.engines.get(this.defaultEngine)! || 
      this.engines.values().next().value!;
  }
  
  /**
   * 获取指定类型的搜索引擎
   */
  getEngine(type: string): SearchEngine | null {
    return this.engines.get(type.toLowerCase()) || null;
  }
  
  /**
   * 获取所有可用的搜索引擎
   */
  getAllEngines(): Map<string, SearchEngine> {
    return this.engines;
  }
  
  /**
   * 获取指定类型的SearchTools实例
   */
  getSearchTools(type?: string): SearchTools {
    if (type && this.searchTools.has(type.toLowerCase())) {
      return this.searchTools.get(type.toLowerCase())!;
    }
    return this.searchTools.get(this.defaultEngine)! || 
      this.searchTools.values().next().value!;
  }
  
  /**
   * 获取搜索引擎选择工具 - 让Agent自己选择
   */
  getEngineSelectionTool() {
    const availableEngines = Array.from(this.engines.keys());
    
    const tool = new CustomTool({
      name: "select_search_engine",
      description: `选择要使用的搜索引擎，可用选项: ${availableEngines.join(', ')}`,
      schema: z.object({
        engine: z.string().describe("搜索引擎名称"),
        keyword: z.string().describe("关键词或查询"),
        reason: z.string().optional().describe("选择该引擎的理由")
      })
    });
    
    tool._call = async ({ engine, keyword, reason }) => {
      const lowerEngine = engine.toLowerCase();
      const selectedEngine = this.engines.get(lowerEngine) || 
                            this.engines.get(this.defaultEngine);
                            
      if (!selectedEngine) {
        return JSON.stringify({
          success: false,
          message: `无法使用 ${engine} 引擎，将使用默认引擎`,
          engine: this.defaultEngine
        });
      }
      
      logger.info(`为关键词 "${keyword}" 选择了 ${engine} 搜索引擎`, { reason });
      
      try {
        const startTime = Date.now();
        const results = await selectedEngine.getSearchResults(keyword, { maxResults: 5 });
        const searchTime = Date.now() - startTime;
        
        // 记录搜索历史
        this.recordSearchHistory(keyword, lowerEngine, true, searchTime);
        
        return JSON.stringify({
          success: true,
          engine: lowerEngine,
          results,
          searchTime
        });
      } catch (error: any) {
        logger.error(`使用 ${engine} 搜索失败`, { error: error.message });
        
        // 记录失败
        this.recordSearchHistory(keyword, lowerEngine, false, 0);
        
        // 尝试备用引擎
        try {
          const backupEngine = this.getBackupEngine(lowerEngine);
          if (backupEngine) {
            logger.info(`尝试使用备用引擎: ${backupEngine.getEngineType()}`);
            
            const startTime = Date.now();
            const results = await backupEngine.getSearchResults(keyword, { maxResults: 5 });
            const searchTime = Date.now() - startTime;
            
            // 记录备用引擎搜索历史
            this.recordSearchHistory(keyword, backupEngine.getEngineType(), true, searchTime);
            
            return JSON.stringify({
              success: true,
              engine: backupEngine.getEngineType(),
              results,
              searchTime,
              note: "使用了备用搜索引擎，因为首选引擎失败"
            });
          }
        } catch (backupError) {
          logger.error("备用引擎也失败了", { backupError });
        }
        
        return JSON.stringify({
          success: false,
          message: `搜索失败: ${error.message}`,
          error: error.message
        });
      }
    };
    
    return tool;
  }
  
  /**
   * 获取智能搜索工具 - 自动选择最适合的搜索引擎
   */
  getSmartSearchTool() {
    const tool = new CustomTool({
      name: "smart_search",
      description: "智能选择最合适的搜索引擎来执行查询",
      schema: z.object({
        keyword: z.string().describe("要搜索的关键词"),
        preference: z.string().optional().describe("可选的引擎偏好"),
        maxResults: z.number().optional().describe("最大结果数，默认为5")
      })
    });
    
    tool._call = async ({ keyword, preference, maxResults = 5 }) => {
      // 根据关键词和历史数据智能选择搜索引擎
      const chosenEngine = this.selectBestEngine(keyword, preference);
      const engine = this.engines.get(chosenEngine);
      
      if (!engine) {
        return JSON.stringify({ 
          success: false, 
          message: "没有可用的搜索引擎" 
        });
      }
      
      logger.info(`智能选择了 ${chosenEngine} 搜索引擎`, { keyword });
      
      try {
        const startTime = Date.now();
        const results = await engine.getSearchResults(keyword, { maxResults });
        const searchTime = Date.now() - startTime;
        
        // 记录搜索历史
        this.recordSearchHistory(keyword, chosenEngine, true, searchTime);
        
        return JSON.stringify({
          success: true,
          engine: chosenEngine,
          keyword,
          results,
          searchTime
        });
      } catch (error: any) {
        logger.error(`智能搜索失败`, { engine: chosenEngine, error: error.message });
        
        // 记录失败
        this.recordSearchHistory(keyword, chosenEngine, false, 0);
        
        // 尝试备用引擎
        const backupEngine = this.getBackupEngine(chosenEngine);
        if (backupEngine) {
          try {
            logger.info(`使用备用引擎 ${backupEngine.getEngineType()}`);
            
            const startTime = Date.now();
            const results = await backupEngine.getSearchResults(keyword, { maxResults });
            const searchTime = Date.now() - startTime;
            
            // 记录备用引擎搜索历史
            this.recordSearchHistory(keyword, backupEngine.getEngineType(), true, searchTime);
            
            return JSON.stringify({
              success: true,
              engine: backupEngine.getEngineType(),
              keyword,
              results,
              searchTime,
              note: "使用了备用引擎"
            });
          } catch (backupError) {
            logger.error("备用引擎也失败了", { error: backupError });
          }
        }
        
        return JSON.stringify({
          success: false,
          message: `搜索失败: ${error.message}`,
          keyword
        });
      }
    };
    
    return tool;
  }
  
  /**
   * 记录搜索历史
   */
  private recordSearchHistory(keyword: string, engine: string, success: boolean, time: number): void {
    if (!this.searchHistory.has(keyword)) {
      this.searchHistory.set(keyword, []);
    }
    
    const history = this.searchHistory.get(keyword)!;
    history.push({ engine, success, time });
    
    // 限制历史记录数量
    if (history.length > 10) {
      history.shift();
    }
  }
  
  /**
   * 智能选择最佳搜索引擎
   */
  private selectBestEngine(keyword: string, preference?: string): string {
    // 如果有明确的偏好并且该引擎可用，使用偏好引擎
    if (preference && this.engines.has(preference.toLowerCase())) {
      return preference.toLowerCase();
    }
    
    // 如果有搜索历史，考虑历史表现
    if (this.searchHistory.has(keyword)) {
      const history = this.searchHistory.get(keyword)!;
      
      // 查找成功率最高的引擎
      const engineStats = new Map<string, { success: number, total: number, avgTime: number }>();
      
      for (const record of history) {
        if (!engineStats.has(record.engine)) {
          engineStats.set(record.engine, { success: 0, total: 0, avgTime: 0 });
        }
        
        const stats = engineStats.get(record.engine)!;
        stats.total++;
        if (record.success) {
          stats.success++;
          // 计算平均响应时间
          stats.avgTime = (stats.avgTime * (stats.success - 1) + record.time) / stats.success;
        }
      }
      
      // 找出成功率最高的引擎
      let bestEngine = '';
      let bestScore = -1;
      
      for (const [engine, stats] of engineStats.entries()) {
        if (stats.total === 0) continue;
        
        // 计算得分 (成功率 * 0.7 + 响应时间评分 * 0.3)
        const successRate = stats.success / stats.total;
        const timeScore = stats.avgTime > 0 ? Math.min(1, 5000 / stats.avgTime) : 0;
        const score = successRate * 0.7 + timeScore * 0.3;
        
        if (score > bestScore) {
          bestScore = score;
          bestEngine = engine;
        }
      }
      
      if (bestEngine && bestScore > 0.5) {
        return bestEngine;
      }
    }
    
    // 基于关键词特征选择
    // 1. 包含中文字符，优先使用百度
    if (/[\u4e00-\u9fa5]/.test(keyword) && this.engines.has('baidu')) {
      return 'baidu';
    }
    
    // 2. 技术内容优先使用Google
    if (/\b(github|code|programming|npm|api|framework|技术|编程)\b/i.test(keyword) && 
        this.engines.has('google')) {
      return 'google';
    }
    
    // 3. 当地服务优先使用百度
    if (/\b(附近|商店|餐厅|地址|位置|怎么走)\b/i.test(keyword) && 
        this.engines.has('baidu')) {
      return 'baidu';
    }
    
    // 4. 默认使用通用web搜索
    if (this.engines.has('web')) {
      return 'web';
    }
    
    // 兜底方案：使用默认引擎
    return this.defaultEngine;
  }
  
  /**
   * 获取备用引擎
   */
  private getBackupEngine(currentEngine: string): SearchEngine | null {
    // 如果当前引擎不是默认引擎，使用默认引擎作为备用
    if (currentEngine !== this.defaultEngine && this.engines.has(this.defaultEngine)) {
      return this.engines.get(this.defaultEngine)!;
    }
    
    // 如果当前是默认引擎，使用其他可用引擎
    for (const [name, engine] of this.engines.entries()) {
      if (name !== currentEngine) {
        return engine;
      }
    }
    
    return null;
  }
  
  /**
   * 获取所有工具
   */
  getAllTools() {
    const engineSelectionTool = this.getEngineSelectionTool();
    const smartSearchTool = this.getSmartSearchTool();
    
    // 获取默认SearchTools的所有工具
    const defaultSearchTools = this.getSearchTools();
    const basicTools = defaultSearchTools.getAllTools();
    
    return [
      engineSelectionTool,
      smartSearchTool,
      ...basicTools
    ];
  }
  
  /**
   * 关闭所有搜索引擎
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.engines.values()).map(engine => engine.close());
    await Promise.all(closePromises);
    logger.info('所有搜索引擎已关闭');
  }
} 