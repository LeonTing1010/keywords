# LLM JSON格式处理优化

本次更新解决了两个主要问题：

1. 当大模型返回格式不符合要求（JSON）时，重试机制未能正常工作
2. 需要在调用层面统一处理JSON格式验证，符合OOP原则

## 实施方案

我们采取了以下改进措施：

### 1. 增强LLMServiceHub的重试机制

- 添加了 `strictFormat` 选项，用于要求严格的JSON格式验证
- 修改了 `shouldRetry` 方法，使其能够捕获JSON格式错误并触发重试
- 增加了对JSON解析结果的验证，确保当请求JSON格式时返回的是有效JSON

### 2. 遵循OOP原则的统一JSON处理方案

我们实现了两种补充方案：

#### 方案A：装饰器模式

创建 `JsonEnforcedLLMProvider` 类，这是一个装饰器，可以包装任何 LLM 提供者：

```typescript
const provider = // 原始LLM提供者
const jsonProvider = new JsonEnforcedLLMProvider(provider);

// 使用时，它会确保返回的是有效JSON
const result = await jsonProvider.call(messages, {
  format: 'json',
  strictFormat: true
});
```

#### 方案B：工厂方法模式

在 `LLMServiceHub` 中添加工厂方法来创建JSON强制提供者：

```typescript
const llm = new LLMServiceHub();
const provider = // 原始LLM提供者
const jsonProvider = llm.createJsonEnforcedProvider(provider);

// 使用同上
```

#### 方案C：内置JSON强制配置

我们还在 `analyze` 方法中添加了默认的JSON格式强制处理：

```typescript
// 当请求JSON格式时，默认启用严格模式
if (options.format === 'json' && options.strictFormat === undefined) {
  options.strictFormat = true;
}
```

## 使用示例

见示例文件 `examples/json-enforced-llm-example.ts`，其中演示了如何使用这些新功能。

### 如何要求严格的JSON格式

```typescript
// 在analyze调用时
const result = await llm.analyze(prompt, 'task', {
  format: 'json',
  strictFormat: true  // 开启严格JSON验证和重试
});
```

### 如何在项目中集成

1. 对于需要JSON返回的模块，使用 `strictFormat: true` 选项
2. 对于关键业务流程，考虑使用 `JsonEnforcedLLMProvider`
3. 对于分析类应用，可以创建专门的jsonLlm实例：

```typescript
this.llm = new LLMServiceHub();  // 普通LLM服务
this.jsonLlm = new LLMServiceHub(); // 用于JSON严格模式
```

## 未来改进方向

1. 添加更多JSON格式修复策略
2. 实现语义验证层，确保返回的JSON不仅格式正确，还符合预期结构
3. 考虑添加JSON Schema验证支持，通过schema验证返回的JSON结构

## 开发者注意事项

- `strictFormat` 选项会导致重试次数增加，可能增加API调用成本
- 在非关键场景，可以选择不使用严格模式，以提高响应速度
- 如果遇到特别顽固的格式问题，可以增加 `maxRetries` 参数值 