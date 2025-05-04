#!/bin/bash

# KeywordNova 调试工具脚本
# 用于启动各种调试模式

# 启用严格模式
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印标题
print_header() {
  echo -e "\n${BLUE}======================================${NC}"
  echo -e "${GREEN}     KeywordNova 调试工具${NC}"
  echo -e "${BLUE}======================================${NC}\n"
}

# 打印选项菜单
print_menu() {
  echo -e "${YELLOW}可用的调试选项:${NC}"
  echo -e "  ${GREEN}1.${NC} 浏览器网络日志调试"
  echo -e "  ${GREEN}2.${NC} 浏览器事件调试"
  echo -e "  ${GREEN}3.${NC} 搜索引擎接口调试"
  echo -e "  ${GREEN}4.${NC} LLM 服务调试"
  echo -e "  ${GREEN}5.${NC} 完整调试模式（所有日志）"
  echo -e "  ${GREEN}q.${NC} 退出"
  echo ""
}

# 主函数
main() {
  print_header
  print_menu
  
  read -p "请选择调试模式 [1-5 或 q]: " option
  
  case $option in
    1)
      echo -e "\n${GREEN}启动浏览器网络日志调试...${NC}"
      DEBUG=true DEBUG_NETWORK=true ts-node src/tools/debug-runner.ts network
      ;;
    2)
      echo -e "\n${GREEN}启动浏览器事件调试...${NC}"
      DEBUG=true DEBUG_EVENTS=true ts-node src/tools/debug-runner.ts events
      ;;
    3)
      echo -e "\n${GREEN}启动搜索引擎接口调试...${NC}"
      DEBUG=true DEBUG_SEARCH=true ts-node src/tools/debug-runner.ts search
      ;;
    4)
      echo -e "\n${GREEN}启动 LLM 服务调试...${NC}"
      DEBUG=true DEBUG_LLM=true ts-node src/tools/debug-runner.ts llm
      ;;
    5)
      echo -e "\n${GREEN}启动完整调试模式...${NC}"
      DEBUG=true VERBOSE=true ts-node src/tools/debug-runner.ts all
      ;;
    q|Q)
      echo -e "\n${YELLOW}退出调试工具${NC}"
      exit 0
      ;;
    *)
      echo -e "\n${RED}无效选项: $option${NC}"
      main
      ;;
  esac
}

# 执行主函数
main 