# KeywordPioneer

<p align="center">
  <img src="docs/assets/logo.png" alt="KeywordPioneer Logo" width="200"/>
</p>

<p align="center">
  <b>智能多Agent协作发现高价值市场机会与未满足需求系统</b><br>
  <i>探索真实存在但尚未被解决的高价值用户需求，发现市场蓝海</i>
</p>

<p align="center">
  <a href="#核心价值">核心价值</a> •
  <a href="#主要功能">主要功能</a> •
  <a href="#问题发现框架">问题发现框架</a> •
  <a href="#系统架构">系统架构</a> •
  <a href="#增强版LLM服务">增强版LLM服务</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用示例">使用示例</a> •
  <a href="#文档">文档</a>
</p>

---

## 核心价值

KeywordPioneer是一个基于自适应多Agent协作架构的需求挖掘与价值验证系统。通过融合自适应调度、状态共享和智能恢复机制，KeywordPioneer能够:

- **建立智能、高效、可靠的多Agent协作生态**，支持复杂协同任务的高效执行
- **发现互联网上尚未被满足的真实用户需求**，识别内容空白与市场机会
- **分析需求的真实性与价值**，找出具有长尾价值的潜在商机
- **提供简化解决方案与冷启动MVP方案**，快速验证需求价值
- **智能应对系统错误与资源限制**，确保在复杂环境中的可靠性

## 主要功能

### 🔍 关键词需求挖掘

通过关键词+字母组合的方式，利用搜索引擎自动补全功能发现相关潜在需求，深入洞察用户真实搜索意图。

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

## 问题发现框架

KeywordPioneer的核心创新是**问题发现框架**，这是一个专门用于发现高价值未解决问题的递进式多Agent协作系统。

### 框架设计理念

问题发现框架基于以下关键理念:

1. **递进式问题精炼**: 从初始关键词出发，通过多轮迭代不断提升问题质量和价值
2. **自我反思机制**: Agent能够对自己发现的问题进行质疑和验证，剔除低价值问题
3. **循环反馈**: 高价值问题本身可作为新的关键词，进入下一轮更深入的分析
4. **社区数据整合**: 结合在线论坛和社区数据，捕捉真实用户痛点

### 四重问题验证流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      阶段1      │     │      阶段2      │     │      阶段3      │     │      阶段4      │
│  初始问题发现   │---->│  用户价值验证   │---->│ 解决方案缺口确认│---->│  机会评估与设计 │
│ MarketNeedAgent │     │ JourneySimAgent │     │ SolutionEvAgent │     │ OpportunityAgent│
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                                       │
        │                                                                       │
        └───────────────────────<─────────────────────────────────<────────────┘
                              问题循环反馈与深化
```

### Agent职责明确化

每个Agent在问题发现过程中扮演特定角色:

1. **市场需求探索Agent**: 发现潜在问题，从搜索建议、论坛数据中挖掘初始问题集
2. **用户旅程模拟Agent**: 从用户视角验证问题价值，确认问题是否真实且具有足够满足动机
3. **解决方案评估Agent**: 确认现有解决方案是否充分，评估解决方案质量与市场空缺
4. **机会策略Agent**: 对问题进行优先级排序，设计MVP解决方案，并准备循环反馈

### 问题质量评分体系

问题通过以下维度进行质量评估:

- **真实性**: 是否存在真实用户在搜索此问题 (1-10分)
- **紧迫性**: 用户解决此问题的迫切程度 (1-10分)
- **规模**: 受此问题影响的潜在用户数量 (1-10分)
- **解决缺口**: 现有解决方案的质量差距 (1-10分)
- **实施可行性**: 构建解决方案的技术和资源难度 (1-10分)

### 特定社区与论坛数据

系统能够针对性搜索特定论坛和社区内容，包括:

- Reddit, Stack Overflow, Quora等问答社区
- Twitter/X, LinkedIn等社交媒体平台
- 垂直行业论坛和讨论区
- GitHub Issues和讨论区

## 系统架构

KeywordPioneer采用基于自适应多Agent协作的先进架构设计，包含状态共享、恢复管理和自适应调度三大核心能力。

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
│  │市场需求探索Agent│  │用户旅程模拟Agent│  │解决方案评估Agent│  │
│  │MarketNeedExplorer│  │UserJourneySimul│  │SolutionEvaluator│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ 机会策略Agent   │  │   其他Agent     │                       │
│  │OpportunityStrat │  │   OtherAgents   │                       │
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
│   │   ├── keyword/           # 市场需求探索Agent
│   │   ├── journey/           # 用户旅程模拟Agent  
│   │   ├── content/           # 解决方案评估Agent
│   │   └── report/            # 机会策略Agent
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
5. **专业Agent实现**: 包括市场需求探索Agent、用户旅程模拟Agent、解决方案评估Agent和机会策略Agent

### 专业Agent职责

KeywordPioneer系统由四个专业Agent协作完成需求挖掘与价值验证:

1. **市场需求探索Agent (需求发现专家)**: 
   - 实现高级关键词挖掘策略，超越简单自动补全功能
   - 挖掘多个搜索引擎和平台的搜索模式
   - 识别特定领域的热门问题和新兴需求
   - 量化每个潜在需求的搜索量和竞争指标
   - 将需求分类为清晰的分类体系，方便组织和分析

2. **用户旅程模拟Agent (用户行为分析专家)**:
   - 模拟具有不同搜索行为和偏好的多样化用户角色
   - 映射用户从初始查询到最终行动或放弃的完整旅程
   - 识别搜索旅程中的摩擦点和决策分支
   - 从搜索优化和放弃模式中提取隐含需求
   - 分析跨设备和跨平台的搜索连续性

3. **解决方案评估Agent (解决方案评估专家)**:
   - 对搜索结果进行深度内容缺口分析
   - 评估解决方案的全面性、权威性和可访问性
   - 识别信息质量问题(过时、不完整、矛盾)
   - 根据用户需求维度评估竞争对手解决方案
   - 计算客观需求满足度分数并提供可信度指标

4. **机会策略Agent (机会策略专家)**:
   - 整合和综合所有其他Agent的洞察
   - 基于价值潜力和执行可行性对机会进行优先级排序
   - 设计具有最小可行功能和明确成功指标的MVP解决方案
   - 创建包含时间/资源估计的验证路线图
   - 为每个机会生成有证据支持的商业案例

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

## Schema Validation for LLM Responses

The codebase now includes a robust schema validation framework for LLM responses, providing:

- **Automatic Validation**: LLM outputs are automatically validated against predefined Zod schemas
- **Automatic Retry**: When outputs don't match schemas, the system automatically retries with corrective feedback
- **Type Safety**: Full TypeScript type inference through Zod schemas
- **Unified Logic**: All agents use the same validation logic, reducing code duplication
- **Enhanced Prompts**: Schemas are converted to TypeScript interfaces and included in prompts to guide LLM outputs

To use schema validation in your agent:

```typescript
import { z } from 'zod';
import { AgentLLMServiceExtensions } from '../../core/llm/SchemaValidator';

