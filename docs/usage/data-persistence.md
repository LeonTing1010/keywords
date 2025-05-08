# 数据持久化说明

本项目已移除 SQLite 持久化相关实现。
如需自定义数据持久化方案，请根据实际需求自行扩展。

---

# 数据持久化功能

本文档介绍了 NeuralMiner 关键词分析工具的数据持久化功能，该功能允许系统保存和分析历史数据。

## 功能概述

数据持久化系统使用 SQLite 数据库存储以下类型的数据：

1. **会话数据** - 每次关键词分析的基本信息，如关键词、使用的模型、开始时间等
2. **浏览器数据** - 搜索引擎和网页内容的抓取数据
3. **Agent 数据** - 各种 Agent (KeywordAgent, ContentAgent, JourneyAgent 等) 的输入和输出数据
4. **LLM 数据** - LLM 处理的 prompt 和 completion 内容

此功能有助于：

- 追踪分析历史和性能
- 审计 AI 决策过程
- 提供系统稳定性和可扩展性
- 支持离线分析和报告

## 数据库结构

系统使用以下表结构：

| 表名 | 描述 | 主要字段 |
|------|------|---------|
| `session` | 分析会话 | id, keyword, start_time, end_time, status, model |
| `browser_data` | 浏览器/搜索数据 | id, session_id, url, search_query, content, timestamp |
| `agent_data` | Agent 处理数据 | id, session_id, agent_id, agent_type, input_data, output_data |
| `llm_data` | LLM 调用数据 | id, session_id, model, prompt, completion, tokens |

## 使用方法

### 命令行参数

在使用交互式分析脚本时，数据持久化功能默认是启用的：

```bash
./scripts/interactive-analyze.sh "人工智能" --fast
```

如需指定数据库路径，可以修改脚本中的 `DATA_DB` 变量：

```bash
# 默认值
DATA_DB="./data/analytics.db"
```

### 查看数据

项目提供了数据库查看工具，位于 `scripts/utils/view-database.sh`：

```bash
# 查看统计信息
./scripts/utils/view-database.sh ./data/analytics.db --stats

# 查看特定表内容
./scripts/utils/view-database.sh ./data/analytics.db --table session

# 执行自定义查询
./scripts/utils/view-database.sh ./data/analytics.db --query "SELECT * FROM llm_data WHERE model='gpt-4'"
```

## 编程接口

如果您希望在代码中使用数据持久化系统，可以使用以下类：

1. **DataCaptureInterceptor** - 用于捕获和存储各种类型的数据
   - 位置：`src/infra/storage/DataCaptureInterceptor.ts`
   - 主要方法：`captureBrowserData()`, `captureAgentData()`, `captureLLMData()`

2. **StorageManager** - 管理数据存储和会话
   - 位置：`src/infra/storage/StorageManager.ts`
   - 实现了单例模式和会话管理功能

示例代码：

```typescript
import { DataCaptureInterceptor } from '../infra/storage/DataCaptureInterceptor';

// 创建数据捕获拦截器
const interceptor = new DataCaptureInterceptor('./data/my-analysis.db');
await interceptor.initialize();

// 开始会话
const sessionId = interceptor.startSession('人工智能', 'gpt-4');

// 捕获浏览器数据
interceptor.captureBrowserData({
  url: 'https://example.com/search?q=人工智能',
  content: '搜索结果页面内容...'
});

// 捕获 Agent 数据
interceptor.captureAgentData({
  agentId: 'keyword-agent-1',
  agentType: 'KeywordAgent',
  inputData: '输入数据...',
  outputData: '输出数据...',
  processingTimeMs: 1500
});

// 完成会话
interceptor.completeSession(sessionId, './output/report.html');
```

## 示例程序

项目提供了一个完整的示例程序，展示如何使用数据持久化系统：

```bash
# 运行示例程序
./scripts/run-storage-example.sh
```

示例源代码位于 `src/examples/storage-example.ts`。 