import { AutocompleteSuggestion, SearchEngineConfig, SearchOptions, SearchEngineType } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from '../utils/fileUtils';
import { AppError, ErrorType } from '../utils/errorHandler';
import { Logger } from '../utils/logger';
import { Browser, chromium, BrowserType, Page, LaunchOptions } from 'playwright';

/**
 * 搜索引擎基类
 * 所有特定搜索引擎实现都应该继承这个基类
 */
export abstract class SearchEngine {
  protected config: SearchEngineConfig;
  protected outputDir: string;
  protected logger: Logger;
  protected browser: Browser | null = null;
  protected static globalBrowser: Browser | null = null; // 添加全局浏览器实例

  constructor(config: SearchEngineConfig) {
    this.config = config;
    this.outputDir = ensureOutputDirectory();
    this.logger = new Logger(config.name);
    this.browser = null;
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
   * 随机延迟函数，模拟人类行为
   * @param min 最小延迟(ms)
   * @param max 最大延迟(ms)
   */
  protected async randomDelay(min: number = 200, max: number = 2000): Promise<number> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
    return delay;
  }

  /**
   * 设置浏览器指纹以减少检测
   */
  protected async setupBrowserFingerprint(page: Page): Promise<void> {
    // 随机化用户代理
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    ];
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': userAgent
    });
    
    // 设置更真实的窗口尺寸
    const sizes = [
      {width: 1366, height: 768},
      {width: 1920, height: 1080},
      {width: 1440, height: 900}
    ];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    await page.setViewportSize(size);
  }

  /**
   * 启动浏览器
   * 子类可以重写此方法以实现特定的启动逻辑
   */
  async launchBrowser(options?: SearchOptions): Promise<Browser> {
    // 优先使用全局浏览器实例
    if (SearchEngine.globalBrowser) {
      this.logger.info('使用全局共享浏览器实例');
      this.browser = SearchEngine.globalBrowser;
      return this.browser;
    }

    // 如果已有自己的浏览器实例，复用它
    if (this.browser) {
      this.logger.info('使用现有浏览器实例');
      return this.browser;
    }

    const { proxyServer, useSystemBrowser = false } = options || {};

    // 浏览器启动选项
    const launchOptions: LaunchOptions = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    };

    // 如果提供了代理服务器地址，则使用代理
    if (proxyServer) {
      this.logger.info(`使用代理服务器: ${proxyServer}`);
      launchOptions.proxy = { server: proxyServer };
    }

    // 根据选项决定使用系统浏览器还是内置浏览器
    if (useSystemBrowser && this.config.supportsSystemBrowser) {
      this.logger.info('使用系统浏览器');
      const systemBrowser = this.getSystemBrowser();
      this.browser = await systemBrowser.type.launch({
        ...launchOptions,
        channel: systemBrowser.channel
      });
    } else {
      this.logger.info('使用内置浏览器');
      this.browser = await chromium.launch(launchOptions);
    }

    // 保存到全局实例以供共享
    SearchEngine.globalBrowser = this.browser;
    
    return this.browser;
  }

  /**
   * 保存错误截图
   */
  protected async saveErrorScreenshot(page: Page, errorPrefix: string): Promise<string | null> {
    if (!page || page.isClosed()) return null;
    
    try {
      const screenshotPath = path.join(this.outputDir, `${errorPrefix}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      this.logger.info(`已保存错误截图到 ${screenshotPath}`);
      return screenshotPath;
    } catch (e) {
      this.logger.error(`保存错误截图失败: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /**
   * 获取系统默认浏览器类型
   */
  protected getSystemBrowser(): { type: BrowserType<{}>; channel: string | undefined } {
    const platform = process.platform;
    
    // 根据操作系统确定可能安装的浏览器
    if (platform === 'darwin') { // macOS
      return { 
        type: chromium,
        channel: 'chrome' // macOS上通常安装了Chrome
      };
    } else if (platform === 'win32') { // Windows
      return { 
        type: chromium,
        channel: 'chrome' // Windows上可能有Chrome或Edge
      };
    } else { // Linux和其他系统
      return { 
        type: chromium,
        channel: undefined // 使用默认
      };
    }
  }

  /**
   * 抓取自动补全建议方法
   * 每个搜索引擎实现必须重写此方法
   */
  abstract fetchAutocomplete(
    keyword: string,
    options?: SearchOptions,
    existingBrowser?: Browser
  ): Promise<AutocompleteSuggestion>;

  /**
   * 提取新关键词，供二次查询使用
   * 子类可以重写此方法以提供更适合的关键词提取逻辑
   */
  protected extractNewKeywords(
    suggestions: string[], 
    originalKeyword: string,
    options?: { 
      maxKeywords?: number,
      minLength?: number,
      customFilters?: ((keyword: string) => boolean)[]
    }
  ): string[] {
    const { 
      maxKeywords = 10, 
      minLength = 5,
      customFilters = [] 
    } = options || {};
    
    const keywords = new Set<string>();
    const originalKeywordLower = originalKeyword.toLowerCase();
    
    // 默认过滤器
    const defaultFilters = [
      // 不包含原始关键词，也不是原始关键词的一部分
      (kw: string) => !kw.includes(originalKeywordLower) && !originalKeywordLower.includes(kw),
      // 长度要求
      (kw: string) => kw.length > minLength,
      // 不包含特殊字符
      (kw: string) => !/[^\w\s-]/.test(kw)
    ];
    
    // 合并所有过滤器
    const allFilters = [...defaultFilters, ...customFilters];
    
    // 关键词提取规则
    for (const suggestion of suggestions) {
      // 基本清理
      const cleanSuggestion = suggestion.trim();
      if (!cleanSuggestion) continue;
      
      // 分割建议获取可能的关键词
      const parts = cleanSuggestion.split(/\s+/);
      
      // 如果建议中有3个或以上的词，可能是一个好的关键词组合
      if (parts.length >= 3) {
        // 组合2-3个词作为新的关键词
        for (let i = 0; i < parts.length - 1; i++) {
          if (keywords.size >= maxKeywords) break;
          
          // 2个词组合
          if (i + 1 < parts.length) {
            const keyword = `${parts[i]} ${parts[i + 1]}`.toLowerCase();
            
            // 应用所有过滤器
            if (allFilters.every(filter => filter(keyword))) {
              keywords.add(keyword);
            }
          }
          
          // 3个词组合
          if (i + 2 < parts.length) {
            const keyword = `${parts[i]} ${parts[i + 1]} ${parts[i + 2]}`.toLowerCase();
            
            // 应用所有过滤器
            if (allFilters.every(filter => filter(keyword))) {
              keywords.add(keyword);
            }
          }
        }
      }
    }
    
    return Array.from(keywords).slice(0, maxKeywords);
  }

  /**
   * 提取二次关键词
   */
  protected async getSecondaryKeywords(
    keyword: string, 
    page: Page, 
    suggestions: string[],
    options?: SearchOptions
  ): Promise<string[]> {
    const { 
      maxResults = 50,
      maxSecondaryKeywords = 10,
      minKeywordLength = 5,
      retryCount = 1,
      delayBetweenQueries = { min: 1000, max: 2000 }
    } = options || {};
    
    // 提取新关键词
    const secondaryKeywords = this.extractNewKeywords(suggestions, keyword, {
      maxKeywords: maxSecondaryKeywords,
      minLength: minKeywordLength
    });
    
    const allSuggestions: string[] = [];
    const uniqueSuggestions = new Set<string>();
    
    this.logger.info(`从第一次查询结果中提取到 ${secondaryKeywords.length} 个新关键词`);
    
    // 对每个提取出的关键词进行查询
    for (const secondaryKeyword of secondaryKeywords) {
      let retryAttempt = 0;
      let success = false;
      
      while (retryAttempt <= retryCount && !success) {
        try {
          this.logger.info(`正在查询二次关键词: ${secondaryKeyword} ${retryAttempt > 0 ? `(重试 ${retryAttempt})` : ''}`);
          
          // 使用通用的页内查询方法获取建议
          const newSuggestions = await this.processQueryInPage(secondaryKeyword, page, options);
          
          // 去重并添加到结果中
          for (const suggestion of newSuggestions) {
            if (!uniqueSuggestions.has(suggestion)) {
              uniqueSuggestions.add(suggestion);
              allSuggestions.push(suggestion);
            }
          }
          
          success = true;
          this.logger.info(`关键词 "${secondaryKeyword}" 查询完成，当前共 ${uniqueSuggestions.size} 条建议`);
        } catch (error) {
          retryAttempt++;
          this.logger.warn(`关键词 "${secondaryKeyword}" 查询失败: ${error instanceof Error ? error.message : String(error)}`);
          
          if (retryAttempt <= retryCount) {
            this.logger.info(`将在 ${delayBetweenQueries.min}-${delayBetweenQueries.max}ms 后重试...`);
            await this.randomDelay(delayBetweenQueries.min, delayBetweenQueries.max);
          }
        }
      }
      
      // 随机延迟，避免请求过快
      await this.randomDelay(delayBetweenQueries.min, delayBetweenQueries.max);
      
      // 如果已经达到最大结果数，提前结束
      if (allSuggestions.length >= maxResults) {
        this.logger.info(`已达到最大结果数 ${maxResults}，提前结束查询`);
        break;
      }
    }
    
    this.logger.info(`二次查询完成，共获取到 ${allSuggestions.length} 条建议`);
    return allSuggestions.slice(0, maxResults);
  }

  /**
   * 抓取自动补全建议并保存到文件
   */
  async fetchAndSaveAutocomplete(
    keyword: string,
    options?: SearchOptions,
    outputFilename?: string
  ): Promise<string> {
    try {
      // 确保output目录存在
      this.outputDir = ensureOutputDirectory();
      
      // 如果未提供文件名，使用默认格式
      if (!outputFilename) {
        const safeKeyword = keyword.replace(/\s+/g, '_');
        outputFilename = `${this.config.name.toLowerCase()}_${safeKeyword}_suggestions.json`;
      } else if (!outputFilename.endsWith('.json')) {
        // 确保文件名以.json结尾
        outputFilename = `${outputFilename}.json`;
      }
      
      const outputPath = path.join(this.outputDir, outputFilename);
      
      // 获取建议
      this.logger.info(`正在获取 "${keyword}" 的自动补全建议...`);
      const result = await this.fetchAutocomplete(keyword, options);
      
      // 写入JSON文件
      const jsonData = {
        keyword: result.keyword,
        suggestions: result.suggestions,
        engine: this.config.name,
        timestamp: new Date().toISOString(),
        count: result.suggestions.length
      };
      
      // 如果有二次查询结果，也添加到JSON中
      if (result.secondarySuggestions && result.secondarySuggestions.length > 0) {
        Object.assign(jsonData, {
          secondarySuggestions: result.secondarySuggestions,
          secondaryCount: result.secondarySuggestions.length
        });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      
      this.logger.success(`已将 "${keyword}" 的${this.config.name}自动补全建议保存到${outputPath}(${result.suggestions.length}条)`);
      
      if (result.secondarySuggestions && result.secondarySuggestions.length > 0) {
        this.logger.success(`包含二次查询结果 ${result.secondarySuggestions.length}条`);
      }
      
      return outputPath;
    } catch (error) {
      this.logger.error(`获取自动补全建议失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(
        `获取 "${keyword}" 的${this.config.name}自动补全建议失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.NETWORK,
        error
      );
    }
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
    options?: SearchOptions,
    outputFilename?: string
  ): Promise<string> {
    try {
      this.logger.info(`开始为关键词 "${keyword}" 获取字母组合建议 (搜索引擎: ${this.config.name})...`);
      
      // 生成查询
      const queries = this.generateAlphabetQueries(keyword);
      this.logger.info(`已生成 ${queries.length} 个查询组合`);
      
      // 准备文件和进度跟踪
      if (!outputFilename) {
        const safeKeyword = keyword.replace(/\s+/g, '_');
        outputFilename = `${this.config.name.toLowerCase()}_${safeKeyword}_alphabets_suggestions.json`;
      } else if (!outputFilename.endsWith('.json')) {
        // 确保文件名以.json结尾
        outputFilename = `${outputFilename}.json`;
      }
      
      const outputPath = path.join(this.outputDir, outputFilename);
      const progressPath = `${outputPath}.progress`;
      
      // 检查是否有进度文件，支持断点续传
      let completedQueries: string[] = [];
      if (fs.existsSync(progressPath)) {
        try {
          const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
          if (Array.isArray(progressData)) {
            // 旧格式：直接是数组
            completedQueries = progressData;
          } else if (progressData.completed && Array.isArray(progressData.completed)) {
            // 新格式：包含在对象中
            completedQueries = progressData.completed;
            this.logger.info(`找到进度文件，来自 ${progressData.timestamp}，已完成 ${completedQueries.length}/${queries.length} 个查询`);
            
            if (progressData.uniqueSuggestionsCount > 0) {
              this.logger.info(`进度文件记录的唯一建议数: ${progressData.uniqueSuggestionsCount}`);
            }
          }
          
          this.logger.info(`找到进度文件，已完成 ${completedQueries.length}/${queries.length} 个查询`);
        } catch (e) {
          this.logger.warn(`进度文件损坏，将重新开始: ${e instanceof Error ? e.message : String(e)}`);
          completedQueries = [];
        }
      }
      
      // 处理每个查询
      let allSuggestions: Set<string> = new Set();
      let totalProcessed = completedQueries.length;
      
      // 提取选项
      const { persistBrowser = true, batchSize = 26 } = options || {};
      this.logger.info(`浏览器持久化: ${persistBrowser ? '启用' : '禁用'}, 批处理大小: ${batchSize}`);
      
      // 启动浏览器（只启动一次，用于所有查询）
      let currentBatchCount = 0;
      let page = null;
      
      try {
        // 如果启用了持久化浏览器，先启动一个浏览器实例
        if (persistBrowser) {
          await this.launchBrowser(options);
          
          // 创建一个页面并重用
          if (this.browser) {
            page = await this.browser.newPage({
              viewport: { width: 390, height: 844 },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            });
            this.logger.info('创建新页面用于处理所有查询');
          }
        }
        
        for (const query of queries) {
          // 跳过已完成的查询
          if (completedQueries.includes(query)) {
            continue;
          }
          
          try {
            this.logger.info(`正在处理查询: "${query}" (${totalProcessed + 1}/${queries.length})`);
            
            // 如果没有启用持久化浏览器或需要重启浏览器，则启动新的浏览器
            if (!persistBrowser || (persistBrowser && currentBatchCount === 0)) {
              if (!this.browser) {
                await this.launchBrowser(options);
              }
              
              // 如果页面不存在或已关闭，创建新页面
              if (!page || page.isClosed()) {
                if (this.browser) {
                  page = await this.browser.newPage({
                    viewport: { width: 1920, height: 1080 },
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                  });
                  this.logger.info('创建新页面用于处理查询');
                }
              }
            }
            
            // 自定义处理每个查询的方法，可由子类重写
            if (!page) {
              throw new Error('页面不可用，无法处理查询');
            }
            const suggestions = await this.processQueryInPage(query, page, options);
            suggestions.forEach(s => allSuggestions.add(s));
            
            // 更新进度
            completedQueries.push(query);
            const progressData = {
              keyword,
              engine: this.config.name,
              timestamp: new Date().toISOString(),
              total: queries.length,
              completed: completedQueries,
              completedCount: completedQueries.length,
              remaining: queries.length - completedQueries.length,
              uniqueSuggestionsCount: allSuggestions.size
            };
            fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2), 'utf-8');
            totalProcessed++;
            
            this.logger.info(`查询 "${query}" 完成，获取到 ${suggestions.length} 条建议，当前总计 ${allSuggestions.size} 条唯一建议`);
            
            // 计算批处理计数
            currentBatchCount++;
            
            // 如果达到批处理大小，重置计数并关闭浏览器（如果启用了持久化）
            if (persistBrowser && currentBatchCount >= batchSize) {
              this.logger.info(`达到批处理大小 ${batchSize}，重启浏览器...`);
              if (page) {
                await page.close().catch(e => this.logger.error(`关闭页面失败: ${e instanceof Error ? e.message : String(e)}`));
                page = null;
              }
              await this.cleanup(); // 关闭当前浏览器
              currentBatchCount = 0; // 重置计数
            }
            
            // 随机延迟，避免请求过快
            const delay = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } catch (error) {
            this.logger.error(`处理查询 "${query}" 时出错: ${error instanceof Error ? error.message : String(error)}`);
            
            // 如果出错，重置浏览器
            if (persistBrowser) {
              if (page) {
                await page.close().catch(e => this.logger.error(`关闭页面失败: ${e instanceof Error ? e.message : String(e)}`));
                page = null;
              }
              await this.cleanup();
              currentBatchCount = 0;
            }
          }
        }
      } finally {
        // 关闭页面
        if (page) {
          await page.close().catch(e => this.logger.error(`关闭页面失败: ${e instanceof Error ? e.message : String(e)}`));
        }
        
        // 所有查询完成后关闭浏览器
        await this.cleanup();
      }
      
      // 将所有建议保存为JSON格式
      const uniqueSuggestions = Array.from(allSuggestions).sort();
      const jsonData = {
        keyword: keyword,
        engine: this.config.name,
        timestamp: new Date().toISOString(),
        queries: queries.length,
        completedQueries: totalProcessed,
        suggestions: uniqueSuggestions,
        count: uniqueSuggestions.length
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      
      // 同时保存为CSV格式
      const csvFilename = outputFilename.replace('.json', '.csv');
      const csvPath = path.join(this.outputDir, csvFilename);
      
      // 准备CSV数据
      const headers = ['序号', '关键词'];
      const rows = uniqueSuggestions.map((suggestion, index) => [
        (index + 1).toString(),
        suggestion
      ]);
      
      // 生成并保存CSV文件
      const headerLine = headers.join(',');
      const dataLines = rows.map(row => row.join(','));
      const csvContent = [headerLine, ...dataLines].join('\n');
      
      fs.writeFileSync(csvPath, csvContent, 'utf-8');
      
      // 不要删除进度文件，保留它以便下次可以继续（仅当没有完成所有查询时）
      if (completedQueries.length < queries.length) {
        this.logger.info(`已保留进度文件，下次可以继续从中断处开始`);
      } else {
        // 如果全部完成，可以选择性删除进度文件
        // if (fs.existsSync(progressPath)) {
        //   fs.unlinkSync(progressPath);
        // }
      }
      
      this.logger.success(`已完成所有查询，共获取到 ${uniqueSuggestions.length} 条唯一建议`);
      this.logger.success(`JSON结果已保存到: ${outputPath}`);
      this.logger.success(`CSV结果已保存到: ${csvPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`字母组合查询失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(
        `为 "${keyword}" 获取字母组合建议失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.NETWORK,
        error
      );
    }
  }

  /**
   * 执行二次查询并支持断点续传
   * 基于初始关键词的自动补全结果，提取二次关键词并查询
   */
  async executeSecondaryQueries(
    keyword: string,
    options?: SearchOptions,
    outputFilename?: string,
    providedSecondaryKeywords?: string[]
  ): Promise<string> {
    try {
      this.logger.info(`开始为关键词 "${keyword}" 执行二次查询 (搜索引擎: ${this.config.name})...`);
      
      // 合并默认选项
      const searchOptions = {
        persistBrowser: true,
        batchSize: 10,
        retryCount: 1,
        delayBetweenQueries: { min: 1000, max: 3000 },
        maxResults: 300,
        maxSecondaryKeywords: 10,
        minKeywordLength: 5,
        ...options,
        enableSecondRound: false // 确保不会触发嵌套的二次查询
      };
      
      // 1. 获取二次关键词
      let secondaryKeywords: string[] = [];
      
      if (providedSecondaryKeywords && providedSecondaryKeywords.length > 0) {
        // 如果提供了二次关键词，直接使用
        secondaryKeywords = providedSecondaryKeywords;
        this.logger.info(`使用提供的 ${secondaryKeywords.length} 个二次关键词`);
      } else {
        // 获取初始关键词的查询结果
        this.logger.info(`未提供二次关键词，正在获取初始关键词 "${keyword}" 的自动补全建议...`);
        const initialResult = await this.fetchAutocomplete(keyword, {
          ...searchOptions,
          enableSecondRound: false
        });
        const initialSuggestions = initialResult.suggestions;
        this.logger.info(`获取到 ${initialSuggestions.length} 条初始自动补全建议`);
        
        // 保存初始结果为CSV
        const initialCsvFilename = `${this.config.name.toLowerCase()}_${keyword.replace(/\s+/g, '_')}_initial_suggestions.csv`;
        this.saveSuggestionsToCSV(initialSuggestions, initialCsvFilename);
        
        // 提取二次查询关键词
        secondaryKeywords = this.extractNewKeywords(initialSuggestions, keyword, {
          maxKeywords: searchOptions.maxSecondaryKeywords,
          minLength: searchOptions.minKeywordLength,
          customFilters: searchOptions.customFilters
        });
      }
      
      // 准备输出文件
      if (!outputFilename) {
        const safeKeyword = keyword.replace(/\s+/g, '_');
        outputFilename = `${this.config.name.toLowerCase()}_${safeKeyword}_secondary_suggestions.json`;
      } else if (!outputFilename.endsWith('.json')) {
        outputFilename = `${outputFilename}.json`;
      }
      
      const outputPath = path.join(this.outputDir, outputFilename);
      const progressPath = `${outputPath}.progress`;
      
      // 2. 检查进度文件，支持断点续传
      let completedKeywords: string[] = [];
      let allSuggestions: Set<string> = new Set();
      
      // 读取初始查询结果并添加到建议集合中（如果是内部执行的初始查询）
      if (!providedSecondaryKeywords && secondaryKeywords.length > 0) {
        try {
          const initialResult = await this.fetchAutocomplete(keyword, {
            ...searchOptions,
            enableSecondRound: false
          });
          initialResult.suggestions.forEach(suggestion => allSuggestions.add(suggestion));
          this.logger.info(`添加了 ${initialResult.suggestions.length} 条初始查询结果到建议集合中`);
        } catch (error) {
          this.logger.error(`获取初始查询结果失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // 读取进度文件（如果存在）
      if (fs.existsSync(progressPath)) {
        try {
          const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
          if (progressData.completed && Array.isArray(progressData.completed)) {
            completedKeywords = progressData.completed;
            this.logger.info(`找到进度文件，来自 ${progressData.timestamp}，已完成 ${completedKeywords.length}/${secondaryKeywords.length} 个二次查询`);
            
            // 恢复已收集的建议
            if (progressData.suggestions && Array.isArray(progressData.suggestions)) {
              progressData.suggestions.forEach((suggestion: string) => allSuggestions.add(suggestion));
              this.logger.info(`从进度文件恢复了 ${allSuggestions.size} 条建议`);
            }
          }
        } catch (e) {
          this.logger.warn(`进度文件损坏，将重新开始: ${e instanceof Error ? e.message : String(e)}`);
          completedKeywords = [];
        }
      }
      
      // 3. 执行二次查询
      let totalProcessed = completedKeywords.length;
      let currentBatchCount = 0;
      let page = null;
      
      try {
        // 启动浏览器，只启动一次并复用
        if (searchOptions.persistBrowser) {
          await this.launchBrowser(searchOptions);
          
          if (this.browser) {
            page = await this.browser.newPage({
              viewport: { width: 1024, height: 768 },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            });
            this.logger.info('创建新页面用于处理所有二次查询');
          }
        }
        
        // 处理每个二次关键词
        for (const secondaryKeyword of secondaryKeywords) {
          // 跳过已完成的查询
          if (completedKeywords.includes(secondaryKeyword)) {
            continue;
          }
          
          let retryAttempt = 0;
          let success = false;
          
          // 尝试查询，支持重试
          while (retryAttempt <= searchOptions.retryCount && !success) {
            try {
              this.logger.info(`正在处理二次关键词: "${secondaryKeyword}" ${retryAttempt > 0 ? `(重试 ${retryAttempt})` : ''} (${totalProcessed + 1}/${secondaryKeywords.length})`);
              
              // 确保浏览器和页面可用
              if (!this.browser || !page || page.isClosed()) {
                if (!this.browser) {
                  await this.launchBrowser(searchOptions);
                }
                
                // 创建新页面
                if (this.browser) {
                  page = await this.browser.newPage({
                    viewport: { width: 1024, height: 768 },
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                  });
                }
              }
              
              // 确保页面存在
              if (!page) {
                throw new Error('页面不可用，无法处理查询');
              }
              
              // 处理二次查询
              const suggestions = await this.processQueryInPage(secondaryKeyword, page, searchOptions);
              
              // 去重并添加到结果中
              let newSuggestionsCount = 0;
              for (const suggestion of suggestions) {
                if (!allSuggestions.has(suggestion)) {
                  allSuggestions.add(suggestion);
                  newSuggestionsCount++;
                }
              }
              
              success = true;
              this.logger.info(`关键词 "${secondaryKeyword}" 查询完成，获取到 ${suggestions.length} 条建议，其中 ${newSuggestionsCount} 条为新建议，当前总计 ${allSuggestions.size} 条`);
              
              // 更新进度
              completedKeywords.push(secondaryKeyword);
              totalProcessed++;
              
              // 保存进度
              const progressData = {
                keyword,
                engine: this.config.name,
                timestamp: new Date().toISOString(),
                total: secondaryKeywords.length,
                completed: completedKeywords,
                completedCount: completedKeywords.length,
                remaining: secondaryKeywords.length - completedKeywords.length,
                suggestions: Array.from(allSuggestions),
                suggestionsCount: allSuggestions.size
              };
              fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2), 'utf-8');
              
              // 如果已经达到最大结果数，提前结束
              if (searchOptions.maxResults && allSuggestions.size >= searchOptions.maxResults) {
                this.logger.info(`已达到最大结果数 ${searchOptions.maxResults}，提前结束查询`);
                break;
              }
            } catch (error) {
              this.logger.error(`查询 "${secondaryKeyword}" 失败: ${error instanceof Error ? error.message : String(error)}`);
              retryAttempt++;
              
              if (retryAttempt <= searchOptions.retryCount) {
                const waitTime = Math.floor(Math.random() * 
                  (searchOptions.delayBetweenQueries.max - searchOptions.delayBetweenQueries.min + 1)) + 
                  searchOptions.delayBetweenQueries.min;
                this.logger.info(`将在 ${waitTime/1000} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
          
          currentBatchCount++;
          
          // 批处理完成后，可能需要重置浏览器以防内存泄漏
          if (searchOptions.persistBrowser && currentBatchCount >= searchOptions.batchSize) {
            this.logger.info(`已处理 ${currentBatchCount} 个查询，达到批处理大小 ${searchOptions.batchSize}，重置浏览器...`);
            
            try {
              // 关闭当前页面
              if (page && !page.isClosed()) {
                await page.close();
              }
              
              // 重置全局浏览器实例，以便下一批处理时重新启动
              if (this.browser === SearchEngine.globalBrowser) {
                // 对于全局浏览器实例，不关闭它，只创建新页面
                this.logger.info('使用的是全局浏览器实例，将在下一批处理时创建新页面');
              } else if (this.browser) {
                this.logger.info('关闭并重新创建浏览器实例...');
                await this.browser.close();
                this.browser = null;
              }
              
              // 重置批次计数
              currentBatchCount = 0;
              page = null;
            } catch (e) {
              this.logger.error(`重置浏览器失败: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          
          // 查询间隔，避免请求过快
          if (success && secondaryKeywords.indexOf(secondaryKeyword) < secondaryKeywords.length - 1) {
            const waitTime = Math.floor(Math.random() * 
              (searchOptions.delayBetweenQueries.max - searchOptions.delayBetweenQueries.min + 1)) + 
              searchOptions.delayBetweenQueries.min;
            this.logger.info(`等待 ${waitTime/1000} 秒后进行下一次查询...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      } finally {
        // 关闭最后使用的页面（如果存在）
        if (page && !page.isClosed()) {
          await page.close().catch(e => this.logger.error(`关闭页面失败: ${e instanceof Error ? e.message : String(e)}`));
        }
      }
      
      // 4. 保存最终结果
      const suggestions = Array.from(allSuggestions);
      const data = {
        keyword,
        engine: this.config.name,
        timestamp: new Date().toISOString(),
        total: suggestions.length,
        suggestions
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.success(`二次查询完成，共获取到 ${suggestions.length} 条建议，结果保存在: ${outputPath}`);
      
      // 保存为CSV格式
      const csvPath = this.saveSuggestionsToCSV(suggestions, outputFilename.replace('.json', '.csv'));
      this.logger.info(`同时保存了CSV格式: ${csvPath}`);
      
      // 清理进度文件
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
        this.logger.info('清理进度文件');
      }
      
      return outputPath;
    } catch (error) {
      this.logger.error(`执行二次查询失败: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(
        `执行二次查询失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.PROCESS,
        error
      );
    }
  }

  /**
   * 通用方法：创建CSV文件保存建议
   */
  protected saveSuggestionsToCSV(suggestions: string[], filename: string): string {
    const headers = ['序号', '关键词'];
    const rows = suggestions.map((suggestion, index) => [
      (index + 1).toString(),
      suggestion
    ]);
    
    // 生成并保存CSV文件
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => row.join(','));
    const csvContent = [headerLine, ...dataLines].join('\n');
    
    const csvPath = path.join(this.outputDir, filename);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    this.logger.info(`已将建议保存为CSV文件: ${csvPath}`);
    
    return csvPath;
  }

  /**
   * 清理资源方法
   * 子类可以重写此方法以实现特定的清理逻辑
   */
  async cleanup(): Promise<void> {
    this.logger.info('清理资源...');
    
    // 清理自己的浏览器实例（如果不是共享实例）
    if (this.browser && this.browser !== SearchEngine.globalBrowser) {
      this.logger.info('关闭浏览器实例...');
      try {
        await this.browser.close();
      } catch (error) {
        this.logger.error(`关闭浏览器时出错: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.browser = null;
      }
    } else if (this.browser) {
      this.logger.info('使用的是全局浏览器实例，保持浏览器打开状态');
      // 只解除引用，不关闭
      this.browser = null;
    }
    
    return Promise.resolve();
  }
  
  /**
   * 关闭全局浏览器实例
   * 应该在所有操作完成后调用
   */
  static async closeGlobalBrowser(): Promise<void> {
    if (SearchEngine.globalBrowser) {
      const logger = new Logger('SearchEngine');
      logger.info('关闭全局浏览器实例...');
      try {
        await SearchEngine.globalBrowser.close();
      } catch (error) {
        logger.error(`关闭全局浏览器时出错: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        SearchEngine.globalBrowser = null;
      }
    }
  }

  /**
   * 保存建议到JSON文件
   */
  protected saveSuggestionsToJSON(suggestions: string[], outputPath: string, keyword: string): string {
    const jsonData = {
      keyword: keyword,
      engine: this.config.name,
      timestamp: new Date().toISOString(),
      suggestions: suggestions,
      count: suggestions.length
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    this.logger.info(`已将建议保存为JSON文件: ${outputPath}`);
    
    return outputPath;
  }

  /**
   * 在同一页面中处理查询的抽象方法
   * 子类必须实现此方法以提供特定引擎的查询处理逻辑
   */
  public abstract processQueryInPage(
    keyword: string,
    page: Page,
    options?: SearchOptions
  ): Promise<string[]>;
}