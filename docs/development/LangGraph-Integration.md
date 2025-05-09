# LangGraph 集成指南

## 概述

NeedMiner 系统使用 LangGraph 创建基于多 Agent 的工作流，通过专业化 Agent 之间的协作完成复杂的关键词分析和需求挖掘任务。本文档介绍 LangGraph 的集成方式、主要组件和最新兼容性更新。

## 兼容性要求

NeedMiner 当前版本要求以下依赖版本：

```json
{
  "@langchain/langgraph": "^0.0.8",
  "@langchain/openai": "^0.0.10",
  "langchain": "^0.1.9",
  "langchain-core": "^0.0.4"
}
```

## 核心组件

### 1. BaseAgent

所有专业化 Agent 的基类，提供共享功能和 LangGraph 集成：

```typescript
export abstract class BaseAgent<S = any, R = any> {
  // Agent 核心方法
  public abstract execute(state: S, config?: RunnableConfig): Promise<R>;

  // 创建 StateGraph 节点
  public createGraphNode() {
    return async (state: S) => {
      try {
        const result = await this.execute(state);
        return result;
      } catch (error) {
        console.error(`Error in ${this.name}:`, error);
        throw error;
      }
    };
  }
}
```

### 2. KeywordAnalysisGraph

定义和构建 LangGraph 工作流图：

```typescript
export function createKeywordAnalysisGraph(config: KeywordAnalysisGraphConfig = {}) {
  // 创建 Agent 实例
  const keywordAgent = new KeywordAgent({...});
  const journeyAgent = new JourneyAgent({...});
  const contentAgent = new ContentAgent({...});
  const reportAgent = new ReportAgent({...});
  
  // 创建工作流图
  const builder = new StateGraph({
    channels: {
      keywordDiscovery: { value: null },
      journeySimulation: { value: null },
      contentAnalysis: { value: null },
      reportGeneration: { value: null },
    }
  });
  
  // 添加节点
  builder.addNode("keywordDiscovery", keywordAgent.createGraphNode());
  builder.addNode("journeySimulation", journeyAgent.createGraphNode());
  builder.addNode("contentAnalysis", contentAgent.createGraphNode());
  builder.addNode("reportGeneration", reportAgent.createGraphNode());
  
  // 添加边和路由逻辑
  builder.addEdge("__start__", "keywordDiscovery");
  builder.addConditionalEdges(
    "keywordDiscovery",
    (state: GraphStateType) => state.input.options?.fast ? "contentAnalysis" : "journeySimulation"
  );
  builder.addEdge("journeySimulation", "contentAnalysis");
  builder.addEdge("contentAnalysis", "reportGeneration");
  builder.addEdge("reportGeneration", "__end__");
  
  // 编译工作流
  return builder.compile();
}
```

### 3. 专业化 Agent

系统包含多个专业化 Agent，每个 Agent 负责工作流的特定部分：

- **KeywordAgent**: 关键词发现与需求挖掘
- **JourneyAgent**: 用户搜索旅程模拟
- **ContentAgent**: 内容质量分析与未满足需求识别
- **ReportAgent**: 整合结果生成报告

## 最新兼容性更新

最近对 LangGraph 集成进行了以下关键更新，以确保与 `@langchain/langgraph` 0.0.8 版本的兼容性：

### 1. BaseAgent 更新

- 移除了过时的 `StateGraphArgs` 导入
- 重构 `createGraphNode` 方法，使用新的函数形式返回节点处理函数

```typescript
// 旧版
public createGraphNode(): StateGraphArgs<any, any> {
  return {
    execute: async (state: S) => { ... }
  };
}

// 新版
public createGraphNode() {
  return async (state: S) => { ... };
}
```

### 2. StateGraph 初始化更新

- 更新 channels 定义，添加 `value: null` 属性

```typescript
// 旧版
channels: {
  keywordDiscovery: {},
  journeySimulation: {},
  ...
}

// 新版
channels: {
  keywordDiscovery: { value: null },
  journeySimulation: { value: null },
  ...
}
```

### 3. 边和条件边 API 更新

- 更新 `addEdge` 方法调用格式
- 更新 `addConditionalEdges` 方法调用格式

```typescript
// 旧版
builder.addEdge({
  from: "nodeA",
  to: "nodeB"
});

// 新版
builder.addEdge("nodeA", "nodeB");

// 旧版条件边
builder.addConditionalEdges({
  from: "nodeA",
  to: (state) => "nodeB" 
});

// 新版条件边
builder.addConditionalEdges("nodeA", (state) => "nodeB");
```

### 4. 提示模板参数处理

优化了 Agent 中的提示模板参数处理，解决了数组类型与字符串不匹配的问题：

```typescript
// 旧版 - 直接传递数组（导致类型错误）
const response = await chain.invoke({ 
  keywords,
  searchResults 
});

// 新版 - 将数组转换为文本
const keywordsText = keywords.join('\n');
const response = await chain.invoke({ 
  keywordsText 
});
```

## 临时解决方案

对于遇到 LangGraph 兼容性问题的用户，我们提供了临时解决脚本：

```bash
./analyze-langgraph-fix.sh "your keyword here"
```

此脚本使用简化版本的多 Agent 系统，跳过 LangGraph 相关的兼容性问题。

## 最佳实践

- 确保使用兼容的依赖版本
- 在调试过程中查看详细日志，帮助识别潜在问题
- 在开发自定义 Agent 时，遵循基类模式和类型定义
- 使用正确的 API 格式添加节点和边

## 常见问题解决

1. **TypeScript 类型错误**: 确保正确使用 `createGraphNode` 方法，并且不依赖过时的 `StateGraphArgs` 类型
2. **边定义错误**: 使用新的简化 API 格式定义边和条件边
3. **JSON 解析错误**: 确保所有 LLM 响应都有正确的错误处理和 JSON 解析逻辑
4. **模板参数错误**: 将数组参数转换为字符串形式再传递给模板 