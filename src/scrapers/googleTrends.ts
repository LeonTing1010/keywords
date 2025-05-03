import { chromium, BrowserType, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { ensureOutputDirectory } from '../utils/fileUtils';
import { TrendsResult } from '../types';

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
      const screenshotPath = path.join(process.cwd(), 'captcha-trends.png');
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
 * 等待页面稳定加载
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
 * 获取Google Trends数据并下载为CSV
 * 
 * @param keyword 搜索关键词
 * @param outputFilename 可选的自定义文件名(默认: trends.csv)
 * @param useSystemBrowser 是否使用系统浏览器(默认: true)
 * @returns 包含关键词和下载的CSV路径的对象
 */
export async function fetchTrends(
  keyword: string,
  outputFilename = 'trends.csv',
  useSystemBrowser: boolean = true
): Promise<TrendsResult> {
  console.log(`正在获取 "${keyword}" 的Google Trends数据...`);
  
  const outputDir = ensureOutputDirectory();
  const savePath = path.join(outputDir, outputFilename);
  
  // 基本浏览器启动选项
  const launchOptions: any = { 
    headless: false, // 使用有头模式便于观察和处理验证码
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas', 
      '--disable-blink-features=AutomationControlled', // 尝试隐藏自动化特征
      '--window-size=1920,1080'
    ]
  };
  
  // 浏览器上下文选项
  const contextOptions: any = {
    acceptDownloads: true, // 允许下载
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 1
  };
  
  // 使用系统浏览器
  let browserInfo = { type: chromium, channel: undefined as string | undefined };
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
  const userDataDir = path.join(process.cwd(), 'browser-profile-trends');
  console.log(`使用浏览器配置文件: ${userDataDir}`);
  
  let context;
  let page;
  
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
    
    // 导航到Google Trends并传入关键词
    console.log(`正在访问Google Trends并搜索"${keyword}"...`);
    try {
      // 增加超时时间并使用domcontentloaded而不是load
      await page.goto(`https://trends.google.com/trends/explore?q=${encodeURIComponent(keyword)}`, {
        timeout: 120000, // 增加到120秒
        waitUntil: 'domcontentloaded' // 只等待DOM完成，不等待所有资源
      });
    } catch (error: any) {
      console.log('页面加载超时，但将尝试继续执行...');
      
      // 检查页面是否有部分加载
      const isPartiallyLoaded = await page.title().then(title => 
        title.includes('Trends') || title.includes('趋势')
      ).catch(() => false);
      
      if (isPartiallyLoaded) {
        console.log('页面部分加载成功，继续执行...');
      } else {
        throw new Error(`页面加载失败: ${error.message || '未知错误'}`);
      }
    }
    
    // 给页面一些额外时间加载
    console.log('额外等待页面加载资源...');
    await page.waitForTimeout(10000); // 额外等待10秒
    
    // 检测验证码
    const hasCaptcha = await handleCaptcha(page);
    if (hasCaptcha) {
      console.log('已完成验证码验证，继续执行...');
      await randomDelay(1000, 2000);
    }
    
    // 尝试多次等待页面元素
    console.log('等待页面元素加载...');
    let titleFound = false;
    
    // 获取当前页面标题
    const pageTitle = await page.title().catch(() => '');
    console.log(`当前页面标题: "${pageTitle}"`);
    
    // 更宽松地检查标题
    if (pageTitle && (
        pageTitle.includes('Trends') || 
        pageTitle.includes('趋势') || 
        pageTitle.includes('Google') ||
        pageTitle.includes(keyword)
      )) {
      console.log('通过页面标题验证，继续执行');
      titleFound = true;
    } else {
      // 如果标题不匹配，尝试使用选择器
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.waitForSelector('title:has-text("Trends"), title:has-text("Google"), title:has-text("趋势")', { 
            timeout: 5000 
          });
          titleFound = true;
          console.log('页面标题已加载');
          break;
        } catch (e) {
          console.log(`等待页面标题尝试 ${attempt}/2 失败`);
          await page.waitForTimeout(2000); // 等待后重试
        }
      }
    }
    
    if (!titleFound) {
      console.log('未能验证页面标题，但仍将继续执行...');
    }
    
    // 打印页面上所有可见元素，帮助调试
    console.log('页面可能已加载，检查可见元素...');
    
    // 等待页面稳定
    await page.waitForTimeout(5000);
    
    // 等待图表可见，更宽松地检测
    console.log('尝试定位图表元素...');
    let chartFound = false;
    const chartSelectors = [
      'div[aria-label*="Interest over time"]', 
      'div[aria-label*="随时间变化的兴趣"]',
      'svg', // 任何SVG元素
      '.trends-widget', // 常见的趋势小部件类
      '.fe-atoms-chart',
      'div[role="presentation"]',
      'div[role="region"]',
      'div[data-chart-id]',
      'canvas',
      // 更通用的选择器
      'div:has(svg)',
      'section:has(svg)'
    ];
    
    // 检查是否有图表相关元素
    for (const selector of chartSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`找到图表相关元素: ${selector} (${elements.length}个)`);
          chartFound = true;
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    if (!chartFound) {
      console.log('未找到明确的图表元素，但页面可能已加载');
      await page.screenshot({ path: 'trends-content.png' });
      console.log('已保存页面内容截图以供分析');
    }
    
    // 不管是否找到图表，都给予页面充分加载时间
    console.log('等待页面完全稳定...');
    await randomDelay(5000, 8000);
    
    // 再次检测验证码
    const hasCaptchaAfterLoad = await handleCaptcha(page);
    if (hasCaptchaAfterLoad) {
      console.log('已完成加载后的验证码验证，继续执行...');
      await randomDelay(1000, 2000);
    }
    
    // 查找下载按钮 - 更多选择器以增加兼容性
    console.log('查找下载按钮...');
    
    // 首先寻找更多可能的元素区域
    console.log('扫描页面寻找可能的工具栏和操作区域...');
    const actionAreaSelectors = [
      'div[role="toolbar"]',
      'div.widget-actions',
      'div.fe-atoms-actions',
      'div.download-section',
      'div.control-menu',
      'header',
      'div.chart-actions',
      'div.trends-bar'
    ];
    
    let actionArea = null;
    for (const selector of actionAreaSelectors) {
      const area = await page.$(selector);
      if (area) {
        console.log(`找到可能的操作区域: ${selector}`);
        actionArea = area;
        break;
      }
    }
    
    // 如果找到操作区，在其中搜索下载按钮
    let downloadButton = null;
    let downloadButtonSelector = '';
    const downloadButtonSelectors = [
      'button[aria-label*="Download"], button[aria-label*="download"]',
      'button[aria-label*="下载"], button[aria-label*="导出"]',
      'button[title*="Download"], button[title*="download"]',
      'button[title*="下载"], button[title*="导出"]',
      'button:has-text("Download")',
      'button:has-text("下载")',
      // 更通用的选择器
      'button.download-button',
      'button.export-button',
      'button[role="button"]:has(svg)', // 带有图标的按钮
      'button.widget-actions-item', // 常见的小部件操作按钮
      // 图标和SVG相关
      'button svg',
      // 文件图标常用类名
      'button .material-icons-extended',
      'button i.material-icon',
      'button i.fa-download',
      // 任何按钮
      'button'
    ];
    
    // 如果找到操作区域，先在区域内查找
    if (actionArea) {
      for (const selector of downloadButtonSelectors) {
        try {
          const el = await actionArea.$(selector);
          if (el) {
            console.log(`在操作区域中找到下载按钮: ${selector}`);
            downloadButton = el;
            downloadButtonSelector = selector;
            break;
          }
        } catch (e) {
          // 继续下一个
        }
      }
    }
    
    // 如果在操作区未找到，在整个页面查找
    if (!downloadButton) {
      console.log('在全页面中查找下载按钮...');
      for (const selector of downloadButtonSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            const isVisible = await el.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`找到可见的下载按钮: ${selector}`);
              downloadButton = el;
              downloadButtonSelector = selector;
              break;
            }
          }
        } catch (e) {
          // 继续下一个
        }
      }
    }
    
    // 如果仍然找不到，寻找所有按钮
    if (!downloadButton) {
      console.log('搜索所有按钮和可点击元素...');
      
      // 列出页面所有按钮和角色为按钮的元素
      const buttons = await page.$$('button, [role="button"]');
      console.log(`页面上共有 ${buttons.length} 个按钮或可点击元素`);
      
      // 检查每个按钮的文本、标题、ARIA标签等
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const isVisible = await button.isVisible().catch(() => false);
        
        if (isVisible) {
          const buttonText = await button.textContent().catch(() => '');
          const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
          const title = await button.getAttribute('title').catch(() => '');
          
          // 搜索可能表示"下载"的关键词
          const keywords = ['download', '下载', 'export', '导出', 'csv', 'data', '数据'];
          
          // 检查是否包含任何关键词
          const matchesKeyword = keywords.some(keyword => 
            (buttonText && buttonText.toLowerCase().includes(keyword.toLowerCase())) ||
            (ariaLabel && ariaLabel.toLowerCase().includes(keyword.toLowerCase())) ||
            (title && title.toLowerCase().includes(keyword.toLowerCase()))
          );
          
          if (matchesKeyword) {
            console.log(`找到匹配的下载按钮 #${i}: "${buttonText || ariaLabel || title}"`);
            downloadButton = button;
            break;
          }
          
          // 检查是否包含SVG或图标
          const hasSvg = await button.$('svg').then(res => !!res).catch(() => false);
          const hasIcon = await button.$('i').then(res => !!res).catch(() => false);
          
          if ((hasSvg || hasIcon) && i < 10) { // 只考虑前10个带图标的按钮
            console.log(`找到带图标的按钮 #${i}${buttonText ? ': ' + buttonText : ''}`);
            // 记录但不立即设为下载按钮
          }
        }
      }
    }
    
    // 如果仍然没找到，尝试进行视觉识别
    if (!downloadButton) {
      console.log('尝试根据位置识别可能的下载按钮...');
      
      // 截图以便手动分析
      await page.screenshot({ path: 'trends-ui.png' });
      console.log('已保存页面截图到trends-ui.png以便分析');
      
      // 尝试点击页面右上角区域，很多情况下下载按钮在那里
      console.log('尝试点击页面右上角区域...');
      try {
        // 获取页面尺寸
        const dimensions = await page.evaluate(() => {
          return {
            width: window.innerWidth,
            height: window.innerHeight
          };
        });
        
        // 点击右上角区域
        const rightTopX = dimensions.width - 100;
        const rightTopY = 100;
        
        console.log(`尝试点击坐标(${rightTopX}, ${rightTopY})...`);
        await page.mouse.click(rightTopX, rightTopY);
        console.log('已点击右上角区域');
        
        // 等待可能出现的菜单
        await page.waitForTimeout(2000);
        
        // 再次查找下载按钮
        const newButtons = await page.$$('button, [role="button"]:visible');
        console.log(`点击后页面上有 ${newButtons.length} 个按钮或可点击元素`);
        
        // 只考虑之前可能不存在的新按钮
        for (const button of newButtons) {
          const buttonText = await button.textContent().catch(() => '');
          if (buttonText && ['download', '下载', 'csv', 'export', '导出'].some(keyword => 
            buttonText.toLowerCase().includes(keyword.toLowerCase())
          )) {
            console.log(`在点击后找到下载按钮: "${buttonText}"`);
            downloadButton = button;
            break;
          }
        }
      } catch (e: any) {
        console.log(`右上角区域点击失败: ${e?.message || '未知错误'}`);
      }
    }
    
    if (!downloadButton) {
      console.log('无法自动识别下载按钮，请手动选择操作...');
      await page.screenshot({ path: 'trends-no-download.png' });
      console.log('已保存页面截图到 trends-no-download.png');
      
      // 提示用户手动介入
      const userAction = await askUser('无法找到下载按钮，请在浏览器中手动下载CSV文件到' + savePath + '，完成后输入"done"，或输入"skip"跳过下载: ');
      
      if (userAction.toLowerCase() === 'done') {
        console.log('用户已手动完成下载');
        return { keyword, csvPath: savePath };
      } else if (userAction.toLowerCase() === 'skip') {
        console.log('用户选择跳过下载');
        throw new Error('用户选择跳过下载');
      } else {
        throw new Error('在Google Trends页面上找不到下载按钮，且用户操作无效');
      }
    }
    
    // 随机延迟模拟思考后点击
    await randomDelay(1000, 2000);
    console.log('点击下载按钮...');
    
    try {
      await downloadButton.click();
    } catch (error: any) {
      console.log(`点击下载按钮失败: ${error?.message || '未知错误'}，尝试使用JavaScript点击`);
      
      if (downloadButtonSelector) {
        await page.evaluate((selector) => {
          const btn = document.querySelector(selector);
          if (btn) (btn as HTMLElement).click();
        }, downloadButtonSelector);
      } else {
        await page.evaluate((button) => {
          if (button) (button as HTMLElement).click();
        }, downloadButton);
      }
    }
    
    // 等待下载开始并完成
    console.log('等待文件下载(最多60秒)...');
    try {
      const download = await page.waitForEvent('download', { timeout: 60000 });
      await download.saveAs(savePath);
      console.log('文件下载成功!');
    } catch (downloadError: any) {
      console.log(`下载事件等待超时: ${downloadError?.message || '未知错误'}`);
      console.log('可能需要更多交互才能触发下载，尝试辅助操作...');
      
      // 保存当前页面状态
      await page.screenshot({ path: 'download-attempt-failed.png' });
      
      throw new Error(`无法完成下载: ${downloadError?.message || '未知错误'}`);
    }
    
    // 添加随机延迟，模拟人类离开页面的行为
    await randomDelay(1000, 3000);
    
    await context.close();
    
    console.log(`已下载 "${keyword}" 的Google Trends数据到${savePath}`);
    return { keyword, csvPath: savePath };
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({ path: 'error-trends-page.png' });
        console.log('已保存错误页面截图到 error-trends-page.png');
      } catch (e) {
        console.log('截图失败:', e);
      }
    }
    
    if (context) await context.close();
    console.error(`获取 "${keyword}" 的Google Trends数据时出错:`, error);
    throw error;
  }
} 