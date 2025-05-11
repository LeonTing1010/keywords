/**
 * AdaptiveScheduler.ts
 * 提供基于资源和需求的Agent动态调度能力
 */
import { EventEmitter } from 'events';
import { logger } from '../../infra/logger';
import { FailureType, RecoveryManager, RecoveryStrategy } from '../../core/coordinator/RecoveryManager';

/**
 * 资源监控配置
 */
export interface ResourceMonitorConfig {
  pollInterval?: number;        // 监控间隔（毫秒）
  cpuThreshold?: number;        // CPU使用率阈值
  memoryThreshold?: number;     // 内存使用率阈值
  maxConcurrentAgents?: number; // 最大并发Agent数量
}

/**
 * Agent优先级
 */
export enum AgentPriority {
  CRITICAL = 0,    // 关键，必须执行
  HIGH = 1,        // 高优先级
  NORMAL = 2,      // 正常优先级
  LOW = 3,         // 低优先级
  BACKGROUND = 4   // 背景任务，可延迟执行
}

/**
 * Agent调度信息
 */
export interface AgentScheduleInfo {
  agentId: string;
  priority: AgentPriority;
  estimatedDuration: number;    // 预估执行时间（毫秒）
  resourceIntensity: number;    // 资源消耗强度 (0-1)
  dependencies: string[];       // 依赖的Agent ID列表
  canExecuteParallel: boolean;  // 是否可并行执行
  tags: string[];               // 标签列表
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  agentId: string;
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: any;
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  workflowId: string;
  steps: WorkflowStep[];
  parallelGroups?: string[][];  // 可并行执行的步骤组
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

/**
 * 系统资源状态
 */
interface SystemResources {
  cpuUsage: number;       // CPU使用率 (0-1)
  memoryUsage: number;    // 内存使用率 (0-1)
  activeAgents: number;   // 当前活跃Agent数量
}

/**
 * 自适应调度器
 * 根据系统资源情况和任务优先级动态调整Agent执行
 */
export class AdaptiveScheduler {
  private readonly events: EventEmitter;
  private readonly agentRegistry: Map<string, AgentScheduleInfo>;
  private readonly workflows: Map<string, WorkflowConfig>;
  private readonly runningSteps: Set<string>;
  private readonly recoveryManager: RecoveryManager;
  private readonly defaultResourceConfig: Required<ResourceMonitorConfig> = {
    pollInterval: 5000,
    cpuThreshold: 0.8,
    memoryThreshold: 0.8,
    maxConcurrentAgents: 5
  };
  private readonly resourceConfig: Required<ResourceMonitorConfig>;
  private resources: SystemResources;
  private monitorIntervalId?: NodeJS.Timeout;
  private executeAgentFn?: (agentId: string, context: any) => Promise<any>;
  
  /**
   * 创建自适应调度器实例
   */
  constructor(
    resourceConfig: ResourceMonitorConfig = {},
    recoveryManager?: RecoveryManager
  ) {
    this.events = new EventEmitter();
    this.agentRegistry = new Map();
    this.workflows = new Map();
    this.runningSteps = new Set();
    this.recoveryManager = recoveryManager || new RecoveryManager();
    
    this.resourceConfig = {
      ...this.defaultResourceConfig,
      ...resourceConfig
    };
    
    this.resources = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeAgents: 0
    };
    
    // 开始资源监控
    this.startMonitoring();
  }
  
  /**
   * 注册Agent
   * @param info Agent调度信息
   */
  public registerAgent(info: AgentScheduleInfo): void {
    this.agentRegistry.set(info.agentId, info);
    logger.debug(`Agent registered: ${info.agentId}`, { priority: info.priority });
  }
  
  /**
   * 更新Agent信息
   * @param agentId Agent ID
   * @param updates 更新的信息
   */
  public updateAgentInfo(agentId: string, updates: Partial<AgentScheduleInfo>): void {
    const info = this.agentRegistry.get(agentId);
    if (info) {
      this.agentRegistry.set(agentId, { ...info, ...updates });
      logger.debug(`Agent info updated: ${agentId}`);
    } else {
      logger.warn(`Cannot update agent info: Agent ${agentId} not found`);
    }
  }
  
