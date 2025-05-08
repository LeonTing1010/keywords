#!/bin/bash

# 交互式分析脚本 - 类似聊天形式运行关键词分析
# 流式返回运行日志的主要信息，直到生成报告

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 帮助信息
show_help() {
    echo -e "${BLUE}交互式关键词分析${NC}"
    echo "用法: $0 <关键词> [选项]"
    echo ""
    echo "选项:"
    echo "  -f, --fast          快速模式，跳过部分分析步骤"
    echo "  -m, --model <模型>   指定使用的LLM模型 (默认: gpt-3.5-turbo)"
    echo "  -o, --output <目录>  指定报告输出目录 (默认: ./output)"
    echo "  -h, --help          显示此帮助信息"
    echo ""
    echo "示例: $0 '人工智能应用' --fast --model gpt-4"
}

# 默认值
FAST_MODE=false
MODEL="deepseek-prover-v2:free"
OUTPUT_DIR="./output"
ENABLE_DATA_STORAGE=true
DATA_DB="./data/analytics.db"

# 分析单个关键词的函数
analyze_keyword() {
    local KEYWORD="$1"
    
    # 处理输出行的函数
    process_output_line() {
        local line="$1"
        # 从CLI输出中提取关键信息并格式化显示
        if [[ $line == *"KeywordAgent"* ]]; then
            echo -e "${BLUE}[关键词Agent]${NC} ${line#*KeywordAgent*}"
        elif [[ $line == *"JourneyAgent"* || $line == *"Journey"* ]]; then
            echo -e "${YELLOW}[旅程Agent]${NC} ${line#*JourneyAgent*}"
        elif [[ $line == *"ContentAgent"* || $line == *"Content"* ]]; then
            echo -e "\033[0;36m[内容Agent]\033[0m ${line#*ContentAgent*}"
        elif [[ $line == *"ReportAgent"* || $line == *"Report"* ]]; then
            echo -e "\033[0;35m[报告Agent]\033[0m ${line#*ReportAgent*}"
        elif [[ $line == *"ERROR"* || $line == *"错误"* ]]; then
            echo -e "${RED}[错误]${NC} ${line#*ERROR*}"
        elif [[ $line == *"分析完成"* || $line == *"报告已保存"* || $line == *"Complete"* || $line == *"完成"* ]]; then
            echo -e "${GREEN}[系统]${NC} $line"
        elif [[ $line == *"INFO"* ]]; then
            # 处理INFO日志
            if [[ $line == *"keyword"* || $line == *"关键词"* ]]; then
                echo -e "${BLUE}[关键词信息]${NC} ${line#*INFO*}"
            elif [[ $line == *"journey"* || $line == *"旅程"* ]]; then
                echo -e "${YELLOW}[旅程信息]${NC} ${line#*INFO*}"
            elif [[ $line == *"content"* || $line == *"内容"* ]]; then
                echo -e "\033[0;36m[内容信息]\033[0m ${line#*INFO*}"
            elif [[ $line == *"report"* || $line == *"报告"* ]]; then
                echo -e "\033[0;35m[报告信息]\033[0m ${line#*INFO*}"
            else
                echo -e "${GREEN}[信息]${NC} ${line#*INFO*}"
            fi
        elif [[ $line == *"DEBUG"* ]]; then
            # 只在有关键信息时显示调试信息
            if [[ $line == *"progress"* || $line == *"进度"* || $line == *"完成"* || $line == *"开始"* ]]; then
                echo -e "${GREEN}[进度]${NC} ${line#*DEBUG*}"
            fi
        elif [[ $line == *"starting"* || $line == *"开始"* || $line == *"初始化"* || $line == *"启动"* ]]; then
            echo -e "${GREEN}[开始]${NC} $line"
        elif [[ $line == *"finished"* || $line == *"完成"* || $line == *"结束"* ]]; then
            echo -e "${GREEN}[完成]${NC} $line"
        elif [[ $line == *"progress"* || $line == *"进度"* ]]; then
            echo -e "${GREEN}[进度]${NC} $line"
        else
            # 打印所有其他输出，确保不丢失信息
            echo -e "${GREEN}[分析中]${NC} $line"
        fi
    }
    
    # 检查必要参数
    if [[ -z "$KEYWORD" ]]; then
        echo -e "${RED}错误: 请提供要分析的关键词${NC}"
        return 1
    fi
    
    # 创建输出目录
    mkdir -p "$OUTPUT_DIR"
    
    # 标准化关键词作为文件名
    SAFE_KEYWORD=$(echo "$KEYWORD" | tr ' ' '_' | tr -cd '[:alnum:]_-')
    TIMESTAMP=$(date +"%Y%m%d%H%M%S")
    REPORT_DIR="${OUTPUT_DIR}/${SAFE_KEYWORD}_${TIMESTAMP}"
    mkdir -p "$REPORT_DIR"
    
    # 记录分析配置
    LOG_FILE="${REPORT_DIR}/analysis.log"
    echo "关键词分析配置" > "$LOG_FILE"
    echo "关键词: $KEYWORD" >> "$LOG_FILE"
    echo "时间: $(date)" >> "$LOG_FILE"
    echo "模型: $MODEL" >> "$LOG_FILE"
    echo "快速模式: $FAST_MODE" >> "$LOG_FILE"
    echo "----------------------------" >> "$LOG_FILE"
    
    # 输出欢迎信息
    clear
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     交互式关键词分析 - NeuralMiner     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}正在开始分析关键词:${NC} $KEYWORD"
    echo -e "${YELLOW}使用模型:${NC} $MODEL"
    echo -e "${YELLOW}输出目录:${NC} $REPORT_DIR"
    if $FAST_MODE; then
        echo -e "${YELLOW}模式:${NC} 快速分析"
    else
        echo -e "${YELLOW}模式:${NC} 完整分析"
    fi
    echo ""
    echo -e "${GREEN}[系统]${NC} 初始化分析环境..."
    sleep 1
    
    # 开始分析过程
    echo -e "${GREEN}[系统]${NC} 开始分析流程，请稍候..."
    
    # 构建CLI参数
    CLI_ARGS=()
    CLI_ARGS+=("--keyword" "$KEYWORD")
    CLI_ARGS+=("--output" "$REPORT_DIR")
    
    if $FAST_MODE; then
        CLI_ARGS+=("--fast")
    fi
    
    # 启用数据存储（如果设置）
    if $ENABLE_DATA_STORAGE; then
        CLI_ARGS+=("--store-data")
        CLI_ARGS+=("--db-path" "$DATA_DB")
        
        echo -e "${GREEN}[系统]${NC} 启用数据持久化，数据库: $DATA_DB"
        
        # 确保数据目录存在
        mkdir -p "$(dirname "$DATA_DB")"
    fi
    
    # 始终设置 LLM_MODEL 环境变量，确保正确传递模型参数
    export LLM_MODEL="$MODEL"
    echo -e "${YELLOW}使用模型: ${NC}$MODEL"
    
    # 使用tee命令来捕获输出并显示到屏幕
    echo -e "${GREEN}[系统]${NC} 正在调用关键词分析引擎..."
    
    # 检查 stdbuf 命令是否可用
    HAS_STDBUF=0
    command -v stdbuf >/dev/null 2>&1 && HAS_STDBUF=1
    
    # 调用实际的CLI工具执行分析
    # 从TypeScript工具中捕获输出内容显示，同时记录到日志
    # 使用stdbuf禁用缓冲，确保实时输出
    export NODE_ENV=production
    export LLM_MODEL="$MODEL"
    
    # 输出调试信息
    echo -e "${GREEN}[系统]${NC} 环境变量: NODE_ENV=$NODE_ENV, LLM_MODEL=$LLM_MODEL"
    echo -e "${GREEN}[系统]${NC} 命令参数: ${CLI_ARGS[@]}"
    echo -e "${GREEN}[系统]${NC} 分析开始..."
    
    if [ $HAS_STDBUF -eq 1 ]; then
        # 使用 stdbuf 禁用缓冲
        echo -e "${GREEN}[系统]${NC} 使用 stdbuf 优化输出缓冲"
        stdbuf -oL -eL npx ts-node src/cli/AdaptiveCli.ts "${CLI_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE" | stdbuf -oL grep --line-buffered -E '.*' | while IFS= read -r line; do
            process_output_line "$line"
        done
    else
        # 如果没有 stdbuf，尝试使用其他方法禁用缓冲
        echo -e "${GREEN}[系统]${NC} stdbuf 不可用，使用标准输出流"
        npx ts-node src/cli/AdaptiveCli.ts "${CLI_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE" | grep --line-buffered -E '.*' | while IFS= read -r line; do
            process_output_line "$line"
        done
    fi
    
    # 查找生成的报告文件
    REPORT_FILE=$(find "$REPORT_DIR" -name "*.html" -o -name "*.md" | head -1)
    TEXT_REPORT="$REPORT_DIR/summary.txt"
    
    if [[ -z "$REPORT_FILE" ]]; then
        # 如果找不到HTML/MD文件，尝试找JSON文件
        REPORT_FILE=$(find "$REPORT_DIR" -name "*.json" | head -1)
    fi
    
    # 从JSON生成简单文本摘要
    if [[ "$REPORT_FILE" == *.json ]]; then
        # 使用jq工具从JSON中提取信息并生成文本摘要
        if command -v jq > /dev/null; then
            jq -r '.mainKeyword + "\n\n长尾关键词:\n" + (.relatedKeywords | join("\n- ")) + "\n\n内容机会:\n" + (.contentGaps | join("\n- "))' "$REPORT_FILE" > "$TEXT_REPORT" 2>/dev/null || echo "无法解析JSON报告" > "$TEXT_REPORT"
        else
            echo "关键词分析摘要 - ${KEYWORD}" > "$TEXT_REPORT"
            echo "请安装jq工具以生成更详细的摘要" >> "$TEXT_REPORT"
        fi
    fi
    
    # 显示完成信息
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           分析任务已完成               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}分析报告已保存至以下位置:${NC}"
    if [[ -n "$REPORT_FILE" ]]; then
        echo -e "1. 完整报告: ${GREEN}${REPORT_FILE}${NC}"
    else 
        echo -e "1. 完整报告: ${RED}未找到${NC}"
    fi
    if [[ -f "$TEXT_REPORT" ]]; then
        echo -e "2. 文本摘要: ${GREEN}${TEXT_REPORT}${NC}"
    fi
    echo -e "3. 分析日志: ${GREEN}${LOG_FILE}${NC}"
    echo ""
    
    if [[ -n "$REPORT_FILE" ]]; then
        echo -e "${GREEN}可以使用以下命令查看报告:${NC}"
        echo -e "open ${REPORT_FILE}"
        echo ""
        
        # 提供运行报告的选项
        read -p "是否立即打开报告? (y/n): " OPEN_REPORT
        if [[ "$OPEN_REPORT" == "y" || "$OPEN_REPORT" == "Y" ]]; then
            open "${REPORT_FILE}"
        fi
    fi
    
    # 提供保存参考路径的选项
    REFERENCE_FILE="last_report.txt"
    read -p "是否保存此报告路径到${REFERENCE_FILE}? (y/n): " SAVE_PATH
    if [[ "$SAVE_PATH" == "y" || "$SAVE_PATH" == "Y" ]]; then
        echo "${REPORT_DIR}" > "${REFERENCE_FILE}"
        echo -e "${GREEN}报告路径已保存到 ${REFERENCE_FILE}${NC}"
    fi
    
    echo -e "${YELLOW}分析\"${KEYWORD}\"完成!${NC}"
    echo ""
    
    # 返回报告路径以便外部使用
    echo "$REPORT_DIR"
}

