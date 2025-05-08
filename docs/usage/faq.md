# 常见问题（FAQ）

## 1. 为什么分析任务执行失败？
- 检查 Node.js 版本（建议 18+）。
- 确认 `.env` 配置了所有必需的 API Key。
- 依赖未安装请运行 `npm install`。
- 脚本需有执行权限：`chmod +x analyze.sh`。
- 查看日志和终端报错信息定位问题。

## 2. 如何导出分析报告为 HTML/CSV/Excel？
- 使用 `--format html/csv/excel` 参数，或在 API/代码中指定 `format`。
- 详见 [导出与可视化](./cli-commands.md#多格式导出)。

## 3. 如何批量分析关键词？
- 使用 `./analyze.sh batch keywords.txt`，支持并发分析。

## 4. 如何反馈分析结果或参与A/B测试？
- 分析完成后可通过API或Web界面提交反馈。

## 5. 数据持久化和历史分析如何实现？
- 系统自动将分析数据存储到 SQLite，支持后续审计和复盘。

## 6. 还有其他问题？
- 请查阅 [README.md](../../README.md) 或提交 issue。 