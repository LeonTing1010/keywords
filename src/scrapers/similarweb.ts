import { chromium } from 'playwright';
import { writeCsvFile } from '../utils/fileUtils';
import { SimilarWebData } from '../types';

/**
 * 从SimilarWeb获取流量概览数据
 * 
 * @param domain 要分析的域名
 * @returns 包含域名和月访问量数据的对象
 */
export async function fetchSimilarweb(domain: string): Promise<SimilarWebData> {
  console.log(`正在获取 "${domain}" 的SimilarWeb流量数据...`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 前往SimilarWeb首页
    await page.goto('https://www.similarweb.com/');
    
    // 输入域名并搜索
    await page.fill('input[placeholder*="website"], input[placeholder*="Website"]', domain);
    await page.keyboard.press('Enter');
    
    // 等待结果页面加载
    await page.waitForURL(`**/${domain}/**`, { timeout: 30000 });
    
    // 等待流量数据出现
    await page.waitForSelector('div.engagementInfo-valueNumber', { timeout: 30000 });
    
    // 提取月访问量
    const traffic = await page.textContent('div.engagementInfo-valueNumber');
    const cleanTraffic = traffic?.trim() || 'N/A';
    
    await browser.close();
    
    console.log(`已获取 "${domain}" 的SimilarWeb数据: 月访问量 = ${cleanTraffic}`);
    return { domain, monthlyTraffic: cleanTraffic };
  } catch (error) {
    await browser.close();
    console.error(`获取 "${domain}" 的SimilarWeb数据时出错:`, error);
    throw error;
  }
}

/**
 * 获取SimilarWeb数据并保存到CSV文件
 * 
 * @param domain 要分析的域名
 * @param outputFilename 可选的自定义文件名(默认: similarweb.csv)
 * @returns 保存的文件路径
 */
export async function fetchAndSaveSimilarweb(
  domain: string,
  outputFilename = 'similarweb.csv'
): Promise<string> {
  const result = await fetchSimilarweb(domain);
  
  const filePath = await writeCsvFile(
    outputFilename,
    ['domain', 'monthly_traffic'],
    [[result.domain, result.monthlyTraffic]]
  );
  
  console.log(`已将 "${domain}" 的SimilarWeb数据保存到${filePath}`);
  return filePath;
} 