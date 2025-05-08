# CLI 命令参考

本页介绍 NeuralMiner 的命令行工具用法，涵盖批量分析、流式输出、A/B测试、导出等高级特性。

## 基本用法

```bash
./analyze.sh "关键词"
```

## 批量关键词分析

```bash
./analyze.sh batch keywords.txt --format json
```
- `keywords.txt` 为每行一个关键词的文本文件。
- 支持并发分析。

## 流式输出与进度反馈

```bash
./analyze.sh "AI医疗" --stream
```
- 实时显示分析进度和内容。

## A/B 测试分析

```bash
./analyze.sh "AI医疗" --abtest promptA promptB
```
- 自动对比不同提示词或策略，结果自动追踪。

## 多格式导出

```bash
./analyze.sh "AI医疗" --format html --output report.html
```
- 支持导出为 Markdown、JSON、HTML、CSV、Excel 等。

## 其他命令

- `./debug.sh`：调试工具
- `./test.sh`：测试工具
- `./scripts/organize-scripts.sh`：整理脚本

详见 [README.md](../../README.md) 和 [API 文档](../api/api-reference.md)。 