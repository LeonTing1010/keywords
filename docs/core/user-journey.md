# 用户旅程模拟

用户旅程模拟是KeywordIntent系统的一项核心功能，通过模拟用户在搜索引擎中的完整搜索路径，识别查询修改模式和决策点，深入理解用户搜索行为。

## 功能概述

用户旅程模拟器(UserJourneySim)能够:

1. 模拟用户从初始查询开始的完整搜索路径
2. 识别查询修改模式和用户决策点
3. 捕捉意图变化和查询细化过程
4. 分析多个用户旅程以发现共同模式

## 技术实现

系统采用以下方式实现用户旅程模拟:

1. **大模型模拟**: 利用LLM根据初始查询生成真实的搜索路径
2. **搜索引擎数据增强**: 使用实际搜索引擎数据增强模拟真实性
3. **决策点分析**: 识别查询变化和意图转换点
4. **模式提取**: 从多个旅程中提取常见查询修改模式

## 旅程模拟过程

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  初始查询     │─────▶│  LLM模拟路径  │─────▶│ 搜索引擎增强  │
└───────────────┘      └───────────────┘      └───────────────┘
                                                      │
                                                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  结果分析     │◀─────│  模式识别     │◀─────│  决策点分析   │
└───────────────┘      └───────────────┘      └───────────────┘
```

### 模拟步骤详解

1. **初始化**: 用户提供一个初始查询词
2. **路径生成**: LLM基于初始查询和搜索行为知识生成可能的搜索路径
3. **真实数据增强**: 系统使用实际搜索引擎的数据(如建议和结果)增强模拟
4. **决策点分析**: 识别查询变化点并分析变化原因
5. **模式识别**: 识别查询修改的模式(如添加特定词、问题转换等)
6. **结果生成**: 生成完整的用户旅程分析报告

## 数据结构

### 旅程步骤 (JourneyStep)

```typescript
interface JourneyStep {
  query: string;         // 查询词
  intentType: string;    // 意图类型
  expectedResults: string[]; // 期望的结果
  userAction: string;    // 用户行为
  reasoning: string;     // 决策原因
}
```

### 决策点 (DecisionPoint)

```typescript
interface DecisionPoint {
  step: number;          // 步骤索引
  fromQuery: string;     // 原查询
  toQuery: string;       // 新查询
  reason: string;        // 转换原因
  intentShift: boolean;  // 是否发生意图转换
  intentChange?: {       // 意图变化(如果有)
    from: string;
    to: string;
  };
}
```

### 用户旅程 (UserJourney)

```typescript
interface UserJourney {
  initialQuery: string;        // 初始查询
  steps: JourneyStep[];        // 路径步骤
  decisionPoints: DecisionPoint[]; // 决策点
  finalQuery: string;          // 最终查询
  summary: {                   // 摘要信息
    totalSteps: number;        // 总步骤数
    intentShifts: number;      // 意图转换次数
    refinementPatterns: string[]; // 查询精炼模式
    mainIntent: string;        // 主要意图
  };
}
```

## 查询修改模式

系统能够识别以下常见的查询修改模式:

- **添加特定词**: 往查询中添加更具体的描述词
- **重新表述**: 使用同义词或不同表达方式
- **简化查询**: 缩短或简化查询词
- **添加问题词**: 往查询中添加疑问词(如何、为什么等)
- **添加商业意图词**: 添加购买、价格、比较等商业词汇

## 应用场景

1. **内容策略优化**: 根据用户旅程分析优化内容结构和关联
2. **用户意图图谱**: 构建完整的用户意图转换路径图
3. **转化率优化**: 识别用户购买决策路径中的关键点
4. **搜索体验改进**: 基于真实搜索行为优化搜索功能

## 使用示例

```javascript
// 初始化用户旅程模拟器
const journeySim = new UserJourneySim({
  llmService,
  searchEngine,
  verbose: true
});

// 模拟单个旅程
const journey = await journeySim.simulateJourney("智能手机推荐");

// 分析多个旅程的共同模式
const multiJourneyAnalysis = await journeySim.analyzeMultipleJourneys([
  "智能手机推荐",
  "最好的手机2023",
  "手机性价比排行"
]);

// 获取查询演变路径
const queryPath = journeySim.getQueryEvolutionPath(journey);

// 获取意图变化路径
const intentPath = journeySim.getIntentEvolutionPath(journey);
```

## 旅程评估系统

除了模拟用户搜索旅程外，系统还提供了评估模拟旅程质量的功能。评估系统可以衡量模拟旅程与真实用户行为的匹配度，帮助验证模拟结果的有效性和改进模拟策略。

### 评估维度

评估系统关注三个核心维度:

1. **模式相似度(Pattern Similarity)**: 衡量模拟旅程中的查询修改模式是否与真实行为一致
2. **意图转换准确性(Intent Transition Accuracy)**: 验证模拟中的意图变化点是否准确反映用户决策
3. **查询相关性(Query Relevance)**: 衡量模拟查询与真实查询在主题和关键词上的一致性

### 使用方式

可以通过以下方式使用评估系统:

```typescript
// 初始化带评估器的旅程模拟器
const journeySim = new UserJourneySim({
  llmService,
  searchEngine,
  evaluator: new JourneyEvaluator({ verbose: true }),
  verbose: true
});

