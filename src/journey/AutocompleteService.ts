/**
 * AutocompleteService - 搜索引擎自动补全服务
 * 支持从搜索引擎获取自动补全建议
 */
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { SearchEngine } from '../providers/SearchEngine';
import { BaiduSearchEngine } from '../providers/BaiduSearchEngine';
import { AutocompleteSuggestion } from './AutocompleteTypes';
import { logger } from '../core/logger';

/**
 * 自动补全服务配置
 */
export interface AutocompleteServiceConfig {
  defaultEngine?: SearchEngine; // 默认搜索引擎
  timeout?: number; // 请求超时时间（毫秒）
  proxyUrl?: string; // 代理服务器URL
  verbose?: boolean; // 是否输出详细日志
}

/**
 * 搜索引擎自动补全服务
 * 支持从搜索引擎获取自动补全建议
 */
export class AutocompleteService {
  private timeout: number;
  private defaultEngine: SearchEngine;
  private proxyUrl?: string;
  private verbose: boolean;
  
  constructor(config: AutocompleteServiceConfig = {}) {
    this.timeout = config.timeout || 10000; // 默认10秒
    this.defaultEngine = config.defaultEngine || new BaiduSearchEngine();
    this.proxyUrl = config.proxyUrl;
    this.verbose = config.verbose || false;
    
    logger.info('初始化自动补全服务', { 
      engine: this.defaultEngine.getEngineType(),
      timeout: this.timeout
    });
  }
  
  /**
   * 获取自动补全建议
   * @param query 用户查询词
   * @returns 自动补全建议列表
   */
  async getSuggestions(query: string): Promise<AutocompleteSuggestion[]> {
    const targetEngine = this.defaultEngine;
    
    if (this.verbose) {
      logger.debug('获取自动补全建议', { 
        query,
        engine: targetEngine.getEngineType()
      });
    }
    
    // 根据不同搜索引擎获取建议
    try {
      const suggestions = await targetEngine.getSuggestions(query);
      
      if (this.verbose) {
        logger.debug('获取自动补全建议成功', { 
          query, 
          count: suggestions.length 
        });
      }
      
      return suggestions;
    } catch (error) {
      logger.error('获取自动补全建议失败', { query, error });
      
      // 出错时返回空数组
      return [];
    }
  }
} 