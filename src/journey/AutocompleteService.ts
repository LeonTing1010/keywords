/**
 * AutocompleteService - 搜索引擎自动补全服务
 * 负责从各搜索引擎获取自动补全建议
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SearchEngine } from '../providers/SearchEngine';
import { BaiduSearchEngine } from '../providers/BaiduSearchEngine';

// 自动补全建议接口
export interface AutocompleteSuggestion {
  query: string;      // 补全查询词
  position: number;   // 在建议列表中的位置
  source: string;     // 来源搜索引擎
  timestamp: number;  // 获取时间
}

// 自动补全服务配置
export interface AutocompleteServiceConfig {
  cacheDir?: string;        // 缓存目录
  cacheExpiry?: number;     // 缓存过期时间(秒)
  timeout?: number;         // 请求超时时间(毫秒)
  defaultEngine?: SearchEngine;   // 默认搜索引擎
  proxyUrl?: string;        // 代理服务器
  verbose?: boolean;        // 是否输出详细日志
}

/**
 * 搜索引擎自动补全服务
 * 支持从多个搜索引擎获取自动补全建议，并提供缓存功能
 */
export class AutocompleteService {
  private cacheDir: string;
  private cacheExpiry: number;
  private timeout: number;
  private defaultEngine: SearchEngine;
  private proxyUrl?: string;
  private verbose: boolean;
  
  constructor(config: AutocompleteServiceConfig = {}) {
    this.cacheDir = config.cacheDir || path.join(process.cwd(), 'output', 'cache', 'autocomplete');
    this.cacheExpiry = config.cacheExpiry || 24 * 60 * 60; // 默认24小时
    this.timeout = config.timeout || 10000; // 默认10秒
    this.defaultEngine = config.defaultEngine || new BaiduSearchEngine();
    this.proxyUrl = config.proxyUrl;
    this.verbose = config.verbose || false;
    
    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  
  /**
   * 获取自动补全建议
   * @param query 用户查询词
   * @param engine 搜索引擎(baidu, google等)
   * @returns 自动补全建议列表
   */
  async getSuggestions(query: string): Promise<AutocompleteSuggestion[]> {
    const targetEngine = this.defaultEngine;
    
    if (this.verbose) {
      console.info(`[AutocompleteService] 获取"${query}"的自动补全建议，使用引擎: ${targetEngine}`);
    }
    
    // 检查缓存
    const cacheKey = this.generateCacheKey(query, targetEngine.getEngineType());
    const cachedSuggestions = this.getCachedSuggestions(cacheKey);
    
    if (cachedSuggestions) {
      if (this.verbose) {
        console.info(`[AutocompleteService] 使用缓存的自动补全建议，共 ${cachedSuggestions.length} 条`);
      }
      return cachedSuggestions;
    }
    
    // 根据不同搜索引擎获取建议
    let suggestions: AutocompleteSuggestion[] = [];
    
    try {
      suggestions = await targetEngine.getSuggestions(query);
    
      // 缓存结果
      this.cacheSuggestions(cacheKey, suggestions);
      
      if (this.verbose) {
        console.info(`[AutocompleteService] 获取自动补全建议成功，共 ${suggestions.length} 条`);
      }
      
      return suggestions;
    } catch (error) {
      console.error(`[AutocompleteService] 获取自动补全建议失败: ${error}`);
      
      // 出错时返回空数组
      return [];
    }
  }
  
  /**
   * 生成缓存键
   */
  private generateCacheKey(query: string, engine: string): string {
    const data = `${query}_${engine}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }
  
  /**
   * 获取缓存的建议
   */
  private getCachedSuggestions(cacheKey: string): AutocompleteSuggestion[] | null {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        const now = Date.now();
        
        // 检查缓存是否过期
        if (now - cacheData.timestamp < this.cacheExpiry * 1000) {
          return cacheData.suggestions;
        }
      } catch (error) {
        console.error(`[AutocompleteService] 读取缓存错误: ${error}`);
      }
    }
    
    return null;
  }
  
  /**
   * 缓存建议
   */
  private cacheSuggestions(cacheKey: string, suggestions: AutocompleteSuggestion[]): void {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      const cacheData = {
        suggestions,
        timestamp: Date.now()
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData));
    } catch (error) {
      console.error(`[AutocompleteService] 写入缓存错误: ${error}`);
    }
  }
} 