/**
 * enhanced-llm-usage.ts
 * 演示如何使用增强版LLM服务
 */
import { EnhancedLLMService } from '../core/llm/EnhancedLLMService';
import { AgentLLMService } from '../core/llm/AgentLLMService';
import { logger } from '../infra/logger';

/**
 * 基本用法示例
 */
async function basicUsageExample() {
  console.log('===== 基本用法示例 =====');
  
  // 创建增强版LLM服务
  const llmService = new EnhancedLLMService({
    model: 'gpt-3.5-turbo',
    enableCache: true,
    autoModelSelection: true,
    enableStreamingByDefault: false
  });
  
  // 简单的分析请求
  const result = await llmService.analyze(
    '分析关键词"智能家居"的搜索意图和用户需求',
    'keyword-analysis',
    {
      format: 'json',
      temperature: 0.5
    }
  );
  
  console.log('分析结果:', JSON.stringify(result, null, 2));
  
  // 查看缓存统计
  console.log('缓存统计:', llmService.getCacheManager().getStats());
}

/**
 * 自动模型选择示例
 */
async function autoModelSelectionExample() {
  console.log('\n===== 自动模型选择示例 =====');
  
  const llmService = new EnhancedLLMService({
    autoModelSelection: true,
    modelTiers: {
      simple: 'gpt-3.5-turbo',
      medium: 'gpt-3.5-turbo-16k',
      complex: 'gpt-4-turbo'
    }
  });
  
  // 简单任务
  console.log('处理简单任务...');
  const simpleResult = await llmService.analyze(
    '总结一下智能家居的优点',
    'simple-task',
    { complexityLevel: 'simple' }
  );
  
  // 复杂任务
  console.log('处理复杂任务...');
  const complexResult = await llmService.analyze(
    '详细分析智能家居市场在未来5年的发展趋势，包括技术演进、用户需求变化、市场规模预测和潜在风险',
    'complex-task',
    { complexityLevel: 'complex' }
  );
  
  console.log('模型选择配置:', llmService.getModelSelector().getConfig());
}

/**
 * 流式响应示例
 */
async function streamingExample() {
  console.log('\n===== 流式响应示例 =====');
  
  const llmService = new EnhancedLLMService({
    enableStreamingByDefault: true
  });
  
  // 收集响应块
  const chunks: string[] = [];
  
  // 流式请求
  await llmService.analyze(
    '分步解释如何搭建一个智能家居系统',
    'streaming-demo',
    {
      stream: true,
      onChunk: (chunk: string) => {
        chunks.push(chunk);
        process.stdout.write(chunk); // 实时输出
      }
    }
  );
  
  console.log('\n\n总共收到', chunks.length, '个响应块');
}

/**
 * 批处理请求示例
 */
async function batchProcessingExample() {
  console.log('\n===== 批处理请求示例 =====');
  
  const llmService = new EnhancedLLMService({
    batchProcessingEnabled: true,
    maxBatchSize: 3
  });
  
  // 创建多个类似的请求
  const keywords = ['智能音箱', '智能灯泡', '智能门锁'];
  const prompts = keywords.map(keyword => `简要描述${keyword}的主要功能和优势`);
  
  console.log('批量处理', prompts.length, '个相似请求...');
  
  // 同时发送所有请求
  const results = await Promise.all(
    prompts.map((prompt, index) => 
      llmService.analyze(prompt, 'batch-request', {
        batchId: 'product-batch' // 使用相同的批处理ID
      })
    )
  );
  
  // 显示结果
  results.forEach((result, index) => {
    console.log(`关键词 "${keywords[index]}" 分析结果:`, 
      typeof result === 'string' ? result.substring(0, 100) + '...' : result.content?.substring(0, 100) + '...');
  });
  
  // 查看批处理统计
  console.log('批处理统计:', llmService.getBatchProcessor().getStats());
}

/**
 * 自定义输出格式示例
 */
