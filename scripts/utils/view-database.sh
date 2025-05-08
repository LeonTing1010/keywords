#!/bin/bash

# 数据库查看工具

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 默认数据库路径
DEFAULT_DB_PATH="./data/analytics.db"
DB_PATH=${1:-$DEFAULT_DB_PATH}

# 帮助信息
show_help() {
    echo -e "${BLUE}数据库查看工具${NC}"
    echo "用法: $0 [数据库路径] [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示此帮助信息"
    echo "  -s, --stats         显示数据库统计信息"
    echo "  -t, --table <表名>  查看指定表的内容"
    echo "  -q, --query <SQL>   执行自定义SQL查询"
    echo ""
    echo "示例: $0 ./data/analytics.db -t session"
    echo "      $0 -q \"SELECT * FROM llm_data WHERE model='gpt-4'\""
}

# 检查SQLite3是否安装
check_sqlite() {
    if ! command -v sqlite3 &> /dev/null; then
        echo -e "${RED}错误: 未找到 sqlite3 命令${NC}"
        echo -e "${YELLOW}请安装 SQLite3 命令行工具后再使用此脚本${NC}"
        exit 1
    fi
}

# 显示数据库表列表
show_tables() {
    echo -e "${BLUE}数据库表:${NC}"
    sqlite3 "$DB_PATH" ".tables"
}

# 显示表结构
show_schema() {
    echo -e "${BLUE}数据库结构:${NC}"
    sqlite3 "$DB_PATH" ".schema"
}

# 显示统计信息
show_stats() {
    echo -e "${BLUE}数据库统计信息:${NC}"
    echo ""
    
    echo -e "${YELLOW}会话数量:${NC}"
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM session;"
    
    echo -e "${YELLOW}浏览器数据条数:${NC}"
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM browser_data;"
    
    echo -e "${YELLOW}Agent数据条数:${NC}"
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM agent_data;"
    
    echo -e "${YELLOW}LLM数据条数:${NC}"
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_data;"
    
    echo ""
    echo -e "${YELLOW}LLM模型使用情况:${NC}"
    sqlite3 "$DB_PATH" "SELECT model, COUNT(*) FROM llm_data GROUP BY model;"
    
    echo ""
    echo -e "${YELLOW}Agent类型统计:${NC}"
    sqlite3 "$DB_PATH" "SELECT agent_type, COUNT(*) FROM agent_data GROUP BY agent_type;"
}

# 查看表内容
view_table() {
    local table_name=$1
    echo -e "${BLUE}表 '$table_name' 内容:${NC}"
    
    case "$table_name" in
        "session")
            sqlite3 "$DB_PATH" "SELECT id, keyword, start_time, end_time, status, model FROM session;"
            ;;
        "browser_data")
            sqlite3 "$DB_PATH" "SELECT id, session_id, url, search_query, timestamp FROM browser_data;"
            ;;
        "agent_data")
            sqlite3 "$DB_PATH" "SELECT id, session_id, agent_id, agent_type, timestamp FROM agent_data;"
            ;;
        "llm_data")
            sqlite3 "$DB_PATH" "SELECT id, session_id, model, tokens, processing_time_ms, timestamp FROM llm_data;"
            ;;
        *)
            sqlite3 "$DB_PATH" "SELECT * FROM $table_name;"
            ;;
    esac
}

# 执行自定义查询
run_query() {
    local query=$1
    echo -e "${BLUE}执行查询:${NC} $query"
    sqlite3 "$DB_PATH" "$query"
}

# 主函数
main() {
    check_sqlite
    
    # 检查数据库文件是否存在
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}错误: 数据库文件不存在: $DB_PATH${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}数据库文件: $DB_PATH${NC}"
    
    # 解析命令行参数
    if [ "$#" -eq 0 ]; then
        show_tables
        echo ""
        show_stats
    else
        while [ "$#" -gt 0 ]; do
            case "$1" in
                -h|--help)
                    show_help
                    exit 0
                    ;;
                -s|--stats)
                    show_stats
                    shift
                    ;;
                -t|--table)
                    if [ -n "$2" ]; then
                        view_table "$2"
                        shift 2
                    else
                        echo -e "${RED}错误: --table 选项需要参数${NC}"
                        exit 1
                    fi
                    ;;
                -q|--query)
                    if [ -n "$2" ]; then
                        run_query "$2"
                        shift 2
                    else
                        echo -e "${RED}错误: --query 选项需要参数${NC}"
                        exit 1
                    fi
                    ;;
                *)
                    # 如果参数不是选项，假设是数据库路径
                    if [ -f "$1" ]; then
                        DB_PATH="$1"
                        shift
                    else
                        echo -e "${RED}错误: 未知选项或文件不存在: $1${NC}"
                        exit 1
                    fi
                    ;;
            esac
        done
    fi
}

# 调用主函数，传递所有命令行参数
main "$@" 