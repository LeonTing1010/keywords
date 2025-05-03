# 变更日志

项目的所有显著变更都将记录在此文件中。

格式基于[Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [2.0.0] - 2023-09-15

### 新增
- 重构为支持多搜索引擎的架构
- 添加抽象的`SearchEngine`基类
- 添加`SearchEngineFactory`工厂类，实现灵活创建搜索引擎实例
- 添加`BaiduSearchEngine`实现，支持中文搜索习惯
- 新增`keywordsTool.ts`作为统一入口，支持多引擎选择
- 改进的命令行参数解析，支持引擎选择
- 针对不同搜索引擎的查询策略定制
- 更新README.md文档，添加多引擎架构说明和使用方法

### 更改
- 将Google相关功能重构为`GoogleSearchEngine`类
- `googleKeywords.ts`保留作为向后兼容
- 统一文件命名方式，包含引擎名称前缀

### 修复
- 修复二次查询断点续传问题
- 改进验证码检测逻辑

## [1.0.0] - 2023-05-03

### 新增
- 初始版本，包含四个核心数据采集模块：
  - Google自动补全爬虫
  - Google Trends数据下载器
  - SEMrush关键词搜索量爬虫
  - SimilarWeb流量数据爬虫
- 模块化文件结构，职责分离
- 文件操作工具函数
- TypeScript类型定义
- 全面的错误处理
- 提供单文件版本和模块化版本 