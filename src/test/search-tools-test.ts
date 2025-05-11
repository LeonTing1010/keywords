/**
 * search-tools-test.ts - 测试搜索工具与Agent的集成
 * 
 * 本测试文件专门用于测试搜索工具是否能被Agent正确调用
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../agents/base/EnhancedAgent';
import { LLMService } from '../core/llm/LLMService';
import { MockLLMService } from './mocks/MockLLMService';
import { 
  SearchToolFactory, 
  UnifiedSearchEngine,
  SearchSuggestionsTool,
  SearchResultsTool,
  WebpageContentTool
} from '../tools/search';
import { ProblemMiner } from '../agents/roles/ProblemMiner';
import { AgentInput, AgentOutput } from '../types/schemas';
import { Tool, BaseTool } from '../tools/Tool';

// 创建一个简单的搜索引擎实现
class TestSearchEngine implements UnifiedSearchEngine {
  private callLog: Array<{method: string, args: any, timestamp: number}> = [];

  // 实现搜索建议方法
  async getSuggestions(keyword: string) {
    console.log(`📝 调用搜索建议方法: "${keyword}"`);
    
    this.logCall('getSuggestions', { keyword });
    
    return [
      { query: `${keyword} 问题`, position: 1 },
      { query: `${keyword} 如何`, position: 2 },
      { query: `${keyword} 最佳实践`, position: 3 },
      { query: `${keyword} 优势`, position: 4 },
      { query: `${keyword} 例子`, position: 5 }
    ];
  }

  // 实现搜索结果方法
  async getSearchResults(keyword: string, options?: { maxResults?: number }) {
    const maxResults = options?.maxResults || 3;
    console.log(`📝 调用搜索结果方法: "${keyword}"，最大结果数: ${maxResults}`);
    
    this.logCall('getSearchResults', { keyword, options });
    
    return Array(maxResults).fill(0).map((_, i) => ({
      title: `关于${keyword}的搜索结果 ${i+1}`,
      snippet: `这是关于"${keyword}"的示例搜索结果摘要 ${i+1}`,
      url: `https://example.com/result-${i+1}`
    }));
  }

  // 实现网页内容获取方法
  async getWebpageContent(url: string, options?: any) {
    console.log(`📝 调用网页内容获取方法: "${url}"`);
    
    this.logCall('getWebpageContent', { url, options });
    
    return `
<!DOCTYPE html>
<html>
<head><title>关于 ${url} 的内容</title></head>
<body>
  <h1>示例网页内容</h1>
  <p>这是为URL "${url}" 返回的示例网页内容</p>
  <p>在实际项目中，这里会返回真实的网页内容</p>
</body>
</html>`;
  }

  // 实现引擎类型获取方法
  getEngineType(): string {
    return 'test';
  }

  // 记录工具调用
  private logCall(method: string, args: any) {
    this.callLog.push({
      method,
      args, 
      timestamp: Date.now()
    });
  }

  // 获取调用日志
  getCallLog() {
    return this.callLog;
  }

  // 打印调用日志
  printCallLog() {
    console.log('\n📊 搜索引擎方法调用日志:');
    console.log('-'.repeat(50));
    
    if (this.callLog.length === 0) {
      console.log('没有记录到任何调用');
      return;
    }
    
    this.callLog.forEach((log, index) => {
      console.log(`${index + 1}. 方法: ${log.method}`);
      console.log(`   参数: ${JSON.stringify(log.args)}`);
      console.log(`   时间: ${new Date(log.timestamp).toISOString()}`);
      console.log('-'.repeat(50));
    });
  }
}

/**
 * 创建工具包装器，用于将我们的工具重命名为ProblemMiner期望的名称
 */
function createToolWrapper(originalTool: Tool, newName: string): Tool {
  return new class extends BaseTool {
    constructor() {
      super(
        newName,
        originalTool.getDescription(),
        originalTool.getUsage(),
        {} // 使用空对象替代getSchema，因为Tool接口可能没有这个方法
      );
    }

    protected async executeInternal(args: any): Promise<any> {
      console.log(`🔄 工具包装器: 转发调用从 ${this.getName()} 到 ${originalTool.getName()}`);
      return originalTool.execute(args);
    }
  };
}

/**
 * 测试搜索工具是否被正确调用
 */
async function testSearchTools() {
  console.log('=== 开始测试搜索工具与Agent集成 ===\n');

  try {
    // 1. 创建测试搜索引擎
    const searchEngine = new TestSearchEngine();
    
    // 2. 创建搜索工具工厂
    const searchToolFactory = new SearchToolFactory(searchEngine);
    
    // 3. 创建LLM服务
    const llmService = new MockLLMService();
    
    // 4. 创建ProblemMiner Agent
    console.log('创建ProblemMiner...');
    const problemMiner = new ProblemMiner(llmService, {
      maxProblems: 3,
      useAutocomplete: true,
      testAllTools: true
    });
    
    // 5. 获取原始工具
    console.log('创建工具包装器...');
    const originalTools = searchToolFactory.getAllTools();
    
    // 找到searchSuggestions工具并创建包装器
    const suggestionsTool = originalTools.find(t => t.getName() === 'searchSuggestions');
    const searchCompletionWrapper = suggestionsTool ? 
      createToolWrapper(suggestionsTool, 'searchAutocomplete') : null;
    
    // 找到searchResults工具并创建包装器
    const resultsTool = originalTools.find(t => t.getName() === 'searchResults');
    const searchResultsWrapper = resultsTool ?
      createToolWrapper(resultsTool, 'searchResults') : null;
      
    // 注册原始的webpageContent工具
    const webpageTool = originalTools.find(t => t.getName() === 'webpageContent');
    
    // 6. 向Agent注册工具
    console.log('注册搜索工具...');
    
    if (searchCompletionWrapper) {
      problemMiner.registerTool(searchCompletionWrapper);
      console.log(`- 注册工具: ${searchCompletionWrapper.getName()} (包装了 ${suggestionsTool?.getName()})`);
    }
    
    if (searchResultsWrapper) {
      problemMiner.registerTool(searchResultsWrapper);
      console.log(`- 注册工具: ${searchResultsWrapper.getName()} (包装了 ${resultsTool?.getName()})`);
    }
    
    if (webpageTool) {
      problemMiner.registerTool(webpageTool);
      console.log(`- 注册工具: ${webpageTool.getName()}`);
    }
    
    // 7. 创建执行上下文
    const workflowContext = {
      workflowId: uuidv4(),
      state: {
        input: {
          keyword: '人工智能营销',
          options: {
            fast: false,
            maxProblems: 3
          }
        },
        currentNodeId: 'ProblemMiner',
        completedNodeIds: [],
        nodeOutputs: {},
        executionMetadata: {
          startTime: Date.now(),
          currentTime: Date.now(),
          errors: []
        }
      },
      sharedMemory: {},
      availableTools: problemMiner.getRegisteredTools()
    };
    
    // 8. 执行Agent任务
    console.log('\n📣 执行ProblemMiner处理关键词: "人工智能营销"...');
    const agentInput: AgentInput = {
      data: { keyword: '人工智能营销' },
      context: workflowContext
    };
    
    const result = await problemMiner.execute(agentInput);
    
    // 9. 显示结果摘要
    console.log('\n✅ Agent执行完成');
    console.log(`状态: ${result.status}`);
    
    // 使用类型断言，将data当做any类型处理
    const data = result.data as any;
    console.log(`发现问题数: ${data?.problems?.length || 0}`);
    
    // 10. 打印搜索引擎调用日志
    searchEngine.printCallLog();
    
    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 执行测试
testSearchTools(); 