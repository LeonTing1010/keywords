import { chromium, BrowserType, Page } from 'playwright';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

/**
 * 随机延迟函数，模拟人类行为
 * @param min 最小延迟(ms)
 * @param max 最大延迟(ms)
 */
export async function randomDelay(min: number = 200, max: number = 2000) {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
  return delay;
}

/**
 * 获取系统默认浏览器类型
 * @returns 系统合适的浏览器类型和通道
 */
export function getSystemBrowser(): { type: BrowserType<{}>; channel: string | undefined } {
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
export function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * 等待用户输入
 * @param question 询问内容
 */
export async function askUser(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * 设置浏览器指纹以减少检测
 * @param page Playwright页面实例
 */
export async function setupBrowserFingerprint(page: Page) {
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
export async function handleCaptcha(page: Page): Promise<boolean> {
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
      const screenshotPath = path.join(process.cwd(), 'captcha-screenshot.png');
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
 * 等待页面稳定加载
 * @param page Playwright页面实例
 * @param options 配置选项
 */
export async function waitForStableLoadState(page: Page, options: {
  domContentTimeout?: number;
  networkIdleTimeout?: number;
  minStableDelay?: number;
  maxStableDelay?: number;
} = {}) {
  const {
    domContentTimeout = 30000,
    networkIdleTimeout = 5000,
    minStableDelay = 1000,
    maxStableDelay = 2000
  } = options;

  try {
    // 等待DOM内容加载
    await page.waitForLoadState('domcontentloaded', { timeout: domContentTimeout });
    await randomDelay(500, 1000);
    
    // 等待网络空闲
    await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log(`错误详情: ${errorMessage}`);
    return undefined;
  }
  
  // 额外等待，确保页面完全稳定
  await randomDelay(minStableDelay, maxStableDelay);
}