# 参数解析
KEYWORD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--fast)
            FAST_MODE=true
            shift
            ;;
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            if [[ -z "$KEYWORD" ]]; then
                KEYWORD="$1"
            else
                echo -e "${RED}错误: 未知参数 $1${NC}"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# 检查环境变量
if [[ -z "$OPENAI_API_KEY" ]]; then
    if [[ -f .env ]]; then
        source .env
    else
        echo -e "${RED}错误: 未设置OPENAI_API_KEY环境变量${NC}"
        echo "请在.env文件中设置或直接导出变量"
        exit 1
    fi
fi

# 主循环 - 允许连续分析多个关键词
if [[ -n "$KEYWORD" ]]; then
    # 如果提供了初始关键词，先分析它
    LAST_REPORT=$(analyze_keyword "$KEYWORD")
fi

# 连续分析循环
while true; do
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   交互式关键词分析 - 等待下一个任务   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}选择操作:${NC}"
    echo -e "1. 分析新的关键词"
    echo -e "2. 重新打开上次报告"
    echo -e "3. 退出分析服务"
    echo ""
    read -p "请输入选项(1/2/3): " CHOICE
    
    case $CHOICE in
        1)
            read -p "请输入要分析的关键词: " NEW_KEYWORD
            if [[ -n "$NEW_KEYWORD" ]]; then
                LAST_REPORT=$(analyze_keyword "$NEW_KEYWORD")
            else
                echo -e "${RED}错误: 关键词不能为空${NC}"
            fi
            ;;
        2)
            if [[ -n "$LAST_REPORT" && -d "$LAST_REPORT" ]]; then
                REPORT_FILE=$(find "$LAST_REPORT" -name "*.html" -o -name "*.md" -o -name "*.json" | head -1)
                if [[ -f "$REPORT_FILE" ]]; then
                    echo -e "${GREEN}正在打开上次报告...${NC}"
                    open "$REPORT_FILE"
                else
                    echo -e "${RED}错误: 上次报告文件不存在${NC}"
                fi
            else
                echo -e "${RED}错误: 没有可用的上次报告${NC}"
            fi
            ;;
        3)
            echo -e "${GREEN}感谢使用交互式关键词分析工具!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}错误: 无效的选项${NC}"
            ;;
    esac
    
    echo ""
done 