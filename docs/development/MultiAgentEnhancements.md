# 多Agent协作能力增强说明

## 概述

本文档描述了对NeedMiner系统多Agent协作能力的增强实现，包括Agent间状态共享机制、失败恢复策略和自适应调度功能。这些增强功能显著提高了系统的健壮性、效率和可扩展性。

## 1. Agent间状态共享机制

实现了高效的数据共享机制，使Agent之间能够共享中间结果和分析数据，避免重复计算。

### 核心组件

- **StateRegistry**: 提供中央化的状态管理
  - 支持数据缓存和过期策略
  - 基于事件的状态变更通知
  - 类型安全的数据访问接口
  - 支持跨Agent数据共享

### 主要功能

- **状态获取与存储**: 统一接口存储和获取共享数据
- **状态变更通知**: 支持Agent监听其他Agent的状态变更
- **缓存与性能优化**: 智能缓存减少重复计算
- **缓存清理策略**: 自动过期和LRU淘汰策略

## 2. Agent失败恢复机制

实现了智能的错误处理和恢复策略，提高系统在遇到错误时的健壮性。

### 核心组件

- **RecoveryManager**: 提供失败检测和恢复策略
  - 支持多种失败类型分类
  - 指数退避重试策略
  - 自定义恢复操作
  - 失败历史记录与监控

### 主要恢复策略

- **重试 (Retry)**: 带有指数退避的智能重试
- **跳过 (Skip)**: 忽略非关键步骤的失败
- **回滚 (Rollback)**: 恢复到先前的可靠状态
- **备选方案 (Fallback)**: 使用备选实现或数据
- **中止 (Abort)**: 在严重错误时终止执行

### 失败类型识别

系统能够智能识别不同类型的失败：
- LLM API错误
- 响应解析错误
- 执行超时
- 数据验证错误
- 外部API错误

## 3. Agent自适应调度

实现了基于资源可用性和任务优先级的动态工作流调度机制。

### 核心组件

- **AdaptiveScheduler**: 提供动态工作流调度
  - 资源监控与负载均衡
  - 基于优先级的任务排序
  - 智能并行度调整
  - 自动依赖管理

### 主要功能

- **动态并行度调整**: 根据系统资源动态调整并行执行的Agent数量
- **优先级调度**: 支持Agent优先级设置，确保关键任务优先执行
- **资源监控**: 监控CPU、内存使用情况，避免系统过载
- **依赖关系管理**: 自动处理Agent间的执行依赖，确保正确的执行顺序

## 4. 增强型Agent基类

实现了一个功能丰富的Agent基类，整合了上述所有增强功能。

### 核心功能

- **统一错误处理**: 标准化的错误捕获和分类
- **状态共享集成**: 内置状态共享能力
- **进度报告**: 自动进度更新和状态跟踪
- **结果缓存**: 智能缓存执行结果
- **监听能力**: 监听其他Agent的状态变更

## 5. 自适应工作流

实现了支持动态调整的工作流定义，提高整体系统效率。

### 主要特点

- **条件路由**: 基于状态和配置的动态路由
- **资源自适应**: 根据系统资源调整执行策略
- **模式切换**: 支持快速模式与完整分析模式
- **可配置优先级**: 允许根据需求调整各Agent的优先级

## 实现文件结构

```
src/
├── agents/
│   ├── base/
│   │   └── EnhancedBaseAgent.ts     # 增强型Agent基类
│   ├── keyword/
│   ├── journey/
│   ├── content/
│   └── report/
├── core/
│   ├── coordinator/
│   │   ├── AdaptiveScheduler.ts     # 自适应调度器
│   │   └── RecoveryManager.ts       # 恢复管理器
│   └── registry/
│       └── StateRegistry.ts         # 状态注册中心
├── graphs/
│   └── keyword-analysis/
│       └── AdaptiveKeywordGraph.ts  # 自适应关键词分析图
└── infra/
    └── logger/
        └── index.ts                 # 日志服务
```

## 使用示例

```typescript
// 创建共享组件
const stateRegistry = new StateRegistry();
const recoveryManager = new RecoveryManager();

// 创建增强型Agents
const keywordAgent = new EnhancedKeywordAgent("keywordAgent", tools, { 
  stateRegistry, 
  recoveryManager
});

// 创建自适应工作流
const workflow = createAdaptiveWorkflow(
  {
    keywordAgent,
    journeyAgent,
    contentAgent,
    reportAgent
  },
  {
    fastMode: true,
    maxConcurrentAgents: 3,
    prioritizeKeywordDiscovery: true
  }
);

// 执行工作流
const result = await workflow.graph.invoke({
  keyword: "人工智能应用"
});
```

## 后续优化方向

1. **分布式Agent执行**: 支持跨机器分布式执行Agent
2. **资源预留机制**: 为关键Agent预留系统资源
3. **更精细的资源监控**: 精细监控每个Agent的资源使用
4. **自学习调度策略**: 基于历史执行数据优化调度策略
5. **断点恢复机制**: 支持工作流的断点续执行能力