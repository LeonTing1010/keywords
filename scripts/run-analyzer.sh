#!/bin/bash

# NeuralMiner 综合启动脚本
# 可以启动服务、运行分析，提供多种选项

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 脚本路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 帮助信息
show_help() {
    echo -e "${BLUE}NeuralMiner 综合启动脚本${NC}"
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  analyze <关键词>   运行关键词分析（默认命令）"
    echo "  server            启动LLM服务"
    echo "  chat              以聊天形式运行分析"
    echo "  help              显示帮助信息"
    echo ""
    echo "选项:"
    echo "  --fast            快速分析模式"
    echo "  --gpt4            使用GPT-4模型" 
    echo "  --port=PORT       指定服务端口（仅适用于server命令）"
    echo "  --daemon          以守护进程模式运行服务（仅适用于server命令）"
    echo "  --output=DIR      指定输出目录"
    echo ""
    echo "示例:"
    echo "  $0 analyze '人工智能应用' --fast"
    echo "  $0 server --port=5000 --daemon"
    echo "  $0 chat --gpt4"
}

# 参数解析
COMMAND=""
KEYWORD=""
ARGS=()
PORT="3000"
DAEMON=false
MODEL="gpt-3.5-turbo"
FAST_MODE=false
OUTPUT_DIR="./output"

if [[ $# -eq 0 ]]; then
    COMMAND="help"
else
    case $1 in
        analyze|server|chat|help)
            COMMAND="$1"
            shift
            ;;
        *)
            COMMAND="analyze"
            ;;
    esac
fi

# 解析剩余参数
for arg in "$@"; do
    case $arg in
        --fast)
            FAST_MODE=true
            ARGS+=("-f")
            ;;
        --gpt4)
            MODEL="gpt-4"
            ARGS+=("-m" "gpt-4")
            ;;
        --port=*)
            PORT="${arg#*=}"
            ;;
        --daemon)
            DAEMON=true
            ;;
        --output=*)
            OUTPUT_DIR="${arg#*=}"
            ARGS+=("-o" "${arg#*=}")
            ;;
        -h|--help)
            COMMAND="help"
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

# 如果是analyze命令但没有关键词，交互式询问
if [[ "$COMMAND" == "analyze" && -z "$KEYWORD" ]]; then
    echo -e "${YELLOW}请输入要分析的关键词:${NC}"
    read -p "> " KEYWORD
    
    if [[ -z "$KEYWORD" ]]; then
        echo -e "${RED}错误: 关键词不能为空${NC}"
        exit 1
    fi
fi

# 主功能
case $COMMAND in
    analyze)
        echo -e "${BLUE}======================================${NC}"
        echo -e "${BLUE}     NeuralMiner 关键词分析工具     ${NC}"
        echo -e "${BLUE}======================================${NC}"
        echo ""
        echo -e "${YELLOW}分析关键词:${NC} $KEYWORD"
        echo -e "${YELLOW}使用模型:${NC} $MODEL"
        if $FAST_MODE; then
            echo -e "${YELLOW}模式:${NC} 快速分析"
        else
            echo -e "${YELLOW}模式:${NC} 完整分析"
        fi
        echo -e "${YELLOW}输出目录:${NC} $OUTPUT_DIR"
        echo ""
        
        # 执行分析
        "${SCRIPT_DIR}/interactive-analyze.sh" "$KEYWORD" "${ARGS[@]}"
        ;;
        
    chat)
        # 执行聊天式分析
        "${SCRIPT_DIR}/chatbot-analyze.sh" "$KEYWORD" "${ARGS[@]}"
        ;;
        
    server)
        echo -e "${BLUE}======================================${NC}"
        echo -e "${BLUE}     NeuralMiner LLM服务启动器      ${NC}"
        echo -e "${BLUE}======================================${NC}"
        echo ""
        echo -e "${YELLOW}服务端口:${NC} $PORT"
        echo -e "${YELLOW}使用模型:${NC} $MODEL"
        echo -e "${YELLOW}守护进程模式:${NC} $DAEMON"
        echo ""
        
        SERVER_ARGS=()
        SERVER_ARGS+=("-p" "$PORT")
        SERVER_ARGS+=("-m" "$MODEL")
        
        if $FAST_MODE; then
            echo -e "${YELLOW}启用缓存${NC}"
            SERVER_ARGS+=("-c")
        fi
        
        if $DAEMON; then
            SERVER_ARGS+=("-d")
        fi
        
        # 启动服务
        "${SCRIPT_DIR}/run-server.sh" "${SERVER_ARGS[@]}"
        
        if $DAEMON; then
            echo ""
            echo -e "${GREEN}服务已在后台启动。API端点:${NC}"
            echo -e "  标准API: ${BLUE}http://localhost:${PORT}/api/analyze${NC}"
            echo -e "  流式API: ${BLUE}http://localhost:${PORT}/api/analyze/stream${NC}"
            echo -e "  服务信息: ${BLUE}http://localhost:${PORT}/api/info${NC}"
            echo ""
            echo -e "${YELLOW}使用以下命令查看日志:${NC}"
            echo -e "  pm2 logs llm-service"
            echo -e "${YELLOW}使用以下命令停止服务:${NC}"
            echo -e "  pm2 stop llm-service"
        fi
        ;;
        
    help|*)
        show_help
        ;;
esac

exit $? 