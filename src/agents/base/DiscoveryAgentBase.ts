/**
 * 问题发现Agent基类
 * 
 * 为参与问题发现流程的Agent提供基础功能
 * 实现DiscoveryAgent接口
 */
import { v4 as uuidv4 } from 'uuid';
import { EnhancedBaseAgent, EnhancedAgentConfig } from './EnhancedBaseAgent';
import { 
  DiscoveryAgent, 
  Problem, 
  AgentFeedback,
  Evidence 
} from '../../types/discovery';
import { logger } from '../../infra/logger';
import { StructuredTool } from '@langchain/core/tools';

/**
 * 问题发现Agent的基础配置
 */
export interface DiscoveryAgentBaseConfig extends EnhancedAgentConfig {
  agentId?: string;
  agentName?: string;
  feedbackConfidence?: number;
  adaptiveMode?: boolean;
  learningRate?: number;
}

/**
 * 问题发现Agent基类
 * 拓展EnhancedBaseAgent并实现DiscoveryAgent接口的通用功能
 */
export abstract class DiscoveryAgentBase extends EnhancedBaseAgent implements DiscoveryAgent {
  // DiscoveryAgent接口属性
  public readonly id: string;
  public abstract readonly type: 'explorer' | 'simulator' | 'evaluator' | 'strategist';
  
  // 额外配置
  protected feedbackConfidence: number;
  protected adaptiveMode: boolean;
  protected learningRate: number;
  protected feedbackHistory: Map<string, AgentFeedback[]> = new Map();
  protected successfulStrategies: Map<string, number> = new Map();

  /**
   * 构造函数
   */
  constructor(config: DiscoveryAgentBaseConfig = {}) {
    // 初始化EnhancedBaseAgent
    super(
      config.agentName || 'DiscoveryAgent', 
      [], // 工具在setupTools中初始化
      config
    );
    
    // 初始化Agent标识
    this.id = config.agentId || uuidv4();
    
    // 配置反馈置信度
    this.feedbackConfidence = config.feedbackConfidence || 0.8;
    
    // 初始化自适应模式配置
    this.adaptiveMode = config.adaptiveMode !== false;
    this.learningRate = config.learningRate || 0.05;
    
    logger.debug({ name: this.name, id: this.id, adaptiveMode: this.adaptiveMode }, 
      `DiscoveryAgent initialized: ${this.name} (${this.id})`);
    
    // 初始化子类工具
    this.setupTools();
  }

  /**
   * 设置Agent所需的工具
   * 子类需要重写此方法
   */
  protected abstract setupTools(): void;

  /**
   * 注册工具到Agent
   */
  protected registerTool(tool: StructuredTool): void {
    this.tools.push(tool);
  }
  
  /**
   * 注册多个工具到Agent
   */
  protected registerTools(tools: StructuredTool[]): void {
    this.tools.push(...tools);
  }

  /**
   * 处理输入数据并返回结果
   * 由子类实现具体处理逻辑
   */
  public abstract process(input: any): Promise<any>;

  /**
   * 执行Agent逻辑
   * 实现EnhancedBaseAgent的抽象方法
   */
  public async enhancedExecuteImpl(state: any, config?: any): Promise<any> {
    logger.debug({ name: this.name, state }, `${this.name} executing with state`);
    return await this.process(state);
  }

  /**
   * 为问题提供反馈
   * @param problem 要提供反馈的问题
   */
  public async provideFeedback(problem: Problem): Promise<AgentFeedback> {
    logger.debug({ name: this.name, problemId: problem.id }, `${this.name} providing feedback for problem: ${problem.id}`);
    
    try {
      let feedback: AgentFeedback;
      
      // 根据自适应模式选择反馈生成方法
      if (this.adaptiveMode) {
        feedback = await this.generateAdaptiveFeedback(problem);
      } else {
        feedback = await this.generateFeedback(problem);
      }
      
      // 存储反馈用于学习
      if (!this.feedbackHistory.has(problem.id)) {
        this.feedbackHistory.set(problem.id, []);
      }
      this.feedbackHistory.get(problem.id)!.push(feedback);
      
      // 根据反馈历史进行学习
      if (this.adaptiveMode && this.feedbackHistory.size > 5) {
        this.learnFromFeedbackHistory();
      }
      
      return feedback;
    } catch (error: any) {
      logger.error({ error, problemId: problem.id }, `Error generating feedback: ${error.message}`);
      
      // 返回默认反馈
      return this.createDefaultFeedback(problem, error);
    }
  }

