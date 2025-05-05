# KeywordIntent API 文档

本文档提供了KeywordIntent系统的主要API和组件接口说明。

## 核心组件API

- [LLM服务中心](llm-service.md)
- [工作流控制器](workflow-controller.md)
- [用户旅程模拟器](user-journey-sim.md)
- [领域专家系统](domain-expert.md)
- [跨领域分析器](cross-domain-analyzer.md)
- [关键词价值预测器](value-predictor.md)

## 使用示例

### 基础使用

```typescript
import { WorkflowController } from '../core/WorkflowController';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { GoogleSearchEngine } from '../providers/GoogleSearchEngine';

// 初始化组件
const searchEngine = new GoogleSearchEngine();
const llmService = new LLMServiceHub({
  model: 'gpt-4'
});

// 创建工作流控制器
const workflowController = new WorkflowController({
  searchEngine,
  llmService,
  maxIterations: 5,
  satisfactionThreshold: 0.85,
  analysisDepth: 5,
  outputFormat: 'json',
  enableDomainExpert: true,
  enableJourneySim: true,
  enableCrossDomain: true,
  enableValuePredict: true,
  enableIntentAnalysis: true,
  verbose: true
});

// 执行工作流
const result = await workflowController.executeWorkflow("人工智能");
```

### 单独使用用户旅程模拟

```typescript
import { UserJourneySim } from '../journey/UserJourneySim';
import { LLMServiceHub } from '../llm/LLMServiceHub';

// 初始化LLM服务
const llmService = new LLMServiceHub({
  model: 'gpt-4'
});

// 创建用户旅程模拟器
const journeySim = new UserJourneySim({
  llmService,
  maxSteps: 5,
  verbose: true
});

// 模拟单个旅程
const journey = await journeySim.simulateJourney("电动汽车");

// 获取查询演变路径
const queryPath = journeySim.getQueryEvolutionPath(journey);
```

### 单独使用领域专家系统

```typescript
import { DomainExpertSystem } from '../domain/DomainExpertSystem';
import { LLMServiceHub } from '../llm/LLMServiceHub';

// 初始化LLM服务
const llmService = new LLMServiceHub({
  model: 'gpt-4'
});

// 创建领域专家系统
const domainExpert = new DomainExpertSystem({
  llmService,
  verbose: true
});

// 识别关键词所属领域
const domains = await domainExpert.identifyDomain([
  "Python机器学习",
  "TensorFlow教程",
  "深度学习框架比较"
]);

// 按领域分类关键词
const keywordsByDomain = await domainExpert.classifyKeywordsByDomain([
  "Python机器学习",
  "股票投资策略",
  "健康饮食指南"
]);
```

## 组件交互图

```
┌─────────────────┐
│  用户代码       │
└───────┬─────────┘
        │
        ▼
┌───────────────────┐
│  WorkflowController│
└────┬────┬────┬────┘
     │    │    │
     ▼    ▼    ▼
┌─────┐ ┌───┐ ┌───┐
│LLM  │ │专家│ │旅程│
│服务 │ │系统│ │模拟│
└─────┘ └───┘ └───┘
```

## 输出格式

系统支持多种输出格式:

- **JSON**: 默认格式，适合后续程序处理
- **Markdown**: 适合生成可读性强的报告
- **CSV**: 适合导入到电子表格进行进一步分析

## 错误处理

所有API方法均返回Promise，可使用标准try/catch进行错误处理:

```typescript
try {
  const result = await workflowController.executeWorkflow("人工智能");
  console.log(result);
} catch (error) {
  console.error("分析过程出错:", error);
}
``` 