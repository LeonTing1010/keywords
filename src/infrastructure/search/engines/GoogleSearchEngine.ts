/**
 * GoogleSearchEngine - Google搜索引擎实现
 * 支持浏览器模式和API模式
 */
import { SearchEngine } from './SearchEngine';
import { 
  SearchOptions, 
  AutocompleteSuggestion, 
  SearchEngineConfig 
} from '../types';
import { ErrorType, AppError } from '../../core/errorHandler';
import { logger } from '../../error/logger';
import * as playwright from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class GoogleSearchEngine implements SearchEngine {
  private browser: playwright.Browser | null = null;
  private context: playwright.BrowserContext | null = null;
  private page: playwright.Page | null = null;
  private isInitialized = false;
  private proxyServer: string | null = null;
  private useSystem: boolean = true;
  private customDomain: string | null = null;
  private cookie: string = '';
  
  // Google搜索引擎配置
  private config: SearchEngineConfig = {
    name: 'Google',
    defaultDomain: 'www.google.com',
    supportsProxy: true,
    supportsSystemBrowser: true,
    description: 'Google搜索引擎',
    retryAttempts: 3,
    timeout: 60000,
    waitTime: 2000
  };

  constructor() {
    this.cookie = process.env.GOOGLE_COOKIE || '';
  }
  
  /**
   * 获取搜索引擎配置
   */
  getConfig(): SearchEngineConfig {
    return this.config;
  }

  /**
   * 设置代理服务器
   */
  setProxy(proxyServer: string): void {
    this.proxyServer = proxyServer;
    logger.info('设置代理服务器', { proxy: proxyServer });
  }
  
  /**
   * 设置是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void {
    this.useSystem = useSystem;
    logger.info(`${useSystem ? '使用系统浏览器' : '使用临时浏览器'}`);
  }
  
  /**
   * 设置自定义域名
   */
  setDomain(domain: string): void {
    this.customDomain = domain;
    logger.info('设置自定义域名', { domain });
  }

  /**
   * 获取搜索引擎类型
   */
  getEngineType(): string {
    return 'google';
  }

  /**
   * 随机延迟函数，模拟人类行为
   */
  private async randomDelay(min: number = 200, max: number = 2000): Promise<number> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
    return delay;
  }

  /**
   * 设置浏览器指纹以减少检测
   */
  private async setupBrowserFingerprint(page: playwright.Page): Promise<void> {
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
    
    const sizes = [
      {width: 1366, height: 768},
      {width: 1920, height: 1080},
      {width: 1440, height: 900}
    ];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    await page.setViewportSize(size);
  }
  
  /**
   * 初始化搜索引擎
   */
  async initialize(options?: SearchOptions): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      const launchOptions: playwright.LaunchOptions = {
        headless: false,
        channel: this.useSystem ? 'chrome' : undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      };
      
      if (this.proxyServer || options?.proxyServer) {
        launchOptions.proxy = {
          server: this.proxyServer || options?.proxyServer || ''
        };
      }
      
      this.browser = await playwright.chromium.launch(launchOptions);
      
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
        viewport: { width: 1280, height: 720 }
      });
      
      this.page = await this.context.newPage();
      
      if (this.page && this.config.timeout) {
        this.page.setDefaultTimeout(this.config.timeout);
      }

      if (this.page) {
        await this.setupBrowserFingerprint(this.page);
      }
      
      this.isInitialized = true;
      logger.info('Google搜索引擎初始化完成');
    } catch (error) {
      throw new AppError(
        `初始化Google搜索引擎失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
  
  /**
   * 处理Google的Cookie确认对话框
   */
  private async handleCookieConsent(page: playwright.Page): Promise<void> {
    try {
      const consentSelectors = [
        'button[id="L2AGLb"]',
        'button:has-text("Accept all")',
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button:has-text("Accept")',
        'button:has-text("Reject")',
        '[aria-label="Accept all"]',
        '[aria-label="Reject all"]'
      ];
      
      for (const selector of consentSelectors) {
        const button = await page.$(selector);
        if (button) {
          logger.debug(`找到Cookie确认按钮: ${selector}`);
          await button.click();
          await this.randomDelay(1000, 2000);
          break;
        }
      }
    } catch (e) {
      logger.debug('未发现Cookie确认对话框或已处理');
    }
  }

  /**
   * 保存错误截图
   */
  private async saveErrorScreenshot(page: playwright.Page, errorPrefix: string): Promise<string | null> {
    if (!page) return null;
    
    try {
      const outputDir = path.join(process.cwd(), 'logs');
      fs.mkdirSync(outputDir, { recursive: true });
      
      const screenshotPath = path.join(outputDir, `${errorPrefix}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      logger.info(`已保存错误截图: ${screenshotPath}`);
      return screenshotPath;
    } catch (e) {
      logger.error('保存错误截图失败', { error: e });
      return null;
    }
  }
  
  /**
   * 获取搜索建议 - 浏览器模式
   */
  private async getBrowserSuggestions(
    keyword: string,
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion[]> {
    if (!this.page) {
      throw new AppError('浏览器页面未初始化', ErrorType.BROWSER);
    }
    
    try {
      const domain = this.customDomain || options?.domain || this.config.defaultDomain;
      const url = `https://${domain}/`;
      
      logger.debug(`访问Google首页: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.randomDelay(1000, 2000);
      
      await this.handleCookieConsent(this.page);
      
      logger.debug('查找搜索框');
      const searchInput = await this.page.$('input[name="q"], textarea[name="q"], input[type="text"]');
      
      if (!searchInput) {
        throw new Error('无法找到Google搜索框');
      }
      
      logger.debug(`输入关键词: ${keyword}`);
      await searchInput.click();
      await this.randomDelay(300, 600);
      await searchInput.fill('');
      await this.randomDelay(200, 500);
      await searchInput.fill(keyword);
      await this.randomDelay(800, 1500);
      
      logger.debug('等待自动补全结果');
      const suggestionSelector = 'ul[role="listbox"] li, [role="listbox"] [role="option"]';
      await this.page.waitForSelector(suggestionSelector, { 
        timeout: this.config.waitTime || 2000 
      }).catch(() => {
        logger.warn('未找到自动补全结果');
      });
      
      await this.randomDelay(400, 800);
      
      const suggestions = await this.extractSuggestions(this.page);
      
      const filteredSuggestions = suggestions
        .filter(suggestion => suggestion.trim().length > 0)
        .filter(suggestion => {
          if (!options?.customFilters?.length) return true;
          return options.customFilters.every(filter => filter(suggestion));
        });
      
      logger.info(`获取到 ${filteredSuggestions.length} 条建议`);
      
      return filteredSuggestions.map((suggestion, index) => ({
        query: suggestion,
        position: index,
        source: 'google',
        timestamp: Date.now()
      }));
    } catch (error) {
      if (this.page) {
        await this.saveErrorScreenshot(this.page, 'error-google-suggestions');
      }
      throw error;
    }
  }
  
  /**
   * 获取搜索建议 - API模式
   */
  private async getAPISuggestions(
    keyword: string,
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion[]> {
    try {
      logger.info('获取Google搜索建议', { keyword });
      
      const domain = this.customDomain || options?.domain || this.config.defaultDomain;
      const url = `https://${domain}/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`;
      
      const fetchOptions: any = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Cookie': this.cookie,
          'Accept': 'application/json'
        },
        timeout: 10000
      };

      if (this.proxyServer) {
        fetchOptions.agent = new HttpsProxyAgent(this.proxyServer);
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json();
      
      // Google API返回格式: [query, [suggestions]]
      const suggestions = Array.isArray(data[1]) ? data[1] : [];

      return suggestions.map((suggestion: string, index: number) => ({
        query: suggestion,
        position: index,
        source: 'google',
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error('API获取搜索建议失败', { error });
      throw new AppError(
        `API获取搜索建议失败: ${(error as Error).message}`,
        ErrorType.NETWORK,
        error as Error
      );
    }
  }

  /**
   * 获取搜索建议
   */
  async getSuggestions(
    keyword: string,
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion[]> {
    // 如果有cookie，优先使用API模式
    if (this.cookie) {
      try {
        return await this.getAPISuggestions(keyword, options);
      } catch (error) {
        logger.warn('API模式失败，切换到浏览器模式', { error });
      }
    }
    
    // 浏览器模式
    if (!this.isInitialized) {
      await this.initialize(options);
    }
    
    return this.getBrowserSuggestions(keyword, options);
  }
  
  /**
   * 提取自动补全建议
   */
  private async extractSuggestions(page: playwright.Page): Promise<string[]> {
    return await page.$$eval('ul[role="listbox"] li, [role="listbox"] [role="option"]', (elements: Element[]) => {
      return elements.map(el => {
        // 1. 首先尝试获取只包含文本的子元素
        const textSpan = el.querySelector('.wM6W7d, .G43f7e, .zRAEtc, .sbl1');
        if (textSpan?.textContent) {
          return textSpan.textContent.trim();
        }
        
        // 2. 尝试获取第一个div或span子元素
        const firstChild = el.querySelector('div:first-child, span:first-child');
        if (firstChild?.textContent) {
          return firstChild.textContent.trim();
        }
        
        // 3. 备选方案：从完整文本中提取第一行
        const fullText = el.textContent || '';
        const firstLine = fullText.split('\n')[0].trim();
        if (firstLine.length > 0 && firstLine.length < 100) {
          return firstLine;
        }
        
        // 4. 如果上述都失败，使用最原始的提取并尝试过滤
        return (el.textContent || '')
          .trim()
          .replace(/\{.*?\}/g, '')
          .split('\n')[0]
          .substring(0, 100);
      }).filter(text => 
        text && 
        text.length > 0 && 
        text.length < 100 &&
        !text.includes('{') &&
        !text.includes(';}') &&
        !text.match(/^[.#]\w+/)
      );
    });
  }
  
  /**
   * 获取搜索结果
   */
  async getSearchResults(
    keyword: string,
    options?: { maxResults?: number }
  ): Promise<{ title: string; snippet: string; url: string }[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.page) {
      throw new AppError('浏览器页面未初始化', ErrorType.BROWSER);
    }
    
    try {
      const domain = this.customDomain || this.config.defaultDomain;
      const url = `https://${domain}/search?q=${encodeURIComponent(keyword)}`;
      
      logger.debug(`访问搜索结果页: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.randomDelay(1000, 2000);
      
      await this.handleCookieConsent(this.page);
      
      logger.debug('等待搜索结果加载');
      await this.page.waitForSelector('div#search', { timeout: 8000 });
      await this.randomDelay(1200, 1800);
      
      const results = await this.page.$$eval(
        'div#search .g',
        (elements: Element[], maxResults: number) => {
          const arr: { title: string; snippet: string; url: string }[] = [];
          
          for (const node of elements.slice(0, maxResults)) {
            const titleEl = node.querySelector('h3');
            let linkEl = titleEl ? titleEl.closest('a') : null;
            
            if (!linkEl) {
              linkEl = node.querySelector('a');
            }
            
            const snippetEl = node.querySelector('.VwiC3b, .IsZvec, .aCOpRe, .st');
            const title = titleEl?.textContent?.trim() || '';
            const url = linkEl?.getAttribute('href') || '';
            const snippet = snippetEl?.textContent?.trim() || '';
            
            if (title && url && url.startsWith('http')) {
              arr.push({ title, snippet, url });
            }
          }
          
          return arr;
        },
        options?.maxResults || 3
      );
      
      logger.info(`获取到 ${results.length} 条搜索结果`);
      return results;
    } catch (error) {
      if (this.page) {
        await this.saveErrorScreenshot(this.page, 'error-google-results');
      }
      throw new AppError(
        `获取搜索结果失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }

  /**
   * 关闭搜索引擎
   */
  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isInitialized = false;
        logger.info('搜索引擎已关闭');
      }
    } catch (error) {
      throw new AppError(
        `关闭搜索引擎失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
} 