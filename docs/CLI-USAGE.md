# KeywordAlchemist 命令行工具使用指南 🧪

KeywordAlchemist 命令行工具可以帮助您将普通关键词转化为高价值商业洞察与未解决问题。本文档介绍如何安装和使用此工具。

## 安装

确保已安装 Node.js 环境（v14.0.0 或更高版本），然后执行以下步骤：

```bash
# 克隆仓库
git clone https://github.com/yourusername/keyword-alchemist.git
cd keyword-alchemist

# 安装依赖
npm install

# 构建项目
npm run build
```

## 基本用法

KeywordAlchemist CLI 提供了两种主要的使用模式：

1. **单个关键词炼金**：对单个关键词进行深度分析，提炼出高价值洞察
2. **批量关键词处理**：从文件中读取多个关键词并批量分析处理

### 命令概览

```bash
# 显示帮助信息
npm run keywords

# 单个关键词分析
npm run discover <关键词> [选项]

# 批量处理关键词
npm run batch <关键词文件路径> [选项]
```

或者直接使用 `ts-node` 运行：

```bash
# 显示帮助信息
npx ts-node src/cli/index.ts

# 单个关键词分析
npx ts-node src/cli/index.ts discover <关键词> [选项]

# 批量处理关键词
npx ts-node src/cli/index.ts batch <关键词文件路径> [选项]
```

## 单个关键词分析

使用 `discover` 命令来分析单个关键词：

```bash
npm run discover "远程办公"
```

### 可用选项

- `-m, --max-problems <number>`: 最大返回问题数量（默认：5）
- `-c, --min-confidence <number>`: 最小置信度阈值，范围0-1（默认：0.6）
- `-f, --filter-threshold <number>`: 问题过滤阈值，范围0-1（默认：0.6）
- `--fast`: 启用快速模式
- `--disable-autocomplete`: 禁用搜索自动补全
- `--mock-mode`: 使用模拟LLM服务（默认：true）
- `-o, --output <path>`: 保存结果到文件
- `--format <format>`: 输出格式，可选 json, markdown, text（默认：json）

### 示例

```bash
# 分析"远程办公"关键词，最多返回3个洞察
npm run discover "远程办公" -m 3

# 保存结果为Markdown格式
npm run discover "人工智能" -o results/ai_insights.md --format markdown

# 提高问题质量阈值
npm run discover "区块链" -c 0.7 -f 0.8
```

## 批量处理关键词

使用 `batch` 命令从文件批量处理多个关键词：

```bash
npm run batch keywords.txt
```

关键词文件应包含每行一个关键词：

```
远程办公
人工智能
网络安全
区块链
云计算
```

### 可用选项

- `-m, --max-problems <number>`: 每个关键词的最大返回洞察数量（默认：3）
- `-o, --output-dir <path>`: 结果保存目录（默认：./results）
- `--format <format>`: 输出格式，可选 json, markdown, text（默认：json）

### 示例

```bash
# 批量处理关键词，输出到custom_results目录
npm run batch keywords.txt -o custom_results

# 每个关键词最多返回5个洞察，保存为Markdown格式
npm run batch keywords.txt -m 5 --format markdown
```

## 输出格式

KeywordAlchemist 支持三种输出格式：

1. **JSON**（默认）：结构化数据，适合进一步处理
2. **Markdown**：格式化的文档，适合阅读和分享
3. **Text**：纯文本格式，适合简单查看

## 注意事项

- 首次运行可能较慢，因为系统需要初始化各种组件
- 默认情况下使用模拟LLM服务，实际生产环境应配置真实LLM服务
- 分析洞察的质量取决于置信度阈值和过滤阈值的设置 