  /**
   * 注册工作流
   * @param config 工作流配置
   */
  public registerWorkflow(config: WorkflowConfig): void {
    // 确保工作流中的Agent都已注册
    const missingAgents = config.steps
      .map(step => step.agentId)
      .filter(agentId => !this.agentRegistry.has(agentId));
    
    if (missingAgents.length > 0) {
      logger.warn(`Workflow registration warning: Missing agents`, { missingAgents });
    }
    
    this.workflows.set(config.workflowId, config);
    logger.info({ steps: config.steps.length }, `Workflow registered: ${config.workflowId}`);
  }
  
  /**
   * 执行工作流
   * @param workflowId 工作流ID
   * @param initialContext 初始上下文
   */
  public async executeWorkflow(workflowId: string, initialContext: any = {}): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    logger.info({ workflowId }, `Starting workflow execution: ${workflowId}`);
    
    // 创建工作流执行上下文
    const context = {
      workflowId,
      startTime: Date.now(),
      data: initialContext,
      results: {}
    };
    
    try {
      // 获取初始可执行步骤
      const executableSteps = this.getExecutableSteps(workflow);
      
      // 按优先级排序并开始执行
      const sortedSteps = this.prioritizeSteps(executableSteps);
      await this.scheduleSteps(workflow, sortedSteps, context);
      
      // 返回工作流结果
      return context.results;
    } catch (error) {
      logger.error({ error }, `Workflow execution failed: ${workflowId}`);
      if (workflow.onError) {
        workflow.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * 获取可执行的工作流步骤
   * @param workflow 工作流配置
   * @returns 可执行的步骤列表
   * @private
   */
  private getExecutableSteps(workflow: WorkflowConfig): WorkflowStep[] {
    // 获取已完成步骤的ID
    const completedStepIds = new Set(
      workflow.steps
        .filter(step => step.status === 'completed')
        .map(step => step.stepId)
    );
    
    // 获取当前运行步骤的ID
    const runningStepIds = new Set(
      workflow.steps
        .filter(step => step.status === 'running')
        .map(step => step.stepId)
    );
    
    // 找出待执行的步骤
    return workflow.steps.filter(step => {
      // 只考虑等待执行的步骤
      if (step.status !== 'pending') {
        return false;
      }
      
      // 检查依赖的步骤是否全部完成
      const dependencies = this.getDependencies(workflow, step);
      const allDependenciesCompleted = dependencies.every(depId => completedStepIds.has(depId));
      
      return allDependenciesCompleted;
    });
  }
  
  /**
   * 获取步骤的所有依赖
   * @param workflow 工作流配置
   * @param step 工作流步骤
   * @returns 依赖步骤ID列表
   * @private
   */
  private getDependencies(workflow: WorkflowConfig, step: WorkflowStep): string[] {
    // 获取Agent的依赖
    const agentInfo = this.agentRegistry.get(step.agentId);
    const agentDependencies = agentInfo?.dependencies || [];
    
    // 将Agent依赖转换为步骤依赖
    const stepDependencies = agentDependencies.flatMap(depAgentId => {
      return workflow.steps
        .filter(s => s.agentId === depAgentId)
        .map(s => s.stepId);
    });
    
    // 添加工作流中的线性依赖（当前步骤之前的所有步骤）
    const stepIndex = workflow.steps.findIndex(s => s.stepId === step.stepId);
    const previousSteps = workflow.steps.slice(0, stepIndex).map(s => s.stepId);
    
    // 合并所有依赖（去重）
    return [...new Set([...stepDependencies, ...previousSteps])];
  }
  
  /**
   * 按优先级排序步骤
   * @param steps 工作流步骤列表
   * @returns 排序后的步骤列表
   * @private
   */
  private prioritizeSteps(steps: WorkflowStep[]): WorkflowStep[] {
    return [...steps].sort((a, b) => {
      const priorityA = this.agentRegistry.get(a.agentId)?.priority || AgentPriority.NORMAL;
      const priorityB = this.agentRegistry.get(b.agentId)?.priority || AgentPriority.NORMAL;
      
      // 优先级低的数值大
      return priorityA - priorityB;
    });
  }
  
  /**
   * 调度执行步骤
   * @param workflow 工作流配置
   * @param steps 步骤列表
   * @param context 执行上下文
   * @private
   */
  private async scheduleSteps(
    workflow: WorkflowConfig, 
    steps: WorkflowStep[],
    context: any
  ): Promise<void> {
    // 如果没有可执行步骤，检查工作流是否完成
    if (steps.length === 0) {
      // 检查是否有运行中的步骤
      const hasRunningSteps = workflow.steps.some(step => step.status === 'running');
      if (!hasRunningSteps) {
        // 检查是否有失败的步骤
        const failedSteps = workflow.steps.filter(step => step.status === 'failed');
        if (failedSteps.length > 0) {
          // 有失败步骤，工作流失败
          const error = new Error('Workflow failed due to failed steps');
          if (workflow.onError) {
            workflow.onError(error);
          }
          throw error;
        }
        
        // 工作流成功完成
        if (workflow.onComplete) {
          workflow.onComplete(context.results);
        }
        logger.info({ workflowId: workflow.workflowId }, `Workflow completed: ${workflow.workflowId}`);
      }
      
      return;
    }
    
    // 根据资源情况确定可同时执行的步骤数
    const parallelLimit = this.getParallelLimit();
    const currentRunning = this.runningSteps.size;
    const availableSlots = Math.max(0, parallelLimit - currentRunning);
    
    // 选择要执行的步骤
    const stepsToExecute = steps.slice(0, availableSlots);
    
    // 并行执行选中的步骤
    const stepPromises = stepsToExecute.map(async step => {
      // 更新步骤状态
      step.status = 'running';
      step.startTime = Date.now();
      this.runningSteps.add(step.stepId);
      
      try {
        logger.info({ agentId: step.agentId }, `Executing step: ${step.stepId}`);
        
        // 获取Agent信息
        const agentInfo = this.agentRegistry.get(step.agentId);
        if (!agentInfo) {
          throw new Error(`Agent not found: ${step.agentId}`);
        }
        
        // 检查Agent是否可执行（根据恢复管理器）
        if (!this.recoveryManager.canProceed(step.agentId)) {
          logger.warn({ stepId: step.stepId }, `Skipping step due to recent failures: ${step.stepId}`);
          step.status = 'skipped';
          this.runningSteps.delete(step.stepId);
          return;
        }
        
        // 调用自定义Agent执行逻辑
        let result;
        if (this.executeAgentFn) {
          result = await this.executeAgentFn(step.agentId, context.data);
        } else {
          // fallback: 模拟异步执行
          await new Promise(resolve => setTimeout(resolve, 100));
          result = { stepId: step.stepId, status: 'success', data: {} };
        }
        
        // 更新步骤状态和结果
        step.status = 'completed';
        step.endTime = Date.now();
        step.result = result;
        
        // 更新工作流上下文
        context.results[step.stepId] = result;
        
        logger.info({ stepId: step.stepId }, `Step completed: ${step.stepId}`);
      } catch (error: any) {
        // 记录失败
        step.status = 'failed';
        step.endTime = Date.now();
        step.error = error;
        
        // 通知恢复管理器
        const failureType = error.name === 'TimeoutError' 
          ? FailureType.TIMEOUT_ERROR 
          : FailureType.UNKNOWN_ERROR;
        
        this.recoveryManager.recordFailure(step.agentId, failureType, error, {
          stepId: step.stepId,
          workflowId: workflow.workflowId
        });
        
        // 获取恢复操作
        const failureRecord = this.recoveryManager.getFailureHistory(step.agentId).pop()!;
        const recoveryAction = this.recoveryManager.getRecoveryAction(failureRecord);
        
        logger.warn({ error, recovery: recoveryAction.strategy }, `Step failed: ${step.stepId}`);
        
        // 根据恢复策略采取行动
        switch (recoveryAction.strategy) {
          case RecoveryStrategy.RETRY:
            // 重置步骤状态，等待重试
            step.status = 'pending';
            logger.info({ delay: recoveryAction.delay }, `Scheduling retry for step: ${step.stepId}`);
            
            // 如果有延迟，添加延迟
            if (recoveryAction.delay) {
              await new Promise(resolve => {
                setTimeout(resolve, recoveryAction.delay);
              });
            }
            break;
            
          case RecoveryStrategy.SKIP:
            // 标记为已跳过
            step.status = 'skipped';
            logger.info({ stepId: step.stepId }, `Skipping failed step: ${step.stepId}`);
            break;
            
          case RecoveryStrategy.ABORT:
            // 中止工作流
            throw new Error(`Workflow aborted due to critical failure in step: ${step.stepId}`);
            
          // 其他恢复策略...
        }
      } finally {
        // 标记步骤不再运行
        this.runningSteps.delete(step.stepId);
      }
    });
    
    // 等待当前批次的步骤完成
    await Promise.all(stepPromises);
    
    // 继续执行后续步骤
    const nextSteps = this.getExecutableSteps(workflow);
    const nextSortedSteps = this.prioritizeSteps(nextSteps);
    await this.scheduleSteps(workflow, nextSortedSteps, context);
  }
  
  /**
   * 获取当前可并行执行的步骤数量
   * @returns 可并行步骤数量
   * @private
   */
  private getParallelLimit(): number {
    // 基于资源使用情况动态调整并行度
    
    // CPU负载过高 - 降低并行度
    if (this.resources.cpuUsage > this.resourceConfig.cpuThreshold) {
      return Math.max(1, Math.floor(this.resourceConfig.maxConcurrentAgents / 2));
    }
    
    // 内存负载过高 - 降低并行度
    if (this.resources.memoryUsage > this.resourceConfig.memoryThreshold) {
      return Math.max(1, Math.floor(this.resourceConfig.maxConcurrentAgents / 2));
    }
    
    // 资源正常 - 使用配置的最大并行度
    return this.resourceConfig.maxConcurrentAgents;
  }
  
  /**
   * 开始资源监控
   * @private
   */
  private startMonitoring(): void {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
    }
    
    this.monitorIntervalId = setInterval(() => {
      this.updateResourceInfo();
    }, this.resourceConfig.pollInterval);
    
    // 初始更新
    this.updateResourceInfo();
  }
  
  /**
   * 停止资源监控
   */
  public stopMonitoring(): void {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = undefined;
    }
  }
  
