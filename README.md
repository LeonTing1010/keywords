# NeuralMiner

<p align="center">
  <img src="docs/assets/logo.png" alt="NeuralMiner Logo" width="200"/>
</p>

<p align="center">
  <b>智能多Agent协作需求挖掘与价值验证系统</b><br>
  <i>强大的多Agent协作机制，发现真实存在但尚未被解决的高价值用户需求</i>
</p>

<p align="center">
  <a href="#核心价值">核心价值</a> •
  <a href="#主要功能">主要功能</a> •
  <a href="#系统架构">系统架构</a> •
  <a href="#增强版LLM服务">增强版LLM服务</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用示例">使用示例</a> •
  <a href="#文档">文档</a>
</p>

---

## 核心价值

NeuralMiner 是一个基于自适应多Agent协作架构的需求挖掘与价值验证系统。通过融合自适应调度、状态共享和智能恢复机制，NeuralMiner能够:

- **建立智能、高效、可靠的多Agent协作生态**，支持复杂协同任务的高效执行
- **发现互联网上尚未被满足的真实用户需求**，识别内容空白与市场机会
- **分析需求的真实性与价值**，找出具有长尾价值的潜在商机
- **提供简化解决方案与冷启动MVP方案**，快速验证需求价值
- **智能应对系统错误与资源限制**，确保在复杂环境中的可靠性

## 主要功能

### 🔍 关键词需求挖掘

通过关键词+字母组合的方式，利用搜索引擎自动补全功能发现相关潜在需求。

### 🛣️ 用户旅程模拟

模拟用户在搜索引擎中的完整搜索路径，识别查询修改模式和决策点，洞察搜索行为背后的真实需求演变过程。

### 📊 需求满足度分析

评估搜索结果对用户需求的满足程度，识别内容质量不足的领域，发现未被充分解决的需求机会。

### 🚀 冷启动MVP方案

为每个未满足需求提供简化解决方案和冷启动MVP方案，包括具体特性、验证指标、时间和资源估计。

### 🔄 自适应多Agent协作

基于系统资源和任务优先级动态调整工作流执行，实现高效的多Agent协作和资源优化利用。

### 🔁 智能错误恢复

内置错误识别和恢复策略，在Agent执行失败时自动应用最佳恢复策略，确保系统可靠性。

### 🔄 状态共享与缓存

强大的Agent间状态共享机制，避免重复计算，提高整体效率，实现更智能的协作决策。

## 系统架构

NeuralMiner 采用基于自适应多Agent协作的先进架构设计，包含状态共享、恢复管理和自适应调度三大核心能力。

```
┌─────────────────────────────────────────────────────────────────┐
│                       工作流管理层                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  自适应关键词   │  │     快速分析    │  │    自定义工作流  │  │
│  │     工作流      │  │     工作流      │  │      模板       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                        核心协调层                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   自适应调度器  │  │  状态注册中心   │  │   恢复管理器    │  │
│  │AdaptiveScheduler│  │  StateRegistry  │  │ RecoveryManager │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                       增强型Agent层                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   关键词Agent   │  │   旅程Agent     │  │   内容Agent     │  │
│  │  KeywordAgent   │  │  JourneyAgent   │  │  ContentAgent   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │   报告Agent     │  │   其他Agent     │                       │
│  │  ReportAgent    │  │   OtherAgents   │                       │
│  └─────────────────┘  └─────────────────┘                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                        基础设施层                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │    日志系统     │  │    搜索引擎     │  │    存储系统     │  │
│  │     Logger      │  │  SearchEngine   │  │    Storage      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

neuralminer/
├── src/
│   ├── agents/                # 所有Agent实现
│   │   ├── base/              # 基础Agent抽象类和增强Agent基类
│   │   ├── keyword/           # 关键词Agent
│   │   ├── journey/           # 用户旅程Agent  
│   │   ├── content/           # 内容分析Agent
│   │   └── report/            # 报告生成Agent
│   │
│   ├── core/                  # 核心服务与功能
│   │   ├── coordinator/       # Agent协调器和恢复管理
│   │   ├── registry/          # 状态注册中心
│   │   ├── llm/               # LLM服务封装
│   │   └── config/            # 系统配置
│   │
│   ├── graphs/                # LangGraph工作流定义
│   │   ├── keyword-analysis/  # 关键词分析工作流
│   │   ├── fast-analysis/     # 快速分析工作流
│   │   └── custom/            # 自定义工作流模板
│   │
│   ├── tools/                 # 共享工具集
│   │   ├── search/            # 搜索相关工具
│   │   ├── analysis/          # 分析工具
│   │   └── utils/             # 通用工具
│   │
│   ├── infra/                 # 基础设施
│   │   ├── search/            # 搜索引擎适配器
│   │   ├── storage/           # 存储服务
│   │   ├── logger/            # 日志系统
│   │   └── cache/             # 缓存机制
│   │
│   ├── types/                 # 全局类型定义
│   │
│   ├── api/                   # API接口
│   │   ├── routes/            # API路由
│   │   ├── controllers/       # 控制器
│   │   └── middleware/        # 中间件
│   │
│   └── cli/                   # 命令行界面
│       ├── commands/          # CLI命令
│       └── formatters/        # 输出格式化
│
├── docs/                      # 文档
│   ├── api/                   # API文档
│   ├── architecture/          # 架构文档
│   ├── assets/                # 资源文件
│   ├── usage/                 # 使用指南
│   └── development/           # 开发指南
│
├── scripts/                   # 实用脚本
├── examples/                  # 使用示例
├── tests/                     # 测试
├── dist/                      # 构建输出
├── .env.example               # 环境变量示例
└── README.md                  # 项目说明

### 核心组件

1. **自适应调度器** (AdaptiveScheduler): 基于资源和优先级动态调整Agent执行，优化系统资源利用
2. **状态注册中心** (StateRegistry): 提供Agent间状态共享和缓存机制，避免重复计算
3. **恢复管理器** (RecoveryManager): 提供智能错误识别和恢复策略，确保系统可靠性
4. **增强型Agent基类** (EnhancedBaseAgent): 集成状态共享、错误恢复和缓存能力的高级Agent基类
5. **专业Agent实现**: 包括关键词Agent、旅程Agent、内容Agent和报告Agent

### 自适应工作流

系统支持基于LangGraph的自适应工作流定义，可以根据实时状态和资源动态调整执行路径：

```typescript
// 创建自适应工作流示例
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

