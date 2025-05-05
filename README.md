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

KeywordIntent 是一个关键词挖掘与用户搜索意图分析系统。通过融合搜索引擎数据挖掘与大语言模型的认知分析能力，KeywordIntent能够:

- **发现相关长尾关键词**，拓展内容策略
- **解析用户完整搜索旅程**，洞察关键决策点和意图变化
- **提供精准的内容建议**，满足用户真实搜索需求

## 主要功能

### 🔍 简化版长尾关键词挖掘

通过关键词+字母组合的方式，利用搜索引擎自动补全功能发现相关长尾关键词。

### 🛣️ 用户旅程模拟

模拟用户在搜索引擎中的完整搜索路径，识别查询修改模式和决策点，洞察搜索行为背后的真实需求演变过程。

## 系统架构

KeywordIntent 采用模块化设计，各组件之间通过清晰的接口进行交互，便于扩展和定制。

```
┌────────────────────────────────────────────────────┐
│                  WorkflowController                │
│          (协调各模块执行，管理整体分析流程)          │
└───────┬────────────────────────────────┬───────────┘
        │                                │        
        ▼                                ▼        
┌────────────────┐                 ┌────────────────┐
│SimpleKeywordDis│                 │  UserJourneySim │
│     covery     │                 │                │
└────────────────┘                 └────────────────┘
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
3. **简单关键词挖掘器** (SimpleKeywordDiscovery): 通过关键词+字母组合方式发现长尾关键词
4. **用户旅程模拟器** (UserJourneySim): 模拟完整搜索路径和决策点，包含动态意图分析

## 技术特点

- **简化架构**：专注于核心功能，提高系统稳定性和易用性
- **大模型驱动**：核心分析由大语言模型提供支持，无需复杂规则库

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
# 基本用法（百度搜索引擎）
npm run intent "人工智能"

# 使用谷歌搜索引擎
npm run intent "人工智能" --engine google

# 禁用用户旅程模拟
npm run intent "智能手机推荐" --no-journey-sim

# 使用代理服务器
npm run intent "最佳笔记本" --proxy http://127.0.0.1:7890
```

### 主要命令行参数

```
搜索引擎选项:
  --engine, -e <引擎名称>     使用指定的搜索引擎(默认: baidu)
                            可选值: baidu, google
  --proxy, -p <代理地址>     使用指定的代理服务器
  --output, -o <文件路径>    指定输出文件路径

功能模块选项:
  --no-journey-sim           禁用用户旅程模拟（默认开启）
  
高级选项:
  --model <模型名称>         指定LLM模型(默认: gpt-4)
  --format <格式>            输出格式(json, markdown, csv，默认: json)
```

## 使用示例

### 关键词挖掘与用户旅程模拟

```bash
npm run intent "最好的智能手机2023"
```

输出:
```json
{
  "keyword": "最好的智能手机2023",
  "discoveredKeywords": [
    "最好的智能手机2023",
    "最好的智能手机2023排行榜",
    "2023年十大智能手机排名",
    "最好的智能手机2023前十名"
  ],
  "journeyAnalysis": {
    "steps": [
      {
        "query": "最好的智能手机2023",
        "intentType": "comparative_research",
        "reasoning": "初始探索最佳智能手机"
      },
      {
        "query": "2023旗舰手机对比",
        "intentType": "detailed_comparison",
        "reasoning": "希望获得更详细的对比信息"
      }
    ],
    "decisionPoints": [
      {
        "step": 1,
        "reason": "需要更具体的比较信息",
        "intentShift": true
      }
    ]
  }
}
```

### 仅关键词挖掘（禁用旅程模拟）

```bash
npm run intent "学习编程" --no-journey-sim
```

输出:
```json
{
  "keyword": "学习编程",
  "discoveredKeywords": [
    "学习编程的网站",
    "学习编程的app",
    "学习编程的基础知识",
    "学习编程哪个语言好",
    "学习编程的步骤"
  ],
  "summary": {
    "keywordCounts": {
      "total": 27,
      "byIteration": [5, 3, 4, 2, 5, 8]
    }
  }
}
```

## 文档

- [系统架构](docs/core/architecture.md)
- [用户旅程模拟](docs/core/user-journey.md)
- [API文档](docs/api/api.md)
- [配置选项](docs/usage/configuration.md)

## 贡献

欢迎贡献代码、报告问题或提出改进建议！请查看[贡献指南](CONTRIBUTING.md)了解更多信息。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
