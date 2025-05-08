/**
 * KeywordAnalysisGraph.ts - 关键词分析工作流定义
 * 使用LangGraph定义多Agent协作的工作流
 */
import { END, StateGraph } from '@langchain/langgraph';
import { GraphStateType } from '../../types/schema';
import { 
  KeywordAgent, 
  JourneyAgent, 
  ContentAgent, 
  ReportAgent 
} from '../../agents';
import { logger } from '../../infra/logger';

/**
 * 工作流配置项
 */
export interface KeywordAnalysisGraphConfig {
  enableJourneySim?: boolean;
  enableDetailsInReport?: boolean;
  fastMode?: boolean;
  outputDir?: string;
  format?: 'markdown' | 'json';
  language?: 'zh' | 'en';
}

/**
 * 定义状态转换逻辑，判断下一步应该走哪个节点
 */
const routeToNextNode = (state: GraphStateType) => {
  const executionMetadata = state.executionMetadata || {};
  const currentNode = executionMetadata.currentNode || 'start';
  const completedNodes = executionMetadata.completedNodes || [];
  
  logger.debug('Routing to next node', { currentNode, completedNodes });
  
  // 根据当前节点和配置决定下一步
  switch (currentNode) {
    case 'start':
      return 'keywordDiscovery';
      
    case 'keywordDiscovery':
      // 如果启用了用户旅程模拟，则下一步是journeySimulation
      if (state.input.options?.fast === true) {
        // 快速模式下跳过旅程模拟，直接进行内容分析
        return 'contentAnalysis';
      }
      return 'journeySimulation';
      
    case 'journeySimulation':
      return 'contentAnalysis';
      
    case 'contentAnalysis':
      return 'reportGeneration';
      
    case 'reportGeneration':
      return END;
      
    default:
      logger.warn('Unknown node in workflow', { currentNode });
      return END;
  }
};

/**
 * 创建关键词分析工作流图
 */
export function createKeywordAnalysisGraph(config: KeywordAnalysisGraphConfig = {}) {
  try {
    logger.info('Creating keyword analysis graph', { config });
    
    // 默认配置
    const enableJourneySim = config.enableJourneySim !== false; // 默认启用
    const enableDetailsInReport = config.enableDetailsInReport === true; // 默认禁用
    const fastMode = config.fastMode === true; // 默认禁用
    const format = config.format || 'markdown';
    const language = config.language || 'zh';
    const outputDir = config.outputDir || './output';
    
    // 创建各Agent实例
    const keywordAgent = new KeywordAgent({
      useAutocomplete: !fastMode,  // 快速模式下禁用自动补全
      maxKeywords: fastMode ? 10 : 30  // 快速模式减少关键词数量
    });
    
    const journeyAgent = new JourneyAgent({
      maxSteps: fastMode ? 3 : 5  // 快速模式减少模拟步骤
    });
    
    const contentAgent = new ContentAgent({
      maxContentSamples: fastMode ? 3 : 5,  // 快速模式减少内容样本
      detailedAnalysis: !fastMode  // 快速模式简化分析
    });
    
    const reportAgent = new ReportAgent({
      format,
      language,
      outputDir,
      includeDetails: enableDetailsInReport
    });
    
    // 创建工作流图实例
    const builder = new StateGraph({
      channels: {
        keywordDiscovery: { value: null },
        journeySimulation: { value: null },
        contentAnalysis: { value: null },
        reportGeneration: { value: null },
      }
    });
    
    // 添加节点
    builder.addNode("keywordDiscovery", keywordAgent.createGraphNode());
    builder.addNode("journeySimulation", journeyAgent.createGraphNode());
    builder.addNode("contentAnalysis", contentAgent.createGraphNode());
    builder.addNode("reportGeneration", reportAgent.createGraphNode());
    
    // 添加边 - 使用正确的API
    builder.addEdge("__start__", "keywordDiscovery");
    
    // 条件路由
    builder.addConditionalEdges(
      "keywordDiscovery",
      (state: GraphStateType) => {
        if (state.input.options?.fast === true) {
          return "contentAnalysis";
        }
        return "journeySimulation";
      }
    );
    
    // 添加常规边
    builder.addEdge("journeySimulation", "contentAnalysis");
    
    builder.addEdge("contentAnalysis", "reportGeneration");
    
    builder.addEdge("reportGeneration", "__end__");
    
    // 编译工作流
    const graph = builder.compile();
    
    logger.info('Keyword analysis graph created successfully');
    
    return graph;
  } catch (error) {
    logger.error('Failed to create keyword analysis graph', { error });
    throw error;
  }
}

/**
 * 创建快速分析工作流图
 * 简化版本，跳过用户旅程模拟
 */
export function createFastKeywordAnalysisGraph(config: KeywordAnalysisGraphConfig = {}) {
  return createKeywordAnalysisGraph({
    ...config,
    fastMode: true,
    enableJourneySim: false
  });
} 