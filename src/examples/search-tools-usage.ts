/**
 * search-tools-usage.ts - 搜索工具使用示例
 * 
 * 本示例展示如何使用搜索工具与Agent集成
 */

import { EnhancedAgent } from '../agents/base/EnhancedAgent';
import { LLMService } from '../core/llm/LLMService';
import { 
  UnifiedSearchEngine, 
  SearchToolFactory 
} from '../tools/search';
import { AgentInput, AgentOutput, ToolParams, ToolResult } from '../types/schemas';

// 模拟搜索引擎实现（实际项目中需要实现完整的UnifiedSearchEngine）
class MockSearchEngine implements UnifiedSearchEngine {
  // 实现搜索建议方法
  async getSuggestions(keyword: string) {
    console.log(`[Mock] 为关键词"${keyword}"获取搜索建议`);
    return [
      { query: `${keyword} 示例`, position: 1 },
      { query: `${keyword} 教程`, position: 2 },
      { query: `${keyword} 最佳实践`, position: 3 }
    ];
  }

  // 实现搜索结果方法
  async getSearchResults(keyword: string, options?: { maxResults?: number }) {
    const maxResults = options?.maxResults || 3;
    console.log(`[Mock] 为关键词"${keyword}"获取最多${maxResults}个搜索结果`);
    
    return Array(maxResults).fill(0).map((_, i) => ({
      title: `关于${keyword}的搜索结果 ${i+1}`,
      snippet: `这是关于"${keyword}"的示例搜索结果摘要 ${i+1}`,
      url: `https://example.com/result-${i+1}`
    }));
  }

  // 实现网页内容获取方法
  async getWebpageContent(url: string) {
    console.log(`[Mock] 获取网页内容: ${url}`);
    return `
<!DOCTYPE html>
<html>
<head><title>示例网页</title></head>
<body>
  <h1>示例网页内容</h1>
  <p>这是为URL "${url}" 返回的示例网页内容</p>
  <p>在实际项目中，这里会返回真实的网页内容</p>
</body>
</html>`;
  }

  // 实现引擎类型获取方法
  getEngineType(): string {
    return 'mock';
  }
}

/**
 * 演示如何在Agent中使用搜索工具
 */
async function demonstrateSearchTools() {
  try {
    console.log('=== 搜索工具使用示例 ===\n');

    // 1. 创建模拟搜索引擎
    const searchEngine = new MockSearchEngine();
    
    // 2. 创建搜索工具工厂
    const searchToolFactory = new SearchToolFactory(searchEngine);
    
    // 3. 创建模拟LLM服务（实际项目中需要实现）
    const mockLlmService = {} as LLMService;
    
    // 4. 创建示例Agent
    class SearchDemoAgent extends EnhancedAgent {
      constructor() {
        super(
          'SearchDemoAgent',
          '搜索工具演示Agent',
          'searcher',
          mockLlmService
        );
      }
      
      // 实现抽象方法
      protected async executeInternal(input: AgentInput): Promise<AgentOutput> {
        console.log(`Agent执行内部逻辑: ${JSON.stringify(input)}`);
        return this.createSuccessOutput({
          message: '示例执行完成'
        });
      }
    }
    
    const agent = new SearchDemoAgent();
    
    // 5. 向Agent注册搜索工具
    console.log('向Agent注册所有搜索工具...');
    searchToolFactory.getAllTools().forEach(tool => {
      agent.registerTool(tool);
      console.log(`- 注册工具: ${tool.getName()}`);
    });
    
    // 6. 演示使用搜索工具
    console.log('\n使用搜索自动补全工具:');
    const suggestionsResult = await agent.useTool('searchSuggestions', { 
      keyword: '人工智能' 
    });
    console.log('结果:', JSON.stringify(suggestionsResult, null, 2));
    
    console.log('\n使用搜索结果工具:');
    const searchResult = await agent.useTool('searchResults', { 
      keyword: '关键词分析', 
      maxResults: 2 
    });
    console.log('结果:', JSON.stringify(searchResult, null, 2));
    
    console.log('\n使用网页内容工具:');
    const contentResult = await agent.useTool('webpageContent', { 
      url: 'https://example.com/sample' 
    });
    
    // 安全地访问数据
    if (contentResult.success && contentResult.data) {
      // 类型断言
      const data = contentResult.data as any;
      if (data.content && typeof data.content === 'string') {
        console.log('结果 (截取前100字符):', 
          JSON.stringify(data.content.substring(0, 100) + '...', null, 2));
      } else {
        console.log('内容不是字符串格式');
      }
    } else {
      console.log('获取内容失败');
    }
    
    console.log('\n=== 演示完成 ===');
  } catch (error) {
    console.error('演示过程中发生错误:', error);
  }
}

// 执行演示
demonstrateSearchTools(); 