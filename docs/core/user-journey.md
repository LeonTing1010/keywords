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

## 未来扩展

1. **真实用户数据集成**: 与实际用户搜索数据集成，增强模拟准确性
2. **个性化模拟**: 基于不同用户画像的搜索行为模拟
3. **多渠道旅程**: 扩展到社交媒体、语音搜索等多渠道
4. **竞争分析**: 添加竞争对手在不同旅程阶段的可见性分析 