## 技术特点

- **自适应多Agent协作**: 基于资源负载和优先级动态调整Agent执行，实现高效协作
- **状态共享与缓存**: 高效的Agent间数据共享机制，避免重复计算，提高整体效率
- **智能错误恢复**: 自动识别错误类型并应用最佳恢复策略，确保系统稳定性
- **LangGraph工作流支持**: 基于LangGraph构建高效工作流，支持复杂条件路由和状态管理
- **资源自适应优化**: 动态监控系统资源，优化并行度和执行顺序
- **高度可扩展性**: 模块化架构设计，易于扩展新的Agent和功能
- **统一数据交换格式**: 标准化Agent间数据交换，确保系统一致性和可维护性
- **全面日志系统**: 多级别日志记录和监控，便于追踪系统状态和调试

## 增强版LLM服务

本系统最新版本集成了全新的增强版LLM服务，大幅提升了性能、降低了成本，并提供了更好的用户体验。

### 主要特性

#### 1. 降低成本，提升响应速度

- **模型自动选择**：根据任务复杂度自动选择合适的模型，简单任务使用轻量级模型，复杂任务使用强大模型
- **缓存机制**：为常见关键词和查询实现结果缓存，减少重复调用，节省成本
- **流式响应**：使用流式响应，提高用户体验，即时显示生成内容
- **批处理请求**：合并多个小请求为批处理，减少API调用次数

#### 2. 提高工具的实用性和易用性

- **交互式报告**：提供更丰富的报告格式，包括可视化图表、交互式元素
- **定制化输出**：允许用户指定感兴趣的特定分析维度
- **进度反馈**：提供实时分析进度和预估完成时间
- **多种导出格式**：支持导出到不同格式，便于与其他工具集成

#### 3. 持续提升分析质量

- **反馈循环**：收集用户对分析结果的反馈，用于改进模型
- **自我优化**：系统自动评估分析质量，不断调整算法参数
- **A/B测试框架**：自动测试不同分析策略的效果
- **用户行为学习**：根据用户的使用模式调整默认设置和推荐

### 服务模式运行

增强版LLM服务不仅支持作为集成组件使用，还可以作为独立服务运行，便于测试和集成：

```bash
# 安装依赖
npm install express cors

# 启动服务 (前台运行)
npm run server

# 以守护进程模式运行（永久运行）
npm run server:daemon

# 高级配置 (指定端口、模型等)
./scripts/run-server.sh -p 5000 -m gpt-4 -c -s -d
```

### 测试流式响应功能

服务启动后，可以通过以下方式测试流式响应功能:

