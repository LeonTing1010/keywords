import { chromium, Browser, Page } from 'playwright';
import { AutocompleteSuggestion, SearchOptions } from '../types';
import { SearchEngine } from './SearchEngine';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 百度搜索引擎类
 * 实现百度搜索自动补全建议的获取
 */
export class BaiduSearchEngine extends SearchEngine {
  constructor() {
    super({
      name: 'Baidu',
      defaultDomain: 'https://www.baidu.com',
      supportsProxy: true,
      supportsSystemBrowser: false,  // 百度暂不支持系统浏览器模式
      supportsSecondRound: true,
      description: '百度搜索引擎，中文搜索最佳选择'
    });
  }
  
  /**
   * 获取百度搜索自动补全建议
   */
  async fetchAutocomplete(
    keyword: string, 
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion> {
    // 设置默认选项
    const {
      domain = this.config.defaultDomain,
      proxyServer
    } = options || {};
    
    console.log(`正在获取 "${keyword}" 的百度自动补全建议...`);
    
    // 浏览器启动选项
    const launchOptions: any = { 
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
      console.log(`使用代理服务器: ${proxyServer}`);
      launchOptions.proxy = { server: proxyServer };
    }
    
    // 创建浏览器实例
    const browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });
    
    try {
      console.log(`正在访问 ${domain}...`);
      await page.goto(domain, { timeout: 60000 });
      console.log('页面加载完成，等待稳定...');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000); // 等待页面稳定
      
      // 搜索框选择器
      console.log('正在查找搜索框...');
      let searchInput = null;
      const selectors = [
        '#kw',
        'input[name="wd"]',
        'input[id="kw"]',
        'input[class="s_ipt"]',
        'input[type="text"]'
      ];
      
      for (const selector of selectors) {
        try {
          console.log(`尝试选择器: ${selector}`);
          await page.waitForSelector(selector, { timeout: 1000 });
          searchInput = await page.$(selector);
          if (searchInput) {
            console.log(`找到搜索框，使用选择器: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
      
      if (!searchInput) {
        console.log('尝试截图查看页面状态...');
        await page.screenshot({ path: path.join(this.outputDir, 'debug-baidu-page.png') });
        console.log('已保存页面截图到 output/debug-baidu-page.png');
        
        throw new Error('无法找到百度搜索框');
      }

      // 逐字输入关键词
      console.log(`正在输入关键词: ${keyword}`);
      await searchInput.click();
      await searchInput.focus();
      
      // 先清空输入框
      await searchInput.fill('');
      await page.waitForTimeout(500);
      
      // 逐字输入，模拟人类行为
      for (const char of keyword) {
        await page.keyboard.type(char, { delay: 100 });
        await page.waitForTimeout(150);
      }
      
      // 等待自动补全建议出现
      console.log('等待自动补全建议出现...');
      const suggestionSelectors = [
        'ul.bdsug-list li',
        '.bdsug-store-item',
        '.bdsug li'
      ];
      
      let suggestions: string[] = [];
      for (const selector of suggestionSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          suggestions = await page.$$eval(selector, els =>
            els.map(el => el.textContent?.trim() || '')
              .filter(text => text && text.length > 0)
          );
          if (suggestions.length > 0) {
            console.log(`找到自动补全建议，使用选择器: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
      
      // 延迟关闭浏览器
      await page.waitForTimeout(1000);
      await browser.close();
      
      console.log(`已找到 "${keyword}" 的${suggestions.length}个建议`);
      return { keyword, suggestions };
    } catch (error) {
      console.log('出现错误，尝试截图...');
      try {
        await page.screenshot({ path: path.join(this.outputDir, 'error-baidu-page.png') });
        console.log('已保存错误页面截图到 output/error-baidu-page.png');
      } catch (e) {
        console.log('截图失败:', e);
      }
      
      await browser.close();
      console.error(`获取 "${keyword}" 的自动补全建议时出错:`, error);
      throw error;
    }
  }
  
  /**
   * 生成查询组合
   * 针对中文搜索习惯进行定制
   */
  generateAlphabetQueries(rootWord: string): string[] {
    const queries: string[] = [];
    
    // 常用中文连接词
    const chineseConnectors = ['是', '怎么', '如何', '有什么', '什么', '为什么', '哪些', '可以', '需要'];
    
    // 添加中文连接词查询
    for (const connector of chineseConnectors) {
      queries.push(`${rootWord}${connector}`);
    }
    
    // 添加字母查询（中英文混合搜索）
    for (let charCode = 97; charCode <= 122; charCode++) {
      const letter = String.fromCharCode(charCode);
      queries.push(`${rootWord} ${letter}`);
    }
    
    // 添加数字后缀
    for (let i = 0; i <= 9; i++) {
      queries.push(`${rootWord}${i}`);
    }
    
    return queries;
  }
} 