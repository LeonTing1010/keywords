#!/bin/bash

# batch.sh - 关键词批量分析CLI工具脚本
# 用法: ./batch.sh --keywords "关键词1,关键词2,关键词3" [选项]
#      或 ./batch.sh --file keywords.txt [选项]

# 为脚本设置可执行权限
if [ ! -x "$0" ]; then
    chmod +x "$0"
    echo "已为脚本设置可执行权限"
fi

# 检查是否有参数
if [ "$#" -eq 0 ]; then
    echo "错误: 请提供关键词参数"
    echo "用法: ./batch.sh --keywords \"关键词1,关键词2,关键词3\" [选项]"
    echo "      或 ./batch.sh --file keywords.txt [选项]"
    echo "示例: ./batch.sh --keywords \"智能家居,人工智能,区块链\" --concurrent 2 --fast"
    exit 1
fi

# 构建命令行，确保关键词参数正确传递
CMD="npx ts-node src/cli.ts batch"

# 添加所有参数，特别处理带引号的关键词列表
for arg in "$@"; do
    # 如果是 --keywords 参数，确保把值放在引号中
    if [[ "$arg" == "--keywords" ]]; then
        CMD="$CMD $arg"
    elif [[ "$prev_arg" == "--keywords" ]]; then
        # 关键词列表参数需要特殊处理，确保用引号包裹
        CMD="$CMD \"$arg\""
    else
        CMD="$CMD $arg"
    fi
    prev_arg="$arg"
done

# 输出要执行的命令
echo "正在执行: $CMD"
echo "-------------------------------------------"

# 执行命令
eval $CMD

exit $? 