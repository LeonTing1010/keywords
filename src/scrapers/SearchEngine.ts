import { AutocompleteSuggestion, SearchEngineConfig, SearchOptions, SearchEngineType } from '../types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 搜索引擎基类
 * 所有特定搜索引擎实现都应该继承这个基类
 */
export abstract class SearchEngine {
  protected config: SearchEngineConfig;
  protected outputDir: string;

  constructor(config: SearchEngineConfig) {
    this.config = config;
    this.outputDir = path.join(process.cwd(), 'output');
    
    // 确保output目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 获取搜索引擎名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取搜索引擎配置
   */
  getConfig(): SearchEngineConfig {
    return this.config;
  }

  /**
   * 抓取自动补全建议方法
   * 每个搜索引擎实现必须重写此方法
   */
  abstract fetchAutocomplete(
    keyword: string,
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion>;

  /**
   * 抓取自动补全建议并保存到文件
   */
  async fetchAndSaveAutocomplete(
    keyword: string,
    outputFilename?: string,
    options?: SearchOptions
  ): Promise<string> {
    // 确保output目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // 如果未提供文件名，使用默认格式
    if (!outputFilename) {
      const safeKeyword = keyword.replace(/\s+/g, '_');
      outputFilename = `${this.config.name.toLowerCase()}_${safeKeyword}_suggestions.txt`;
    }
    
    const outputPath = path.join(this.outputDir, outputFilename);
    
    // 获取建议
    const result = await this.fetchAutocomplete(keyword, options);
    
    // 写入文件
    fs.writeFileSync(outputPath, result.suggestions.join('\n'), 'utf-8');
    
    console.log(`已将 "${keyword}" 的${this.config.name}自动补全建议保存到${outputPath}(${result.suggestions.length}条)`);
    return outputPath;
  }

  /**
   * 获取带字母的查询关键词组合
   * 基本实现，可以被子类覆盖
   */
  generateAlphabetQueries(rootWord: string): string[] {
    const queries: string[] = [];
    for (let charCode = 97; charCode <= 122; charCode++) {
      const letter = String.fromCharCode(charCode);
      queries.push(`${rootWord} ${letter}`);
    }
    return queries;
  }

  /**
   * 使用字母组合获取搜索建议
   * 基本实现，支持断点续传
   */
  async fetchAutocompleteWithAlphabets(
    keyword: string,
    options?: SearchOptions
  ): Promise<string> {
    console.log(`开始为关键词 "${keyword}" 获取字母组合建议 (搜索引擎: ${this.config.name})...`);
    
    // 生成查询
    const queries = this.generateAlphabetQueries(keyword);
    console.log(`已生成 ${queries.length} 个查询组合`);
    
    // 准备文件和进度跟踪
    const safeKeyword = keyword.replace(/\s+/g, '_');
    const outputFilename = path.join(this.outputDir, `${this.config.name.toLowerCase()}_${safeKeyword}_alphabets_suggestions.txt`);
    const progressFilename = path.join(this.outputDir, `${this.config.name.toLowerCase()}_${safeKeyword}_alphabets_progress.json`);
    
    // 加载之前的进度
    const processedQueries: string[] = [];
    try {
      if (fs.existsSync(progressFilename)) {
        const data = fs.readFileSync(progressFilename, 'utf-8');
        const loadedQueries = JSON.parse(data);
        processedQueries.push(...loadedQueries);
        console.log(`已从进度文件加载 ${processedQueries.length} 个已处理的查询`);
      }
    } catch (error) {
      console.error(`加载进度文件失败: ${error}`);
    }
    
    // 加载已保存的建议以避免重复
    const savedSuggestions = new Set<string>();
    try {
      if (fs.existsSync(outputFilename)) {
        const content = fs.readFileSync(outputFilename, 'utf-8');
        content.split('\n').forEach(line => {
          const suggestion = line.trim();
          if (suggestion) {
            savedSuggestions.add(suggestion);
          }
        });
        console.log(`已加载 ${savedSuggestions.size} 条现有建议`);
      }
    } catch (error) {
      console.error(`加载已有建议失败: ${error}`);
    }
    
    // 逐个处理查询
    for (const query of queries) {
      // 检查该查询是否已处理
      if (processedQueries.includes(query)) {
        console.log(`跳过已处理的查询: ${query}`);
        continue;
      }
      
      console.log(`\n===== 处理查询: "${query}" =====`);
      
      try {
        // 获取建议
        const result = await this.fetchAutocomplete(query, options);
        
        // 过滤并保存新建议
        let newCount = 0;
        const newSuggestions: string[] = [];
        
        for (const suggestion of result.suggestions) {
          if (suggestion && !savedSuggestions.has(suggestion)) {
            savedSuggestions.add(suggestion);
            newSuggestions.push(suggestion);
            newCount++;
          }
        }
        
        // 添加到文件
        if (newSuggestions.length > 0) {
          fs.appendFileSync(outputFilename, newSuggestions.join('\n') + '\n', 'utf-8');
          console.log(`添加了 ${newCount} 条新建议，过滤了 ${result.suggestions.length - newCount} 条重复建议`);
        } else {
          console.log('未获取到任何新建议');
        }
        
        // 更新进度
        processedQueries.push(query);
        fs.writeFileSync(progressFilename, JSON.stringify(processedQueries, null, 2), 'utf-8');
        
        // 延迟一定时间，避免请求过于频繁
        const waitTime = Math.floor(Math.random() * 3000) + 2000;
        console.log(`等待 ${waitTime / 1000} 秒...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
      } catch (error) {
        console.error(`处理查询 "${query}" 时出错:`, error);
        // 暂停一段时间后继续
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`\n所有查询处理完成，结果保存到 ${outputFilename}`);
    console.log(`总共获取了 ${savedSuggestions.size} 条不重复的自动补全建议`);
    
    return outputFilename;
  }
}

/**
 * 搜索引擎工厂类
 * 用于注册和创建不同的搜索引擎实例
 */
export class SearchEngineFactory {
  private static engines: Map<SearchEngineType, new () => SearchEngine> = new Map();
  
  /**
   * 注册搜索引擎
   */
  static register(type: SearchEngineType, engineClass: new () => SearchEngine): void {
    this.engines.set(type, engineClass);
  }
  
  /**
   * 创建搜索引擎实例
   */
  static create(type: SearchEngineType): SearchEngine {
    const EngineClass = this.engines.get(type);
    if (!EngineClass) {
      throw new Error(`未知的搜索引擎类型: ${type}`);
    }
    return new EngineClass();
  }
  
  /**
   * 获取所有注册的搜索引擎类型
   */
  static getRegisteredEngines(): SearchEngineType[] {
    return Array.from(this.engines.keys());
  }
  
  /**
   * 检查搜索引擎是否已注册
   */
  static isRegistered(type: SearchEngineType): boolean {
    return this.engines.has(type);
  }
} 