/**
 * KeywordIntent Google搜索引擎
 * 谷歌搜索自动补全建议获取实现
 */
import { SearchEngine } from './SearchEngine';
import { 
  SearchOptions, 
  AutocompleteSuggestion, 
  SearchEngineConfig 
} from '../types';
import { ErrorType, AppError } from '../core/errorHandler';
import * as playwright from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Google搜索引擎实现
 */
export class GoogleSearchEngine implements SearchEngine {
  private browser: playwright.Browser | null = null;
  private context: playwright.BrowserContext | null = null;
  private page: playwright.Page | null = null;
  private isInitialized = false;
  private proxyServer: string | null = null;
  private useSystem: boolean = true;
  private customDomain: string | null = null;
  
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
  
  /**
   * 获取搜索引擎配置
   */
  getConfig(): SearchEngineConfig {
    return this.config;
  }
  
  /**
   * 设置代理服务器
   * @param proxyServer 代理服务器URL
   */
  setProxy(proxyServer: string): void {
    this.proxyServer = proxyServer;
    console.log(`[GoogleSearchEngine] 设置代理服务器: ${proxyServer}`);
  }
  
  /**
   * 设置是否使用系统浏览器
   * @param useSystem 是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void {
    this.useSystem = useSystem;
    console.log(`[GoogleSearchEngine] ${useSystem ? '使用系统浏览器' : '使用临时浏览器'}`);
  }
  
  /**
   * 设置自定义域名
   * @param domain 自定义域名
   */
  setDomain(domain: string): void {
    this.customDomain = domain;
    console.log(`[GoogleSearchEngine] 设置自定义域名: ${domain}`);
  }

  /**
   * 随机延迟函数，模拟人类行为
   * @param min 最小延迟(ms)
   * @param max 最大延迟(ms)
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
   * 初始化搜索引擎
   * @param options 搜索选项
   */
  async initialize(options?: SearchOptions): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // 创建浏览器启动选项 - 默认有头模式且使用系统浏览器
      const launchOptions: playwright.LaunchOptions = {
        headless: false,
        channel: 'chrome', // 使用系统安装的Chrome浏览器
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      };
      
      // 如果配置了代理，添加代理设置
      if (options?.proxyServer) {
        launchOptions.proxy = {
          server: options.proxyServer
        };
      }
      
      // 启动浏览器 - 使用系统Chrome浏览器
      this.browser = await playwright.chromium.launch(launchOptions);
      
