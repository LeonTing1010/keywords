# Changelog

## 2024-05-11

### 新增

- 集成 Zod 验证库，用于对所有类型和输入/输出进行运行时验证
- 创建集中式类型验证模式 `src/types/schemas.ts`
- 添加 `ValidationService` 工具类，提供集中式验证功能
- 优化 Agent 基类，添加输入/输出验证
- 优化 Tool 基类，添加参数验证
- 优化 LLMService 接口，支持嵌入和健康检查功能
- 更新 MockLLMService 以支持新的 LLMService 接口
- 更新工作流测试脚本，使用新的验证接口

### 变更

- 重构 EnhancedAgent 类，提供更好的工具管理和错误处理
- 更新 ProblemMiner 等角色实现，使用新的 Agent 接口
- 更新接口名称以提高可读性（例如 `process` -> `execute`）
- 改进错误处理机制，提供更详细的错误信息

### 修复

- 修复 MockToolFactory 实现，正确实现工具接口
- 修复 LLMService 接口中的类型安全问题
- 解决工作流执行中的验证错误 