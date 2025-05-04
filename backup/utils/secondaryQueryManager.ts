import { SearchEngine } from '../providers/SearchEngine';
import { SearchOptions } from '../types';
import { Logger } from './logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 二次查询管理器
 * 提供统一的接口执行二次查询和结果合并
 */
export class SecondaryQueryManager {
  private logger: Logger;
  private engine: SearchEngine;
  private outputDir: string;
  
  constructor(engine: SearchEngine, outputDir: string) {
    this.engine = engine;
    this.outputDir = outputDir;
    this.logger = new Logger('SecondaryQueryManager');
  }
  
  /**
   * 基于初始查询结果执行二次查询
   * @param keyword 初始关键词
   * @param initialSuggestions 初始查询获取的建议（必须提供）
   * @param options 查询选项
   * @returns 二次查询建议数组
   */
  async executeSecondaryQueryBasedOnInitial(
    keyword: string,
    initialSuggestions: string[],
    options?: SearchOptions
  ): Promise<string[]> {
    if (!initialSuggestions || initialSuggestions.length === 0) {
      this.logger.error("二次查询必须提供初始查询结果");
      throw new Error("二次查询必须提供初始查询结果");
    }
    
    this.logger.info(`开始基于初始结果执行二次查询，初始结果中有 ${initialSuggestions.length} 条建议...`);
    
    // 确保浏览器持久化选项开启
    const updatedOptions: SearchOptions = {
      ...options,
      persistBrowser: true // 强制使用持久化浏览器
    };
    
    // 从初始建议中提取关键词
    const secondaryKeywords = (this.engine as any).extractNewKeywords(
      initialSuggestions, 
      keyword,
      {
        maxKeywords: updatedOptions.maxSecondaryKeywords || 10,
        minLength: updatedOptions.minKeywordLength || 5,
      }
    );
    
    this.logger.info(`从初始查询结果中提取出 ${secondaryKeywords.length} 个二次关键词`);
    
    if (secondaryKeywords.length === 0) {
      this.logger.warn(`无法从初始结果中提取有效的二次关键词，将返回空结果`);
      return [];
    }
    
    let secondarySuggestions: string[] = [];
    
    // 检查引擎是否支持内置二次查询方法
    if (typeof (this.engine as any).executeSecondaryQueries === 'function') {
      this.logger.info(`引擎支持内置的二次查询功能，将使用内置方法...`);
      
      try {
        // 使用引擎的内置方法执行二次查询
        const outputFileName = `${this.engine.getName().toLowerCase()}_${keyword.replace(/\s+/g, '_')}_secondary_suggestions.json`;
        const outputPath = await (this.engine as any).executeSecondaryQueries(
          keyword, 
          updatedOptions, 
          outputFileName,
          secondaryKeywords // 传递已提取的二次关键词
        );
        
        // 从输出文件中读取结果
        if (fs.existsSync(outputPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            if (data.suggestions && Array.isArray(data.suggestions)) {
              secondarySuggestions = data.suggestions;
              this.logger.success(`引擎内置二次查询完成，共获取到 ${secondarySuggestions.length} 条建议`);
            }
          } catch (e) {
            this.logger.error(`读取二次查询结果文件失败: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } catch (error) {
        this.logger.error(`使用引擎内置二次查询方法失败: ${error instanceof Error ? error.message : String(error)}`);
        // 失败后继续使用下面的自定义方法
      }
    }
    
    // 如果内置方法失败或不支持，使用自定义的二次查询逻辑
    if (secondarySuggestions.length === 0) {
      this.logger.info(`将使用自定义方法执行二次查询...`);
      
      // 初始化结果集
      const allSecondaryResults = new Set<string>();
      
      // 设置查询批次大小
      const batchSize = updatedOptions.batchSize || 5;
      this.logger.info(`二次查询批处理大小: ${batchSize}`);
      
      // 处理每个提取的二次关键词
      for (let i = 0; i < secondaryKeywords.length; i += batchSize) {
        const batch = secondaryKeywords.slice(i, i + batchSize);
        this.logger.info(`处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(secondaryKeywords.length/batchSize)}, 包含 ${batch.length} 个关键词`);
        
        await Promise.all(batch.map(async (secondaryKeyword: string) => {
          try {
            const result = await this.engine.fetchAutocomplete(secondaryKeyword, {
              ...updatedOptions,
              enableSecondRound: false // 确保不会再触发二次查询
            });
            
            // 添加到结果集
            result.suggestions.forEach(suggestion => allSecondaryResults.add(suggestion));
            this.logger.info(`关键词 "${secondaryKeyword}" 查询成功，获取 ${result.suggestions.length} 条建议`);
          } catch (error) {
            this.logger.error(`关键词 "${secondaryKeyword}" 查询失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }));
        
        // 查询间隔，避免请求过于频繁
        if (i + batchSize < secondaryKeywords.length) {
          const delay = updatedOptions.delayBetweenQueries || { min: 2000, max: 5000 };
          const waitTime = Math.floor(Math.random() * (delay.max - delay.min + 1)) + delay.min;
          this.logger.info(`批次间等待 ${waitTime/1000} 秒...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      // 转换为数组并去除可能与初始建议重复的内容
      secondarySuggestions = Array.from(allSecondaryResults).filter(
        suggestion => !initialSuggestions.includes(suggestion)
      );
      
      this.logger.success(`自定义二次查询完成，共获取到 ${secondarySuggestions.length} 条唯一建议`);
    }
    
    return secondarySuggestions;
  }
  
  /**
   * 执行二次查询并收集结果
   * @param keyword 初始关键词
   * @param options 查询选项
   * @param initialSuggestions 初始查询建议（可选，如果不提供将重新执行初始查询）
   */
  async executeSecondaryQueries(
    keyword: string,
    options?: SearchOptions,
    initialSuggestions?: string[]
  ): Promise<string[]> {
    try {
      this.logger.info(`准备执行关键词 "${keyword}" 的二次查询...`);
      
      // 如果提供了初始建议，直接使用
      if (initialSuggestions && initialSuggestions.length > 0) {
        this.logger.info(`使用提供的初始查询结果，共 ${initialSuggestions.length} 条建议`);
      } else {
        // 如果没有提供初始建议，执行独立的初始查询
        this.logger.info(`未提供初始查询结果，将执行独立的初始查询...`);
        const initialOptions = { 
          ...options, 
          enableSecondRound: false // 确保不触发引擎内部的二次查询
        };
        
        try {
          const result = await this.engine.fetchAutocomplete(keyword, initialOptions);
          initialSuggestions = result.suggestions;
          this.logger.info(`独立初始查询完成，获取到 ${initialSuggestions.length} 条建议`);
        } catch (error) {
          this.logger.error(`独立初始查询失败: ${error instanceof Error ? error.message : String(error)}`);
          initialSuggestions = []; // 失败时使用空数组
        }
      }
      
      // 基于初始查询结果执行二次查询
      return await this.executeSecondaryQueryBasedOnInitial(keyword, initialSuggestions, options);
    } catch (error) {
      this.logger.error(`二次查询失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * 合并初始建议和二次查询建议
   * @param initialSuggestions 初始建议
   * @param secondarySuggestions 二次查询建议
   */
  mergeSuggestions(initialSuggestions: string[], secondarySuggestions: string[]): string[] {
    // 使用Set去重
    const uniqueSuggestions = new Set<string>([...initialSuggestions, ...secondarySuggestions]);
    return Array.from(uniqueSuggestions);
  }
  
  /**
   * 保存合并结果到文件
   * @param keyword 原始关键词
   * @param suggestions 所有建议
   * @param outputFilename 输出文件名
   */
  saveMergedResults(keyword: string, suggestions: string[], outputFilename: string): string {
    if (!outputFilename.endsWith('.json')) {
      outputFilename += '.json';
    }
    
    const outputPath = path.join(this.outputDir, outputFilename);
    
    const data = {
      keyword,
      engine: this.engine.getName(),
      timestamp: new Date().toISOString(),
      suggestionsCount: suggestions.length,
      suggestions
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    this.logger.success(`已将合并结果保存到 ${outputPath} (${suggestions.length}条)`);
    
    return outputPath;
  }
} 