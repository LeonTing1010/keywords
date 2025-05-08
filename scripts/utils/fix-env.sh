#!/bin/bash

# 显示当前环境变量
echo "== 当前环境变量 =="
echo "LLM_MODEL=${LLM_MODEL}"
echo "LLM_BASE_URL=${LLM_BASE_URL}"
echo "DASHSCOPE_API_KEY是否设置: $(if [ ! -z "$DASHSCOPE_API_KEY" ]; then echo "已设置"; else echo "未设置"; fi)"

# 创建.env.local文件
echo "创建.env.local文件..."

cat > .env.local << EOF
# 通义千问配置
LLM_MODEL=qwen-plus
LLM_BASE_URL=https://dashscope.aliyuncs.com/v1/chat/completions
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY:-'你的API密钥'}
OPENAI_API_KEY=${OPENAI_API_KEY:-'你的API密钥'}

# 其他配置
DEBUG=false
SEARCH_ENGINE=baidu
OUTPUT_DIR=./output
OUTPUT_FORMAT=json
LANGUAGE=zh
EOF

echo ".env.local文件已创建"
echo ""
echo "现在你可以运行: npm run analyze \"AI\"" 