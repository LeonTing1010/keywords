#!/bin/bash

# 聊天式分析脚本 - 启动交互式关键词分析
# 这是一个更加友好的interactive-analyze.sh包装器

# 标题
echo -e "\033[0;34m======================================\033[0m"
echo -e "\033[0;34m  NeuralMiner 聊天式关键词分析助手  \033[0m"
echo -e "\033[0;34m======================================\033[0m"
echo ""

# 检查工具依赖
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo -e "\033[0;31m错误: 未找到必需工具 '$1'\033[0m"
        return 1
    fi
    return 0
}

check_dependency bc || echo "提示: 请安装bc工具以获得更好的进度显示"

# 简短的用法提示
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "用法: $0 [关键词] [选项]"
    echo ""
    echo "如果不提供关键词，将会交互式询问"
    echo ""
    echo "选项:"
    echo "  --fast     快速分析模式"
    echo "  --gpt4     使用GPT-4模型(默认使用gpt-3.5-turbo)"
    echo "  --output=DIR  指定输出目录"
    echo ""
    echo "示例: $0 \"人工智能\" --fast"
    echo "更多详细选项请查看: scripts/interactive-analyze.sh --help"
    exit 0
fi

# 解析简化参数
KEYWORD=""
ARGS=()

for arg in "$@"; do
    case $arg in
        --fast)
            ARGS+=("-f")
            ;;
        --gpt4)
            ARGS+=("-m" "gpt-4")
            ;;
        --output=*)
            DIR="${arg#*=}"
            ARGS+=("-o" "$DIR")
            ;;
        -*)
            # 直接传递其他参数
            ARGS+=("$arg")
            ;;
        *)
            # 第一个非选项参数作为关键词
            if [[ -z "$KEYWORD" ]]; then
                KEYWORD="$arg"
            else
                ARGS+=("$arg")
            fi
            ;;
    esac
done

# 如果没有提供关键词，交互式询问
if [[ -z "$KEYWORD" ]]; then
    echo -e "\033[0;33m请输入您想要分析的关键词:\033[0m"
    read -p "> " KEYWORD
    
    if [[ -z "$KEYWORD" ]]; then
        echo -e "\033[0;31m错误: 关键词不能为空\033[0m"
        exit 1
    fi
fi

# 打印欢迎信息
echo -e "\033[0;32m开始分析关键词: \033[1;32m$KEYWORD\033[0m"
echo -e "\033[0;36m分析过程将以聊天形式展示...\033[0m"
echo ""

# 等待用户确认开始
read -p "按回车键开始分析..." START

# 使用管道而不是直接执行，确保我们可以执行命令后再次获得控制权
# 执行实际的分析脚本 - 现在interactive-analyze.sh会自动进入连续模式
"$(dirname "$0")/interactive-analyze.sh" "$KEYWORD" "${ARGS[@]}" 