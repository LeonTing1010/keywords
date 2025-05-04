#!/bin/bash

# KeywordIntent 调试脚本
# 用于在调试模式下运行应用

# 启用严格模式
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印标题
echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}     KeywordIntent 调试模式${NC}"
echo -e "${BLUE}======================================${NC}\n"

# 检查是否提供了关键词参数
if [ $# -lt 1 ]; then
  echo -e "${RED}错误: 缺少关键词参数${NC}"
  echo -e "用法: ${YELLOW}$0 <关键词> [选项]${NC}"
  echo -e "示例: ${YELLOW}$0 \"iphone\" --engine google --proxy http://127.0.0.1:7890${NC}"
  exit 1
fi

# 创建日志目录
mkdir -p logs/debug

# 获取当前时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/debug/keywordintent_debug_${TIMESTAMP}.log"

echo -e "${YELLOW}启动调试会话...${NC}"
echo -e "关键词: ${GREEN}$1${NC}"
echo -e "日志文件: ${BLUE}${LOG_FILE}${NC}\n"

# 设置环境变量并运行应用
DEBUG=true ts-node --inspect keywordIntent.ts "$@" 2>&1 | tee "$LOG_FILE"

echo -e "\n${GREEN}调试会话完成${NC}"
echo -e "日志已保存到: ${BLUE}${LOG_FILE}${NC}" 