#!/bin/bash

# 自适应问题发现命令行工具

# 显示帮助信息
function show_help {
  echo "自适应问题发现工具"
  echo "用法: ./adaptive-discovery.sh <关键词> [配置文件路径]"
  echo ""
  echo "参数:"
  echo "  <关键词>          要发现问题的关键词或主题"
  echo "  [配置文件路径]    可选的JSON配置文件路径"
  echo ""
  echo "示例:"
  echo "  ./adaptive-discovery.sh '人工智能教育'"
  echo "  ./adaptive-discovery.sh '远程办公' ./configs/custom-config.json"
  exit 0
}

# 如果没有参数或者是帮助参数
if [ "$1" == "" ] || [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
  show_help
fi

# 运行TypeScript脚本
echo "启动自适应问题发现: $1"
npm run adaptive-discovery -- "$1" "$2"

# 检查执行结果
if [ $? -eq 0 ]; then
  echo "问题发现流程成功完成！"
else
  echo "问题发现流程执行失败，请查看日志获取更多信息。"
  exit 1
fi 