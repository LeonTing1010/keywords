import { fetchTrends } from '../scrapers/googleTrends';

async function testGoogleTrends() {
  try {
    console.log('测试: 获取"AI"关键词的Google Trends数据...');
    const result = await fetchTrends('Personal Digital');
    console.log('获取到的结果:', result);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testGoogleTrends(); 