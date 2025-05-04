import { GoogleSearchEngine } from '../engines/GoogleSearchEngine';
import { SearchOptions } from '../types';

async function testGoogleAutocomplete() {
  try {
    // 创建Google搜索引擎实例
    const engine = new GoogleSearchEngine();
    
    // 配置搜索选项
    const searchOptions: SearchOptions = {
      domain: 'https://www.google.com',
      useSystemBrowser: true,
      enableSecondRound: false
    };
    
    // 1. 测试获取自动补全建议
    console.log('测试1: 使用系统浏览器抓取"Personal Digital"关键词的建议...');
    const result = await engine.fetchAutocomplete('Personal Digital', searchOptions);
    console.log('获取到的建议:', result);
    
    // // 2. 测试获取并保存自动补全建议
    // console.log('\n测试2: 使用系统浏览器抓取并保存"SEO"关键词的建议...');
    // const filePath = await engine.fetchAndSaveAutocomplete('SEO', searchOptions);
    // console.log('建议已保存到:', filePath);
    
    // // 3. 测试非系统浏览器模式(可选)
    // console.log('\n测试3: 使用非系统浏览器抓取"javascript"关键词的建议...');
    // const nonSystemOptions: SearchOptions = {
    //   ...searchOptions,
    //   useSystemBrowser: false
    // };
    // const nonSystemBrowserResult = await engine.fetchAutocomplete('javascript', nonSystemOptions);
    // console.log('获取到的建议:', nonSystemBrowserResult);
    
    // // 4. 测试使用代理（如果有需要）
    // console.log('\n测试4: 使用代理抓取"python"关键词的建议...');
    // const proxyOptions: SearchOptions = {
    //   ...searchOptions,
    //   proxyServer: 'http://127.0.0.1:7890'
    // };
    // const proxyResult = await engine.fetchAutocomplete('python', proxyOptions);
    // console.log('使用代理获取到的建议:', proxyResult);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testGoogleAutocomplete();