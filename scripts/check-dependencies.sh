#!/bin/bash

# 检查并安装脚本依赖项
# 主要用于确保运行分析所需的系统工具都已安装

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

# 帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "检查并安装脚本依赖项。"
    echo ""
    echo "选项:"
    echo "  -y, --yes     自动确认所有安装操作"
    echo "  -q, --quiet   静默模式，仅显示错误信息"
    echo "  -h, --help    显示此帮助信息"
}

# 默认选项
AUTO_YES=false
QUIET=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -y|--yes)
            AUTO_YES=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}错误: 未知选项 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 输出函数
log_info() {
    if ! $QUIET; then
        echo -e "${GREEN}[INFO]${NC} $1"
    fi
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" &> /dev/null
}

# 安装bc命令
install_bc() {
    if command_exists apt-get; then
        sudo apt-get update && sudo apt-get install -y bc
    elif command_exists yum; then
        sudo yum install -y bc
    elif command_exists brew; then
        brew install bc
    else
        log_error "无法自动安装bc，请手动安装"
        return 1
    fi
    return 0
}

# 检查并安装pm2
check_and_install_pm2() {
    if ! command_exists pm2; then
        log_warn "未找到pm2，需要安装才能以守护进程模式运行服务"
        
        if ! command_exists npm; then
            log_error "未找到npm，无法安装pm2"
            return 1
        fi
        
        if $AUTO_YES; then
            INSTALL=true
        else
            read -p "是否安装pm2? [y/N] " response
            case "$response" in
                [yY][eE][sS]|[yY]) 
                    INSTALL=true
                    ;;
                *)
                    INSTALL=false
                    ;;
            esac
        fi
        
        if $INSTALL; then
            log_info "正在安装pm2..."
            npm install -g pm2
            if [ $? -eq 0 ]; then
                log_info "pm2安装成功"
            else
                log_error "pm2安装失败"
                return 1
            fi
        else
            log_warn "跳过pm2安装，注意这将禁用守护进程模式"
        fi
    else
        log_info "pm2已安装"
    fi
    return 0
}

# 主要检查函数
main() {
    local all_ok=true
    
    # 检查bc
    if ! command_exists bc; then
        log_warn "未找到bc命令，这是计算进度所必需的"
        
        if $AUTO_YES; then
            INSTALL=true
        else
            read -p "是否安装bc? [y/N] " response
            case "$response" in
                [yY][eE][sS]|[yY]) 
                    INSTALL=true
                    ;;
                *)
                    INSTALL=false
                    ;;
            esac
        fi
        
        if $INSTALL; then
            log_info "正在安装bc..."
            if install_bc; then
                log_info "bc安装成功"
            else
                log_warn "bc安装失败，某些进度显示可能无法正常工作"
                all_ok=false
            fi
        else
            log_warn "跳过bc安装，某些进度显示可能无法正常工作"
            all_ok=false
        fi
    else
        log_info "bc已安装"
    fi
    
    # 检查pm2
    if ! check_and_install_pm2; then
        all_ok=false
    fi
    
    # 返回状态
    if $all_ok; then
        log_info "所有依赖项检查完成，系统已准备就绪"
        return 0
    else
        log_warn "某些依赖项可能未正确安装，部分功能可能无法正常工作"
        return 1
    fi
}

# 执行主函数
main 