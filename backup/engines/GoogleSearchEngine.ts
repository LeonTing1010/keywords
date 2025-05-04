import { chromium, Browser, Page, BrowserType } from 'playwright';
import { AutocompleteSuggestion, SearchOptions } from '../types';
import { SearchEngine } from './SearchEngine';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { AppError, ErrorType } from '../utils/errorHandler';

// 调试模式常量
const DEBUG_MODE = process.env.DEBUG === 'true';

/**
 * Google搜索引擎类
 * 实现Google搜索自动补全建议的获取
 */
export class GoogleSearchEngine extends SearchEngine {
  constructor() {
    super({
      name: 'Google',
      defaultDomain: 'https://www.google.com',
      supportsProxy: true,
      supportsSystemBrowser: true,
      supportsSecondRound: true,
      description: 'Google搜索引擎，全球最大的搜索引擎'
    });
  }

  /**
   * 获取Google搜索自动补全建议
   */
  async fetchAutocomplete(
    keyword: string, 
    options?: SearchOptions,
    existingBrowser?: Browser
  ): Promise<AutocompleteSuggestion> {
    // 设置默认选项
    const {
      domain = this.config.defaultDomain,
      proxyServer,
      useSystemBrowser = false,
      enableSecondRound = false,
      persistBrowser = true // 默认使用持久化浏览器
    } = options || {};
    
    this.logger.info(`正在获取 "${keyword}" 的Google自动补全建议...`);
    if (DEBUG_MODE) this.logger.debug(`调试模式: 使用选项 ${JSON.stringify({ domain, proxyServer, useSystemBrowser, enableSecondRound, persistBrowser })}`);
    
    let browser: Browser | null = null;
    let page: Page | null = null;
    
    try {
      // 使用现有浏览器或创建新的浏览器
      if (existingBrowser) {
        browser = existingBrowser;
        this.logger.info('使用共享浏览器实例');
      } else {
        // 使用基类的方法启动浏览器
        browser = await this.launchBrowser(options);
        if (DEBUG_MODE) this.logger.debug(`浏览器实例已创建: ${browser ? '成功' : '失败'}`);
      }
      
      page = await browser.newPage({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      });
      
      if (DEBUG_MODE) {
        // 监听页面事件
        await this.setupDebugEventListeners(page);
      }
      
      // 设置浏览器指纹
      await this.setupBrowserFingerprint(page);
      
      this.logger.info(`正在访问 ${domain}...`);
      await page.goto(domain, { timeout: 120000 }); // 增加超时时间到2分钟
      this.logger.info('页面加载完成，等待稳定...');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle'); // 等待网络请求完成
      await this.randomDelay(3000, 5000); // 增加页面稳定等待时间
      
      // 处理Google的Cookie确认对话框
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
            this.logger.info(`找到Cookie确认按钮，使用选择器: ${selector}`);
            await button.click();
            this.logger.info('已点击Cookie确认按钮');
            await this.randomDelay(1000, 2000); // 等待确认操作完成
            break;
          }
        }
      } catch (e) {
        this.logger.info('未发现Cookie确认对话框或已处理');
      }
      
      // 获取第一轮查询结果
      const suggestions = await this.processQueryInPage(keyword, page, options);
      this.logger.info(`获取到 ${suggestions.length} 条自动补全建议`);
      
      // 保存第一轮查询结果为CSV
      const csvFilename = `${this.config.name.toLowerCase()}_${keyword.replace(/\s+/g, '_')}_suggestions.csv`;
      this.saveSuggestionsToCSV(suggestions, csvFilename);
      
      // 如果启用了二次查询，则进行二次查询或返回初步查询结果
      if (enableSecondRound && this.config.supportsSecondRound) {
        // 如果有现有浏览器，我们需要先关闭页面
        if (page) {
          this.logger.info('正在关闭初次查询页面...');
          await page.close().catch(e => this.logger.error(`关闭页面失败: ${e instanceof Error ? e.message : String(e)}`));
          page = null;
        }
        
        // 已经获取了初步查询结果，可以直接返回，二次查询由executeSecondaryQueries方法单独处理
        this.logger.info('已启用二次查询，将执行单独的二次查询过程，可通过executeSecondaryQueries方法调用');
        return { 
          keyword, 
          suggestions 
        };
      }
      
      return { keyword, suggestions };
    } catch (error) {
      this.logger.error(`获取Google自动补全建议失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 保存错误截图
      if (page) {
        await this.saveErrorScreenshot(page, 'error-google');
      }
      
      throw new AppError(
        `获取Google自动补全建议失败: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.NETWORK,
        error
      );
    } finally {
      // 只关闭页面，保留浏览器实例供重用
      if (page) {
        this.logger.info('正在关闭页面...');
        await page.close().catch(e => this.logger.error(`关闭页面失败: ${e instanceof Error ? e.message : String(e)}`));
      }
      
      // 如果明确指定不持久化浏览器，并且是我们自己创建的浏览器实例（而非共享），才关闭它
      if (browser && !existingBrowser && !persistBrowser) {
        this.logger.info('正在关闭浏览器...');
        await browser.close().catch(e => this.logger.error(`关闭浏览器失败: ${e instanceof Error ? e.message : String(e)}`));
      } else if (browser) {
        this.logger.info('保持浏览器实例打开以供后续查询使用');
      }
    }
  }

  /**
   * 设置调试事件监听器
   * @param page Playwright页面对象
   */
  private async setupDebugEventListeners(page: Page): Promise<void> {
    if (!DEBUG_MODE) return;

    // 监听控制台信息
    page.on('console', msg => {
      this.logger.debug(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });

    // 监听网络请求
    page.on('request', request => {
      const url = request.url();
      // 过滤出与搜索建议相关的请求
      if (url.includes('complete/search') || url.includes('suggest') || url.includes('autocomplete')) {
        this.logger.debug(`[Network Request] ${request.method()} ${url}`);
        this.logger.debug(`[Request Headers] ${JSON.stringify(request.headers())}`);
      }
    });

    // 监听网络响应
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('complete/search') || url.includes('suggest') || url.includes('autocomplete')) {
        this.logger.debug(`[Network Response] ${response.status()} ${url}`);
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const responseBody = await response.json().catch(() => null);
            this.logger.debug(`[Response Body] ${JSON.stringify(responseBody)}`);
          }
        } catch (error) {
          this.logger.debug(`[Error parsing response] ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });

    // 监听页面错误
    page.on('pageerror', error => {
      this.logger.debug(`[Page Error] ${error.message}`);
    });
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await super.cleanup();
    // 特定的清理逻辑
    this.logger.info('Google搜索引擎资源清理完成');
  }

  /**
   * 在同一页面中处理查询
   * 实现在同一标签页中获取多个关键词的自动补全建议
   */
  public async processQueryInPage(
    query: string,
    page: Page,
    options?: SearchOptions
  ): Promise<string[]> {
    if (!page || page.isClosed()) {
      throw new Error('页面不可用，无法处理查询');
    }
    
    const {
      domain = this.config.defaultDomain,
    } = options || {};
    
    this.logger.info(`正在获取 "${query}" 的Google自动补全建议...`);
    
    try {
      // 检查页面是否已经打开Google
      const currentUrl = page.url();
      if (!currentUrl.includes('google.com')) {
        this.logger.info(`正在访问 ${domain}...`);
        await page.goto(domain, { timeout: 120000 }); // 增加超时时间到2分钟
        this.logger.info('页面加载完成，等待稳定...');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle'); // 等待网络请求完成
        await this.randomDelay(3000, 5000); // 增加页面稳定等待时间
        
        // 处理Google的Cookie确认对话框
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
              this.logger.info(`找到Cookie确认按钮，使用选择器: ${selector}`);
              await button.click();
              this.logger.info('已点击Cookie确认按钮');
              await this.randomDelay(1000, 2000); // 等待确认操作完成
              break;
            }
          }
        } catch (e) {
          this.logger.info('未发现Cookie确认对话框或已处理');
        }
      }
      
      // 搜索框选择器
      this.logger.info('正在查找搜索框...');
      let searchInput = null;
      const selectors = [
        'input[name="q"]',
        'input[title="Search"]',
        'textarea[name="q"]',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        try {
          const input = await page.$(selector);
          if (input) {
            searchInput = input;
            this.logger.info(`找到搜索框，使用选择器: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
      
      if (!searchInput) {
        throw new Error('无法找到Google搜索框');
      }
      
      if (DEBUG_MODE) {
        this.logger.debug('开始记录DOM结构和自动补全UI信息');
        await this.debugDOMStructure(page);
      }
      
      // 输入关键词
      this.logger.info(`正在输入关键词: ${query}`);
      await searchInput.click();
      await this.randomDelay(300, 600);
      await searchInput.fill(''); // 清空当前内容
      await this.randomDelay(200, 500);
      await searchInput.fill(query);
      await this.randomDelay(800, 1500);
      
      // 等待自动补全结果出现
      this.logger.info('等待自动补全结果...');
      const suggestionSelector = 'ul[role="listbox"] li, .sbct';
      await page.waitForSelector(suggestionSelector, { timeout: 5000 }).catch(() => {
        this.logger.warn('未找到自动补全结果，可能没有建议或选择器变化');
      });
      
      await this.randomDelay(800, 1500);
      
      if (DEBUG_MODE) {
        // 在调试模式下，截图并保存这个查询的自动补全结果
        await this.saveDebugScreenshot(page, `debug-autocomplete-${query.replace(/\s+/g, '_')}`);
      }
      
      // 获取建议列表并去重
      let suggestions = await this.extractSuggestions(page);
      suggestions = Array.from(new Set(suggestions));
      
      this.logger.info(`获取到 ${suggestions.length} 条自动补全建议`);
      return suggestions;
    } catch (error) {
      this.logger.error(`获取Google自动补全建议失败: ${error instanceof Error ? error.message : String(error)}`);
      // 保存错误截图
      await this.saveErrorScreenshot(page, `error-google-query-${query.replace(/\s+/g, '_')}`);
      
      // 返回空数组，允许继续处理其他查询
      return [];
    }
  }

  /**
   * 调试DOM结构
   * @param page 页面对象
   */
  private async debugDOMStructure(page: Page): Promise<void> {
    if (!DEBUG_MODE) return;

    try {
      // 获取自动补全相关元素的信息
      const domInfo = await page.evaluate(() => {
        const info = {
          searchBox: null as any,
          autocompleteContainer: null as any,
          suggestions: [] as any[]
        };

        // 搜索框信息
        const searchBox = document.querySelector('input[name="q"], textarea[name="q"]');
        if (searchBox) {
          info.searchBox = {
            tagName: searchBox.tagName,
            attributes: Object.fromEntries(
              Array.from(searchBox.attributes).map(attr => [attr.name, attr.value])
            )
          };
        }

        // 自动补全容器信息
        const container = document.querySelector('ul[role="listbox"]');
        if (container) {
          info.autocompleteContainer = {
            tagName: container.tagName,
            attributes: Object.fromEntries(
              Array.from(container.attributes).map(attr => [attr.name, attr.value])
            )
          };

          // 获取建议项信息
          const items = container.querySelectorAll('li');
          info.suggestions = Array.from(items).map(item => ({
            tagName: item.tagName,
            attributes: Object.fromEntries(
              Array.from(item.attributes).map(attr => [attr.name, attr.value])
            ),
            textContent: item.textContent?.trim().substring(0, 100),
            childrenCount: item.children.length
          }));
        }

        return info;
      });

      this.logger.debug(`[DOM Analysis] ${JSON.stringify(domInfo, null, 2)}`);
    } catch (error) {
      this.logger.debug(`[DOM Analysis Error] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 保存调试截图
   * @param page 页面对象
   * @param fileName 文件名前缀
   */
  private async saveDebugScreenshot(page: Page, fileName: string): Promise<void> {
    if (!DEBUG_MODE) return;

    try {
      // 确保调试目录存在
      const outputDir = path.join(process.cwd(), 'logs', 'debug');
      fs.mkdirSync(outputDir, { recursive: true });

      // 保存截图
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(outputDir, `${fileName}-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      this.logger.debug(`[Debug Screenshot] 已保存截图到 ${screenshotPath}`);
    } catch (error) {
      this.logger.debug(`[Debug Screenshot Error] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 提取自动补全建议
   * @param page 页面对象
   * @returns 提取到的建议数组
   */
  private async extractSuggestions(page: Page): Promise<string[]> {
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
   * 在Google页面上获取二次关键词
   */
  protected async getSecondaryKeywords(
    keyword: string, 
    page: Page, 
    suggestions: string[],
    options?: SearchOptions
  ): Promise<string[]> {
    // 使用基类的提取关键词方法
    return this.extractNewKeywords(suggestions, keyword, {
      maxKeywords: options?.maxSecondaryKeywords || 10,
      minLength: options?.minKeywordLength || 5,
      customFilters: options?.customFilters
    });
  }
}