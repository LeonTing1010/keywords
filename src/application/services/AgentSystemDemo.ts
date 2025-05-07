/**
 * AgentSystemDemo - 多Agent系统演示
 * 展示如何使用多Agent架构进行关键词分析
 */
import { AgentCoordinator } from '../../infrastructure/agent/AgentCoordinator';
import { ToolRegistry } from '../../infrastructure/agent/ToolRegistry';
import { KeywordAgent } from '../../domain/agent/KeywordAgent';
import { JourneyAgent } from '../../domain/agent/JourneyAgent';
import { ContentAgent } from '../../domain/agent/ContentAgent';
import { ReportAgent } from '../../domain/agent/ReportAgent';
import { SearchSuggestionTool } from '../../infrastructure/agent/tools/SearchSuggestionTool';
import { SearchResultsTool } from '../../infrastructure/agent/tools/SearchResultsTool';
import { BaiduSearchEngine } from '../../infrastructure/search/engines/BaiduSearchEngine';
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { logger } from '../../infrastructure/core/logger';

export class AgentSystemDemo {
  private coordinator: AgentCoordinator;
  
  constructor() {
    // 初始化工具注册中心
    const toolRegistry = new ToolRegistry();
    
    // 初始化协调器
    this.coordinator = new AgentCoordinator(toolRegistry, { verbose: true });
    
    // 初始化LLM服务
    const llm = new LLMServiceHub();
    
    // 初始化搜索引擎
    const searchEngine = new BaiduSearchEngine();
    
    // 初始化工具
    const searchSuggestionTool = new SearchSuggestionTool({
      id: 'searchSuggestion',
      name: '搜索建议工具',
      searchEngine
    });
    
    const searchResultsTool = new SearchResultsTool({
      id: 'searchResults',
      name: '搜索结果工具',
      searchEngine
    });
    
    // 注册工具
    toolRegistry.registerTool(searchSuggestionTool);
    toolRegistry.registerTool(searchResultsTool);
    
    // 初始化Agent
    const keywordAgent = new KeywordAgent({
      id: 'keywordAgent',
      name: '关键词挖掘Agent',
      llm
    });
    
    const journeyAgent = new JourneyAgent({
      id: 'journeyAgent',
      name: '用户旅程模拟Agent',
      llm
    });
    
    const contentAgent = new ContentAgent({
      id: 'contentAgent',
      name: '内容分析Agent',
      llm
    });
    
    const reportAgent = new ReportAgent({
      id: 'reportAgent',
      name: '报告生成Agent',
      llm,
      outputDir: './output'
    });
    
    // 为Agent注册工具
    keywordAgent.registerTool(searchSuggestionTool);
    journeyAgent.registerTool(searchSuggestionTool);
    contentAgent.registerTool(searchResultsTool);
    
    // 注册Agent
    this.coordinator.registerAgent('keywordAgent', keywordAgent);
    this.coordinator.registerAgent('journeyAgent', journeyAgent);
    this.coordinator.registerAgent('contentAgent', contentAgent);
    this.coordinator.registerAgent('reportAgent', reportAgent);
    
    logger.info('AgentSystemDemo初始化完成');
  }
  
  /**
   * 执行关键词分析
   */
  public async analyzeKeyword(keyword: string): Promise<any> {
    logger.info(`开始关键词分析: ${keyword}`);
    
    try {
      // 执行工作流
      const result = await this.coordinator.executeWorkflow('keywordAnalysis', { keyword });
      
      logger.info('关键词分析完成', { keyword });
      
      return result;
    } catch (error) {
      logger.error('关键词分析失败', { error, keyword });
      throw error;
    }
  }
}

// 示例使用方法
async function runDemo() {
  try {
    const demo = new AgentSystemDemo();
    const result = await demo.analyzeKeyword('智能家居控制系统');
    
    console.log('分析结果:', result);
  } catch (error) {
    console.error('演示失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runDemo();
} 