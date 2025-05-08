#!/bin/bash
# debug-all.sh - 综合调试脚本
# 
# 此脚本运行一系列测试来诊断报告生成功能的问题，
# 包括LLM调用、JSON解析和文件生成等方面

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 时间戳
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_DIR="logs/debug"
LOG_FILE="${LOG_DIR}/debug_run_${TIMESTAMP}.log"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 日志函数
log() {
  echo -e "${BLUE}[$(date +"%H:%M:%S")]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# 运行命令并记录输出
run_cmd() {
  log "运行命令: $1"
  echo "$ $1" >> "$LOG_FILE"
  eval "$1" 2>&1 | tee -a "$LOG_FILE"
  
  # 获取命令的退出状态
  status=${PIPESTATUS[0]}
  if [ $status -eq 0 ]; then
    log_success "命令执行成功 (退出状态: $status)"
  else
    log_error "命令执行失败 (退出状态: $status)"
  fi
  return $status
}

# 开始调试
log "=== 开始综合调试流程 ==="
log "日志文件: $LOG_FILE"

# 1. 环境检查
log "\n=== 环境检查 ==="
log "Node.js 版本:"
run_cmd "node --version"
log "NPM 版本:"
run_cmd "npm --version"

# 2. 目录和文件权限检查
log "\n=== 目录和文件权限检查 ==="
log "输出目录权限:"
run_cmd "ls -la ./output"
log "日志目录权限:"
run_cmd "ls -la ./logs"

# 3. 运行简单的报告生成测试
log "\n=== 运行报告生成测试 ==="
log "运行独立的报告生成调试脚本:"
run_cmd "node debug-report.js"

# 4. 检查最新生成的报告
log "\n=== 检查生成的报告 ==="
if [ -f "output/latest_report.md" ]; then
  log_success "成功找到 Markdown 报告: output/latest_report.md"
  log "报告内容预览 (前10行):"
  run_cmd "head -n 10 output/latest_report.md"
  log "报告大小:"
  run_cmd "wc -l output/latest_report.md"
else
  log_error "未找到最新的 Markdown 报告"
fi

if [ -f "output/latest_report.json" ]; then
  log_success "成功找到 JSON 报告: output/latest_report.json"
  log "报告内容预览:"
  run_cmd "head -n 10 output/latest_report.json"
else
  log_warning "未找到最新的 JSON 报告"
fi

# 5. 启动监控工具
log "\n=== 启动LLM日志监控 ==="
log "在后台启动监控工具..."
run_cmd "node monitor-llm-logs.js > ${LOG_DIR}/monitor_${TIMESTAMP}.log 2>&1 &"
MONITOR_PID=$!
log "监控工具进程ID: $MONITOR_PID"

# 6. 运行真实的分析脚本
log "\n=== 运行真实分析脚本 (带调试标志) ==="
log "请注意: 在另一个终端查看 ${LOG_DIR}/monitor_${TIMESTAMP}.log 以获取实时LLM日志监控"
log "开始真实分析，这可能需要几分钟时间..."

# 使用正确的分析脚本
run_cmd "NODE_ENV=development FORMAT=markdown ts-node src/cli/AdaptiveCli.ts analyze --keyword 'AI Agent' --debug"

# 7. 检查结果
log "\n=== 检查分析结果 ==="
# 查找最新生成的报告文件
LATEST_REPORT=$(find ./output -type f -name "*.md" -o -name "*.json" | sort -r | head -n 1)
if [ -n "$LATEST_REPORT" ]; then
  log_success "找到最新报告: $LATEST_REPORT"
  log "报告内容预览:"
  run_cmd "head -n 10 \"$LATEST_REPORT\""
  log "报告大小:"
  run_cmd "wc -l \"$LATEST_REPORT\""
else
  log_error "未找到分析后生成的报告"
fi

# 8. 检查重要的日志文件
log "\n=== 检查错误日志 ==="
run_cmd "tail -n 20 logs/error.$(date +"%Y-%m-%d").log 2>/dev/null || echo '没有找到今天的错误日志'"

# 9. 停止监控工具
log "\n=== 停止LLM日志监控 ==="
if ps -p $MONITOR_PID > /dev/null; then
  run_cmd "kill $MONITOR_PID"
  log_success "成功停止监控工具 (PID: $MONITOR_PID)"
else
  log_warning "监控工具进程未运行"
fi

# 10. 收集重要的调试日志
log "\n=== 收集调试信息 ==="
DEBUG_PACKAGE="debug_package_${TIMESTAMP}.tar.gz"
run_cmd "tar -czf $DEBUG_PACKAGE $LOG_FILE logs/debug/ output/latest_report.*"
log_success "调试信息已打包: $DEBUG_PACKAGE"

# 结束
log "\n=== 调试完成 ==="
log "调试日志: $LOG_FILE"
log "调试包: $DEBUG_PACKAGE"
log "时间: $(date)" 