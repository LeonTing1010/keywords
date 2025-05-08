# 交互式命令行使用指南

本文档详细介绍如何使用NeuralMiner的交互式命令行工具，以聊天形式执行关键词分析并查看实时流式结果。

## 目录

- [综合启动脚本](#综合启动脚本)
- [交互式分析](#交互式分析)
- [聊天式分析](#聊天式分析)
- [流式响应服务](#流式响应服务)
- [输出内容说明](#输出内容说明)
- [常见问题](#常见问题)
- [新特性](#新特性)

## 综合启动脚本

`run-analyzer.sh`是一个多功能启动脚本，提供统一的命令行界面来执行各种分析任务。

### 基本用法

```bash
./scripts/run-analyzer.sh [命令] [选项]
```

### 支持的命令

- `analyze <关键词>` - 运行关键词分析（默认命令）
- `server` - 启动LLM服务
- `chat` - 以聊天形式运行分析
- `help` - 显示帮助信息

### 常用选项

- `--fast` - 启用快速分析模式，跳过部分分析步骤
- `--gpt4` - 使用GPT-4模型进行分析（默认使用gpt-3.5-turbo）
- `--port=PORT` - 指定服务器端口（仅适用于server命令，默认为3000）
- `--daemon` - 以守护进程模式运行服务（仅适用于server命令）
- `--output=DIR` - 指定分析报告的输出目录（默认为./output）

### 示例

```bash
# 分析关键词"人工智能应用"
./scripts/run-analyzer.sh analyze "人工智能应用"

# 以聊天形式分析关键词，使用GPT-4模型
./scripts/run-analyzer.sh chat "数据可视化" --gpt4

# 启动服务器在端口5000，以守护进程模式运行
./scripts/run-analyzer.sh server --port=5000 --daemon

# 快速模式分析，并指定输出目录
./scripts/run-analyzer.sh analyze "区块链技术" --fast --output=./my-reports
```

## 交互式分析

`interactive-analyze.sh`脚本提供了全功能的交互式分析体验，将分析过程以类似聊天的形式展示。

### 基本用法

```bash
./scripts/interactive-analyze.sh <关键词> [选项]
```

### 详细选项

```
-f, --fast          快速模式，跳过部分分析步骤
-m, --model <模型>   指定使用的LLM模型 (默认: gpt-3.5-turbo)
-o, --output <目录>  指定报告输出目录 (默认: ./output)
-h, --help          显示帮助信息
```

### 示例

```bash
# 完整分析"人工智能"关键词
./scripts/interactive-analyze.sh "人工智能"

# 使用GPT-4进行快速分析
./scripts/interactive-analyze.sh "用户体验设计" -f -m gpt-4

# 自定义输出目录
./scripts/interactive-analyze.sh "机器学习算法" -o ./reports/ml
```

## 聊天式分析

`chatbot-analyze.sh`脚本提供了更加用户友好的交互界面，尤其适合初次使用的用户。

### 基本用法

```bash
./scripts/chatbot-analyze.sh [关键词] [选项]
```

如果不提供关键词，脚本会交互式地询问用户输入。

### 简化选项

```
--fast     快速分析模式
--gpt4     使用GPT-4模型
--output=DIR  指定输出目录
```

### 示例

```bash
# 交互式启动聊天分析
./scripts/chatbot-analyze.sh

# 分析特定关键词
./scripts/chatbot-analyze.sh "元宇宙"

# 使用GPT-4进行快速分析
./scripts/chatbot-analyze.sh "云计算" --fast --gpt4
```

## 流式响应服务

可以通过以下方式启动流式响应服务：

```bash
# 前台运行服务
./scripts/run-analyzer.sh server

# 后台运行服务（守护进程模式）
./scripts/run-analyzer.sh server --daemon
```

服务启动后，可以通过以下端点进行访问：

- 标准API: `http://localhost:3000/api/analyze` (POST)
- 流式API: `http://localhost:3000/api/analyze/stream` (POST)
- 服务信息: `http://localhost:3000/api/info` (GET)

### 使用CURL测试

```bash
# 标准分析
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt":"分析人工智能在医疗领域的应用","analysisType":"general"}'

# 流式分析
curl -X POST http://localhost:3000/api/analyze/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"分析人工智能在医疗领域的应用","analysisType":"general"}' 
```

### 使用网页客户端

打开`examples/streaming-client.html`文件在浏览器中查看和测试流式响应。

## 输出内容说明

分析完成后会生成以下文件：

- **HTML报告**：包含完整分析结果的网页报告
- **文本摘要**：简明的文本格式分析摘要
- **JSON数据**：包含结构化分析数据（keywords.json, journey.json, content.json等）
- **分析日志**：记录分析过程中的关键步骤和信息

所有文件都会保存在指定的输出目录中（默认为`./output/[关键词]_[时间戳]/`）。

## 常见问题

### 如何查看守护进程模式下的日志？

使用以下命令查看服务日志：
```bash
pm2 logs llm-service
```

### 如何停止后台运行的服务？

使用以下命令停止服务：
```bash
pm2 stop llm-service
```

### 分析速度太慢，如何加快？

可以使用`--fast`选项启用快速分析模式，这会跳过一些详细分析步骤。

### 如何改进分析质量？

使用`--gpt4`选项切换到GPT-4模型，虽然速度可能较慢，但分析质量通常会有显著提升。

### 如何批量分析多个关键词？

可以创建一个简单的脚本循环调用分析命令，例如：
```bash
for keyword in "关键词1" "关键词2" "关键词3"; do
  ./scripts/run-analyzer.sh analyze "$keyword" --fast
done
```

## 新特性

### 连续分析模式

最新版本添加了连续分析模式，允许您在一个会话中分析多个关键词，而无需重启服务：

```bash
# 启动交互式分析服务
./analyze.sh chat
```

启动后，您可以：
1. 分析新的关键词
2. 重新打开之前生成的报告
3. 退出分析服务

这种方式极大提高了多关键词分析的效率。

### 脚本组织结构

所有脚本现在已经整理到脚本目录中的相应子目录：

```
scripts/
├── analyze/    # 关键词分析相关脚本
├── debug/      # 调试工具脚本
├── test/       # 测试脚本
├── utils/      # 实用工具脚本
├── monitor/    # 监控和日志脚本
└── ...         # 基础脚本
```

主要入口点：
- `./analyze.sh` - 关键词分析工具
- `./debug.sh` - 调试工具
- `./test.sh` - 测试工具

您可以使用整理工具来整理新添加的脚本：
```bash
./scripts/organize-scripts.sh
``` 