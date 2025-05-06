/**
 * KeywordIntent 百度搜索引擎
 * 百度搜索自动补全建议获取实现
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
import { logger } from '../core/logger';

/**
 * 百度搜索引擎实现
 */
export class BaiduSearchEngine implements SearchEngine {
  private browser: playwright.Browser | null = null;
  private context: playwright.BrowserContext | null = null;
  private page: playwright.Page | null = null;
  private isInitialized = false;
  private proxyServer: string | null = null;
  private useSystem: boolean = true;
  private customDomain: string | null = null;
  
  // 百度搜索引擎配置
  private config: SearchEngineConfig = {
    name: 'Baidu',
    defaultDomain: 'www.baidu.com',
    supportsProxy: true,
    supportsSystemBrowser: true,
    description: '百度搜索引擎',
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
    logger.info(`设置代理服务器: ${proxyServer}`, { engine: 'baidu' });
  }
  
  /**
   * 设置是否使用系统浏览器
   * @param useSystem 是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void {
    this.useSystem = useSystem;
    logger.info(`${useSystem ? '使用系统浏览器' : '使用临时浏览器'}`, { engine: 'baidu' });
  }
  
  /**
   * 设置自定义域名
   * @param domain 自定义域名
   */
  setDomain(domain: string): void {
    this.customDomain = domain;
    logger.info(`设置自定义域名: ${domain}`, { engine: 'baidu' });
  }

  /**
   * 获取搜索引擎类型
   * @returns 搜索引擎类型
   */
  getEngineType(): string {
    return this.constructor.name.toLowerCase();
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
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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
        channel: this.useSystem ? 'chrome' : undefined, // 使用系统安装的Chrome浏览器或临时浏览器
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      };
      
      // 如果配置了代理，添加代理设置
      if (this.proxyServer || options?.proxyServer) {
        launchOptions.proxy = {
          server: this.proxyServer || options?.proxyServer || ''
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
        `初始化百度搜索引擎失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
  
  /**
   * 处理百度的隐私政策/Cookie确认对话框
   */
  private async handlePrivacyConsent(page: playwright.Page): Promise<void> {
    try {
      const consentSelectors = [
        '#app-agree-btn', // 同意按钮
        '.fc-footer-buttons-yes', // 同意按钮
        '.privacy-box button', // 隐私政策弹窗中的按钮
        'button:has-text("同意")',
        'button:has-text("确定")',
        'button:has-text("接受")',
        'button:has-text("我同意")'
      ];
      
      for (const selector of consentSelectors) {
        const button = await page.$(selector);
        if (button) {
          logger.debug(`找到隐私政策确认按钮，使用选择器: ${selector}`, { engine: 'baidu' });
          await button.click();
          logger.debug('已点击隐私政策确认按钮', { engine: 'baidu' });
          await this.randomDelay(1000, 2000); // 等待确认操作完成
          break;
        }
      }
    } catch (e) {
      logger.debug('未发现隐私政策确认对话框或已处理', { engine: 'baidu' });
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
      logger.info(`已保存错误截图到 ${screenshotPath}`, { engine: 'baidu' });
      return screenshotPath;
    } catch (e) {
      logger.error(`保存错误截图失败: ${e instanceof Error ? e.message : String(e)}`, { 
        engine: 'baidu',
        error: e
      });
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
  ): Promise<AutocompleteSuggestion[]> {
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
      const domain = this.customDomain || options?.domain || this.config.defaultDomain;
      
      // 构建URL
      const url = `https://${domain}/`;
      
      // 导航到百度首页
      logger.debug(`正在访问 ${url}...`, { engine: 'baidu', keyword });
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // 等待页面稳定
      logger.debug('页面加载完成，等待稳定...', { engine: 'baidu' });
      await this.randomDelay(1000, 2000);
      
      // 处理隐私政策确认对话框
      await this.handlePrivacyConsent(this.page);
      
      // 查找搜索框
      logger.debug('正在查找搜索框...', { engine: 'baidu' });
      let searchInput = null;
      const selectors = [
        '#kw',                // 百度主要搜索框ID
        'input[name="wd"]',   // 百度搜索关键词参数
        'input[type="text"]', // 备用选择器
        '#index-kw'           // 另一个可能的搜索框ID
      ];
      
      for (const selector of selectors) {
        try {
          const input = await this.page.$(selector);
          if (input) {
            searchInput = input;
            logger.debug(`找到搜索框，使用选择器: ${selector}`, { engine: 'baidu' });
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
      
      if (!searchInput) {
        throw new Error('无法找到百度搜索框');
      }
      
      // 输入关键词
      logger.debug(`正在输入关键词: ${keyword}`, { engine: 'baidu' });
      await searchInput.click();
      await this.randomDelay(300, 600);
      await searchInput.fill(''); // 清空当前内容
      await this.randomDelay(200, 500);
      await searchInput.fill(keyword);
      await this.randomDelay(800, 1500); // 等待自动补全出现
      
      // 等待自动补全结果出现
      logger.debug('等待自动补全结果...', { engine: 'baidu' });
      const suggestionSelector = '.bdsug-store ul li, .bdsug ul li, .bdsug-list li';
      await this.page.waitForSelector(suggestionSelector, { 
        timeout: this.config.waitTime || 2000 
      }).catch(() => {
        logger.warn('未找到自动补全结果，可能没有建议或选择器变化', { engine: 'baidu', keyword });
      });
      
      await this.randomDelay(400, 800);
      
      // 提取建议
      const suggestions = await this.extractSuggestions(this.page);
      
      // 过滤空建议和应用自定义过滤器
      const filteredSuggestions = suggestions
        .filter(suggestion => suggestion.trim().length > 0)
        .filter(suggestion => {
          if (!options?.customFilters || options.customFilters.length === 0) {
            return true;
          }
          return options.customFilters.every(filter => filter(suggestion));
        });
      
      logger.info(`获取到 ${filteredSuggestions.length} 条自动补全建议`, { 
        engine: 'baidu', 
        keyword,
        count: filteredSuggestions.length
      });
      
      // 返回 AutocompleteSuggestion[]
      return filteredSuggestions.map((suggestion, index) => ({
        query: suggestion,
        position: index,
        source: 'baidu',
        timestamp: Date.now()
      }));
    } catch (error) {
      // 保存错误截图
      if (this.page) {
        await this.saveErrorScreenshot(this.page, 'error-baidu');
      }
      
      throw new AppError(
        `获取百度搜索建议失败: ${(error as Error).message}`,
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
    return await page.$$eval('.bdsug-store ul li, .bdsug ul li, .bdsug-list li', els => {
      return els.map(el => {
        // 尝试从不同的元素结构中提取文本
        // 1. 先查找是否有特定的结构，如百度红色的热搜标签
        const hotTag = el.querySelector('.bdsug-hot');
        const plainText = el.textContent || '';
        
        // 如果有热搜标签，需要移除热搜两个字
        if (hotTag) {
          return plainText.replace('热搜', '').trim();
        }
        
        // 2. 直接获取文本内容
        return plainText.trim();
      }).filter(text => 
        // 过滤空结果
        text && 
        text.length > 0 && 
        text.length < 100
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
        `关闭百度搜索引擎失败: ${(error as Error).message}`,
        ErrorType.BROWSER,
        error as Error
      );
    }
  }
} 