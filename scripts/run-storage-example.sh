#!/bin/bash

# 运行存储系统示例脚本

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  数据持久化系统演示           ${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# 确保目录存在
mkdir -p data
mkdir -p output

# 设置环境变量
export NODE_ENV=development

echo -e "${YELLOW}正在编译 TypeScript 代码...${NC}"
# 编译 TypeScript 代码
npx tsc --noEmit && echo -e "${GREEN}编译通过${NC}" || { echo -e "${RED}编译失败，请修复错误后再试${NC}"; exit 1; }

echo -e "${YELLOW}运行存储示例程序...${NC}"
# 运行示例程序
npx ts-node src/examples/storage-example.ts

echo ""
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  示例数据库生成在 data/ 目录下 ${NC}"
echo -e "${BLUE}=================================${NC}"

# 检查数据库文件
DB_FILE="./data/example.db"
if [ -f "$DB_FILE" ]; then
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    echo -e "${GREEN}数据库文件已创建: ${DB_FILE} (${DB_SIZE})${NC}"
    
    # 如果有 sqlite3 命令行工具，显示一些表信息
    if command -v sqlite3 &> /dev/null; then
        echo ""
        echo -e "${YELLOW}数据库表信息:${NC}"
        echo ""
        
        echo -e "${BLUE}会话表:${NC}"
        sqlite3 "$DB_FILE" "SELECT id, keyword, start_time, status, model FROM session;"
        
        echo ""
        echo -e "${BLUE}浏览器数据表 (行数):${NC}"
        sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM browser_data;"
        
        echo ""
        echo -e "${BLUE}Agent数据表 (行数):${NC}"
        sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM agent_data;"
        
        echo ""
        echo -e "${BLUE}LLM数据表 (行数):${NC}"
        sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM llm_data;"
    else
        echo -e "${YELLOW}提示: 安装 sqlite3 命令行工具可以查看数据库内容${NC}"
    fi
else
    echo -e "${RED}错误: 数据库文件未创建${NC}"
fi

echo ""
echo -e "${GREEN}示例运行完成!${NC}" 