async function customOutputExample() {
  console.log('\n===== 自定义输出格式示例 =====');
  
  const llmService = new EnhancedLLMService();
  
  // 请求自定义输出格式
  const result = await llmService.analyze(
    '分析智能家居市场的主要细分领域及其市场份额',
    'custom-output-demo',
    {
      format: 'json',
      customOutput: {
        format: 'html',
        dimensions: ['marketSegments', 'keyPlayers', 'trends'],
        includeVisualization: true,
        interactive: true
      }
    }
  );
  
  console.log('自定义输出结果:', JSON.stringify(result, null, 2));
}

/**
 * 进度反馈示例
 */
async function progressFeedbackExample() {
  console.log('\n===== 进度反馈示例 =====');
  
  const llmService = new EnhancedLLMService();
  
  // 进度更新回调
  const progressUpdates: number[] = [];
  const progressCallback = (progress: number) => {
    progressUpdates.push(progress);
    console.log(`当前进度: ${progress}%`);
  };
  
  // 订阅进度事件
  llmService.on('progress', (data) => {
    console.log(`进度事件: ${data.progress}%, 已用时: ${data.elapsed}ms`);
  });
  
  console.log('开始复杂分析，请等待进度更新...');
  
  // 执行一个复杂分析
  const result = await llmService.analyze(
    '详细分析智能家居市场中的消费者行为模式和购买决策过程',
    'progress-demo',
    {
      complexityLevel: 'complex',
      progressCallback
    }
  );
  
  console.log('分析完成，收到', progressUpdates.length, '次进度更新');
}

/**
 * 设置A/B测试示例
 */
async function abTestExample() {
  console.log('\n===== A/B测试示例 =====');
  
  const llmService = new EnhancedLLMService();
  
  // 配置A/B测试
  llmService.configureABTest('temperature-test', [
    { id: 'low-temp', config: { temperature: 0.3 }, weight: 1 },
    { id: 'high-temp', config: { temperature: 0.8 }, weight: 1 }
  ]);
  
  // 执行多次测试请求
  for (let i = 0; i < 5; i++) {
    console.log(`执行A/B测试请求 #${i+1}...`);
    
    const result = await llmService.analyze(
      '简述智能家居的未来发展方向',
      'ab-test',
      { format: 'text' }
    );
    
    console.log('结果预览:', typeof result === 'string' 
      ? result.substring(0, 50) + '...' 
      : result.content?.substring(0, 50) + '...');
  }
}

/**
 * AgentLLMService 用法示例
 */
async function agentLLMServiceExample() {
  console.log('\n===== AgentLLMService 用法示例 =====');
  
  // 创建代理LLM服务
  const agentLLM = new AgentLLMService({
    enableCache: true,
    autoModelSelection: true,
    enableStreaming: true
  });
  
  // 创建消息
  const messages = [
    { role: 'system', content: '你是一个专业的智能家居顾问' },
    { role: 'user', content: '我想在预算5000元内打造一个基础的智能家居系统，有什么建议？' }
  ];
  
  console.log('发送代理LLM请求...');
  
  // 收集流式响应块
  let streamOutput = '';
  
  // 流式输出回调函数
  const onStream = (chunk: string) => {
    streamOutput += chunk;
    process.stdout.write(chunk);
  };
  
  // 调用LLM
  const response = await agentLLM.call(messages as any, {
    stream: true,
    streamCallback: (chunk: string) => {
      if (chunk) {
        onStream(chunk);
      }
    }
  } as any);
  
  console.log('\n\n流式输出总长度:', streamOutput.length);
  console.log('代理LLM服务统计:', agentLLM.getServiceStats());
}

/**
 * 运行所有示例
 */
async function runExamples() {
  try {
    // 基本示例
    await basicUsageExample();
    
    // 高级功能示例
    await autoModelSelectionExample();
    await streamingExample();
    await batchProcessingExample();
    await customOutputExample();
    await progressFeedbackExample();
    await abTestExample();
    
    // 代理LLM服务示例
    await agentLLMServiceExample();
    
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

// 运行示例
if (require.main === module) {
  runExamples().then(() => {
    console.log('\n所有示例运行完成');
  });
} 