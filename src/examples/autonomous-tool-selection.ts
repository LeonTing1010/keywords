/**
 * autonomous-tool-selection.ts - 自主工具选择示例
 * 
 * 展示Agent如何根据需要自主选择工具
 */

import { EnhancedAgent } from '../agents/base/EnhancedAgent';
import { LLMService } from '../core/llm/LLMService';
import { Tool, BaseTool } from '../tools/Tool';
import { AgentInput, AgentOutput, ToolParams, ToolResult } from '../types/schemas';
import { toolRegistry, ToolCategory } from '../infrastructure/ToolRegistry';
import { ValidationService } from '../utils/ValidationService';

// 模拟LLM服务
class MockLLMService implements LLMService {
  getModelName() { return 'mock-model'; }
  
  async chat(messages: any[]) {
    return {
      role: 'assistant',
      content: `这是一个模拟回复，基于用户的输入：${messages.find(m => m.role === 'user')?.content || '无输入'}`
    };
  }
  
  async chatCompletion(messages: any[]) {
    return this.chat(messages);
  }
  
  async chatToJSON<T>(messages: any[], jsonSchema: any): Promise<T> {
    // 返回工具选择的模拟结果
    if (messages.some(m => m.content?.includes('选择最合适的工具'))) {
      return {
        selectedTool: 'searchTool',
        reason: '搜索工具最适合获取关键词相关信息',
        params: {
          query: '智能家居市场趋势'
        }
      } as unknown as T;
    }
    return {} as T;
  }
  
  async embedText() { return [0.1, 0.2, 0.3]; }
  updateConfig() { }
  getContextWindowSize() { return 4096; }
  estimateTokenCount(text: string) { return Math.ceil(text.length / 4); }
  formatPrompt(template: string, variables: Record<string, any>) { return template; }
  async checkHealth() { return { status: 'healthy' }; }
}

// 搜索工具
class SearchTool extends BaseTool {
  constructor() {
    super(
      'searchTool',
      '搜索引擎工具，用于检索关键词相关信息',
      '使用方法: searchTool({ query: "搜索关键词" })',
      {
        query: '要搜索的关键词或短语',
        maxResults: '最大结果数量，默认为10'
      }
    );
  }
  
  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    const { query, maxResults = 10 } = params;
    
    if (!query) {
      return {
        success: false,
        error: '缺少必要参数: query'
      };
    }
    
    console.log(`执行搜索: ${query}，最大结果数: ${maxResults}`);
    
    // 模拟搜索结果
    return {
      success: true,
      data: {
        results: [
          { title: `关于 "${query}" 的结果1`, snippet: '这是第一个搜索结果...' },
          { title: `关于 "${query}" 的结果2`, snippet: '这是第二个搜索结果...' }
        ],
        totalResults: 2,
        searchTime: 0.23
      }
    };
  }
}

// 市场分析工具
class MarketAnalysisTool extends BaseTool {
  constructor() {
    super(
      'marketAnalysisTool',
      '市场分析工具，用于分析市场趋势和规模',
      '使用方法: marketAnalysisTool({ market: "市场名称", timeRange: "时间范围" })',
      {
        market: '要分析的市场名称',
        timeRange: '分析的时间范围，默认为"latest"'
      }
    );
  }
  
  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    const { market, timeRange = 'latest' } = params;
    
    if (!market) {
      return {
        success: false,
        error: '缺少必要参数: market'
      };
    }
    
    console.log(`执行市场分析: ${market}，时间范围: ${timeRange}`);
    
    // 模拟市场分析结果
    return {
      success: true,
      data: {
        marketName: market,
        marketSize: '$12.5B',
        growthRate: '15.7%',
        keyPlayers: ['Company A', 'Company B', 'Company C'],
        trends: ['移动化', '云服务', 'AI集成'],
        timeRange
      }
    };
  }
}

// 内容总结工具
class ContentSummarizerTool extends BaseTool {
  constructor() {
    super(
      'summarizerTool',
      '内容总结工具，用于对长文本进行摘要',
      '使用方法: summarizerTool({ content: "要总结的内容", maxLength: 100 })',
      {
        content: '要总结的内容',
        maxLength: '总结的最大长度，默认为200'
      }
    );
  }
  
  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    const { content, maxLength = 200 } = params;
    
    if (!content) {
      return {
        success: false,
        error: '缺少必要参数: content'
      };
    }
    
    const contentStr = String(content);
    console.log(`执行内容总结，内容长度: ${contentStr.length}，最大总结长度: ${maxLength}`);
    
    // 模拟总结结果（简单截取）
    const summary = contentStr.length > maxLength 
      ? contentStr.substring(0, maxLength) + '...' 
      : contentStr;
      
    return {
      success: true,
      data: {
        originalLength: contentStr.length,
        summaryLength: summary.length,
        summary
      }
    };
  }
}

/**
 * 示例Agent：智能研究助手
 * 能够自主选择工具完成任务
 */
