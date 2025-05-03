import { fetchAutocomplete, fetchAndSaveAutocomplete } from '../scrapers/googleAutocomplete';

async function testGoogleAutocomplete() {
  try {
    // 1. 测试使用系统浏览器获取自动补全建议(默认)
    console.log('测试1: 使用系统浏览器抓取"AI Free"关键词的建议...');
    const result = await fetchAutocomplete('Personal Digital');
    console.log('获取到的建议:', result);
    
    // // 2. 测试获取并保存自动补全建议
    // console.log('\n测试2: 使用系统浏览器抓取并保存"SEO"关键词的建议...');
    // const filePath = await fetchAndSaveAutocomplete('SEO', 'seo-suggestions.txt');
    // console.log('建议已保存到:', filePath);
    
    // // 3. 测试非系统浏览器模式(可选)
    // console.log('\n测试3: 使用非系统浏览器抓取"javascript"关键词的建议...');
    // const nonSystemBrowserResult = await fetchAutocomplete('javascript', 'https://www.google.com', undefined, false);
    // console.log('获取到的建议:', nonSystemBrowserResult);
    
    // 4. 测试使用代理（如果有需要）
    // console.log('\n测试4: 使用代理抓取"python"关键词的建议...');
    // const proxyResult = await fetchAutocomplete('python', 'https://www.google.com', 'http://127.0.0.1:7890');
    // console.log('使用代理获取到的建议:', proxyResult);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testGoogleAutocomplete();