// Define a schema for your expected response
const responseSchema = z.object({
  analysis: z.string(),
  score: z.number(),
  categories: z.array(z.string())
});

// Use the schema validation extension
const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
  agentLLM,
  prompt,
  'analysis-type',
  responseSchema,
  {
    temperature: 0.7,
    defaultValue: { analysis: '', score: 0, categories: [] }
  }
);

// 'result' is now fully typed and validated!
```

See the [Schema Validation Guide](docs/development/SchemaValidation.md) for detailed usage instructions.

## 快速开始

### 安装

1. 克隆仓库并安装依赖：

```bash
git clone https://github.com/yourusername/keyword-pioneer.git
cd keyword-pioneer
npm install
```

2. 配置环境变量：

复制`.env.example`文件为`.env`，并配置LLM API密钥：

```bash
cp .env.example .env
# 编辑.env文件，填写必要配置
```

### 使用方法

#### 自适应分析

使用自适应多Agent协作分析关键词：

```bash
npm run analyze:adaptive -- --keyword "你的关键词"
```

高级选项：

```bash
npm run analyze:adaptive -- --keyword "你的关键词" --fast --concurrent 5 --prioritize-discovery --format markdown --language zh
```

#### 问题发现分析

专注于找出高价值未解决问题：

```bash
npm run analyze:problem-discovery -- --keyword "你的关键词"
```

高级选项：

```bash
npm run analyze:problem-discovery -- --keyword "你的关键词" --iterations 3 --problems 15 --format markdown --language zh
```

## 使用示例

### 发现创业机会

通过分析热门技术关键词发现潜在创业机会：

```bash
npm run analyze:adaptive -- --keyword "AI应用"
```

### 找出内容差距

分析特定领域的内容满足度，发现内容创作机会：

```bash
npm run analyze:problem-discovery -- --keyword "育儿指南" --iterations 3
```

### 快速市场验证

对产品创意进行快速市场需求验证：

```bash
npm run analyze:adaptive -- --keyword "远程工作工具" --fast
```

## 文档

详细文档请参考[docs](./docs)目录：

- [API文档](./docs/api/README.md)
- [架构设计](./docs/architecture/README.md)
- [使用指南](./docs/usage/README.md)
- [开发指南](./docs/development/README.md)

## 授权

ISC许可证

## 新特性：自适应问题发现

我们新添加了自适应问题发现功能，该功能通过机器学习方法自动调整探索策略和阈值，以更高效地发现高价值问题。

### 主要特点

- **自适应阈值调整**：根据问题质量分布动态调整质量阈值
- **学习型探索策略**：通过多臂老虎机算法自动选择最优探索策略
- **反馈驱动优化**：从Agent反馈中学习以改进决策
- **多维度评估**：考虑证据质量、反馈一致性等多维度因素

### 使用方法

使用提供的脚本运行自适应问题发现：

```bash
./adaptive-discovery.sh '人工智能教育'
```

或者指定自定义配置文件：

```bash
./adaptive-discovery.sh '远程办公' ./configs/custom-config.json
```

### 配置选项

在配置文件中可以自定义以下参数：

```json
{
  "maxIterations": 3,
  "maxProblems": 15,
  "outputDir": "./output/adaptive-discovery",
  "format": "markdown",
  "language": "zh",
  "trackAgents": true,
  "adaptiveMode": true,
  "learningRate": 0.05
}
```