#!/bin/bash

# 启用严格模式
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 版本信息
VERSION="1.0.0"

# 打印标题
echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}   StartupAnalysis v${VERSION} 调试模式${NC}"
echo -e "${BLUE}======================================${NC}\n"

# 检查是否提供了输入文件参数
if [ $# -lt 1 ]; then
  echo -e "${RED}错误: 缺少输入文件参数${NC}"
  echo -e "用法: ${YELLOW}$0 <输入文件> [选项]${NC}"
  echo -e "示例: ${YELLOW}$0 examples/test-input.json --output ./reports${NC}"
  exit 1
fi

# 创建日志目录
LOG_DIR="logs/debug"
mkdir -p "$LOG_DIR"

# 确保output目录存在
OUTPUT_DIR="output"
mkdir -p "$OUTPUT_DIR"

# 获取当前时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/analysis_debug_${TIMESTAMP}.log"

# 导出环境变量
export DEBUG=true
export TS_NODE_TRANSPILE_ONLY=true

echo -e "${YELLOW}启动调试会话...${NC}"
echo -e "输入文件: ${GREEN}$1${NC}"
echo -e "日志文件: ${BLUE}${LOG_FILE}${NC}"
echo -e "当前目录: ${CYAN}$(pwd)${NC}\n"

# 检查 node_modules 目录是否存在
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}警告: node_modules 目录不存在，正在安装依赖...${NC}"
  npm install
fi

# 检查 node 是否可用
if ! command -v node &> /dev/null; then
  echo -e "${RED}错误: node 命令不可用，请安装最新版本的 Node.js${NC}"
  exit 1
fi

# 运行应用并捕获退出码
echo -e "${GREEN}使用 node 运行 StartupAnalysis...${NC}\n"

# 使用 node 直接运行，使用 ts-node/register 钩子
node -r ts-node/register src/cli.ts "$@" 2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}分析完成! 退出码: $EXIT_CODE${NC}"
else
  echo -e "${RED}分析失败! 退出码: $EXIT_CODE${NC}"
fi

echo -e "日志已保存到: ${BLUE}${LOG_FILE}${NC}\n"

exit $EXIT_CODE 