#!/bin/bash

echo "正在更新NeedMiner依赖到兼容版本..."

# 安装兼容版本的依赖
npm install @langchain/langgraph@0.0.8 @langchain/openai@0.0.10 langchain@0.1.9 langchain-core@0.0.4 --save

# 检查依赖安装状态
if [ $? -eq 0 ]; then
  echo "✅ 依赖更新成功!"
  echo "当前安装的版本:"
  echo "- @langchain/langgraph: $(npm list @langchain/langgraph | grep langgraph)"
  echo "- @langchain/openai: $(npm list @langchain/openai | grep openai)"
  echo "- langchain: $(npm list langchain | grep langchain@)"
  echo "- langchain-core: $(npm list langchain-core | grep core@)"
  
  echo ""
  echo "现在可以运行以下命令测试系统:"
  echo "npm run analyze:langgraph --keyword \"人工智能\""
else
  echo "❌ 依赖更新失败，请检查错误信息并手动更新。"
fi

# 添加可执行权限到脚本
chmod +x ./analyze-langgraph.sh
chmod +x ./analyze-langgraph-fix.sh

echo "完成!" 