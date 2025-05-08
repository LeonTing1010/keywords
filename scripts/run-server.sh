#!/bin/bash

# 运行LLM服务脚本
# 提供永久运行的LLM服务，支持流式响应测试

# 检查是否安装了pm2
if ! command -v pm2 &> /dev/null; then
    echo "正在安装PM2..."
    npm install -g pm2
fi

# 检查是否安装了必要的依赖
if ! npm list express &> /dev/null || ! npm list cors &> /dev/null; then
    echo "正在安装服务器依赖..."
    npm install express cors
fi

# 帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo "运行增强版LLM服务作为永久服务"
    echo ""
    echo "选项:"
    echo "  -p, --port <port>      指定服务器端口 (默认: 3000)"
    echo "  -m, --model <model>    设置默认LLM模型 (默认: gpt-3.5-turbo)"
    echo "  -c, --cache            启用缓存功能"
    echo "  -s, --stream           默认启用流式响应"
    echo "  -d, --daemon           以守护进程模式运行"
    echo "  -h, --help             显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 -p 5000 -m gpt-4 -c -s -d"
}

# 默认值
PORT=3000
MODEL="gpt-3.5-turbo"
CACHE=false
STREAM=false
DAEMON=false

# 参数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        -c|--cache)
            CACHE=true
            shift
            ;;
        -s|--stream)
            STREAM=true
            shift
            ;;
        -d|--daemon)
            DAEMON=true
            shift
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

# 设置环境变量
export SERVER_PORT="$PORT"
export LLM_MODEL="$MODEL"
export ENABLE_CACHE="$CACHE"
export ENABLE_STREAMING="$STREAM"

echo "启动增强版LLM服务..."
echo "端口: $PORT"
echo "模型: $MODEL"
echo "缓存: $CACHE"
echo "流式响应: $STREAM"

# 运行服务
if [ "$DAEMON" = true ]; then
    echo "以守护进程模式运行..."
    pm2 start "ts-node scripts/llm-service.ts" --name "llm-service" -- --port "$PORT"
    echo "服务已启动，使用 'pm2 logs llm-service' 查看日志"
    echo "使用 'pm2 stop llm-service' 停止服务"
else
    echo "在前台运行服务..."
    ts-node scripts/llm-service.ts
fi 