# 搜索工具使用指南

本文档介绍如何在KeywordAlchemist项目中使用搜索相关工具。

## 工具概述

本项目提供了三个核心搜索工具：

1. **SearchSuggestionsTool** - 关键词自动补全工具
   - 通过搜索引擎自动补全功能获取关键词建议
   - 帮助扩展关键词范围，发现相关关键词

2. **SearchResultsTool** - 搜索结果工具
   - 获取关键词的搜索结果，包括标题、摘要和URL
   - 支持限制结果数量

3. **WebpageContentTool** - 网页内容获取工具
   - 通过URL获取网页的完整内容
   - 支持内容长度限制和其他高级选项

## 工具集成步骤

### 1. 创建搜索引擎实例

首先，需要创建一个实现了`UnifiedSearchEngine`接口的搜索引擎实例：

```typescript
import { UnifiedSearchEngine } from '../tools/search';
import { GoogleSearchEngine } from '../infra/search/engines/GoogleSearchEngine';

// 创建Google搜索引擎实例
const searchEngine = new GoogleSearchEngine();

// 如果需要，可以设置代理
searchEngine.setProxy('http://your-proxy-server:port');

// 初始化引擎
await searchEngine.initialize();
```

### 2. 创建搜索工具工厂

使用搜索引擎实例创建工具工厂：

```typescript
import { SearchToolFactory } from '../tools/search';

// 创建工具工厂
const searchToolFactory = new SearchToolFactory(searchEngine, {
  enableCache: true,      // 启用缓存
  cacheTimeMs: 60 * 1000  // 缓存生效时间（毫秒）
});
```

### 3. 向Agent注册工具

将工具注册到Agent中：

```typescript
// 注册单个工具
agent.registerTool(searchToolFactory.getSearchSuggestionsTool());
agent.registerTool(searchToolFactory.getSearchResultsTool());
agent.registerTool(searchToolFactory.getWebpageContentTool());

// 或者一次注册所有工具
searchToolFactory.getAllTools().forEach(tool => {
  agent.registerTool(tool);
});
```

### 4. 在Agent中使用工具

在Agent实现中使用工具：

```typescript
// 使用搜索自动补全工具
const suggestionsResult = await this.useTool('searchSuggestions', { 
  keyword: '人工智能',
  maxResults: 30 
});

// 使用搜索结果工具
const searchResult = await this.useTool('searchResults', { 
  keyword: '关键词分析',
  maxResults: 10
});

// 使用网页内容工具
const contentResult = await this.useTool('webpageContent', { 
  url: 'https://example.com/article',
  maxLength: 10000,
  options: {
    proxyServer: 'http://proxy:port',
    timeout: 10000
  }
});
```

## 工具参数详解

### SearchSuggestionsTool

```typescript
{
  // 要查询的关键词（必须）
  keyword: string;
  
  // 最大返回结果数量（可选，默认30）
  maxResults?: number;
}
```

### SearchResultsTool

```typescript
{
  // 要搜索的关键词（必须）
  keyword: string;
  
  // 最大返回结果数量（可选，默认10）
  maxResults?: number;
}
```

### WebpageContentTool

```typescript
{
  // 要获取内容的网页URL（必须）
  url: string;
  
  // 返回内容的最大长度限制（可选）
  maxLength?: number;
  
  // 额外选项（可选）
  options?: {
    // 代理服务器地址
    proxyServer?: string;
    
    // 请求超时时间（毫秒）
    timeout?: number;
    
    // 自定义User-Agent
    userAgent?: string;
    
    // 是否仅提取文本内容
    extractText?: boolean;
  }
}
```

## 工具返回结果

所有工具都返回标准的`ToolResult`格式：

```typescript
{
  // 执行是否成功
  success: boolean;
  
  // 成功时的数据
  data?: any;
  
  // 失败时的错误信息
  error?: string;
  
  // 元数据
  metadata?: {
    // 工具名称
    toolName: string;
    
    // 时间戳
    timestampMs: number;
    
    // 其他元数据
    [key: string]: any;
  }
}
```

## 工具错误处理

所有工具内部都实现了错误处理，但在使用时，仍建议进行适当的错误处理：

```typescript
try {
  const result = await this.useTool('searchResults', { keyword });
  
  if (!result.success) {
    this.log(`工具执行失败: ${result.error}`, 'error');
    // 进行错误处理...
    return;
  }
  
  // 使用结果...
  const searchResults = result.data;
} catch (error) {
  this.log(`意外错误: ${error}`, 'error');
  // 处理异常...
}
```

## 最佳实践

1. **使用合适的缓存策略**：搜索结果可以缓存一定时间，避免频繁请求
2. **合理限制结果数量**：仅获取必要的搜索结果和内容数量
3. **处理内容提取**：网页内容可能很大，考虑只提取需要的部分
4. **考虑重试策略**：外部请求可能失败，实现适当的重试机制
5. **增量搜索**：先获取少量结果，根据需要增量获取更多

## 示例

请参考 `src/examples/search-tools-usage.ts` 中的完整示例代码。 