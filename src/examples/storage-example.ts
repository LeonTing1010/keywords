/**
 * storage-example.ts
 * 
 * 示例程序，展示如何使用数据持久化系统来记录浏览器、Agent和LLM处理数据
 */

import { DataCaptureInterceptor } from '../infra/storage/DataCaptureInterceptor';
import { SessionStatus } from '../infra/storage/SQLiteStorage';
import { logger } from '../infra/logger';

/**
 * 数据持久化示例
 */
async function storageExample() {
  // 创建数据捕获拦截器
  console.log('初始化数据捕获拦截器...');
  const interceptor = new DataCaptureInterceptor('./data/example.db');
  await interceptor.initialize();

  try {
    // 模拟一次关键词分析会话
    const keyword = '人工智能';
    const model = 'deepseek-prover-v2:free';
    
    // 开始会话
    console.log(`开始新会话: 关键词 "${keyword}", 模型 "${model}"`);
    const sessionId = interceptor.startSession(keyword, model, {
      fastMode: false,
      includeDetails: true
    });
    console.log(`创建会话ID: ${sessionId}`);
    
    // 1. 模拟浏览器数据
    console.log('\n1. 捕获浏览器数据');
    
    // 捕获搜索数据
    const searchId = interceptor.captureBrowserData({
      url: 'https://www.example.com/search?q=人工智能',
      searchQuery: '人工智能',
      contentType: 'text/html',
      content: '<html><body><div class="results">搜索结果页面内容...</div></body></html>',
      metadata: {
        resultsCount: 15,
        searchEngine: 'baidu'
      }
    });
    console.log(`- 已保存搜索数据，ID: ${searchId}`);
    
    // 捕获页面内容
    const pageId = interceptor.captureBrowserData({
      url: 'https://www.example.com/article/ai-intro',
      pageTitle: '人工智能简介 - 初学者指南',
      contentType: 'text/html',
      content: '<html><body><article>人工智能(AI)是计算机科学的一个分支，致力于创建能够模拟人类智能的系统...</article></body></html>',
      metadata: {
        wordCount: 1200,
        readingTime: '5 min'
      }
    });
    console.log(`- 已保存页面内容，ID: ${pageId}`);
    
    // 2. 模拟Agent处理数据
    console.log('\n2. 捕获Agent处理数据');
    
    // 关键词Agent数据
    const keywordAgentId = interceptor.captureAgentData({
      agentId: 'keyword-agent-1',
      agentType: 'KeywordAgent',
      inputData: JSON.stringify({ keyword: '人工智能', options: { maxKeywords: 10 } }),
      outputData: JSON.stringify({ 
        discovered: ['人工智能应用', '人工智能教程', '人工智能案例'],
        related: ['机器学习', '深度学习', '神经网络']
      }),
      processingTimeMs: 1250
    });
    console.log(`- 已保存关键词Agent数据，ID: ${keywordAgentId}`);
    
    // 内容Agent数据
    const contentAgentId = interceptor.captureAgentData({
      agentId: 'content-agent-1',
      agentType: 'ContentAgent',
      inputData: JSON.stringify({ 
        keyword: '人工智能', 
        pages: ['https://www.example.com/article/ai-intro'] 
      }),
      outputData: JSON.stringify({ 
        contentGaps: ['缺乏人工智能入门实践指南', '没有针对初学者的代码示例'],
        opportunities: ['创建AI实践教程', '开发入门级AI项目']
      }),
      processingTimeMs: 2340,
      metadata: {
        pagesAnalyzed: 5,
        keyInsights: ['教程质量参差不齐', '缺乏实践内容']
      }
    });
    console.log(`- 已保存内容Agent数据，ID: ${contentAgentId}`);
    
    // 3. 模拟LLM处理数据
    console.log('\n3. 捕获LLM处理数据');
    
    // 分析Prompt
    const llmAnalysisId = interceptor.captureLLMData({
      model: 'deepseek-prover-v2:free',
      prompt: `分析以下关键词和相关搜索数据，找出主要的用户需求和内容空白:
      关键词: 人工智能
      相关搜索: 人工智能应用, 人工智能教程, 人工智能案例
      页面内容: 人工智能(AI)是计算机科学的一个分支...`,
      completion: `根据分析，主要的用户需求为:
      1. 学习人工智能基础知识
      2. 寻找人工智能的实际应用案例
      3. 获取入门级教程
      
      主要的内容空白:
      1. 缺乏针对初学者的实践教程
      2. 缺少代码示例和小型项目
      3. 没有系统化的学习路径`,
      processingTimeMs: 3560,
      tokens: 512,
      temperature: 0.7,
      metadata: {
        requestId: 'req-123456',
        usage: {
          promptTokens: 215,
          completionTokens: 297
        }
      }
    });
    console.log(`- 已保存LLM分析数据，ID: ${llmAnalysisId}`);
    
    // 报告生成Prompt
    const llmReportId = interceptor.captureLLMData({
      model: 'deepseek-prover-v2:free',
      prompt: `根据以下分析结果生成一份人工智能市场机会报告:
      用户需求: [...简化内容...]
      内容空白: [...简化内容...]
      关键词分析: [...简化内容...]`,
      completion: `# 人工智能市场机会报告
      
      ## 执行摘要
      本报告分析了"人工智能"领域的现有内容和用户需求，发现了几个关键的市场机会...
      
      ## 主要发现
      1. 缺乏针对初学者的实践性内容
      2. 用户对实际应用案例有强烈需求
      
      ## 建议行动方案
      1. 创建"人工智能入门实践指南"
      2. 开发包含代码示例的教程系列`,
      processingTimeMs: 4210,
      tokens: 850,
      temperature: 0.5
    });
    console.log(`- 已保存LLM报告数据，ID: ${llmReportId}`);
    
    // 完成会话
    const reportPath = './output/ai_report_example.html';
    console.log(`\n完成会话，报告路径: ${reportPath}`);
    interceptor.completeSession(sessionId, reportPath);
    
    // 检索并显示会话数据
    console.log('\n检索会话数据:');
    const session = interceptor.getSession(sessionId);
    console.log(`- 会话ID: ${session?.id}`);
    console.log(`- 关键词: ${session?.keyword}`);
    console.log(`- 状态: ${session?.status}`);
    console.log(`- 报告路径: ${session?.reportPath}`);
    
    // 关闭拦截器
    console.log('\n关闭数据捕获拦截器');
    interceptor.close();
    
  } catch (error) {
    console.error('示例运行失败:', error);
    // 确保关闭连接
    interceptor.close();
  }
}

// 只有在直接运行此文件时才执行示例
if (require.main === module) {
  storageExample()
    .then(() => {
      console.log('示例完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('示例运行出错:', error);
      process.exit(1);
    });
} 