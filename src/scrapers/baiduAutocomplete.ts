import { chromium } from 'playwright';
import { writeTextFile } from '../utils/fileUtils';
import { AutocompleteSuggestion } from '../types';

/**
 * 抓取百度搜索自动补全建议
 * 
 * @param keyword 搜索关键词
 * @returns 包含关键词和建议数组的对象
 */
export async function fetchBaiduAutocomplete(keyword: string): Promise<AutocompleteSuggestion> {
  console.log(`正在获取 "${keyword}" 的百度自动补全建议...`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  
  try {
    console.log('正在访问百度...');
    await page.goto('https://www.baidu.com', { timeout: 60000 });
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
      await page.screenshot({ path: 'debug-baidu-page.png' });
      console.log('已保存页面截图到 debug-baidu-page.png');
      
      throw new Error('无法找到百度搜索框');
    }

    // 逐字输入关键词
    console.log(`正在输入关键词: ${keyword}`);
    await searchInput.click();
    await searchInput.focus();
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
        );
        if (suggestions.length > 0) {
          console.log(`找到自动补全建议，使用选择器: ${selector}`);
          break;
        }
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    await browser.close();
    
    console.log(`已找到 "${keyword}" 的${suggestions.length}个建议`);
    return { keyword, suggestions };
  } catch (error) {
    console.log('出现错误，尝试截图...');
    try {
      await page.screenshot({ path: 'error-baidu-page.png' });
      console.log('已保存错误页面截图到 error-baidu-page.png');
    } catch (e) {
      console.log('截图失败:', e);
    }
    
    await browser.close();
    console.error(`获取 "${keyword}" 的自动补全建议时出错:`, error);
    throw error;
  }
}

/**
 * 抓取百度自动补全建议并保存到文本文件
 * 
 * @param keyword 搜索关键词
 * @param outputFilename 可选的自定义文件名(默认: baidu-autocomplete.txt)
 * @returns 保存的文件路径
 */
export async function fetchAndSaveBaiduAutocomplete(
  keyword: string, 
  outputFilename = 'baidu-autocomplete.txt'
): Promise<string> {
  const result = await fetchBaiduAutocomplete(keyword);
  
  const filePath = await writeTextFile(
    outputFilename,
    result.suggestions.join('\n')
  );
  
  console.log(`已将 "${keyword}" 的百度自动补全建议保存到${filePath}(${result.suggestions.length}条)`);
  return filePath;
} 