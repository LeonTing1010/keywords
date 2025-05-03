import { chromium, Browser, Page, BrowserType } from 'playwright';
import { writeTextFile } from '../utils/fileUtils';
import { AutocompleteSuggestion } from '../types';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import * as fs from 'fs';

/**
 * 创建命令行交互接口
 */
function createReadlineInterface() {
  return readline.createInterface({
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
      const screenshotPath = path.join(process.cwd(), 'captcha.png');
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
 * 抓取Google搜索自动补全建议
 * 
 * @param keyword 搜索关键词
 * @param googleDomain 可选的Google域名(默认: https://www.google.com)
 * @param proxyServer 可选的代理服务器地址(例如: http://127.0.0.1:7890)
 * @param useSystemBrowser 是否使用系统浏览器(默认: true)
 * @returns 包含关键词和建议数组的对象
 */
export async function fetchAutocomplete(
  keyword: string, 
  googleDomain: string = 'https://www.google.com',
  proxyServer?: string,
  useSystemBrowser: boolean = true
): Promise<AutocompleteSuggestion> {
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
    
    console.log(`正在访问 ${googleDomain}...`);
    await page.goto(googleDomain, { timeout: 60000 });
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

    // 搜索框选择器优化，使用用户视角的定位策略
    console.log('正在使用用户视角策略查找搜索框...');
    let searchInput = null;
    
    // 1. 首先尝试使用角色定位搜索区域
    console.log('尝试通过角色定位搜索区域...');
    const searchForm = await page.$('[role="search"]').catch(() => null);
    if (searchForm) {
      console.log('找到搜索表单区域，现在查找其中的输入框...');
      searchInput = await searchForm.$('input[role="combobox"], textarea[role="combobox"], input[name="q"], textarea[name="q"]');
      if (searchInput) {
        console.log('在搜索表单中找到输入框');
      }
    }
    
    // 2. 如果通过角色无法找到，尝试通过ARIA标签定位
    if (!searchInput) {
      console.log('尝试通过可访问性标签定位搜索框...');
      searchInput = await page.$('input[aria-label*="earch"], input[aria-label*="搜索"], textarea[aria-label*="earch"], textarea[aria-label*="搜索"]');
      if (searchInput) {
        console.log('通过ARIA标签找到搜索框');
      }
    }
    
    // 3. 最后尝试主要属性选择器（避免使用过于通用的CSS选择器）
    if (!searchInput) {
      console.log('尝试通过主要属性定位搜索框...');
      const prioritySelectors = [
        'input[name="q"]',
        'textarea[name="q"]',
        'input[title*="Search"], input[title*="搜索"]',
        'input.gsfi', // Google 搜索表单输入
        'input[type="search"]'
      ];
      
      for (const selector of prioritySelectors) {
        try {
          console.log(`尝试选择器: ${selector}`);
          await page.waitForSelector(selector, { timeout: 2000 });
          searchInput = await page.$(selector);
          if (searchInput) {
            console.log(`找到搜索框，使用选择器: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
    }
    
    if (!searchInput) {
      console.log('尝试截图查看页面状态...');
      // 确保output目录存在
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      await page.screenshot({ path: path.join(outputDir, 'debug-google-page.png') });
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
    await page.waitForSelector('ul[role="listbox"] li, [role="listbox"] [role="option"]', { timeout: 10000 });
    
    // 再次检测验证码
    const hasCaptchaAfterSearch = await handleCaptcha(page);
    if (hasCaptchaAfterSearch) {
      console.log('已完成搜索后的验证码验证，继续执行...');
      await randomDelay(1000, 2000);
    }
    
    // 改进文本提取逻辑，确保只获取实际的建议内容而不是CSS/HTML
    suggestions = await page.$$eval('ul[role="listbox"] li, [role="listbox"] [role="option"]', els => {
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
        
        // 3. 备选方案：从完整文本中提取第一行（避免CSS/HTML混入）
        const fullText = el.textContent || '';
        const firstLine = fullText.split('\n')[0].trim();
        if (firstLine.length > 0 && firstLine.length < 100) { // 合理的建议长度
          return firstLine;
        }
        
        // 4. 如果上述都失败，使用最原始的提取并尝试过滤
        return (el.textContent || '')
          .trim()
          .replace(/\{.*?\}/g, '') // 移除CSS花括号内容
          .split('\n')[0]          // 只取第一行
          .substring(0, 100);      // 限制长度
      }).filter(text => 
        // 过滤掉明显是代码的结果
        text && 
        text.length > 0 && 
        text.length < 100 &&  // 合理的建议长度
        !text.includes('{') &&
        !text.includes(';}') &&
        !text.includes('.') &&
        !text.match(/^[.#]\w+/)  // CSS选择器通常以.或#开头
      );
    });
    
    // 添加随机延迟，模拟人类离开页面的行为
    await randomDelay(1000, 3000);
    
    console.log(`已找到 "${keyword}" 的${suggestions.length}个建议`);
    return { keyword, suggestions };
  } catch (error) {
    console.log('出现错误，尝试截图...');
    if (page) {
      try {
        // 确保output目录存在
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        await page.screenshot({ path: path.join(outputDir, 'error-google-page.png') });
        console.log('已保存错误页面截图到 output/error-google-page.png');
      } catch (e) {
        console.log('截图失败:', e);
      }
    }
    
    console.error(`获取 "${keyword}" 的自动补全建议时出错:`, error);
    throw error;
  } finally {
    // 确保资源被正确释放
    if (context) await context.close();
  }
}

/**
 * 抓取自动补全建议并保存到文本文件
 * 
 * @param keyword 搜索关键词
 * @param outputFilename 可选的自定义文件名(默认: autocomplete.txt)
 * @param googleDomain 可选的Google域名(默认: https://www.google.com)
 * @param proxyServer 可选的代理服务器地址(例如: http://127.0.0.1:7890)
 * @param useSystemBrowser 是否使用系统浏览器(默认: true)
 * @returns 保存的文件路径
 */
export async function fetchAndSaveAutocomplete(
  keyword: string, 
  outputFilename = 'autocomplete.txt',
  googleDomain: string = 'https://www.google.com',
  proxyServer?: string,
  useSystemBrowser: boolean = true
): Promise<string> {
  const result = await fetchAutocomplete(keyword, googleDomain, proxyServer, useSystemBrowser);
  
  // 确保output目录存在
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`已创建输出目录: ${outputDir}`);
  }
  
  // 构建输出文件路径
  const outputPath = path.join(outputDir, outputFilename);
  
  // 写入文件
  const filePath = await writeTextFile(
    outputPath,
    result.suggestions.join('\n')
  );
  
  console.log(`已将 "${keyword}" 的自动补全建议保存到${filePath}(${result.suggestions.length}条)`);
  return filePath;
}

/**
 * 生成基于词根的查询组合
 * 
 * @param rootWord 搜索词根
 * @returns 包含所有查询组合的数组
 */
export function generateQueriesFromRoot(rootWord: string): string[] {
  const queries: string[] = [];
  
  // 按首字母 a-z 生成查询
  for (let charCode = 97; charCode <= 122; charCode++) {
    const firstChar = String.fromCharCode(charCode);
    
    // 添加单字母查询: "词根 a"
    const singleLetterQuery = `${rootWord} ${firstChar}`;
    queries.push(singleLetterQuery);
    
    // 添加双字母查询: "词根 ab", "词根 a b"
    for (let secondCharCode = 97; secondCharCode <= 122; secondCharCode++) {
      const secondChar = String.fromCharCode(secondCharCode);
      // 紧凑版本: "词根 ab"
      const compactQuery = `${rootWord} ${firstChar}${secondChar}`;
      // 空格版本: "词根 a b"
      const spacedQuery = `${rootWord} ${firstChar} ${secondChar}`;
      
      queries.push(compactQuery);
      queries.push(spacedQuery);
    }
    
    // 添加数字组合: "词根 a1", "词根 a 1"
    for (let num = 0; num <= 9; num++) {
      const compactQuery = `${rootWord} ${firstChar}${num}`;
      const spacedQuery = `${rootWord} ${firstChar} ${num}`;
      
      queries.push(compactQuery);
      queries.push(spacedQuery);
    }
  }
  
  return queries;
}

/**
 * 加载之前保存的进度
 * 
 * @param filename 进度文件名
 * @returns 已处理的查询数组
 */
export function loadProgress(filename: string): string[] {
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`加载进度文件失败: ${error}`);
  }
  return [];
}

/**
 * 保存当前进度
 * 
 * @param queries 已处理的查询数组
 * @param filename 进度文件名
 */
export function saveProgress(queries: string[], filename: string): void {
  try {
    fs.writeFileSync(filename, JSON.stringify(queries, null, 2), 'utf-8');
  } catch (error) {
    console.error(`保存进度失败: ${error}`);
  }
}

/**
 * 批量获取多个关键词的Google自动补全建议
 * 
 * @param rootWord 搜索词根
 * @param googleDomain 可选的Google域名(默认: https://www.google.com)
 * @param proxyServer 可选的代理服务器地址
 * @param useSystemBrowser 是否使用系统浏览器(默认: true)
 * @returns 保存的文件路径
 */
export async function batchFetchAutocomplete(
  rootWord: string,
  googleDomain: string = 'https://www.google.com',
  proxyServer?: string,
  useSystemBrowser: boolean = true
): Promise<string> {
  console.log(`开始批量获取以 "${rootWord}" 为词根的自动补全建议...`);
  
  // 生成查询组合
  const allQueries = generateQueriesFromRoot(rootWord);
  console.log(`已生成 ${allQueries.length} 个查询组合`);
  
  // 确保output目录存在
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`已创建输出目录: ${outputDir}`);
  }
  
  // 准备文件和进度跟踪
  const safeRootWord = rootWord.replace(/\s+/g, '_');
  const outputFilename = path.join(outputDir, `${safeRootWord}_suggestions.txt`);
  const progressFilename = path.join(outputDir, `${safeRootWord}_progress.json`);
  
  // 加载之前的进度
  const processedQueries = loadProgress(progressFilename);
  console.log(`已从进度文件加载 ${processedQueries.length} 个已处理的查询`);
  
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
  try {
    // 启动浏览器
    context = await browserInfo.type.launchPersistentContext(userDataDir, {
      ...launchOptions,
      ...contextOptions
    });
    
    // 创建页面
    let page;
    if (context.pages().length > 0) {
      page = context.pages()[0];
    } else {
      page = await context.newPage();
    }
    
    await setupBrowserFingerprint(page);
    
    // 按字母分组处理查询
    let currentLetter = '';
    let previousQuery = null;
    
    try {
      for (const query of allQueries) {
        // 检查该查询是否已处理
        if (processedQueries.includes(query)) {
          console.log(`跳过已处理的查询: ${query}`);
          previousQuery = query; // 更新上一个查询
          continue;
        }
        
        // 检查是否切换到新字母
        const firstLetterAfterRoot = query.split(' ')[1]?.[0] || '';
        if (firstLetterAfterRoot !== currentLetter) {
          currentLetter = firstLetterAfterRoot;
          console.log(`\n===== 开始处理字母 '${currentLetter}' 的查询 =====`);
          
          // 强制刷新页面，确保干净的搜索环境
          await page.goto(googleDomain, { timeout: 60000 });
          await waitForStableLoadState(page);
          
          // 检查验证码
          await handleCaptcha(page);
          
          // 处理cookie同意弹窗
          const consentButton = await page.$('button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Accept"), button:has-text("同意"), button:has-text("接受"), [role="button"]:has-text("Accept")');
          if (consentButton) {
            await randomDelay(800, 2000);
            await consentButton.click();
            await randomDelay(1000, 2000);
          }
          
          previousQuery = null; // 重置上一个查询
        }
        
        console.log(`正在获取: ${query}`);
        
        // 搜索相关逻辑...
        try {
          // 找到搜索框
          const searchInput = await findSearchBox(page);
          if (!searchInput) {
            throw new Error('无法找到Google搜索框');
          }
          
          // 决定是否需要刷新页面
          let needRefresh = previousQuery === null;
          
          if (previousQuery && !needRefresh) {
            // 检查字母变化
            const prevLetter = previousQuery.split(' ')[1]?.[0] || '';
            if (prevLetter !== firstLetterAfterRoot) {
              console.log(`检测到字母变化（${prevLetter} -> ${firstLetterAfterRoot}），刷新页面`);
              needRefresh = true;
              await page.goto(googleDomain, { timeout: 60000 });
              await waitForStableLoadState(page);
            }
          }
          
          if (needRefresh) {
            // 完全清空并重新输入
            await searchInput.click();
            await searchInput.focus();
            await searchInput.fill('');
            await randomDelay(300, 700);
            await humanLikeTyping(page, searchInput, query);
          } else {
            // 计算共同前缀
            let commonPrefix = 0;
            const minLength = Math.min(query.length, previousQuery?.length || 0);
            for (let i = 0; i < minLength; i++) {
              if (query[i] === previousQuery?.[i]) {
                commonPrefix++;
              } else {
                break;
              }
            }
            
            // 获取当前搜索框内容
            const currentValue = await searchInput.inputValue();
            
            if (currentValue !== query) {
              if (commonPrefix > 0 && currentValue.length >= commonPrefix) {
                // 删除不同部分
                for (let i = 0; i < currentValue.length - commonPrefix; i++) {
                  await page.keyboard.press('Backspace');
                  await randomDelay(50, 150);
                }
                
                // 添加新的后缀
                if (commonPrefix < query.length) {
                  for (const char of query.substring(commonPrefix)) {
                    await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
                    await randomDelay(50, 150);
                  }
                }
              } else {
                // 完全清空并重新输入
                await searchInput.click();
                await searchInput.focus();
                await searchInput.fill('');
                await randomDelay(300, 700);
                await humanLikeTyping(page, searchInput, query);
              }
            }
          }
          
          // 等待自动补全建议出现
          await randomDelay(1000, 2000);
          await page.waitForSelector('ul[role="listbox"] li, [role="listbox"] [role="option"]', { timeout: 10000 }).catch(() => {
            console.log('未找到建议列表，尝试按下箭头键');
            return page.keyboard.press('ArrowDown');
          });
          
          // 再次检测验证码
          await handleCaptcha(page);
          
          // 提取建议
          const suggestions = await extractSuggestions(page);
          
          // 过滤并保存新建议
          let newSuggestionCount = 0;
          if (suggestions.length > 0) {
            // 筛选新建议
            const newSuggestions = suggestions.filter(suggestion => {
              if (suggestion && !savedSuggestions.has(suggestion)) {
                savedSuggestions.add(suggestion);
                return true;
              }
              return false;
            });
            
            // 添加到文件
            if (newSuggestions.length > 0) {
              fs.appendFileSync(outputFilename, newSuggestions.join('\n') + '\n', 'utf-8');
              newSuggestionCount = newSuggestions.length;
            }
            
            console.log(`添加了 ${newSuggestionCount} 条新建议，过滤了 ${suggestions.length - newSuggestionCount} 条重复建议`);
          } else {
            console.log('未获取到任何建议');
          }
          
          // 更新进度
          processedQueries.push(query);
          saveProgress(processedQueries, progressFilename);
          previousQuery = query;
          
          // 随机延迟，避免触发反爬虫
          const waitTime = Math.floor(Math.random() * 3000) + 1000;
          console.log(`等待 ${waitTime / 1000} 秒...`);
          await page.waitForTimeout(waitTime);
        } catch (error) {
          console.error(`处理查询 "${query}" 时出错:`, error);
          
          // 尝试截图记录错误状态
          try {
            const errorScreenshotPath = path.join(process.cwd(), `error_${query.replace(/\s+/g, '_')}.png`);
            await page.screenshot({ path: errorScreenshotPath });
            console.log(`已保存错误页面截图到 ${errorScreenshotPath}`);
          } catch (e) {
            console.log('截图失败:', e);
          }
          
          // 重新加载页面并继续
          await page.goto(googleDomain, { timeout: 60000 });
          await waitForStableLoadState(page);
          await randomDelay(5000, 10000);
        }
      }
    } catch (error) {
      console.error('批量抓取过程中发生错误:', error);
    }
    
    await context.close();
    console.log(`批量获取完成，结果保存到 ${outputFilename}`);
    return outputFilename;
  } catch (error) {
    if (context) await context.close();
    console.error('启动浏览器时出错:', error);
    throw error;
  }
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
 * 从建议列表中提取关键词
 * 
 * @param suggestions 建议列表
 * @param originalKeyword 原始关键词
 * @param maxKeywords 最大提取数量，默认10个
 * @returns 提取的关键词数组
 */
function extractNewKeywords(suggestions: string[], originalKeyword: string, maxKeywords: number = 10): string[] {
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
 * 使用字母组合获取Google自动补全建议
 * 
 * @param keyword 基础搜索关键词
 * @param googleDomain 可选的Google域名(默认: https://www.google.com)
 * @param proxyServer 可选的代理服务器地址
 * @param useSystemBrowser 是否使用系统浏览器(默认: true)
 * @param enableSecondRound 是否启用二次查询(默认: true)
 * @returns 保存的文件路径
 */
export async function fetchAutocompleteWithAlphabets(
  keyword: string,
  googleDomain: string = 'https://www.google.com',
  proxyServer?: string,
  useSystemBrowser: boolean = true,
  enableSecondRound: boolean = true
): Promise<string> {
  console.log(`开始为关键词 "${keyword}" 获取26个字母的自动补全建议...`);
  
  // 生成26个字母的查询
  const queries: string[] = [];
  for (let charCode = 97; charCode <= 122; charCode++) {
    const letter = String.fromCharCode(charCode);
    queries.push(`${keyword} ${letter}`);
  }
  
  console.log(`已生成 ${queries.length} 个查询: ${queries.join(', ')}`);
  
  // 确保output目录存在
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`已创建输出目录: ${outputDir}`);
  }
  
  // 准备输出文件
  const safeKeyword = keyword.replace(/\s+/g, '_');
  const outputFilename = path.join(outputDir, `${safeKeyword}_alphabets_suggestions.txt`);
  const progressFilename = path.join(outputDir, `${safeKeyword}_alphabets_progress.json`);
  
  // 加载之前的进度
  const processedQueries = loadProgress(progressFilename);
  console.log(`已从进度文件加载 ${processedQueries.length} 个已处理的查询`);
  
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
  
  // 浏览器启动设置
  const launchOptions: any = { 
    headless: false,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas', 
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
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
  try {
    // 启动浏览器
    context = await browserInfo.type.launchPersistentContext(userDataDir, {
      ...launchOptions,
      ...contextOptions
    });
    
    // 创建页面
    let page;
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
    
    try {
      // 首次访问Google
      await page.goto(googleDomain, { timeout: 60000 });
      await waitForStableLoadState(page);
      
      // 检查验证码
      await handleCaptcha(page);
      
      // 处理cookie同意弹窗
      const consentButton = await page.$('button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Accept"), button:has-text("同意"), button:has-text("接受"), [role="button"]:has-text("Accept")');
      if (consentButton) {
        await randomDelay(800, 2000);
        await consentButton.click();
        await randomDelay(1000, 2000);
      }
      
      // 处理每个查询
      for (const query of queries) {
        // 检查该查询是否已处理
        if (processedQueries.includes(query)) {
          console.log(`跳过已处理的查询: ${query}`);
          continue;
        }
        
        console.log(`\n===== 处理查询: "${query}" =====`);
        
        try {
          // 找到搜索框
          const searchInput = await findSearchBox(page);
          if (!searchInput) {
            throw new Error('无法找到Google搜索框');
          }
          
          // 清空并输入新查询
          await searchInput.click();
          await searchInput.focus();
          await searchInput.fill('');
          await randomDelay(300, 700);
          await humanLikeTyping(page, searchInput, query);
          
          // 等待自动补全建议出现
          await randomDelay(1000, 2000);
          await page.waitForSelector('ul[role="listbox"] li, [role="listbox"] [role="option"]', { timeout: 10000 }).catch(() => {
            console.log('未找到建议列表，尝试按下箭头键');
            return page.keyboard.press('ArrowDown');
          });
          
          // 检测验证码
          await handleCaptcha(page);
          
          // 提取建议
          const suggestions = await extractSuggestions(page);
          
          // 过滤并保存新建议
          let newSuggestionCount = 0;
          if (suggestions.length > 0) {
            // 筛选新建议
            const newSuggestions = suggestions.filter(suggestion => {
              if (suggestion && !savedSuggestions.has(suggestion)) {
                savedSuggestions.add(suggestion);
                return true;
              }
              return false;
            });
            
            // 添加到文件
            if (newSuggestions.length > 0) {
              fs.appendFileSync(outputFilename, newSuggestions.join('\n') + '\n', 'utf-8');
              newSuggestionCount = newSuggestions.length;
            }
            
            console.log(`添加了 ${newSuggestionCount} 条新建议，过滤了 ${suggestions.length - newSuggestionCount} 条重复建议`);
          } else {
            console.log('未获取到任何建议');
          }
          
          // 更新进度
          processedQueries.push(query);
          saveProgress(processedQueries, progressFilename);
          
          // 随机延迟，避免触发反爬虫
          const waitTime = Math.floor(Math.random() * 3000) + 2000;
          console.log(`等待 ${waitTime / 1000} 秒...`);
          await page.waitForTimeout(waitTime);
          
        } catch (error) {
          console.error(`处理查询 "${query}" 时出错:`, error);
          
          // 尝试截图记录错误状态
          try {
            const errorScreenshotPath = path.join(outputDir, `error_${query.replace(/\s+/g, '_')}.png`);
            await page.screenshot({ path: errorScreenshotPath });
            console.log(`已保存错误页面截图到 ${errorScreenshotPath}`);
          } catch (e) {
            console.log('截图失败:', e);
          }
          
          // 重新加载页面并继续
          await page.goto(googleDomain, { timeout: 60000 });
          await waitForStableLoadState(page);
          await randomDelay(5000, 10000);
        }
      }
      
    } catch (error) {
      console.error('获取自动补全建议过程中发生错误:', error);
    }
    
    await context.close();
    console.log(`所有查询处理完成，结果保存到 ${outputFilename}`);
    
    // 输出统计信息
    console.log(`总共获取了 ${savedSuggestions.size} 条不重复的自动补全建议`);
    
    // 二次查询 - 从结果中提取新关键词并再次查询
    if (enableSecondRound && savedSuggestions.size > 0) {
      console.log('\n===== 开始第二轮查询 =====');
      console.log('从第一轮结果中提取新的关键词...');
      
      // 将Set转换为数组以便处理
      const allSuggestions = Array.from(savedSuggestions);
      
      // 提取新的关键词
      const newKeywords = extractNewKeywords(allSuggestions, keyword);
      
      if (newKeywords.length > 0) {
        console.log(`找到 ${newKeywords.length} 个新的关键词: ${newKeywords.join(', ')}`);
        
        // 创建二次查询结果文件
        const secondRoundFilename = path.join(outputDir, `${safeKeyword}_second_round_suggestions.txt`);
        // 添加一个二次查询进度文件
        const secondRoundProgressFilename = path.join(outputDir, `${safeKeyword}_second_round_progress.json`);
        
        // 记录已处理的二次关键词
        const processedSecondKeywords = new Set<string>();
        
        // 加载已有的二次查询进度文件
        try {
          if (fs.existsSync(secondRoundProgressFilename)) {
            const progressData = fs.readFileSync(secondRoundProgressFilename, 'utf-8');
            const processedKeywords = JSON.parse(progressData);
            processedKeywords.forEach((keyword: string) => {
              processedSecondKeywords.add(keyword);
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
            const result = await fetchAutocomplete(newKeyword, googleDomain, proxyServer, useSystemBrowser);
            
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
      } else {
        console.log('未找到合适的新关键词进行二次查询');
      }
    }
    
    return outputFilename;
  } catch (error) {
    if (context) await context.close();
    console.error('启动浏览器时出错:', error);
    throw error;
  }
} 