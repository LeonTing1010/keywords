#!/bin/bash

# WorkflowController 测试脚本

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印标题
echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}   NeedMiner WorkflowController 测试${NC}"
echo -e "${BLUE}======================================${NC}\n"

# 确保环境变量已配置
if [ ! -f .env ]; then
  echo -e "${YELLOW}警告: .env 文件不存在，正在从示例创建...${NC}"
  cp .env.example .env
  echo -e "${YELLOW}请编辑 .env 文件设置所需的API密钥${NC}"
fi

# 创建日志目录
mkdir -p logs/debug

# 设置测试关键词
if [ $# -eq 0 ]; then
  KEYWORD="智能家居控制系统"
else
  KEYWORD="$1"
fi

echo -e "${GREEN}开始测试工作流控制器...${NC}"
echo -e "关键词: ${YELLOW}${KEYWORD}${NC}\n"

# 使用mock模式运行调试工具测试工作流
echo -e "${YELLOW}启用 LLM Mock 模式${NC}"
export MOCK_LLM=true

# 运行CLI进行测试
echo -e "${GREEN}运行工作流分析...${NC}"
npm run analyze "$KEYWORD" -- --verbose

exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo -e "\n${GREEN}✓ 测试完成!${NC}"
else
  echo -e "\n${RED}✗ 测试失败! 请检查错误信息${NC}"
fi

exit $exit_code 