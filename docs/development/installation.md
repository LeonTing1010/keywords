# 安装指南

## 1. 环境要求
- Node.js 18 及以上
- npm 8 及以上

## 2. 克隆仓库
```bash
git clone https://github.com/yourusername/neuralminer.git
cd neuralminer
```

## 3. 安装依赖
```bash
npm install
```

## 4. 配置环境变量
- 复制 `.env.example` 为 `.env`，并填写以下内容：
```
OPENAI_API_KEY=sk-xxx
```
- 其他可选参数详见 `.env.example` 和 [README.md](../../README.md#高级配置)

## 5. 构建与测试
```bash
npm run build
npm test
```

## 6. 启动分析服务
```bash
./analyze.sh "AI医疗"
```

## 7. 查看链路追踪
- 访问 [smith.langchain.com](https://smith.langchain.com/) 查看分析链路

## 常见问题
- 见 [FAQ](../usage/faq.md) 