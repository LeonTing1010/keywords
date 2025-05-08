#!/bin/bash

# 组织脚本工具 - 整理项目中的所有脚本到scripts目录
# 将调试脚本、测试脚本等分类归档

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 脚本路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 确保我们在根目录下操作
cd "$ROOT_DIR"

# 创建子目录
mkdir -p "$SCRIPT_DIR/debug"
mkdir -p "$SCRIPT_DIR/test"
mkdir -p "$SCRIPT_DIR/analyze"
mkdir -p "$SCRIPT_DIR/utils"
mkdir -p "$SCRIPT_DIR/monitor"

echo -e "${BLUE}开始整理脚本文件...${NC}"

# 整理分析相关脚本
for file in analyze-*.sh; do
    if [ -f "$file" ]; then
        echo -e "移动分析脚本: ${YELLOW}$file${NC} -> ${GREEN}scripts/analyze/$file${NC}"
        cp "$file" "$SCRIPT_DIR/analyze/"
        git rm -f "$file" 2>/dev/null || rm "$file"
    fi
done

# 整理调试相关脚本
for file in debug*.sh debug*.js debug*.ts; do
    if [ -f "$file" ]; then
        echo -e "移动调试脚本: ${YELLOW}$file${NC} -> ${GREEN}scripts/debug/$file${NC}"
        cp "$file" "$SCRIPT_DIR/debug/"
        git rm -f "$file" 2>/dev/null || rm "$file"
    fi
done

# 整理测试相关脚本
for file in test*.sh test*.js test*.ts; do
    if [ -f "$file" ]; then
        echo -e "移动测试脚本: ${YELLOW}$file${NC} -> ${GREEN}scripts/test/$file${NC}"
        cp "$file" "$SCRIPT_DIR/test/"
        git rm -f "$file" 2>/dev/null || rm "$file"
    fi
done

# 整理监控脚本
for file in monitor*.sh monitor*.js; do
    if [ -f "$file" ]; then
        echo -e "移动监控脚本: ${YELLOW}$file${NC} -> ${GREEN}scripts/monitor/$file${NC}"
        cp "$file" "$SCRIPT_DIR/monitor/"
        git rm -f "$file" 2>/dev/null || rm "$file"
    fi
done

# 整理工具脚本
for file in fix-env.sh update-dependencies.sh; do
    if [ -f "$file" ]; then
        echo -e "移动工具脚本: ${YELLOW}$file${NC} -> ${GREEN}scripts/utils/$file${NC}"
        cp "$file" "$SCRIPT_DIR/utils/"
        git rm -f "$file" 2>/dev/null || rm "$file"
    fi
done

# 创建新的软链接
echo -e "\n${BLUE}创建快捷方式软链接...${NC}"

# 创建analyze软链接
ln -sf "$SCRIPT_DIR/run-analyzer.sh" "$ROOT_DIR/analyze.sh"
echo -e "创建软链接: ${GREEN}analyze.sh${NC} -> ${YELLOW}scripts/run-analyzer.sh${NC}"

# 创建debug软链接
ln -sf "$SCRIPT_DIR/debug/debug-all.sh" "$ROOT_DIR/debug.sh"
echo -e "创建软链接: ${GREEN}debug.sh${NC} -> ${YELLOW}scripts/debug/debug-all.sh${NC}"

# 创建test软链接
ln -sf "$SCRIPT_DIR/test/test-workflow.sh" "$ROOT_DIR/test.sh"
echo -e "创建软链接: ${GREEN}test.sh${NC} -> ${YELLOW}scripts/test/test-workflow.sh${NC}"

# 添加可执行权限
find "$SCRIPT_DIR" -name "*.sh" -exec chmod +x {} \;
chmod +x "$ROOT_DIR/analyze.sh" "$ROOT_DIR/debug.sh" "$ROOT_DIR/test.sh"

echo -e "\n${GREEN}脚本整理完成!${NC}"
echo -e "${YELLOW}主要脚本入口:${NC}"
echo -e "  ${GREEN}./analyze.sh${NC} - 关键词分析工具"
echo -e "  ${GREEN}./debug.sh${NC} - 调试工具"
echo -e "  ${GREEN}./test.sh${NC} - 测试工具"
echo -e "\n所有脚本现在已整理到 ${BLUE}scripts/${NC} 目录下的相应子目录中。" 