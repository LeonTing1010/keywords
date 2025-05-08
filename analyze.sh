#!/bin/bash

# analyze.sh - 关键词分析CLI工具脚本
# 用法: ./analyze.sh <关键词> [选项]

# 为脚本设置可执行权限
if [ ! -x "$0" ]; then
    chmod +x "$0"
    echo "已为脚本设置可执行权限"
fi

# 检查是否有关键词参数
if [ "$#" -eq 0 ]; then
    echo "错误: 请提供要分析的关键词"
    echo "用法: ./analyze.sh <关键词> [选项]"
    echo "示例: ./analyze.sh \"智能家居\" --fast"
    exit 1
fi

# 提取关键词参数
KEYWORD="$1"
shift

# 构建命令行
CMD="npx ts-node src/cli.ts analyze --keyword \"$KEYWORD\""

# 添加其他参数
for arg in "$@"; do
    CMD="$CMD $arg"
done

# 输出要执行的命令
echo "正在执行: $CMD"
echo "分析关键词: $KEYWORD"
echo "-------------------------------------------"

# 执行命令
eval $CMD

exit $? 