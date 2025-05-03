import { chromium, Browser, Page, BrowserType } from 'playwright';
import { AutocompleteSuggestion, SearchOptions } from '../types';
import { SearchEngine } from './SearchEngine';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * 随机延迟函数，模拟人类行为
 * @param min 最小延迟(ms)
 * @param max 最大延迟(ms)
 */
async function randomDelay(min: number = 200, max: number = 2000) {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
  return delay;
}

/**
 * 获取系统默认浏览器类型
 * @returns 系统合适的浏览器类型和通道
 */
function getSystemBrowser(): { type: BrowserType<{}>; channel: string | undefined } {
  const platform = os.platform();
  
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
 * 创建命令行交互接口
 */
function createReadlineInterface() {
  return require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * 等待用户输入
 * @param question 询问内容
 */
async function askUser(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * 设置浏览器指纹以减少检测
 * @param page Playwright页面实例
 */
async function setupBrowserFingerprint(page: Page) {
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
 * 检测并处理验证码
 * @param page Playwright页面实例
 */
async function handleCaptcha(page: Page): Promise<boolean> {
  // 检查各种验证码标记
  const captchaSelectors = [
    'form[action*="captcha"]',
    'iframe[src*="recaptcha"]',
    'div.g-recaptcha',
    'iframe[title*="reCAPTCHA"]',
    'div[aria-label*="验证"]',
    'div[aria-label*="verify"]',
    'input[aria-label*="captcha"]',
    '#captcha',
    '.captcha'
  ];
  
  for (const selector of captchaSelectors) {
    const captchaExists = await page.$(selector).then(res => !!res);
    if (captchaExists) {
      console.log('⚠️ 检测到验证码! 需要手动处理。');
      
      // 截图保存验证码
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const screenshotPath = path.join(outputDir, 'google_captcha.png');
      await page.screenshot({ path: screenshotPath });
      console.log(`已保存验证码截图到: ${screenshotPath}`);
      
      // 等待用户手动完成验证
      const userInput = await askUser('请在浏览器中完成验证, 完成后输入"ok"继续: ');
      return userInput.toLowerCase() === 'ok';
    }
  }
  return false;
}

/**
 * 模拟更真实的输入行为
 * @param page Playwright页面实例
 * @param element 要输入的元素
 * @param text 输入文本
 */
async function humanLikeTyping(page: Page, element: any, text: string) {
  console.log(`以人类方式输入: ${text}`);
  await element.click();
  await element.focus();
  
  // 先清空字段
  await element.fill('');
  await randomDelay(300, 700);
  
  // 分组输入，模拟人类打字习惯
  const chunks = [];
  let remainingText = text;
  
  // 分组成2-4个字符的块
  while (remainingText.length > 0) {
    const chunkSize = Math.min(remainingText.length, Math.floor(Math.random() * 3) + 2);
    chunks.push(remainingText.substring(0, chunkSize));
    remainingText = remainingText.substring(chunkSize);
  }
  
  // 输入每个分组，并加入随机停顿
  for (let i = 0; i < chunks.length; i++) {
    for (const char of chunks[i]) {
      await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
    }
    
    // 组间停顿
    if (i < chunks.length - 1) {
      await randomDelay(200, 700);
    }
  }
  
  await randomDelay(300, 800);
}

/**
 * 检查页面是否仍在加载
 * @param page Playwright页面实例
 */
async function waitForStableLoadState(page: Page) {
  // 等待所有重要状态
  await page.waitForLoadState('domcontentloaded');
  await randomDelay(500, 1000);
  
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (e) {
    console.log('等待网络稳定超时，继续执行...');
  }
  
  // 额外等待，确保页面完全稳定
  await randomDelay(1000, 2000);
}

/**
 * 查找搜索框
 */
async function findSearchBox(page: Page) {
  console.log('正在查找搜索框...');
  let searchInput = null;
  
  // 1. 首先尝试使用角色定位搜索区域
  const searchForm = await page.$('[role="search"]').catch(() => null);
  if (searchForm) {
    searchInput = await searchForm.$('input[role="combobox"], textarea[role="combobox"], input[name="q"], textarea[name="q"]');
    if (searchInput) return searchInput;
  }
  
  // 2. 通过ARIA标签定位
  searchInput = await page.$('input[aria-label*="earch"], input[aria-label*="搜索"], textarea[aria-label*="earch"], textarea[aria-label*="搜索"]');
  if (searchInput) return searchInput;
  
  // 3. 尝试主要属性选择器
  const prioritySelectors = [
    'input[name="q"]',
    'textarea[name="q"]',
    'input[title*="Search"], input[title*="搜索"]',
    'input.gsfi',
    'input[type="search"]'
  ];
  
  for (const selector of prioritySelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      searchInput = await page.$(selector);
      if (searchInput) return searchInput;
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }
  
  return null;
}

/**
 * 提取自动补全建议
 */
async function extractSuggestions(page: Page): Promise<string[]> {
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
      !text.includes('.') &&
      !text.match(/^[.#]\w+/)
    );
  });
}

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
      description: 'Google搜索引擎，支持代理和系统浏览器'
    });
  }
  
  /**
   * 获取Google搜索自动补全建议
   */
  async fetchAutocomplete(
    keyword: string, 
    options?: SearchOptions
  ): Promise<AutocompleteSuggestion> {
    // 设置默认选项
    const {
      domain = this.config.defaultDomain,
      proxyServer,
      useSystemBrowser = true
    } = options || {};
    
    console.log(`正在获取 "${keyword}" 的Google自动补全建议...`);
    
    // 基本浏览器启动选项
    const launchOptions: any = { 
      headless: false, // 使用有头模式便于观察和处理验证码
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas', 
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled', // 尝试隐藏自动化特征
        '--window-size=1920,1080'
      ]
    };
    
    // 如果提供了代理服务器地址，则使用代理
    if (proxyServer) {
      console.log(`使用代理服务器: ${proxyServer}`);
      launchOptions.proxy = { server: proxyServer };
    }
    
    // 浏览器上下文选项
    const contextOptions: any = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      deviceScaleFactor: 1
    };
    
    // 使用系统浏览器
    let browserInfo: { type: BrowserType<{}>; channel: string | undefined } = { type: chromium, channel: undefined };
    if (useSystemBrowser) {
      browserInfo = getSystemBrowser();
      if (browserInfo.channel) {
        console.log(`使用系统浏览器: ${browserInfo.channel}`);
        launchOptions.channel = browserInfo.channel;
      } else {
        console.log('未找到系统浏览器，使用默认浏览器');
      }
    }
    
    // 使用持久化上下文
    const userDataDir = path.join(process.cwd(), 'browser-profile');
    console.log(`使用浏览器配置文件: ${userDataDir}`);
    
    let context;
    let page;
    let suggestions: string[] = [];
    
    try {
      // 使用launchPersistentContext代替launch+newContext组合
      context = await browserInfo.type.launchPersistentContext(userDataDir, {
        ...launchOptions,
        ...contextOptions
      });
      
      // 获取第一个页面或创建新页面
      if (context.pages().length > 0) {
        page = context.pages()[0];
      } else {
        page = await context.newPage();
      }
      
      await setupBrowserFingerprint(page);
      
      // 添加脚本以屏蔽WebDriver检测
      await page.addInitScript(() => {
        // @ts-ignore
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // @ts-ignore
        delete navigator.__proto__.webdriver;
      });
      
      // 随机延迟，模拟真实用户
      await randomDelay(1000, 3000);
      
      console.log(`正在访问 ${domain}...`);
      await page.goto(domain, { timeout: 60000 });
      console.log('页面加载完成，等待稳定...');
      await waitForStableLoadState(page);
      
      // 检测验证码
      const hasCaptcha = await handleCaptcha(page);
      if (hasCaptcha) {
        console.log('已完成验证码验证，继续执行...');
        await randomDelay(1000, 2000);
      }
      
      // 处理cookie同意弹窗(如果出现)
      console.log('检查是否有 cookie 同意弹窗...');
      // 使用文本内容和角色定位同意按钮，增加多语言支持
      const consentButton = await page.$('button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Accept"), button:has-text("同意"), button:has-text("接受"), [role="button"]:has-text("Accept")');
      if (consentButton) {
        console.log('发现 cookie 同意弹窗，点击接受...');
        // 随机延迟模拟思考
        await randomDelay(800, 2000);
        await consentButton.click();
        // 等待页面稳定
        await randomDelay(1000, 2000);
      }

      // 搜索相关逻辑
      const searchInput = await findSearchBox(page);
      if (!searchInput) {
        console.log('尝试截图查看页面状态...');
        await page.screenshot({ path: path.join(this.outputDir, 'debug-google-page.png') });
        console.log('已保存页面截图到 output/debug-google-page.png');
        
        throw new Error('无法找到Google搜索框');
      }

      // 使用更人性化的输入
      await humanLikeTyping(page, searchInput, keyword);
      
      // 随机延迟等待建议出现
      await randomDelay(1000, 2000);
      
      // 等待自动补全建议出现
      console.log('等待自动补全建议出现...');
      // 使用角色和列表结构定位自动补全建议
      await page.waitForSelector('ul[role="listbox"] li, [role="listbox"] [role="option"]', { timeout: 10000 })
        .catch(() => {
          console.log('未找到建议列表，尝试按下箭头键');
          return page.keyboard.press('ArrowDown');
        });
      
      // 再次检测验证码
      const hasCaptchaAfterSearch = await handleCaptcha(page);
      if (hasCaptchaAfterSearch) {
        console.log('已完成搜索后的验证码验证，继续执行...');
        await randomDelay(1000, 2000);
      }
      
      // 提取建议
      suggestions = await extractSuggestions(page);
      
      // 添加随机延迟，模拟人类离开页面的行为
      await randomDelay(1000, 3000);
      
      console.log(`已找到 "${keyword}" 的${suggestions.length}个建议`);
      await context.close();
      return { keyword, suggestions };
    } catch (error) {
      console.log('出现错误，尝试截图...');
      if (page) {
        try {
          await page.screenshot({ path: path.join(this.outputDir, 'error-google-page.png') });
          console.log('已保存错误页面截图到 output/error-google-page.png');
        } catch (e) {
          console.log('截图失败:', e);
        }
      }
      
      if (context) await context.close();
      console.error(`获取 "${keyword}" 的自动补全建议时出错:`, error);
      throw error;
    }
  }
  
  /**
   * 生成查询组合（覆盖父类方法，提供更丰富的组合）
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
   * 从建议列表中提取关键词
   */
  extractNewKeywords(suggestions: string[], originalKeyword: string, maxKeywords: number = 10): string[] {
    const keywords = new Set<string>();
    const originalKeywordLower = originalKeyword.toLowerCase();
    
    // 关键词提取规则
    for (const suggestion of suggestions) {
      // 分割建议获取可能的关键词
      const parts = suggestion.split(/\s+/);
      
      // 如果建议中有3个或以上的词，可能是一个好的关键词组合
      if (parts.length >= 3) {
        // 组合2-3个词作为新的关键词
        for (let i = 0; i < parts.length - 1; i++) {
          if (keywords.size >= maxKeywords) break;
          
          // 2个词组合
          if (i + 1 < parts.length) {
            const keyword = `${parts[i]} ${parts[i + 1]}`.toLowerCase();
            // 检查是否与原始关键词不同且不是原始关键词的一部分
            if (!keyword.includes(originalKeywordLower) && !originalKeywordLower.includes(keyword) && keyword.length > 5) {
              keywords.add(keyword);
            }
          }
          
          // 3个词组合
          if (i + 2 < parts.length) {
            const keyword = `${parts[i]} ${parts[i + 1]} ${parts[i + 2]}`.toLowerCase();
            if (!keyword.includes(originalKeywordLower) && !originalKeywordLower.includes(keyword) && keyword.length > 5) {
              keywords.add(keyword);
            }
          }
        }
      }
    }
    
    return Array.from(keywords).slice(0, maxKeywords);
  }
  
  /**
   * 使用字母组合获取Google自动补全建议，并支持二次查询
   */
  async fetchAutocompleteWithAlphabets(
    keyword: string,
    options?: SearchOptions
  ): Promise<string> {
    // 设置默认选项
    const {
      domain = this.config.defaultDomain,
      proxyServer,
      useSystemBrowser = true,
      enableSecondRound = true
    } = options || {};
    
    const baseOptions = { domain, proxyServer, useSystemBrowser };
    
    // 调用基类方法获取第一轮结果
    const outputFilename = await super.fetchAutocompleteWithAlphabets(keyword, baseOptions);
    
    // 如果启用了二次查询，进行处理
    if (enableSecondRound) {
      console.log('\n===== 开始第二轮查询 =====');
      console.log('从第一轮结果中提取新的关键词...');
      
      const safeKeyword = keyword.replace(/\s+/g, '_');
      const secondRoundFilename = path.join(this.outputDir, `${this.config.name.toLowerCase()}_${safeKeyword}_second_round_suggestions.txt`);
      const secondRoundProgressFilename = path.join(this.outputDir, `${this.config.name.toLowerCase()}_${safeKeyword}_second_round_progress.json`);
      
      // 加载已保存的建议
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
        }
      } catch (error) {
        console.error('加载建议失败:', error);
      }
      
      if (savedSuggestions.size === 0) {
        console.log('未找到任何建议，跳过二次查询');
        return outputFilename;
      }
      
      // 提取新的关键词
      const allSuggestions = Array.from(savedSuggestions);
      const newKeywords = this.extractNewKeywords(allSuggestions, keyword);
      
      if (newKeywords.length === 0) {
        console.log('未找到合适的新关键词进行二次查询');
        return outputFilename;
      }
      
      console.log(`找到 ${newKeywords.length} 个新的关键词: ${newKeywords.join(', ')}`);
      
      // 记录已处理的二次关键词
      const processedSecondKeywords = new Set<string>();
      
      // 加载已有的二次查询进度文件
      try {
        if (fs.existsSync(secondRoundProgressFilename)) {
          const progressData = fs.readFileSync(secondRoundProgressFilename, 'utf-8');
          const processedKeywords = JSON.parse(progressData);
          processedKeywords.forEach((kw: string) => {
            processedSecondKeywords.add(kw);
          });
          console.log(`已从进度文件加载 ${processedSecondKeywords.size} 个已处理的二次关键词`);
        }
      } catch (error) {
        console.error(`加载二次查询进度文件失败: ${error}`);
      }
      
      // 记录所有二次查询结果
      const secondRoundSuggestions = new Set<string>();
      
      // 加载已有的二次查询结果
      try {
        if (fs.existsSync(secondRoundFilename)) {
          const content = fs.readFileSync(secondRoundFilename, 'utf-8');
          content.split('\n').forEach(line => {
            const suggestion = line.trim();
            if (suggestion) {
              secondRoundSuggestions.add(suggestion);
            }
          });
          console.log(`已加载 ${secondRoundSuggestions.size} 条现有二次查询建议`);
        }
      } catch (error) {
        console.error(`加载已有二次查询建议失败: ${error}`);
      }
      
      // 对每个新关键词进行查询
      for (const newKeyword of newKeywords) {
        if (processedSecondKeywords.has(newKeyword)) {
          console.log(`跳过已处理的二次关键词: ${newKeyword}`);
          continue;
        }
        
        console.log(`\n正在查询新关键词: "${newKeyword}"...`);
        
        try {
          // 执行查询但不启用三次查询(防止无限递归)
          const result = await this.fetchAutocomplete(newKeyword, baseOptions);
          
          // 过滤并保存新建议
          let newCount = 0;
          let newSuggestions: string[] = [];
          
          for (const suggestion of result.suggestions) {
            if (!secondRoundSuggestions.has(suggestion)) {
              secondRoundSuggestions.add(suggestion);
              newSuggestions.push(suggestion);
              newCount++;
            }
          }
          
          if (newCount > 0) {
            // 将新结果写入文件
            fs.appendFileSync(secondRoundFilename, newSuggestions.join('\n') + '\n', 'utf-8');
            console.log(`添加了 ${newCount} 条新的二次查询建议`);
          } else {
            console.log('没有发现新的建议');
          }
          
          // 标记为已处理
          processedSecondKeywords.add(newKeyword);
          
          // 保存进度
          const progressArray = Array.from(processedSecondKeywords);
          fs.writeFileSync(secondRoundProgressFilename, JSON.stringify(progressArray, null, 2), 'utf-8');
          console.log(`已更新二次查询进度文件`);
          
          // 随机延迟
          const waitTime = Math.floor(Math.random() * 3000) + 2000;
          console.log(`等待 ${waitTime / 1000} 秒...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
        } catch (error) {
          console.error(`处理二次关键词 "${newKeyword}" 时出错:`, error);
          
          // 出错时也保存进度，确保即使出错也能记录当前关键词已处理
          processedSecondKeywords.add(newKeyword);
          const progressArray = Array.from(processedSecondKeywords);
          fs.writeFileSync(secondRoundProgressFilename, JSON.stringify(progressArray, null, 2), 'utf-8');
        }
      }
      
      console.log(`\n二次查询完成，共获取 ${secondRoundSuggestions.size} 条建议，结果保存到 ${secondRoundFilename}`);
    }
    
    return outputFilename;
  }
} 