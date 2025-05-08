# 增强版 LLM 服务

本文档介绍了增强版大语言模型(LLM)服务的设计、功能和使用方法。增强版LLM服务旨在优化成本、提升性能、增强用户体验，并提供丰富的分析结果呈现方式。

## 核心功能

### 1. 降低成本，提升响应速度

#### 模型自动选择

根据任务复杂度自动选择最合适的模型，简单任务使用轻量级模型，复杂任务使用强大模型：

```typescript
const llmService = new EnhancedLLMService({
  autoModelSelection: true,
  modelTiers: {
    simple: 'gpt-3.5-turbo',   // 简单任务
    medium: 'gpt-3.5-turbo-16k', // 中等任务
    complex: 'gpt-4-turbo'     // 复杂任务
  }
});

// 系统会自动选择适合的模型
const result = await llmService.analyze(prompt, 'task-name', {
  // 也可以显式指定复杂度
  complexityLevel: 'medium'
});
```

#### 缓存机制

为常见关键词和查询实现结果缓存，减少重复调用：

```typescript
const llmService = new EnhancedLLMService({
  enableCache: true,
  cacheSize: 1000,   // 缓存最大条目数
  cacheTTL: 3600000  // 缓存有效期（毫秒）
});

// 第一次调用会访问API，后续相同调用直接使用缓存
const result1 = await llmService.analyze(prompt, 'task-name');
const result2 = await llmService.analyze(prompt, 'task-name'); // 使用缓存

// 查看缓存统计
const stats = llmService.getCacheManager().getStats();
```

#### 流式响应

使用流式响应提高用户体验，即时显示生成内容：

```typescript
const llmService = new EnhancedLLMService({
  enableStreamingByDefault: true // 默认启用流式响应
});

await llmService.analyze(prompt, 'streaming-demo', {
  stream: true,
  onChunk: (chunk) => {
    // 处理每个响应块
    console.log(chunk);
  }
});
```

#### 批处理请求

合并多个小请求为批处理，减少API调用次数：

```typescript
const llmService = new EnhancedLLMService({
  batchProcessingEnabled: true,
  maxBatchSize: 5,      // 最大批处理大小
  batchWindow: 200      // 批处理窗口（毫秒）
});

// 使用相同的批处理ID，系统会自动合并请求
const results = await Promise.all([
  llmService.analyze(prompt1, 'task', { batchId: 'batch-1' }),
  llmService.analyze(prompt2, 'task', { batchId: 'batch-1' }),
  llmService.analyze(prompt3, 'task', { batchId: 'batch-1' })
]);
```

### 2. 提高工具的实用性和易用性

#### 交互式报告

提供更丰富的报告格式，包括可视化图表、交互式元素：

```typescript
const result = await llmService.analyze(prompt, 'custom-report', {
  format: 'json',
  customOutput: {
    format: 'html',              // 输出格式
    includeVisualization: true,  // 包含可视化
    interactive: true            // 包含交互元素
  }
});
```

#### 定制化输出

允许用户指定感兴趣的特定分析维度：

```typescript
const result = await llmService.analyze(prompt, 'custom-dimensions', {
  customOutput: {
    dimensions: ['marketSize', 'competitors', 'trends']
  }
});
```

#### 进度反馈

提供实时分析进度和预估完成时间：

```typescript
// 通过回调获取进度
await llmService.analyze(prompt, 'progress-demo', {
  progressCallback: (progress) => {
    console.log(`当前进度: ${progress}%`);
  }
});

// 或通过事件监听
llmService.on('progress', (data) => {
  console.log(`进度: ${data.progress}%, 预计总时间: ${data.estimatedTotal}ms`);
});
```

### 3. 持续提升分析质量

#### 反馈循环

收集用户对分析结果的反馈，用于改进模型：

```typescript
// 启用反馈收集
const llmService = new EnhancedLLMService({
  collectFeedback: true
});

// 提交用户反馈
llmService.submitFeedback('request-id', 4, '分析很有帮助，但缺少一些细节');
```

#### A/B测试框架

自动测试不同分析策略的效果：

```typescript
// 配置A/B测试
llmService.configureABTest('prompt-variant-test', [
  { id: 'variant-a', config: { systemPrompt: '提示A' }, weight: 1 },
  { id: 'variant-b', config: { systemPrompt: '提示B' }, weight: 1 }
]);

// 系统会随机选择变体进行测试
const result = await llmService.analyze(prompt, 'ab-test');
```

## 架构设计

增强版LLM服务由以下核心组件构成：

1. **EnhancedLLMService** - 主服务类，整合所有功能
2. **LLMCacheManager** - 缓存管理器，提供高效的缓存机制
3. **ModelSelectionService** - 模型选择服务，根据任务选择合适的模型
4. **BatchProcessor** - 批处理器，合并和处理批量请求

这些组件协同工作，为用户提供优化的LLM体验。

## 与LangChain集成

通过AgentLLMService，可以将增强版LLM服务与LangChain无缝集成：

```typescript
const agentLLM = new AgentLLMService({
  enableCache: true,
  autoModelSelection: true,
  enableStreaming: true
});

// 使用与LangChain兼容的接口
const response = await agentLLM.call([
  { role: 'system', content: '系统提示' },
  { role: 'user', content: '用户提示' }
], {
  stream: true,
  streamCallback: (chunk) => {
    console.log(chunk);
  }
});
```

## 性能优化指南

为获得最佳性能和成本效益，建议：

1. 为常见查询启用缓存
2. 启用自动模型选择，避免简单任务使用高级模型
3. 对类似的小请求使用批处理
4. 对需要即时反馈的场景使用流式响应
5. 收集用户反馈以持续优化系统

## 示例代码

完整示例代码请参考 `src/examples/enhanced-llm-usage.ts`。此文件演示了所有主要功能的使用方法。

## 扩展与定制

增强版LLM服务设计为可扩展的框架，可以根据需要添加新功能：

1. 添加新的模型选择策略
2. 实现自定义缓存存储后端
3. 开发更复杂的批处理算法
4. 集成额外的数据源进行分析增强 