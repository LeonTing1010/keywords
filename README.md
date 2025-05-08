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
  <a href="#技术特点">技术特点</a> •
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

### 使用示例

```bash
# 基本分析
npm run analyze --keyword "智能家居控制系统"

# 使用自适应工作流进行分析
./analyze-adaptive.sh "人工智能应用" --concurrent 3

# 快速模式（跳过用户旅程模拟）
./analyze-adaptive.sh "区块链技术" --fast

# 优先关键词发现
./analyze-adaptive.sh "元宇宙" --prioritize-discovery
```

### 高级配置

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

## 文档

详细文档请参考：

- [架构概述](docs/architecture/architecture.md)
- [Agent协作机制](docs/architecture/agent-collaboration.md)
- [状态共享机制](docs/development/state-sharing.md)
- [错误恢复策略](docs/development/error-recovery.md)
- [自适应调度](docs/development/adaptive-scheduling.md)
- [API文档](docs/api/index.md)
- [命令行使用](docs/usage/cli.md)
- [路线图](docs/development/RoadMap.md)

## 贡献

欢迎贡献代码、报告问题或提出新功能建议。请参考[贡献指南](CONTRIBUTING.md)。

## 许可

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。
