#!/bin/bash

# 确保logs/debug目录存在
mkdir -p logs/debug

# 设置DEBUG环境变量为true并启动程序
export DEBUG=true

# 可以传递命令行参数
if [ $# -eq 0 ]
then
  # 如果没有参数，使用默认的测试关键词
  npx ts-node keywordsTool.ts "test keyword" --temp-browser
else
  # 如果有参数，传递所有参数
  npx ts-node keywordsTool.ts "$@"
fi 