# KeywordIntent

<p align="center">
  <img src="docs/assets/logo.png" alt="KeywordIntent Logo" width="200"/>
</p>

<p align="center">
  <b>高级用户意图挖掘与搜索行为分析系统</b><br>
  <i>整合搜索引擎数据与AI大模型的先进意图分析平台</i>
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

KeywordIntent 不仅仅是一个关键词挖掘工具，更是一个深度理解用户搜索意图的分析系统。通过融合搜索引擎数据挖掘与大语言模型的认知分析能力，KeywordIntent能够:

- **深入理解用户真实搜索需求**，超越表面关键词分析
- **解析用户完整搜索旅程**，洞察关键决策点和意图变化
- **适配垂直专业领域**，提供行业深度分析
- **发现跨领域关联机会**，识别创新内容空间
- **预测关键词真实商业价值**，实现更精准的投资决策

## 主要功能

### 🧠 AI驱动意图分析

深度分析关键词背后的真实用户意图，识别多维度的搜索目的和需求，提供更精准的内容匹配。

### 🛣️ 用户旅程模拟

模拟用户在搜索引擎中的完整搜索路径，识别查询修改模式和决策点，洞察搜索行为背后的真实需求演变过程。

### 🎯 垂直领域专家

基于大模型的自适应垂直领域分析系统，无需手动构建行业词典，自动适配不同专业领域的知识体系和术语。

### 🔄 跨领域关联分析

发现不同领域间的关键词关联和潜在机会，识别创新内容空间和市场空白点。

### 💎 关键词价值预测

评估关键词的商业价值、竞争程度和转化潜力，为内容投资决策提供数据支持。

### 🔍 迭代式长尾挖掘

通过多轮智能迭代，持续优化挖掘策略，发现高价值长尾关键词。

## 系统架构

KeywordIntent 采用模块化设计，各组件之间通过清晰的接口进行交互，便于扩展和定制。

```
┌────────────────────────────────────────────────────┐
│                  WorkflowController                │
│          (协调各模块执行，管理整体分析流程)          │
└───────┬────────┬────────┬────────┬────────┬────────┘
        │        │        │        │        │
        ▼        ▼        ▼        ▼        ▼
┌────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐
│Discovery│ │ Intent  │ │ Domain  │ │Journey │ │ Value  │
│  挖掘   │ │  意图   │ │  领域   │ │ 旅程   │ │ 价值   │
└────┬───┘ └────┬────┘ └────┬────┘ └────┬───┘ └────┬───┘
     │          │           │           │          │
     └──────────┴───────────┴───────────┴──────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │      LLMServiceHub      │
             │    (统一AI模型交互)      │
             └─────────────────────────┘
```

### 核心组件

1. **工作流控制器** (WorkflowController): 协调各模块执行顺序和数据流转，提供统一分析入口
2. **LLM服务中心** (LLMServiceHub): 管理所有AI模型交互，提供缓存和错误处理
3. **迭代发现引擎** (IterativeDiscoveryEngine): 通过多轮迭代优化挖掘策略，发现长尾关键词
4. **意图分析器** (IntentAnalyzer): 识别关键词背后的用户真实意图和需求
5. **领域专家系统** (DomainExpertSystem): 提供垂直行业专业知识和术语解释
6. **用户旅程模拟器** (UserJourneySim): 模拟完整搜索路径和决策点
7. **跨领域分析器** (CrossDomainAnalyzer): 发现不同领域间的关联和机会
8. **关键词价值预测器** (KeywordValuePredictor): 评估关键词价值和竞争度

详细架构文档请参阅 [系统架构文档](docs/core/architecture.md)。

## 技术特点

- **模块化架构**：各组件可独立工作，也可协同运行
- **大模型驱动**：核心分析由大语言模型提供支持，无需复杂规则库
- **多维度分析**：从意图、领域、用户旅程等多角度分析关键词
- **缓存优化**：智能缓存机制减少API调用，提高性能和降低成本
- **TypeScript实现**：类型安全，提高代码可维护性

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/keywordintent.git
cd keywordintent

# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑.env文件，添加你的API密钥
```

### 使用

```bash
# 基本用法
npm run intent "人工智能"

# 启用用户旅程模拟
npm run intent "智能手机推荐" --journey-sim

# 启用领域专家和跨域分析
npm run intent "机器学习" --domain-expert --cross-domain

# 完整分析
npm run intent "电动汽车" --domain-expert --journey-sim --cross-domain --value-predict
```

## 使用示例

### 意图分析

```bash
npm run intent "最好的智能手机2023" --no-journey-sim
```

输出:
```json
{
  "intents": {
    "comparative": {
      "type": "comparison",
      "confidence": 0.92,
      "features": ["product evaluation", "ranking", "recency"]
    },
    "commercial": {
      "type": "purchase_research",
      "confidence": 0.87,
      "features": ["product research", "buying intent", "evaluation"]
    }
  },
  "recommendations": [
    "创建包含多款智能手机对比的内容",
    "强调2023年的最新功能和创新",
    "提供价格范围和购买渠道信息"
  ]
}
```

### 用户旅程模拟

```bash
npm run intent "学习编程" --journey-sim
```

输出:
```json
{
  "journeyAnalysis": {
    "steps": [
      {
        "query": "学习编程",
        "intentType": "educational_initial",
        "reasoning": "初始探索编程学习途径"
      },
      {
        "query": "初学者学什么编程语言好",
        "intentType": "educational_specific",
        "reasoning": "寻求具体入门建议"
      },
      {
        "query": "Python 入门教程",
        "intentType": "educational_resource",
        "reasoning": "选定特定语言并寻找学习资源"
      }
    ],
    "decisionPoints": [
      {
        "step": 1,
        "reason": "需要更具体的入门指导",
        "intentShift": true
      }
    ]
  }
}
```

## 文档

- [系统架构](docs/core/architecture.md)
- [用户旅程模拟](docs/core/user-journey.md)
- [垂直领域专家](docs/core/domain-expert.md)
- [跨领域分析](docs/core/cross-domain.md)
- [价值预测](docs/core/value-prediction.md)
- [API文档](docs/api/README.md)
- [配置选项](docs/usage/configuration.md)

## 贡献

欢迎贡献代码、报告问题或提出改进建议！请查看[贡献指南](CONTRIBUTING.md)了解更多信息。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
