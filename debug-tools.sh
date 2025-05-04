#!/bin/bash

# 调试工具集主脚本
# 提供多种调试功能的便捷入口

# 确保必要的目录存在
mkdir -p logs/debug
mkdir -p logs/debug/screenshots
mkdir -p logs/debug/network
mkdir -p logs/debug/performance

# 设置调试环境变量
export DEBUG=true

# 显示菜单
show_menu() {
  echo "======================================="
  echo "     关键词工具调试助手"
  echo "======================================="
  echo "1. 运行Google调试查询"
  echo "2. 诊断网络连接"
  echo "3. 启动VSCode调试"
  echo "4. 查看最新日志"
  echo "5. 清理调试文件"
  echo "6. 查看调试截图"
  echo "0. 退出"
  echo "======================================="
  echo "请选择操作 [0-6]:"
}

# 运行Google调试查询
run_google_debug() {
  read -p "请输入要查询的关键词: " keyword
  
  if [ -z "$keyword" ]; then
    keyword="test"
    echo "使用默认关键词: $keyword"
  fi
  
  echo "开始执行Google调试查询: $keyword"
  npx ts-node src/tools/debug-runner.ts query "$keyword"
}

# 诊断网络连接
diagnose_network() {
  echo "开始诊断网络连接..."
  npx ts-node src/tools/debug-runner.ts network
}

# 启动VSCode调试
launch_vscode_debug() {
  if [ -x "$(command -v code)" ]; then
    echo "正在启动VSCode调试..."
    if [ -d ".vscode" ]; then
      code . --enable-proposed-api
      echo "VSCode已启动，请在调试面板中选择'调试Google引擎'配置并开始调试"
    else
      echo "未找到.vscode目录，请先设置VSCode调试配置"
    fi
  else
    echo "未找到VSCode命令行工具，请确保VSCode已安装并添加到PATH中"
  fi
}

# 查看最新日志
view_latest_logs() {
  echo "最新调试日志:"
  if [ -d "logs/debug" ]; then
    # 寻找最新的调试日志文件
    latest_log=$(find logs/debug -name "*.log" -type f -exec ls -t {} \; | head -n 1)
    
    if [ -n "$latest_log" ]; then
      echo "显示日志文件: $latest_log"
      echo "-------------------------"
      tail -n 50 "$latest_log"
      echo "-------------------------"
      echo "显示最后50行，使用 'less $latest_log' 查看完整日志"
    else
      echo "未找到调试日志文件"
    fi
  else
    echo "未找到调试日志目录"
  fi
}

# 清理调试文件
clean_debug_files() {
  read -p "是否清理所有调试文件? (y/n): " confirm
  
  if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    echo "清理调试文件..."
    rm -rf logs/debug/*
    mkdir -p logs/debug/screenshots
    mkdir -p logs/debug/network
    mkdir -p logs/debug/performance
    echo "调试文件已清理"
  else
    echo "操作已取消"
  fi
}

# 查看调试截图
view_debug_screenshots() {
  if [ -d "logs/debug/screenshots" ]; then
    echo "调试截图目录:"
    ls -la logs/debug/screenshots
    
    # 查找最新的截图
    latest_screenshot=$(find logs/debug/screenshots -name "*.png" -type f -exec ls -t {} \; | head -n 1)
    
    if [ -n "$latest_screenshot" ]; then
      echo "最新截图: $latest_screenshot"
      
      # 尝试使用系统查看器打开
      if [ "$(uname)" == "Darwin" ]; then
        # macOS
        open "$latest_screenshot"
      elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
        # Linux
        if [ -x "$(command -v xdg-open)" ]; then
          xdg-open "$latest_screenshot"
        else
          echo "无法自动打开截图，请手动查看"
        fi
      else
        echo "无法自动打开截图，请手动查看"
      fi
    else
      echo "未找到调试截图"
    fi
  else
    echo "未找到调试截图目录"
  fi
}

# 主循环
while true; do
  show_menu
  read -p "选择: " choice
  
  case $choice in
    1) run_google_debug ;;
    2) diagnose_network ;;
    3) launch_vscode_debug ;;
    4) view_latest_logs ;;
    5) clean_debug_files ;;
    6) view_debug_screenshots ;;
    0) echo "退出调试工具"; exit 0 ;;
    *) echo "无效选择，请重试" ;;
  esac
  
  echo ""
  read -p "按Enter键继续..."
  clear
done 