  /**
   * 生成问题反馈
   * 由子类根据自身专业领域实现
   */
  protected abstract generateFeedback(problem: Problem): Promise<AgentFeedback>;

  /**
   * 生成自适应问题反馈
   * 可被子类覆盖以实现更高级的自适应逻辑
   */
  protected async generateAdaptiveFeedback(problem: Problem): Promise<AgentFeedback> {
    // 默认实现 - 根据历史反馈调整策略
    const strategy = this.getMostSuccessfulStrategy();
    const feedback = await this.generateFeedback(problem);
    
    // 附加策略元数据以跟踪哪些策略更成功
    if (!feedback.metadata) {
      feedback.metadata = {};
    }
    feedback.metadata.strategy = strategy;
    feedback.metadata.adaptiveMode = true;
    
    return feedback;
  }

  /**
   * 从反馈历史中学习
   * 优化未来的反馈生成
   */
  protected learnFromFeedbackHistory(): void {
    logger.debug({ name: this.name }, `Learning from feedback history`);
    
    // 分析哪些反馈方法更成功
    let successfulCount = 0;
    let totalCount = 0;
    
    for (const [problemId, feedbacks] of this.feedbackHistory.entries()) {
      // 只考虑有多个反馈的问题
      if (feedbacks.length < 2) continue;
      
      // 按时间戳排序，最新的优先
      const sortedFeedback = [...feedbacks].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const latestFeedback = sortedFeedback[0];
      
      // 跟踪成功的策略
      const strategy = latestFeedback.metadata?.strategy || 'default';
      
      if (latestFeedback.feedbackType === 'validation' && 
          latestFeedback.validationResults?.isValid) {
        successfulCount++;
        
        // 增加此策略的成功计数
        this.successfulStrategies.set(
          strategy, 
          (this.successfulStrategies.get(strategy) || 0) + 1
        );
      }
      
      totalCount++;
    }
    
    if (totalCount > 0) {
      const successRate = successfulCount / totalCount;
      logger.debug(
        { name: this.name, successRate }, 
        `Feedback success rate: ${successRate.toFixed(2)}`
      );
    }
  }

  /**
   * 获取基于反馈历史的最成功策略
   */
  protected getMostSuccessfulStrategy(): string {
    if (this.successfulStrategies.size === 0) {
      return 'default';
    }
    
    let bestStrategy = 'default';
    let highestSuccess = 0;
    
    for (const [strategy, successCount] of this.successfulStrategies.entries()) {
      if (successCount > highestSuccess) {
        highestSuccess = successCount;
        bestStrategy = strategy;
      }
    }
    
    return bestStrategy;
  }

  /**
   * 创建默认反馈（出错时使用）
   */
  protected createDefaultFeedback(problem: Problem, error?: any): AgentFeedback {
    return {
      id: uuidv4(),
      agentId: this.id,
      agentType: this.type,
      problemId: problem.id,
      timestamp: new Date().toISOString(),
      feedbackType: 'validation',
      confidenceScore: 0.5,
      validationResults: {
        isValid: true,
        validationReasoning: "无法生成详细反馈，但问题基本有效",
        suggestions: []
      },
      metadata: {
        error: error ? error.message : 'Unknown error',
        adaptiveMode: this.adaptiveMode
      }
    };
  }

  /**
   * 创建证据
   * 辅助子类创建标准化证据
   */
  protected createEvidence(
    type: Evidence['type'],
    source: string,
    content: string,
    relevanceScore: number = 0.8,
    metadata?: Record<string, any>
  ): Evidence {
    return {
      type,
      source,
      content,
      relevanceScore,
      timestamp: new Date().toISOString(),
      metadata
    };
  }
} 