      // 创建浏览器上下文
      const viewportSize = {
        width: 1280,
        height: 720
      };
      
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
        viewport: viewportSize
      });
      
      // 创建页面
      this.page = await this.context.newPage();
      
      // 设置超时
      if (this.page && this.config.timeout) {
        this.page.setDefaultTimeout(this.config.timeout);
      }

      // 设置浏览器指纹
      if (this.page) {
        await this.setupBrowserFingerprint(this.page);
      }
      
      this.isInitialized = true;
    } catch (error) {
      throw new AppError(
        `初始化Google搜索引擎失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
  
  /**
   * 处理 Google 的 Cookie 确认对话框
   */
  private async handleCookieConsent(page: playwright.Page): Promise<void> {
    try {
      const cookieSelectors = [
        'button[id="L2AGLb"]', // "我同意"按钮
        'button:has-text("Accept all")',
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button:has-text("Accept")',
        'button:has-text("Reject")',
        'button:has-text("拒绝")',
        'button:has-text("同意")',
        'button:has-text("接受")',
        'button:has-text("全部接受")',
        '[aria-label="Accept all"]',
        '[aria-label="Reject all"]'
      ];
      
      for (const selector of cookieSelectors) {
        const button = await page.$(selector);
        if (button) {
          console.log(`找到Cookie确认按钮，使用选择器: ${selector}`);
          await button.click();
          console.log('已点击Cookie确认按钮');
          await this.randomDelay(1000, 2000); // 等待确认操作完成
          break;
        }
      }
    } catch (e) {
      console.log('未发现Cookie确认对话框或已处理');
    }
  }

  /**
   * 保存错误截图
   */
  private async saveErrorScreenshot(page: playwright.Page, errorPrefix: string): Promise<string | null> {
    if (!page) return null;
    
    try {
      // 确保logs目录存在
      const outputDir = path.join(process.cwd(), 'logs');
      fs.mkdirSync(outputDir, { recursive: true });
      
      const screenshotPath = path.join(outputDir, `${errorPrefix}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`已保存错误截图到 ${screenshotPath}`);
      return screenshotPath;
    } catch (e) {
      console.error(`保存错误截图失败: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
  
  /**
   * 获取搜索建议
   * @param keyword 关键词
   * @param options 搜索选项
   * @returns 自动补全建议
   */
  async getSuggestions(
    keyword: string, 
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion> {
    // 如果没有初始化，先初始化
    if (!this.isInitialized) {
      await this.initialize(options);
    }
    
    if (!this.page) {
      throw new AppError(
        '浏览器页面未初始化',
        ErrorType.BROWSER
      );
    }
    
    try {
      // 确定使用的域名
      const domain = options?.domain || this.config.defaultDomain;
      
      // 构建URL
      const url = `https://${domain}/`;
      
      // 导航到谷歌 - 只等待DOM内容加载，不等待网络空闲
      console.log(`正在访问 ${url}...`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // 等待页面稳定
      console.log('页面加载完成，等待稳定...');
      await this.randomDelay(1000, 2000);
      
      // 处理Cookie确认对话框
      await this.handleCookieConsent(this.page);
      
      // 查找搜索框
      console.log('正在查找搜索框...');
      let searchInput = null;
      const selectors = [
        'input[name="q"]',
        'input[title="Search"]',
        'textarea[name="q"]',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        try {
          const input = await this.page.$(selector);
          if (input) {
            searchInput = input;
            console.log(`找到搜索框，使用选择器: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
      
      if (!searchInput) {
        throw new Error('无法找到Google搜索框');
      }
      
      // 输入关键词
      console.log(`正在输入关键词: ${keyword}`);
      await searchInput.click();
      await this.randomDelay(300, 600);
      await searchInput.fill(''); // 清空当前内容
      await this.randomDelay(200, 500);
      await searchInput.fill(keyword);
      await searchInput.fill(' ');
      await this.randomDelay(800, 1500); // 等待自动补全出现
      
      // 等待自动补全结果出现
      console.log('等待自动补全结果...');
      const suggestionSelector = 'ul[role="listbox"] li, .sbct';
      await this.page.waitForSelector(suggestionSelector, { 
        timeout: this.config.waitTime || 2000 
      }).catch(() => {
        console.warn('未找到自动补全结果，可能没有建议或选择器变化');
      });
      
      await this.randomDelay(400, 800);
      
      // 提取建议
      const suggestions = await this.extractSuggestions(this.page);
      
      // 过滤空建议和应用自定义过滤器
      const filteredSuggestions = suggestions
        .filter(suggestion => suggestion.trim().length > 0)
        // 如果有自定义过滤器，应用过滤器
        .filter(suggestion => {
          if (!options?.customFilters || options.customFilters.length === 0) {
            return true;
          }
          return options.customFilters.every(filter => filter(suggestion));
        });
      
      console.log(`获取到 ${filteredSuggestions.length} 条自动补全建议`);
      
      return {
        keyword,
        suggestions: filteredSuggestions
      };
    } catch (error) {
      // 保存错误截图
      if (this.page) {
        await this.saveErrorScreenshot(this.page, 'error-google');
      }
      
      throw new AppError(
        `获取Google搜索建议失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
  
  /**
   * 提取自动补全建议
   * @param page 页面对象
   * @returns 提取到的建议数组
   */
  private async extractSuggestions(page: playwright.Page): Promise<string[]> {
    return await page.$$eval('ul[role="listbox"] li, [role="listbox"] [role="option"]', els => {
      return els.map(el => {
        // 尝试从不同的元素结构中提取文本
        // 1. 首先尝试获取只包含文本的子元素
        const textSpan = el.querySelector('.wM6W7d, .G43f7e, .zRAEtc, .sbl1');
        if (textSpan && textSpan.textContent) {
          return textSpan.textContent.trim();
        }
        
        // 2. 尝试获取第一个div或span子元素
        const firstChild = el.querySelector('div:first-child, span:first-child');
        if (firstChild && firstChild.textContent) {
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
        // 过滤掉明显是代码的结果
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
      }
    } catch (error) {
      throw new AppError(
        `关闭Google搜索引擎失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
} 