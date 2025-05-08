# 贡献指南

欢迎为 NeuralMiner 贡献代码、文档和新特性！

## 贡献新特性
- **可视化报告**：可在 `src/examples/visual-report-demo.html` 基础上扩展更多可视化组件。
- **批量分析与A/B测试**：建议在 `EnhancedLLMService` 和 CLI 层实现批量与A/B测试逻辑。
- **多格式导出**：如需支持新格式，请扩展 `ReportAgent` 和相关导出工具。

## 代码规范
- 遵循 TypeScript 最佳实践
- 保持模块化、可扩展性
- 所有新特性需配套文档和示例

## 文档贡献
- 所有新特性需在 `README.md`、`docs/usage/cli-commands.md`、`docs/api/api-reference.md` 等处补充说明
- 示例代码建议放在 `src/examples/` 目录

## 测试
- 所有新功能需配套单元测试和集成测试

## 提交流程
1. Fork 仓库并新建分支
2. 提交代码和文档
3. 发起 Pull Request，描述变更内容和测试方法

## 参考
- [安装指南](installation.md)
- [API 参考](../api/api-reference.md)
- [FAQ](../usage/faq.md) 