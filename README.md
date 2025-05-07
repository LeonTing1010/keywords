# NeedMiner

<p align="center">
  <img src="docs/assets/logo.png" alt="NeedMiner Logo" width="200"/>
</p>

<p align="center">
  <b>未满足需求挖掘与价值验证系统</b><br>
  <i>发现真实存在但尚未被解决的高价值用户需求</i>
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

NeedMiner 是一个未满足需求挖掘与价值验证系统。通过融合搜索引擎数据挖掘与大语言模型的认知分析能力，NeedMiner能够:

- **发现互联网上尚未被满足的真实用户需求**，识别内容空白与市场机会
- **分析需求的真实性与价值**，找出具有长尾价值的潜在商机
- **提供简化解决方案与冷启动MVP方案**，快速验证需求价值

## 主要功能

### 🔍 关键词需求挖掘

通过关键词+字母组合的方式，利用搜索引擎自动补全功能发现相关潜在需求。

### 🛣️ 用户旅程模拟

模拟用户在搜索引擎中的完整搜索路径，识别查询修改模式和决策点，洞察搜索行为背后的真实需求演变过程。

### 📊 需求满足度分析

评估搜索结果对用户需求的满足程度，识别内容质量不足的领域，发现未被充分解决的需求机会。

### 🚀 冷启动MVP方案

为每个未满足需求提供简化解决方案和冷启动MVP方案，包括具体特性、验证指标、时间和资源估计。

## 系统架构

NeedMiner 采用基于多Agent协作的模块化设计，各专业化Agent之间通过标准化接口和统一协调器进行协作。

```
┌────────────────────────────────────────────────────┐
│               AgentCoordinator                     │
│        (Agent协调与任务编排中心)                     │
└───────┬─────────────────┬───────────────┬──────────┘
        │                 │               │        
        ▼                 ▼               ▼        
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ KeywordAgent   │ │ JourneyAgent   │ │ ContentAgent   │
│ (关键词挖掘)   │ │ (用户旅程模拟) │ │ (内容分析)     │
└────────────────┘ └────────────────┘ └────────────────┘
        │                 │               │
        └─────────────────┼───────────────┘
                          ▼
                 ┌─────────────────┐
                 │  ReportAgent    │
                 │  (报告生成)    │
                 └─────────────────┘
                          │
                          ▼
             ┌─────────────────────────────────┐
             │           ToolRegistry           │
             │    (工具注册与共享能力中心)      │
             └─────────────────────────────────┘
```

### 核心组件

1. **Agent协调器** (AgentCoordinator): 管理Agent生命周期、分配任务、处理通信
2. **工具注册中心** (ToolRegistry): 提供共享工具和能力，供各Agent调用
3. **关键词Agent** (KeywordAgent): 负责关键词发现和需求挖掘
4. **旅程Agent** (JourneyAgent): 负责用户搜索行为模拟和路径分析
5. **内容Agent** (ContentAgent): 负责内容质量评估和未满足需求识别
6. **报告Agent** (ReportAgent): 负责整合分析结果，生成最终报告

## 技术特点

- **多Agent协作架构**：各专业化Agent通过标准化接口协作，高度模块化与可扩展
- **能力工具化**：系统核心能力以工具形式注册，便于跨Agent调用和能力复用
- **需求发现驱动**：专注于发现和验证真实的未满足需求，而非仅优化已有内容
- **大模型分析**：利用大语言模型分析内容质量和需求满足度，提供精准洞察
- **价值验证导向**：为每个发现的需求提供可行的MVP方案，快速验证商业价值
- **全面日志系统**：多级别日志记录，便于追踪分析流程和调试

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/needminer.git
cd needminer

# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑.env文件，添加你的API密钥
```

### 使用

```bash
# 基本用法（百度搜索引擎）
npm run intent "智能家居控制系统"

# 使用谷歌搜索引擎
npm run intent "远程医疗服务" --engine google

# 禁用用户旅程模拟
npm run intent "可持续时尚" --no-journey-sim

# 使用代理服务器
npm run intent "虚拟现实课程" --proxy http://127.0.0.1:7890

# 生成详细的未满足需求分析报告
npm run intent "电动汽车充电解决方案" --verbose
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
  --no-autocomplete          禁用自动补全增强（默认开启）
  --autocomplete-engine <引擎> 指定自动补全使用的搜索引擎（默认与主搜索引擎相同）
  
输出选项:
  --format <格式>            输出格式(json, markdown, csv，默认: json)
  --show-details             在报告中显示分析过程详情

高级选项:
  --model <模型名称>         指定LLM模型(默认: gpt-4)
  --verbose                  输出详细日志
  --log-level <级别>         设置日志级别(error, warn, info, debug, trace)
```

## 使用示例

### 未满足需求发现与验证

```bash
npm run intent "智能家居控制系统"
```

输出示例（部分）:
```json
{
  "keyword": "智能家居控制系统",
  "discoveredKeywords": [
    "智能家居控制系统设计论文",
    "智能家居控制系统哪个品牌好",
    "智能家居控制系统软件设计",
    "小爱同学智能家居控制系统"
  ],
  "unmetNeeds": [
    {
      "keyword": "智能家居控制系统mcu控制空调温控Python代码",
      "isUnmetNeed": true,
      "contentQuality": 0.4,
      "reason": "搜索结果中虽然提到了智能空调温度控制系统和控制器，但没有具体涉及使用MCU控制空调温控的Python代码。这表明当前的内容完整性不足，无法全面覆盖用户需求。"
    }
  ]
}
```

## 文档

- [系统架构](docs/architecture/architecture.md)
- [未满足需求分析](docs/core/unmet-needs-analysis.md)
- [API文档](docs/api/api.md)
- [配置选项](docs/usage/configuration.md)

## 贡献

欢迎贡献代码、报告问题或提出改进建议！请查看[贡献指南](CONTRIBUTING.md)了解更多信息。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
