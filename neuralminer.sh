#!/bin/bash
# NeuralMiner - Advanced Keyword Research & Analysis Tool

# Set bash to exit on error
set -e

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Set up colors for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}"
echo "███╗   ██╗███████╗██╗   ██╗██████╗  █████╗ ██╗     ███╗   ███╗██╗███╗   ██╗███████╗██████╗ "
echo "████╗  ██║██╔════╝██║   ██║██╔══██╗██╔══██╗██║     ████╗ ████║██║████╗  ██║██╔════╝██╔══██╗"
echo "██╔██╗ ██║█████╗  ██║   ██║██████╔╝███████║██║     ██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝"
echo "██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██╔══██║██║     ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗"
echo "██║ ╚████║███████╗╚██████╔╝██║  ██║██║  ██║███████╗██║ ╚═╝ ██║██║██║ ╚████║███████╗██║  ██║"
echo "╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝"
echo -e "${NC}"
echo -e "${GREEN}Advanced Keyword Research & Analysis Tool${NC}"
echo -e "${YELLOW}------------------------------------------${NC}\n"

# Helper function to display usage
show_usage() {
  echo -e "Usage: ./neuralminer.sh <command> <keyword> [options]"
  echo
  echo -e "Commands:"
  echo -e "  ${GREEN}analyze${NC}    Run keyword analysis"
  echo -e "  ${GREEN}help${NC}       Show this help message"
  echo
  echo -e "Options:"
  echo -e "  ${YELLOW}--fast${NC}               Run in fast mode with simplified analysis"
  echo -e "  ${YELLOW}--output <dir>${NC}       Specify output directory"
  echo -e "  ${YELLOW}--format <format>${NC}    Output format (markdown or json)"
  echo -e "  ${YELLOW}--language <lang>${NC}    Output language (zh or en)"
  echo
  echo -e "Examples:"
  echo -e "  ./neuralminer.sh analyze \"artificial intelligence\""
  echo -e "  ./neuralminer.sh analyze \"machine learning\" --fast"
  echo -e "  ./neuralminer.sh analyze \"data science\" --output ./my-reports --format json"
  echo
}

# Analyze command
analyze() {
  KEYWORD="$1"
  shift
  
  if [ -z "$KEYWORD" ]; then
    echo -e "${RED}Error: Keyword is required${NC}"
    show_usage
    exit 1
  fi
  
  # Prepare output directory for this analysis
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  OUTPUT_DIR="./output/_$TIMESTAMP"
  FORMAT="markdown"
  LANGUAGE="zh"
  FAST_MODE=""
  
  # Parse options
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --fast)
        FAST_MODE="--fast"
        shift
        ;;
      --output)
        OUTPUT_DIR="$2"
        shift 2
        ;;
      --format)
        FORMAT="$2"
        shift 2
        ;;
      --language)
        LANGUAGE="$2"
        shift 2
        ;;
      *)
        echo -e "${RED}Unknown option: $1${NC}"
        show_usage
        exit 1
        ;;
    esac
  done
  
  # Create output directory if it doesn't exist
  mkdir -p "$OUTPUT_DIR"
  
  echo -e "${BLUE}Starting analysis for keyword:${NC} $KEYWORD"
  echo -e "${BLUE}Output directory:${NC} $OUTPUT_DIR"
  echo -e "${BLUE}Format:${NC} $FORMAT"
  echo -e "${BLUE}Language:${NC} $LANGUAGE"
  if [ -n "$FAST_MODE" ]; then
    echo -e "${BLUE}Mode:${NC} Fast"
  else
    echo -e "${BLUE}Mode:${NC} Standard"
  fi
  echo
  
  # Run the analysis
  npx ts-node src/cli/AdaptiveCli.ts --keyword "$KEYWORD" --output "$OUTPUT_DIR" --format "$FORMAT" --language "$LANGUAGE" $FAST_MODE
  
  # Get the latest report file
  LATEST_REPORT=$(find "$OUTPUT_DIR" -type f -name "*.md" -or -name "*.json" | sort -r | head -n 1)
  
  if [ -n "$LATEST_REPORT" ]; then
    echo -e "\n${GREEN}Analysis complete!${NC}"
    echo -e "${BLUE}Report saved to:${NC} $LATEST_REPORT"
    
    # Remove any error reports if successful
    find "$OUTPUT_DIR" -type f -name "*error*" -delete 2>/dev/null || true
  else
    echo -e "\n${RED}Analysis failed or no report was generated.${NC}"
    echo -e "Check the logs for more information."
  fi
}

# Main command handler
case "$1" in
  analyze)
    shift
    analyze "$@"
    ;;
  help)
    show_usage
    ;;
  *)
    if [ -z "$1" ]; then
      show_usage
    else
      echo -e "${RED}Unknown command: $1${NC}"
      show_usage
      exit 1
    fi
    ;;
esac