1. **使用Web界面测试**:
   - 打开 `examples/streaming-client.html` 文件在浏览器中
   - 输入提示词，选择模型和参数，点击"开始分析"
   - 观察实时流式输出和进度更新
   - 分析完成后可以提交反馈

2. **使用API直接测试**:
   - 标准API: `http://localhost:3000/api/analyze` (POST)
   - 流式API: `http://localhost:3000/api/analyze/stream` (POST)
   - 服务信息: `http://localhost:3000/api/info` (GET)

3. **使用CURL测试**:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt":"分析人工智能在医疗领域的应用","analysisType":"general"}'
```

4. **在代码中集成**:
```typescript
// 使用fetch API进行流式请求
const response = await fetch('http://localhost:3000/api/analyze/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '分析智能家居市场趋势',
    options: { model: 'gpt-4' }
  })
});

// 处理流式响应
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  // 处理服务器发送的事件...
}
```

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/neuralminer.git
cd neuralminer

# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑.env文件，添加你的API密钥
```

### 依赖更新

为确保兼容性，可以使用提供的脚本更新依赖：

```bash
# 更新到兼容版本的依赖
./update-dependencies.sh
```

## 使用示例

### 基本分析

```bash
# 使用自适应工作流进行分析
./analyze-adaptive.sh "人工智能应用" --concurrent 3

# 快速模式（跳过用户旅程模拟）
./analyze-adaptive.sh "区块链技术" --fast
```

### 使用增强版LLM服务

```typescript
import { EnhancedLLMService } from './src/core/llm/EnhancedLLMService';

// 创建增强版LLM服务
const llmService = new EnhancedLLMService({
  enableCache: true,
  autoModelSelection: true
});

// 分析关键词
const result = await llmService.analyze(
  '分析关键词"智能家居"的搜索意图和用户需求',
  'keyword-analysis',
  { format: 'json' }
);

console.log(result);
```

### 使用流式响应

```typescript
await llmService.analyze('详细分析智能家居市场趋势', 'streaming-demo', {
  stream: true,
  onChunk: (chunk) => {
    process.stdout.write(chunk); // 实时输出
  }
});
```

### 与LangChain集成

```typescript
import { AgentLLMService } from './src/core/llm/AgentLLMService';

const agentLLM = new AgentLLMService({
  enableCache: true,
  autoModelSelection: true
});

// 使用LangChain兼容接口
const response = await agentLLM.call([
  { role: 'system', content: '你是一个市场分析专家' },
  { role: 'user', content: '分析智能家居市场趋势' }
]);
```

## 文档

详细文档请参考：

- [增强LLM服务文档](docs/core/enhanced-llm-service.md)
- [架构概述](docs/architecture/architecture.md)
- [Agent协作机制](docs/architecture/agent-collaboration.md)
- [状态共享机制](docs/development/state-sharing.md)
- [错误恢复策略](docs/development/error-recovery.md)
- [自适应调度](docs/development/adaptive-scheduling.md)
- [API文档](docs/api/index.md)
- [命令行使用](docs/usage/cli.md)

## 高级配置

通过 .env 文件可以进行高级配置：

```
# LLM配置
OPENAI_API_KEY=sk-your-key
MODEL_NAME=gpt-4-turbo

# 系统配置
MAX_CONCURRENT_AGENTS=5
ENABLE_CACHING=true
RECOVERY_MAX_RETRIES=3

# 日志配置
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
```

## 贡献

欢迎贡献代码、报告问题或提出新功能建议。请参考[贡献指南](CONTRIBUTING.md)。

## 许可

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。

## 命令行使用

### 基本用法

NeuralMiner现在提供了持续运行模式，可以连续分析多个关键词而无需重启服务：

```bash
# 启动交互式分析服务
./analyze.sh chat

# 启动后可以连续分析多个关键词，不会退出服务
```

所有脚本已经整理到了scripts目录下的不同分类中，主要包括：

- `scripts/analyze/` - 关键词分析相关脚本
- `scripts/debug/` - 调试工具脚本
- `scripts/test/` - 测试脚本
- `scripts/utils/` - 实用工具脚本
- `scripts/monitor/` - 监控和日志脚本

为了便于访问，项目提供了以下主要入口点：

- `./analyze.sh` - 关键词分析工具
- `./debug.sh` - 调试工具
- `./test.sh` - 测试工具

### 整理脚本

如果您添加了新的脚本，可以使用整理工具将它们归类：

```bash
# 整理所有散落的脚本到对应目录
./scripts/organize-scripts.sh
```

### 综合启动脚本

全新的综合启动脚本提供了更直观、更友好的命令行体验：

```