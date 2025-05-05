# 自动补全增强的用户旅程模拟

本文档介绍了如何使用自动补全功能增强用户搜索旅程模拟系统，使模拟更符合真实用户行为。

## 功能概述

自动补全增强模拟系统通过结合LLM驱动的用户意图模拟和真实搜索引擎的自动补全功能，创建更加真实的用户搜索旅程。系统的主要组件包括：

1. **用户旅程模拟器** (`UserJourneySim`): 核心组件，负责模拟完整用户搜索旅程
2. **自动补全服务** (`AutocompleteService`): 从真实搜索引擎获取自动补全建议
3. **自动补全参数** (`AutocompleteParameters`): 控制自动补全采纳行为的参数
4. **自动补全评估器** (`AutocompleteEvaluator`): 评估模拟的自动补全采纳行为与真实数据的匹配度
5. **旅程评估器** (`JourneyEvaluator`): 评估整体旅程质量

## 工作原理

自动补全增强的用户旅程模拟按以下流程工作：

1. 系统首先使用LLM生成基本的用户搜索旅程，包含多个查询步骤
2. 对于每个步骤，系统从真实搜索引擎获取自动补全建议
3. 系统评估这些建议，并基于位置、相关性、语义偏离度和查询类型决定是否采纳建议
4. 系统根据配置的参数调整下一步的查询，可能采纳自动补全建议或保持LLM原始预测
5. 最终生成的旅程结合了LLM的意图预测和真实的自动补全建议

## 主要特性

- **混合模拟方法**: 结合LLM预测和真实搜索引擎数据
- **可配置的采纳行为**: 通过参数精细控制自动补全建议的采纳模式
- **多维度评估**: 评估模拟旅程在模式相似度、意图转换和查询相关性方面的表现
- **自动补全采纳评估**: 专门评估自动补全采纳行为与真实用户行为的匹配度
- **多搜索引擎支持**: 支持百度、谷歌和必应等多个搜索引擎

## 使用方法

### 基本配置

```typescript
// 1. 初始化服务
const llmService = new LLMServiceImpl(); // 实现LLMServiceHub接口的服务

// 2. 初始化自动补全服务
const autocompleteService = new AutocompleteService({
  verbose: true,
  cacheExpiry: 24 * 60 * 60, // 24小时缓存过期
  defaultEngine: 'baidu' // 使用百度自动补全
});

// 3. 初始化用户旅程模拟器
const userJourneySim = new UserJourneySim({
  llmService,
  autocompleteService,
  verbose: true
});

// 4. 模拟用户旅程
const journey = await userJourneySim.simulateJourney("初始查询词");
```

### 自定义自动补全参数

```typescript
// 自定义自动补全参数
const autocompleteParams = {
  overallAdoptionRate: 0.65,          // 总体采纳率
  positionWeights: [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1], // 位置权重
  relevanceThreshold: 0.5,            // 相关性阈值
  semanticDeviation: {                // 语义偏离倾向
    low: 0.8,                         // 微调类型
    medium: 0.5,                      // 相关但方向不同
    high: 0.2                         // 完全不同方向
  },
  queryTypeMultipliers: {             // 查询类型乘数
    informational: 0.9,
    navigational: 0.7,
    commercial: 1.2,
    transactional: 1.3
  }
};

const userJourneySim = new UserJourneySim({
  llmService,
  autocompleteService,
  autocompleteParams,
  verbose: true
});
```

### 评估模拟质量

```typescript
// 初始化评估器
const journeyEvaluator = new JourneyEvaluator();
const autocompleteEvaluator = new AutocompleteEvaluator();

// 创建带评估功能的模拟器
const userJourneySim = new UserJourneySim({
  llmService,
  autocompleteService,
  evaluator: journeyEvaluator,
  autocompleteEvaluator,
  verbose: true
});

// 评估模拟旅程
const realJourneyData = {
  queries: ["查询1", "查询2", "查询3"],
  refinementPatterns: ["addingSpecificity", "rephrasing"],
  intentTransitions: [
    {
      fromQuery: "查询1",
      toQuery: "查询2",
      fromIntent: "informational",
      toIntent: "informational"
    }
  ]
};

const evaluationResult = await userJourneySim.simulateAndEvaluateJourney(
  "初始查询词",
  realJourneyData
);
```

## 自动补全采纳决策流程

自动补全建议的采纳决策基于以下因素：

1. **位置权重**: 根据建议在列表中的位置分配权重
2. **相关性评分**: 计算建议与当前查询的相关性
3. **语义偏离度**: 评估建议是微调、相关但不同，还是完全不同方向
4. **查询类型乘数**: 不同查询类型对采纳率的影响

这些因素通过一个综合评分机制决定是否采用特定的自动补全建议。

## 示例输出

模拟生成的旅程包括以下信息：

- 初始和最终查询
- 查询步骤序列，包括每一步的查询词、意图类型和是否受自动补全影响
- 决策点，包括查询变化原因和意图转换
- 自动补全影响度，表示有多少步骤采纳了自动补全建议

## 性能和缓存

为了提高性能和减少对搜索引擎API的请求：

1. 自动补全服务包含缓存机制，可缓存查询结果
2. 缓存过期时间可配置
3. 支持代理设置以解决跨域和访问限制问题

## 最佳实践

1. **平衡LLM和自动补全**: 调整`overallAdoptionRate`参数以平衡LLM预测和自动补全影响
2. **根据用例调整参数**: 不同类型的查询可能需要不同的参数配置
3. **使用真实数据校准**: 使用真实用户数据评估并调整模拟系统
4. **定期更新缓存**: 自动补全建议可能随时间变化，定期刷新缓存以保持数据新鲜

## 限制和注意事项

1. 自动补全服务依赖于外部搜索引擎API，可能受到访问频率限制
2. 不同搜索引擎的自动补全结果可能有显著差异
3. 自动补全采纳行为的模拟基于统计模型，可能无法完全复制个体用户行为的特殊性 