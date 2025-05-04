#!/bin/bash

# 帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo "配置LLM服务参数的命令行工具"
    echo ""
    echo "选项:"
    echo "  -k, --api-key <key>     设置OpenAI API密钥"
    echo "  -b, --base-url <url>    设置API基础URL (默认: https://api.openai.com/v1)"
    echo "  -m, --model <model>     设置LLM模型名称 (默认: gpt-3.5-turbo)"
    echo "  -h, --help             显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 -k sk-xxx -b https://api.openai.com/v1 -m gpt-4"
}

# 参数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--api-key)
            API_KEY="$2"
            shift 2
            ;;
        -b|--base-url)
            BASE_URL="$2"
            shift 2
            ;;
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "错误: 未知选项 $1"
            show_help
            exit 1
            ;;
    esac
done

# 验证必需参数
if [ -z "$API_KEY" ]; then
    echo "错误: 必须提供API密钥 (-k 或 --api-key)"
    exit 1
fi

# 设置环境变量
export OPENAI_API_KEY="$API_KEY"

# 创建或更新配置文件
CONFIG_FILE=".env.local"
touch "$CONFIG_FILE"

# 更新配置
if [ ! -z "$API_KEY" ]; then
    sed -i '' '/^OPENAI_API_KEY=/d' "$CONFIG_FILE"
    echo "OPENAI_API_KEY=$API_KEY" >> "$CONFIG_FILE"
    echo "✓ API密钥已更新"
fi

if [ ! -z "$BASE_URL" ]; then
    sed -i '' '/^LLM_BASE_URL=/d' "$CONFIG_FILE"
    echo "LLM_BASE_URL=$BASE_URL" >> "$CONFIG_FILE"
    echo "✓ API基础URL已更新"
fi

if [ ! -z "$MODEL" ]; then
    sed -i '' '/^LLM_MODEL=/d' "$CONFIG_FILE"
    echo "LLM_MODEL=$MODEL" >> "$CONFIG_FILE"
    echo "✓ 模型已更新"
fi

echo "配置已成功更新到 $CONFIG_FILE"