class ResearchAssistantAgent extends EnhancedAgent {
  constructor() {
    super(
      'ResearchAssistant',
      '智能研究助手，能够自主选择工具进行市场研究和分析',
      'researcher',
      new MockLLMService(),
      {
        enableAutonomousToolSelection: true,
        defaultToolCategory: ToolCategory.ANALYSIS
      },
      ['市场研究', '信息检索', '数据分析', '内容总结']
    );
  }
  
  /**
   * 执行Agent任务
   * @param input Agent输入
   * @returns Agent输出
   */
  protected async executeInternal(input: AgentInput): Promise<AgentOutput> {
    console.log('\n====== 开始执行研究任务 ======');
    console.log(`任务内容: ${JSON.stringify(input.data)}`);
    
    const { topic, context } = input.data;
    
    if (!topic) {
      return this.createErrorOutput('缺少必要参数: topic');
    }
    
    try {
      console.log('\n1. 首先通过自主选择获取信息...');
      // 使用自主工具选择获取信息
      const searchResult = await this.executeWithAutonomousToolSelection(
        `获取关于"${topic}"的最新信息和趋势`, 
        context
      );
      console.log(`信息获取结果: ${searchResult.success ? '成功' : '失败'}`);
      
      if (!searchResult.success) {
        return this.createErrorOutput(`信息获取失败: ${searchResult.error}`);
      }
      
      console.log('\n2. 接下来进行市场分析...');
      // 指定工具类别进行市场分析
      const marketAnalysisResult = await this.executeWithAutonomousToolSelection(
        `分析"${topic}"的市场规模和增长趋势`, 
        {
          ...context,
          marketName: topic,
          searchData: searchResult.data
        }
      );
      console.log(`市场分析结果: ${marketAnalysisResult.success ? '成功' : '失败'}`);
      
      console.log('\n3. 最后，总结分析结果...');
      // 根据收集的数据进行总结
      const contentToSummarize = `
${topic} 市场研究:
- 搜索结果: ${JSON.stringify(searchResult.data)}
- 市场分析: ${JSON.stringify(marketAnalysisResult.data)}
- 其他上下文: ${JSON.stringify(context)}
`;

      const summaryResult = await this.executeWithAutonomousToolSelection(
        `总结关于"${topic}"的研究发现`, 
        {
          content: contentToSummarize,
          maxLength: 300
        }
      );
      console.log(`总结结果: ${summaryResult.success ? '成功' : '失败'}`);
      
      // 返回所有结果
      console.log('\n====== 研究任务完成 ======\n');
      return this.createSuccessOutput({
        topic,
        searchResults: searchResult.data,
        marketAnalysis: marketAnalysisResult.data,
        summary: summaryResult.data?.summary || '无法生成总结'
      });
    } catch (error) {
      return this.createErrorOutput(`研究任务执行失败: ${error}`);
    }
  }
}

/**
 * 运行自主工具选择示例
 */
async function runAutonomousToolSelectionExample() {
  console.log('=== 自主工具选择示例 ===\n');
  
  // 1. 注册工具到全局注册中心
  console.log('注册工具到全局注册中心...');
  const searchTool = new SearchTool();
  const marketAnalysisTool = new MarketAnalysisTool();
  const summarizerTool = new ContentSummarizerTool();
  
  toolRegistry.registerTool(searchTool, ToolCategory.SEARCH, ['search', 'web']);
  toolRegistry.registerTool(marketAnalysisTool, ToolCategory.ANALYSIS, ['market', 'analysis']);
  toolRegistry.registerTool(summarizerTool, ToolCategory.UTILITY, ['summarize', 'content']);
  
  console.log('已注册工具:', toolRegistry.getAllTools().map(t => t.getName()).join(', '));
  
  // 2. 创建Agent实例
  console.log('\n创建研究助手Agent...');
  const researchAssistant = new ResearchAssistantAgent();
  
  // 3. 执行任务
  console.log('\n执行研究任务...');
  const result = await researchAssistant.execute({
    data: {
      topic: '智能家居',
      context: {
        focusAreas: ['安全', '节能', '便利性'],
        timeRange: 'last_2_years',
        competitors: ['小米', '百度', '华为', '亚马逊']
      }
    },
    context: {
      workflowId: 'example-workflow',
      state: {
        input: {
          topic: '智能家居'
        },
        currentNodeId: 'ResearchAssistant',
        completedNodeIds: [],
        nodeOutputs: {},
        executionMetadata: {
          startTime: Date.now(),
          currentTime: Date.now(),
          errors: []
        }
      },
      sharedMemory: {},
      availableTools: toolRegistry.getAllTools().map(t => t.getName())
    },
    options: {
      depth: 2
    }
  });
  
  // 4. 输出结果
  console.log('\n研究任务结果:');
  console.log(JSON.stringify(result, null, 2));
}

// 如果直接运行此文件
if (require.main === module) {
  runAutonomousToolSelectionExample()
    .catch(error => {
      console.error('示例执行失败:', error);
      process.exit(1);
    });
}

// 导出示例函数
export { runAutonomousToolSelectionExample }; 