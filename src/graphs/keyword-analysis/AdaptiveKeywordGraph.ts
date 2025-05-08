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
import { AdaptiveScheduler, AgentPriority, AgentScheduleInfo, WorkflowConfig, WorkflowStep } from '../../core/coordinator/AdaptiveScheduler';

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
  
  // 1. 构建Agent调度信息
  const agentInfos: AgentScheduleInfo[] = [
    {
      agentId: 'keywordAgent',
      priority: mergedConfig.prioritizeKeywordDiscovery ? AgentPriority.HIGH : AgentPriority.NORMAL,
      estimatedDuration: 1000,
      resourceIntensity: 0.3,
      dependencies: [],
      canExecuteParallel: false,
      tags: ['keyword']
    },
    {
      agentId: 'journeyAgent',
      priority: AgentPriority.NORMAL,
      estimatedDuration: 1200,
      resourceIntensity: 0.4,
      dependencies: ['keywordAgent'],
      canExecuteParallel: false,
      tags: ['journey']
    },
    {
      agentId: 'contentAgent',
      priority: AgentPriority.NORMAL,
      estimatedDuration: 1500,
      resourceIntensity: 0.5,
      dependencies: ['journeyAgent'],
      canExecuteParallel: false,
      tags: ['content']
    },
    {
      agentId: 'reportAgent',
      priority: AgentPriority.NORMAL,
      estimatedDuration: 800,
      resourceIntensity: 0.2,
      dependencies: ['contentAgent'],
      canExecuteParallel: false,
      tags: ['report']
    }
  ];

  // 2. 构建工作流步骤
  const steps: WorkflowStep[] = [
    { agentId: 'keywordAgent', stepId: 'step_keyword', status: 'pending' },
    { agentId: 'journeyAgent', stepId: 'step_journey', status: 'pending' },
    { agentId: 'contentAgent', stepId: 'step_content', status: 'pending' },
    { agentId: 'reportAgent', stepId: 'step_report', status: 'pending' }
  ];

  // 3. 构建工作流配置
  const workflowConfig: WorkflowConfig = {
    workflowId: 'adaptive_keyword_workflow',
    steps,
    onComplete: (result) => logger.info('自适应工作流完成', { result }),
    onError: (error) => logger.error('自适应工作流出错', { error })
  };

  // 4. 创建调度器并注册Agent和工作流
  const scheduler = new AdaptiveScheduler({
    maxConcurrentAgents: mergedConfig.maxConcurrentAgents
  });
  agentInfos.forEach(info => scheduler.registerAgent(info));
  scheduler.registerWorkflow(workflowConfig);

  // 5. 返回调度器和执行方法
  return {
    scheduler,
    config: mergedConfig,
    async run(initialInput: any) {
      // 绑定Agent执行逻辑
      const agentMap = {
        keywordAgent: agents.keywordAgent,
        journeyAgent: agents.journeyAgent,
        contentAgent: agents.contentAgent,
        reportAgent: agents.reportAgent
      };
      scheduler.setAgentExecutor(async (agentId, context) => {
        const agent = agentMap[agentId as keyof typeof agentMap];
        if (!agent) throw new Error(`Agent not found: ${agentId}`);
        // 合并前序结果，确保ReportAgent等能拿到keyword和所有中间结果
        let agentInput = context;
        if (context && context.results) {
          agentInput = { ...context, ...context.results };
        }
        // 确保 input 字段存在且有 keyword
        if (!agentInput.input) {
          agentInput.input = {};
        }
        if (!agentInput.input.keyword && agentInput.keyword) {
          agentInput.input.keyword = agentInput.keyword;
        }
        return await agent.execute(agentInput);
      });
      // 执行自适应工作流
      return await scheduler.executeWorkflow('adaptive_keyword_workflow', initialInput);
    }
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