  /**
   * 更新资源使用情况
   * @private
   */
  private updateResourceInfo(): void {
    // 实际实现中，可以使用操作系统API获取真实资源使用情况
    // 此处为简化实现，使用模拟数据
    
    // 模拟负载随正在运行的Agent数量增加
    const activeAgents = this.runningSteps.size;
    const baseLoadFactor = activeAgents / this.resourceConfig.maxConcurrentAgents;
    
    // 添加一些随机波动
    const randomFactor = () => Math.random() * 0.2 - 0.1; // -0.1 to 0.1
    
    this.resources = {
      cpuUsage: Math.min(0.95, Math.max(0.05, baseLoadFactor * 0.7 + randomFactor())),
      memoryUsage: Math.min(0.95, Math.max(0.2, baseLoadFactor * 0.5 + randomFactor())),
      activeAgents
    };
    
    logger.debug('Resource monitor update', this.resources);
    
    // 触发资源更新事件
    this.events.emit('resources_updated', this.resources);
  }
  
  /**
   * 监听资源更新事件
   * @param handler 事件处理函数
   */
  public onResourcesUpdated(handler: (resources: SystemResources) => void): void {
    this.events.on('resources_updated', handler);
  }
  
  /**
   * 获取当前资源使用情况
   * @returns 系统资源状态
   */
  public getResourceInfo(): SystemResources {
    return { ...this.resources };
  }
  
  /**
   * 设置自定义Agent执行函数
   */
  public setAgentExecutor(fn: (agentId: string, context: any) => Promise<any>) {
    this.executeAgentFn = fn;
  }
} 