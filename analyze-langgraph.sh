#!/bin/bash
# analyze-langgraph.sh - 使用基于LangGraph的实现执行关键词分析
# 使用方法:
#   ./analyze-langgraph.sh "智能家居控制系统" [--fast] [--no-journey-sim] [--details]
#   ./analyze-langgraph.sh --batch "智能家居,人工智能,区块链" [--fast] [--concurrent 2]
#   ./analyze-langgraph.sh --file keywords.txt [--fast]

# 如果没有第一个参数，显示用法说明
if [ -z "$1" ]; then
  echo "使用方法:"
  echo "  ./analyze-langgraph.sh \"关键词\" [选项]"
  echo "  ./analyze-langgraph.sh --batch \"关键词1,关键词2,关键词3\" [选项]"
  echo "  ./analyze-langgraph.sh --file 关键词文件.txt [选项]"
  echo ""
  echo "选项:"
  echo "  --fast                使用快速模式，简化分析流程"
  echo "  --no-journey-sim      禁用用户旅程模拟"
  echo "  --details             在报告中包含详细信息"
  echo "  --format json/markdown 指定输出格式 (默认: markdown)"
  echo "  --output PATH         指定输出目录"
  echo "  --concurrent N        并行处理的数量 (批处理模式)"
  echo ""
  exit 1
fi

# 检查Node.js环境
if ! [ -x "$(command -v node)" ]; then
  echo "错误: 未安装Node.js" >&2
  exit 1
fi

# 检查ts-node是否安装
if ! [ -x "$(command -v ts-node)" ] && ! [ -x "$(command -v ./node_modules/.bin/ts-node)" ]; then
  echo "错误: 未安装ts-node。请先运行 npm install" >&2
  exit 1
fi

# 加载.env.local环境变量（如果存在）
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# 使用ts-node运行CLI
echo "🚀 启动NeedMiner (LangGraph版)..."
npx ts-node src/presentation/cli/LangGraphCli.ts "$@"

# 检查退出状态
if [ $? -eq 0 ]; then
  echo "✅ 分析完成!"
else
  echo "❌ 分析过程中出现错误"
  exit 1
fi 