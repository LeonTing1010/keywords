# API 参考

本页介绍 NeuralMiner 的主要 API 接口，包括分析、流式输出、批量分析、A/B测试、导出、链路追踪等。

## 1. 分析接口

### 标准分析
```
POST /api/analyze
{
  "prompt": "分析AI医疗市场",
  "analysisType": "keyword-analysis",
  "options": { "format": "json" }
}
```

### 流式输出
```
POST /api/analyze/stream
{
  "prompt": "分析智能家居趋势",
  "options": { "stream": true }
}
```
- 响应为 Server-Sent Events (SSE) 或分块流。

## 2. 批量分析
```
POST /api/analyze/batch
{
  "prompts": ["AI医疗", "智能家居", ...],
  "analysisType": "keyword-analysis"
}
```

## 3. A/B测试
```
POST /api/analyze/abtest
{
  "prompt": "分析AI医疗",
  "variants": ["promptA", "promptB"]
}
```

## 4. 导出与可视化
- 支持 `format: html|csv|excel|json|md` 参数，返回对应格式内容。

## 6. 反馈接口
```
POST /api/feedback
{
  "requestId": "...",
  "score": 5,
  "comment": "结果很棒！"
}
```

详见 [README.md](../../README.md) 和 [CLI命令](../usage/cli-commands.md)。 