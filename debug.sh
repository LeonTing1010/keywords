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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 版本信息
VERSION="3.0.0"

# 打印标题
echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}   KeywordIntent v${VERSION} 调试模式${NC}"
echo -e "${BLUE}======================================${NC}\n"

# 检查是否提供了关键词参数
if [ $# -lt 1 ]; then
  echo -e "${RED}错误: 缺少关键词参数${NC}"
  echo -e "用法: ${YELLOW}$0 <关键词> [选项]${NC}"
  echo -e "示例: ${YELLOW}$0 \"iphone\" --engine google --proxy http://127.0.0.1:7890${NC}"
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
LOG_FILE="${LOG_DIR}/keywordintent_debug_${TIMESTAMP}.log"

# 清理关键词用于文件名
KEYWORD_CLEAN=$(echo "$1" | tr -d '[:space:]' | tr -c '[:alnum:]' '_' | cut -c 1-30)

# 导出环境变量
export DEBUG=true
export TS_NODE_TRANSPILE_ONLY=true

echo -e "${YELLOW}启动调试会话...${NC}"
echo -e "关键词: ${GREEN}$1${NC}"
echo -e "日志文件: ${BLUE}${LOG_FILE}${NC}"
echo -e "当前目录: ${CYAN}$(pwd)${NC}\n"

# 检查 node_modules 目录是否存在
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}警告: node_modules 目录不存在，可能需要运行 npm install${NC}"
fi

# 检查 node 是否可用
if ! command -v node &> /dev/null; then
  echo -e "${RED}错误: node 命令不可用，请安装最新版本的 Node.js${NC}"
  exit 1
fi

# 运行应用并捕获退出码
echo -e "${GREEN}使用 node 运行 KeywordIntent...${NC}\n"

# 使用 node 直接运行，使用 ts-node/register 钩子
node -r ts-node/register keywordIntent.ts "$@" 2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}✅ 调试会话成功完成${NC}"
  # 尝试获取输出文件路径
  LATEST_OUTPUT=$(ls -t ${OUTPUT_DIR}/keywordintent_*.json 2>/dev/null | head -n 1)
  if [ -n "$LATEST_OUTPUT" ]; then
    echo -e "输出文件: ${CYAN}${LATEST_OUTPUT}${NC}"
    # 计算结果大小
    FILE_SIZE=$(du -h "$LATEST_OUTPUT" | cut -f1)
    echo -e "文件大小: ${YELLOW}${FILE_SIZE}${NC}"
  fi
else
  echo -e "\n${RED}❌ 调试会话出错，退出代码: ${EXIT_CODE}${NC}"
  
  # 尝试分析错误日志文件
  if [ -f "$LOG_FILE" ]; then
    echo -e "\n${YELLOW}错误分析:${NC}"
    # 提取常见错误类型
    grep -i "error\|exception\|failed\|cannot\|timeout" "$LOG_FILE" | tail -5
  fi
  
  echo -e "\n${YELLOW}可能的解决方案:${NC}"
  echo -e "1. 检查网络连接和代理设置"
  echo -e "2. 确认 API 密钥是否配置正确"
  echo -e "3. 查看完整日志文件获取详细信息"
fi

echo -e "\n日志已保存到: ${BLUE}${LOG_FILE}${NC}"
echo -e "${BLUE}======================================${NC}" 