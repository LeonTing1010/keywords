import { chromium } from 'playwright';
import { writeCsvFile, generateSimpleCsv } from '../utils/fileUtils';
import { Credentials, SemrushData } from '../types';

/**
 * 从SEMrush获取关键词概览数据
 * 
 * @param keyword 要分析的关键词
 * @param credentials SEMrush登录凭证
 * @returns 包含关键词和搜索量数据的对象
 */
export async function fetchSemrush(
  keyword: string,
  credentials: Credentials
): Promise<SemrushData> {
  console.log(`正在获取 "${keyword}" 的SEMrush数据...`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 登录SEMrush
    await page.goto('https://www.semrush.com/login/');
    
    // 填写登录表单
    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');
    
    // 等待成功登录
    try {
      await page.waitForURL('**/analytics/keywordoverview/**', { timeout: 30000 });
    } catch (error) {
      // 检查是否登录失败
      const errorElement = await page.$('div[class*="error"], .error-message');
      if (errorElement) {
        const errorMessage = await errorElement.textContent();
        throw new Error(`SEMrush登录失败: ${errorMessage?.trim()}`);
      }
      throw new Error('SEMrush登录失败或超时');
    }
    
    // 导航到关键词概览页面
    await page.goto(`https://www.semrush.com/analytics/keywordoverview/?q=${encodeURIComponent(keyword)}`);
    
    // 等待搜索量数据加载
    await page.waitForSelector('.overview-data__info .volume', { timeout: 30000 });
    
    // 提取搜索量
    const volume = await page.textContent('.overview-data__info .volume');
    const cleanVolume = volume?.trim() || 'N/A';
    
    await browser.close();
    
    console.log(`已获取 "${keyword}" 的SEMrush数据: 搜索量 = ${cleanVolume}`);
    return { keyword, volume: cleanVolume };
  } catch (error) {
    await browser.close();
    console.error(`获取 "${keyword}" 的SEMrush数据时出错:`, error);
    throw error;
  }
}

/**
 * 获取SEMrush数据并保存到CSV文件
 * 
 * @param keyword 要分析的关键词
 * @param credentials SEMrush登录凭证
 * @param outputFilename 可选的自定义文件名(默认: semrush.csv)
 * @returns 保存的文件路径
 */
export async function fetchAndSaveSemrush(
  keyword: string,
  credentials: Credentials,
  outputFilename = 'semrush.csv'
): Promise<string> {
  const result = await fetchSemrush(keyword, credentials);
  
  const filePath = await writeCsvFile(
    outputFilename,
    ['keyword', 'volume'],
    [[result.keyword, result.volume]]
  );
  
  console.log(`已将 "${keyword}" 的SEMrush数据保存到${filePath}`);
  return filePath;
} 