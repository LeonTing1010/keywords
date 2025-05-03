import { fetchAndSaveAutocomplete } from './scrapers/googleAutocomplete';
import { fetchTrends } from './scrapers/googleTrends';
import { fetchAndSaveSemrush } from './scrapers/semrush';
import { fetchAndSaveSimilarweb } from './scrapers/similarweb';
import { Credentials } from './types';
import { ensureOutputDirectory } from './utils/fileUtils';

// 确保输出目录存在
ensureOutputDirectory();

/**
 * 配置 - 运行前请编辑这些值
 */
const config = {
  keyword: 'Personal Digital',  // 要分析的关键词
  domain: 'example.com',  // 要在SimilarWeb中分析的域名
  semrushCredentials: {
    email: 'you@example.com',  // 替换为有效的SEMrush邮箱
    password: 'your_password'   // 替换为有效的SEMrush密码
  }
};

/**
 * 主函数，按顺序运行所有爬虫
 */
async function main() {
  try {
    console.log('开始收集关键词数据...');
    console.log('----------------------------------------');
    
    // 1. Google自动补全
    await fetchAndSaveAutocomplete(config.keyword);
    console.log('----------------------------------------');
    
    // 2. Google Trends
    await fetchTrends(config.keyword);
    console.log('----------------------------------------');
    
    // 3. SEMrush关键词概览
    await fetchAndSaveSemrush(config.keyword, config.semrushCredentials);
    console.log('----------------------------------------');
    
    // 4. SimilarWeb流量概览
    await fetchAndSaveSimilarweb(config.domain);
    console.log('----------------------------------------');
    
    console.log('所有数据收集完成！');
    console.log('结果已保存在"output"目录中。');
  } catch (error) {
    console.error('数据收集过程中出错:', error);
    process.exit(1);
  }
}

// 运行主函数
main(); 