// 定义真实旅程数据
const realJourneyData = {
  queries: [
    "智能手机",
    "智能手机推荐2023",
    "华为vs苹果手机对比"
  ],
  refinementPatterns: ['addingSpecificity', 'addingCommercialIntent'],
  intentTransitions: [
    {
      fromQuery: "智能手机",
      toQuery: "智能手机推荐2023",
      fromIntent: "information_seeking",
      toIntent: "comparison_seeking"
    }
  ]
};

// 模拟并同时评估旅程
const result = await journeySim.simulateAndEvaluateJourney("智能手机", realJourneyData);

console.log(`旅程评估得分: ${result.metrics.overallScore}`);
console.log(`模式相似度: ${result.metrics.patternSimilarity}`);
console.log(`意图转换准确性: ${result.metrics.intentTransitionAccuracy}`);
console.log(`查询相关性: ${result.metrics.queryRelevance}`);

// 批量评估多个旅程
const batchResults = await journeySim.batchSimulateAndEvaluate(
  ["智能手机", "笔记本电脑", "健身器材"],
  [realJourneyData] // 可以为每个查询提供对应的真实数据
);

console.log(`平均评估得分: ${batchResults.averageMetrics.overallScore}`);
```

### 评估结果解读

评估指标的解读方式:

- **0.8-1.0**: 极高匹配度，模拟与真实行为高度一致
- **0.6-0.8**: 良好匹配度，主要模式和意图转换点一致
- **0.4-0.6**: 中等匹配度，部分模式和转换点一致
- **0.0-0.4**: 低匹配度，模拟与真实行为差异较大

## 自动补全增强

用户旅程模拟支持通过真实搜索引擎的自动补全建议来增强模拟路径，提高其真实性。这项功能基于一个关键观察：真实用户的搜索行为往往受到搜索引擎自动补全建议的引导。

### 工作原理

在旅程模拟的每一步，系统会:

1. 获取当前查询的实际自动补全建议
2. 评估这些建议与当前用户意图的相关性和匹配度
3. 根据配置的采纳参数，决定是否用建议替换LLM预测的下一步查询
4. 记录自动补全建议对旅程的影响程度

### 自动补全参数

可以通过以下参数来配置自动补全采纳行为:

```typescript
// 自动补全采纳参数示例
const autocompleteParams = {
  // 采纳自动补全建议的总体概率
  overallAdoptionRate: 0.65,          // 65%的概率会采纳建议
  
  // 不同位置的建议权重 (索引0是第一位建议)
  positionWeights: [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
  
  // 最低相关性阈值
  relevanceThreshold: 0.5,
  
  // 不同语义偏离度的权重
  semanticDeviation: {
    low: 0.8,    // 微调类型建议的权重
    medium: 0.5, // 相关但方向不同的建议权重
    high: 0.2    // 完全不同方向的建议权重
  },
  
  // 意图对采纳的影响权重
  intentInfluence: 0.7,
  
  // 不同查询类型的采纳倍率
  queryTypeMultipliers: {
    informational: 0.9,  // 信息查询
    commercial: 1.2,     // 商业查询
    transactional: 1.3   // 交易查询
  }
};
```

### 使用示例

```typescript
// 初始化自动补全服务
const autocompleteService = new AutocompleteService({
  defaultEngine: 'baidu',  // 可选 'baidu', 'google', 'bing'
  verbose: true
});

// 初始化旅程模拟器，包含自动补全增强
const journeySim = new UserJourneySim({
  llmService,
  autocompleteService,
  autocompleteParams: DEFAULT_AUTOCOMPLETE_PARAMETERS, // 或自定义参数
  verbose: true
});

// 模拟旅程
const journey = await journeySim.simulateJourney("智能手机");

// 查看自动补全影响
console.log(`自动补全影响度: ${journey.summary.autocompleteInfluence}`);
```

### 评估自动补全采纳行为

系统提供了专门的自动补全评估器，用于评估模拟旅程中的自动补全采纳行为:

```typescript
// 初始化自动补全评估器
const autocompleteEvaluator = new AutocompleteEvaluator();

// 评估自动补全采纳行为
const evaluationResult = autocompleteEvaluator.evaluateAutocompleteAdoption(
  journeys,  // 模拟旅程列表
  realMetrics // 从真实数据中提取的行为指标
);

console.log(`综合相似度: ${evaluationResult.overallSimilarity}`);
```

## 未来扩展

1. **真实用户数据集成**: 与实际用户搜索数据集成，增强模拟准确性
2. **个性化模拟**: 基于不同用户画像的搜索行为模拟
3. **多渠道旅程**: 扩展到社交媒体、语音搜索等多渠道
4. **竞争分析**: 添加竞争对手在不同旅程阶段的可见性分析
5. **高级评估系统**: 使用机器学习模型自动优化模拟参数，提高匹配度 