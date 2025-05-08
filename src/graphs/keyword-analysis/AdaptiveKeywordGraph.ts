/**
 * AdaptiveKeywordGraph.ts - 自适应多Agent工作流图
 * 
 * 创建智能、高效的自适应工作流，根据需要执行Agent
 */
import { RunnableConfig } from '@langchain/core/runnables';
import { RunnableLambda, Runnable } from '@langchain/core/runnables';
import { END, StateGraph } from '@langchain/langgraph';
import { 
  KeywordAgent, 
  JourneyAgent, 
  ContentAgent, 
  ReportAgent 
} from '../../agents';
import { BaseAgent } from '../../agents/base/BaseAgent';
import { logger } from '../../infra/logger';
import { WebSearchEngine } from '../../infra/search/engines/WebSearchEngine';
import { SearchTools } from '../../tools/search/SearchTools';

/**
 * 工作流配置
 */
export interface AdaptiveWorkflowConfig {
  // 图配置
  fastMode?: boolean;
  maxConcurrentAgents?: number;
  prioritizeKeywordDiscovery?: boolean;
  
  // 输出配置
  outputDir?: string;
  format?: 'markdown' | 'json';
  language?: 'zh' | 'en';
}

/**
 * 创建自适应工作流
 */
export function createAdaptiveWorkflow(
  agents: {
    keywordAgent: KeywordAgent;
    journeyAgent: JourneyAgent;
    contentAgent: ContentAgent;
    reportAgent: ReportAgent;
  },
  config: AdaptiveWorkflowConfig = {}
) {
  // 默认配置
  const defaultConfig: AdaptiveWorkflowConfig = {
    fastMode: false,
    maxConcurrentAgents: 2,
    prioritizeKeywordDiscovery: false,
    outputDir: './output',
    format: 'markdown',
    language: 'zh'
  };
  
  // 合并配置
  const mergedConfig = { ...defaultConfig, ...config };
  
  logger.info('自适应工作流已创建', { 
    fastMode: mergedConfig.fastMode,
    maxConcurrentAgents: mergedConfig.maxConcurrentAgents,
    numAgents: Object.keys(agents).length
  });
  
  // 创建状态图
  const workflow = new StateGraph({
    channels: {
      // 输入/输出渠道
      input: {
        value: null,
        default: () => ({
          keyword: "",
          options: {
            includeDetails: !mergedConfig.fastMode,
            fast: mergedConfig.fastMode
          }
        })
      },
      
      // 节点结果渠道
      keywordDiscovery: { value: null },
      journeySimulation: { value: null },
      contentAnalysis: { value: null },
      reportGeneration: { value: null },
      
      // 元数据渠道
      executionMetadata: {
        value: null,
        default: () => ({
          startTime: Date.now(),
          currentNode: 'start',
          errors: [],
          completedNodes: [],
          nodeDecisions: {}
        })
      },
      
      // 最终输出
      output: { value: null }
    }
  });
  
  // 注册Agent节点
  for (const [name, agent] of Object.entries(agents)) {
    const priority = agent instanceof KeywordAgent && mergedConfig.prioritizeKeywordDiscovery ? 1 : 2;
    
    workflow.addNode(name, createAgentNode(agent));
    
    logger.debug(`Agent registered: ${name}`, { priority });
  }

  // 定义工作流程
  
  // 添加开始节点
  workflow.addNode('start', new RunnableLambda({
    func: (state: any) => {
      return {
        ...state,
        executionMetadata: {
          ...state.executionMetadata,
          startTime: Date.now(),
          currentNode: 'start'
        }
      };
    }
  }));
  
  // 添加结束节点
  workflow.addNode('end', new RunnableLambda({
    func: (state: any) => {
      // 计算执行时间
      const executionTime = Date.now() - state.executionMetadata.startTime;
      
      // 处理各Agent结果，生成最终输出
      return {
        ...state,
        output: {
          keyword: state.input.keyword,
          keywordDiscovery: state.keywordDiscovery,
          journeySimulation: state.journeySimulation,
          contentAnalysis: state.contentAnalysis,
          reportGeneration: state.reportGeneration,
          executionMetadata: {
            ...state.executionMetadata,
            endTime: Date.now(),
            totalExecutionTimeMs: executionTime
          },
          finalReport: state.reportGeneration || {}
        }
      };
    }
  }));
  
  // 设置边界和决策逻辑
  workflow.setEntryPoint('start');
  
  // 从start到关键词发现
  workflow.addEdge('start', 'keywordAgent');
  
  // 关键词发现到客户旅程
  workflow.addEdge('keywordAgent', 'journeyAgent');
  
  // 客户旅程到内容分析
  workflow.addEdge('journeyAgent', 'contentAgent');
  
  // 内容分析到报告生成
  workflow.addEdge('contentAgent', 'reportAgent');
  
  // 报告生成到结束
  workflow.addEdge('reportAgent', 'end');
  
  // 结束节点需要连接到END标记，表示工作流结束
  workflow.addEdge('end', END);
  
  // 编译工作流
  return {
    graph: workflow,
    config: mergedConfig
  };
}

/**
 * 创建Agent节点
 */
function createAgentNode(agent: BaseAgent): Runnable {
  return new RunnableLambda({
    func: async (state: any, config?: RunnableConfig) => {
      try {
        // 更新元数据
        const currentNode = agent.constructor.name.replace('Agent', '').toLowerCase();
        
        logger.info(`执行节点 ${currentNode}`);
        logger.debug(`Node input state for ${currentNode}`, {
          keyword: state.input?.keyword || state.keyword,
          options: state.input?.options,
          currentNode: state.executionMetadata?.currentNode || 'start',
          completedNodes: (state.executionMetadata?.completedNodes || []).length,
          hasErrors: (state.executionMetadata?.errors || []).length > 0
        });
        
        // 执行Agent
        const result = await agent.execute(state);
        
        // 更新执行元数据
        return {
          ...state,
          ...result,
          executionMetadata: {
            ...state.executionMetadata,
            currentNode,
            completedNodes: [
              ...(state.executionMetadata?.completedNodes || []),
              currentNode
            ]
          }
        };
      } catch (error: any) {
        // 记录错误
        logger.error(`Error executing node ${agent.constructor.name}`, {
          errorMessage: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // 更新状态，添加错误但继续执行工作流
        return {
          ...state,
          executionMetadata: {
            ...state.executionMetadata,
            errors: [
              ...(state.executionMetadata?.errors || []),
              {
                node: agent.constructor.name,
                message: error.message,
                timestamp: Date.now()
              }
            ]
          }
        };
      }
    }
  });
}

/**
 * 初始化并创建自适应工作流的工厂函数
 */
export async function initializeAdaptiveWorkflow(config: AdaptiveWorkflowConfig = {}) {
  // 创建共享的搜索工具实例
  const searchTools = new SearchTools();
  
  // 创建各Agent实例
  const keywordAgent = new KeywordAgent({ 
    useAutocomplete: true,
    searchTools
  });
  
  const journeyAgent = new JourneyAgent({ 
    maxSteps: config.fastMode ? 2 : 3,
    searchTools
  });
  
  const contentAgent = new ContentAgent({
    maxContentSamples: config.fastMode ? 2 : 3,
    searchTools
  });
  
  const reportAgent = new ReportAgent({
    format: config.format || 'markdown',
    language: config.language || 'zh',
    outputDir: config.outputDir || './output'
  });

  // 创建工作流
  return createAdaptiveWorkflow(
    { keywordAgent, journeyAgent, contentAgent, reportAgent },
    config
  );
} 