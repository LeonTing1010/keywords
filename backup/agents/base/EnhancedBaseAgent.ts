/**
 * EnhancedBaseAgent.ts - 增强版的LangGraph Agent 基类
 * 提供所有Agent共有的基础功能，并增加了失败恢复与状态共享能力
 */
import { StructuredTool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { BaseAgent, BaseAgentConfig } from "./BaseAgent";
import { StateRegistry } from "../../core/registry/StateRegistry";
import { RecoveryManager, FailureType } from "../../core/coordinator/RecoveryManager";
import { logger } from "../../infra/logger";

// 增强版Agent配置类型，扩展BaseAgentConfig
export interface EnhancedAgentConfig extends BaseAgentConfig {
  stateRegistry?: StateRegistry;
  recoveryManager?: RecoveryManager;
  shareProgressUpdates?: boolean;
  cacheResults?: boolean;
}

/**
 * 增强版LangGraph Agent 基类
 * 继承BaseAgent基础功能，并增加了失败恢复与状态共享能力
 */
export abstract class EnhancedBaseAgent<S = any, R = any> extends BaseAgent<S, R> {
  protected stateRegistry?: StateRegistry;
  protected recoveryManager?: RecoveryManager;
  
  // Agent元数据
  public readonly version: string = "1.0.0";
  public readonly description?: string;
  
  // Agent配置选项
  protected readonly shareProgressUpdates: boolean;
  protected readonly cacheResults: boolean;
  
  // 共享状态键前缀
  protected readonly stateKeyPrefix: string;
  
  /**
   * 创建Agent实例
   */
  constructor(
    name: string,
    tools: StructuredTool[] = [],
    config: EnhancedAgentConfig = {}
  ) {
    // 调用BaseAgent构造函数初始化基础功能
    super(config);
    
    // 手动设置名称
    this.name = name;
    
    // 添加工具
    if (tools.length > 0) {
      this.registerTools(tools);
    }
    
    this.shareProgressUpdates = config.shareProgressUpdates !== false;
    this.cacheResults = config.cacheResults !== false;
    this.stateKeyPrefix = `agent:${this.name}:`;
    
    // 设置状态注册中心和恢复管理器
    this.stateRegistry = config.stateRegistry;
    this.recoveryManager = config.recoveryManager;
    
    logger.debug({ name: this.name }, `EnhancedAgent initialized: ${this.name}`);
  }
  
  /**
   * 实现BaseAgent的抽象方法
   * 添加缓存和恢复功能
   */
  public async executeImpl(state: S, config?: RunnableConfig): Promise<R> {
    try {
      // 尝试从缓存获取结果
      if (this.cacheResults) {
        const cachedResult = this.getCachedResult(state);
        if (cachedResult) {
          if (this.config.verbose) {
            logger.debug({ name: this.name, state }, `${this.name}: Using cached result`);
          }
          return cachedResult;
        }
      }
      
      // 发送进度更新
      if (this.shareProgressUpdates) {
        this.updateProgress({
          status: 'running',
          message: `开始执行 ${this.name}`,
          timestamp: Date.now()
        });
      }
      
      // 子类实现具体的执行逻辑
      const result = await this.enhancedExecuteImpl(state, config);
      
      // 如果启用缓存，保存结果
      if (this.cacheResults) {
        this.setCachedResult(state, result);
      }
      
      // 发送进度更新
      if (this.shareProgressUpdates) {
        this.updateProgress({
          status: 'completed',
          message: `完成执行 ${this.name}`,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error: any) {
      logger.error({ error }, `Error in ${this.name}:`);
      
      // 记录失败并获取恢复行动
      if (this.recoveryManager) {
        const failureType = this.determineFailureType(error);
        const failureRecord = this.recoveryManager.recordFailure(
          this.name,
          failureType,
          error,
          { state }
        );
        
        const recoveryAction = this.recoveryManager.getRecoveryAction(failureRecord);
        logger.warn({ name: this.name, strategy: recoveryAction.strategy }, `Recovery strategy for ${this.name}: ${recoveryAction.strategy}`);
        
        // 发送进度更新
        if (this.shareProgressUpdates) {
          this.updateProgress({
            status: 'failed',
            message: `${this.name} 执行失败: ${error.message}`,
            failureType,
            recoveryStrategy: recoveryAction.strategy,
            timestamp: Date.now()
          });
        }
      }
      
      // 向上抛出错误
      throw error;
    }
  }
  
  /**
   * 子类应该重写此方法提供具体执行逻辑
   */
  protected abstract enhancedExecuteImpl(state: S, config?: RunnableConfig): Promise<R>;
  
  /**
   * 设置Agent所需的工具
   * 子类需要重写此方法
   */
  protected abstract setupTools(): void;
  
  /**
   * 确定错误类型
   * @param error 错误对象
   * @private
   */
  private determineFailureType(error: any): FailureType {
    if (!error) {
      return FailureType.UNKNOWN_ERROR;
    }
    
    // 检查错误名称和消息
    const errorName = error.name || '';
    const errorMessage = error.message || '';
    
    if (errorName === 'TimeoutError' || errorMessage.includes('timeout')) {
      return FailureType.TIMEOUT_ERROR;
    }
    
    if (errorMessage.includes('API') || errorMessage.includes('rate limit')) {
      return FailureType.EXTERNAL_API_ERROR;
    }
    
    if (
      errorMessage.includes('parse') ||
      errorMessage.includes('JSON') ||
      errorMessage.includes('syntax')
    ) {
      return FailureType.PARSING_ERROR;
    }
    
    if (errorMessage.includes('validation') || errorName.includes('ValidationError')) {
      return FailureType.VALIDATION_ERROR;
    }
    
    if (
      errorMessage.includes('OpenAI') ||
      errorMessage.includes('model') ||
      errorName.includes('LLMError')
    ) {
      return FailureType.LLM_ERROR;
    }
    
    return FailureType.UNKNOWN_ERROR;
  }
  
  /**
   * 从共享状态获取缓存的结果
   * @param state 输入状态
   * @private
   */
  private getCachedResult(state: S): R | null {
    if (!this.stateRegistry) {
      return null;
    }
    
    try {
      // 根据输入状态创建缓存键
      const cacheKey = this.createCacheKey(state);
      return this.stateRegistry.get<R>(cacheKey);
    } catch (error) {
      logger.warn({ name: this.name, error }, `Error getting cached result for ${this.name}`);
      return null;
    }
  }
  
  /**
   * 将结果保存到共享状态
   * @param state 输入状态
   * @param result 执行结果
   * @private
   */
  private setCachedResult(state: S, result: R): void {
    if (!this.stateRegistry) {
      return;
    }
    
    try {
      const cacheKey = this.createCacheKey(state);
      this.stateRegistry.set(cacheKey, result, this.name);
    } catch (error) {
      logger.warn({ name: this.name, error }, `Error caching result for ${this.name}`);
    }
  }
  
  /**
   * 为输入状态创建缓存键
   * @param state 输入状态
   * @private
   */
  private createCacheKey(state: S): string {
    if (typeof state === 'string') {
      return `${this.stateKeyPrefix}cache:${state}`;
    }
    
    try {
      // 尝试创建一个状态的稳定哈希
      const stateStr = JSON.stringify(state, Object.keys(state as any).sort());
      return `${this.stateKeyPrefix}cache:${stateStr}`;
    } catch (error) {
      // 如果状态无法序列化，使用时间戳
      return `${this.stateKeyPrefix}cache:${Date.now()}`;
    }
  }
  
  /**
   * 更新Agent进度
   * @param progress 进度数据
   * @private
   */
  private updateProgress(progress: any): void {
    if (!this.stateRegistry) {
      return;
    }
    
    try {
      const progressKey = `${this.stateKeyPrefix}progress`;
      this.stateRegistry.set(progressKey, progress, this.name);
    } catch (error) {
      logger.warn({ name: this.name, error }, `Error updating progress for ${this.name}`);
    }
  }
  
  /**
   * 在共享状态中保存中间数据
   * @param key 数据键
   * @param value 数据值
   * @protected 子类可使用
   */
  protected shareState<T>(key: string, value: T): void {
    if (!this.stateRegistry) {
      return;
    }
    
    try {
      const stateKey = `${this.stateKeyPrefix}${key}`;
      this.stateRegistry.set(stateKey, value, this.name);
    } catch (error) {
      logger.warn({ name: this.name, error, key }, `Error sharing state for ${this.name}`);
    }
  }
  
  /**
   * 从共享状态获取数据
   * @param key 数据键
   * @param defaultValue 默认值
   * @protected 子类可使用
   */
  protected getSharedState<T>(key: string, defaultValue: T | null = null): T | null {
    if (!this.stateRegistry) {
      return defaultValue;
    }
    
    try {
      const stateKey = `${this.stateKeyPrefix}${key}`;
      return this.stateRegistry.get<T>(stateKey, defaultValue);
    } catch (error) {
      logger.warn({ name: this.name, error, key }, `Error getting shared state for ${this.name}`);
      return defaultValue;
    }
  }
  
  /**
   * 获取另一个Agent的共享状态
   * @param agentName Agent名称
   * @param key 数据键
   * @param defaultValue 默认值
   * @protected 子类可使用
   */
  protected getAgentState<T>(
    agentName: string, 
    key: string, 
    defaultValue: T | null = null
  ): T | null {
    if (!this.stateRegistry) {
      return defaultValue;
    }
    
    try {
      const stateKey = `agent:${agentName}:${key}`;
      return this.stateRegistry.get<T>(stateKey, defaultValue);
    } catch (error) {
      logger.warn({ agentName, error, key }, `Error getting state from agent ${agentName}`);
      return defaultValue;
    }
  }
  
  /**
   * 监听其他Agent的状态变化
   * @param agentName 目标Agent名称
   * @param key 状态键
   * @param handler 处理函数
   * @protected 子类可使用
   */
  protected watchAgentState<T>(
    agentName: string,
    key: string,
    handler: (newValue: T, oldValue: T | null) => void
  ): void {
    if (!this.stateRegistry) {
      return;
    }
    
    const stateKey = `agent:${agentName}:${key}`;
    this.stateRegistry.watch<T>(stateKey, (event) => {
      handler(event.newValue, event.oldValue);
    });
  }
} 