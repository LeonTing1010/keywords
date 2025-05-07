/**
 * AgentCoordinator - Agent协调中心
 * 管理多Agent生命周期、任务分配与通信协作
 */
import { Agent } from './Agent';
import { ToolRegistry } from './ToolRegistry';
import { logger } from '../core/logger';

export interface CoordinatorConfig {
  verbose?: boolean;
  maxRetries?: number;
  parallelExecution?: boolean;
}

export class AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private toolRegistry: ToolRegistry;
  private config: CoordinatorConfig;
  
  constructor(toolRegistry: ToolRegistry, config: CoordinatorConfig = {}) {
    this.toolRegistry = toolRegistry;
    this.config = {
      verbose: config.verbose || false,
      maxRetries: config.maxRetries || 3,
      parallelExecution: config.parallelExecution || false
    };
    
    logger.info('Agent协调中心初始化完成');
  }
  
  /**
   * 注册Agent
   */
  public registerAgent(id: string, agent: Agent): void {
    if (this.agents.has(id)) {
      throw new Error(`Agent ID "${id}" 已存在`);
    }
    
    this.agents.set(id, agent);
    logger.info(`已注册Agent: ${id}`);
  }
  
  /**
   * 执行工作流
   */
  public async executeWorkflow(workflowName: string, input: any): Promise<any> {
    logger.info(`开始执行工作流: ${workflowName}`, { input });
    
    try {
      // 实现工作流逻辑
      if (workflowName === 'keywordAnalysis') {
        return await this.executeKeywordAnalysisWorkflow(input);
      } else {
        throw new Error(`未知工作流: ${workflowName}`);
      }
    } catch (error) {
      logger.error(`工作流执行失败: ${workflowName}`, { error });
      throw error;
    }
  }
  
  /**
   * 关键词分析工作流
   */
  private async executeKeywordAnalysisWorkflow(input: any): Promise<any> {
    // 1. 获取所需的Agent
    const keywordAgent = this.agents.get('keywordAgent');
    const journeyAgent = this.agents.get('journeyAgent');
    const contentAgent = this.agents.get('contentAgent');
    const reportAgent = this.agents.get('reportAgent');
    
    if (!keywordAgent || !journeyAgent || !contentAgent || !reportAgent) {
      throw new Error('缺少必要的Agent');
    }
    
    // 2. 执行工作流步骤
    
    // 关键词挖掘
    const keyword = input.keyword;
    const keywordResult = await keywordAgent.execute({
      task: 'discoverKeywords',
      data: { keyword }
    });
    
    // 用户旅程模拟
    const journeyResult = await journeyAgent.execute({
      task: 'simulateJourney',
      data: { 
        keyword,
        discoveredKeywords: keywordResult.discoveredKeywords
      }
    });
    
    // 内容分析
    const contentResult = await contentAgent.execute({
      task: 'analyzeContent',
      data: { 
        keyword,
        journeyResult,
        discoveredKeywords: keywordResult.discoveredKeywords
      }
    });
    
    // 生成报告
    const reportResult = await reportAgent.execute({
      task: 'generateReport',
      data: { 
        keyword,
        keywordResult,
        journeyResult,
        contentResult
      }
    });
    
    return {
      keyword,
      report: reportResult.report,
      insights: contentResult.insights,
      unmetNeeds: contentResult.unmetNeeds
    };
  }
} 