/**
 * RecoveryManager.ts
 * 提供Agent执行失败时的恢复策略和重试机制
 */
import { EventEmitter } from 'events';
import { logger } from '../../infra/logger';

/**
 * 失败类型枚举
 */
export enum FailureType {
  LLM_ERROR = 'llm_error',           // LLM API 错误
  PARSING_ERROR = 'parsing_error',    // 响应解析错误
  TIMEOUT_ERROR = 'timeout_error',    // 执行超时
  VALIDATION_ERROR = 'validation_error', // 数据验证错误
  EXTERNAL_API_ERROR = 'external_api_error', // 外部API错误
  UNKNOWN_ERROR = 'unknown_error'     // 未知错误
}

/**
 * 失败记录结构
 */
export interface FailureRecord {
  agentId: string;
  failureType: FailureType;
  timestamp: number;
  message: string;
  stackTrace?: string;
  context?: any;
  attempt: number;
}

/**
 * 恢复策略配置
 */
export interface RecoveryConfig {
  maxRetries?: number;            // 最大重试次数
  initialDelay?: number;          // 初始重试延迟（毫秒）
  maxDelay?: number;              // 最大重试延迟（毫秒）
  backoffFactor?: number;         // 退避因子
  failureThreshold?: number;      // 全局失败阈值
  monitoringPeriod?: number;      // 监控周期（毫秒）
  enableJittering?: boolean;      // 是否启用随机抖动
  maxConsecutiveFailures?: number; // 最大连续失败次数
}

/**
 * 恢复策略类型
 */
export enum RecoveryStrategy {
  RETRY = 'retry',                // 简单重试
  FALLBACK = 'fallback',          // 使用备选方案
  SKIP = 'skip',                  // 跳过当前节点
  ROLLBACK = 'rollback',          // 回滚到上一状态
  ABORT = 'abort'                 // 中止执行
}

/**
 * 恢复操作结构
 */
export interface RecoveryAction {
  strategy: RecoveryStrategy;
  delay?: number;
  fallbackState?: any;
  fallbackAgentId?: string;
  message?: string;
}

/**
 * 恢复管理器
 * 处理Agent执行失败和恢复的核心组件
 */
export class RecoveryManager {
  private readonly events: EventEmitter;
  private readonly failures: Map<string, FailureRecord[]>;
  private readonly config: Required<RecoveryConfig>;
  private globalFailureCount: number;
  private lastCleanupTime: number;
  
  // 默认配置值
  private readonly defaultConfig: Required<RecoveryConfig> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    failureThreshold: 10,
    monitoringPeriod: 60000,
    enableJittering: true,
    maxConsecutiveFailures: 3
  };

  /**
   * 创建恢复管理器实例
   */
  constructor(config: RecoveryConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
    this.events = new EventEmitter();
    this.failures = new Map<string, FailureRecord[]>();
    this.globalFailureCount = 0;
    this.lastCleanupTime = Date.now();
    
    // 定期清理旧的失败记录
    setInterval(() => this.cleanupOldFailures(), this.config.monitoringPeriod);
  }

  /**
   * 记录执行失败
   * @param agentId 失败的Agent ID
   * @param failureType 失败类型
   * @param error 错误对象
   * @param context 执行上下文
   * @returns 失败记录
   */
  public recordFailure(
    agentId: string, 
    failureType: FailureType, 
    error: Error | string,
    context?: any
  ): FailureRecord {
    const message = typeof error === 'string' ? error : error.message;
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    // 获取Agent的失败历史
    if (!this.failures.has(agentId)) {
      this.failures.set(agentId, []);
    }
    
    const agentFailures = this.failures.get(agentId)!;
    
    // 计算尝试次数（同一类型失败）
    const attempt = agentFailures
      .filter(f => f.failureType === failureType)
      .length + 1;
    
    // 创建失败记录
    const record: FailureRecord = {
      agentId,
      failureType,
      timestamp: Date.now(),
      message,
      stackTrace,
      context,
      attempt
    };
    
    // 添加到历史
    agentFailures.push(record);
    this.globalFailureCount++;
    
    // 触发失败事件
    this.events.emit('failure', record);
    this.events.emit(`failure:${agentId}`, record);
    
    // 检查是否超过全局失败阈值
    if (this.globalFailureCount >= this.config.failureThreshold) {
      this.events.emit('threshold_exceeded', {
        count: this.globalFailureCount,
        threshold: this.config.failureThreshold
      });
    }
    
    logger.warn(`Agent failure recorded`, {
      agentId,
      failureType,
      message,
      attempt
    });
    
    return record;
  }

  /**
   * 获取恢复策略
   * @param failure 失败记录
   * @returns 恢复操作
   */
  public getRecoveryAction(failure: FailureRecord): RecoveryAction {
    // 超过最大重试次数
    if (failure.attempt > this.config.maxRetries) {
      // 根据失败类型决定策略
      switch (failure.failureType) {
        case FailureType.LLM_ERROR:
        case FailureType.EXTERNAL_API_ERROR:
          // 外部服务错误，可以尝试跳过
          return { 
            strategy: RecoveryStrategy.SKIP,
            message: `已达到最大重试次数(${this.config.maxRetries})，跳过出错的Agent`
          };
          
        case FailureType.VALIDATION_ERROR:
        case FailureType.PARSING_ERROR:
          // 数据错误，尝试回滚
          return { 
            strategy: RecoveryStrategy.ROLLBACK,
            message: `数据验证/解析失败，回滚到上一状态`
          };
          
        default:
          // 默认中止流程
          return { 
            strategy: RecoveryStrategy.ABORT,
            message: `未知错误类型，中止执行流程`
          };
      }
    }
    
    // 未超过重试次数，使用指数退避重试
    const delay = this.calculateBackoffDelay(failure.attempt);
    
    return {
      strategy: RecoveryStrategy.RETRY,
      delay,
      message: `第${failure.attempt}次重试，延迟${delay}ms`
    };
  }

  /**
   * 检查Agent是否可以继续执行
   * @param agentId Agent ID
   * @returns 是否可以继续执行
   */
  public canProceed(agentId: string): boolean {
    const failures = this.failures.get(agentId) || [];
    
    // 检查最近时间窗口内的连续失败
    const recentFailures = failures.filter(
      f => (Date.now() - f.timestamp) < this.config.monitoringPeriod
    );
    
    return recentFailures.length < this.config.maxConsecutiveFailures;
  }

  /**
   * 获取Agent的失败历史
   * @param agentId Agent ID
   * @returns 失败记录数组
   */
  public getFailureHistory(agentId: string): FailureRecord[] {
    return this.failures.get(agentId) || [];
  }

  /**
   * 清除Agent的失败历史
   * @param agentId Agent ID
   */
  public clearFailures(agentId: string): void {
    if (this.failures.has(agentId)) {
      const count = this.failures.get(agentId)!.length;
      this.failures.delete(agentId);
      this.globalFailureCount = Math.max(0, this.globalFailureCount - count);
    }
  }

  /**
   * 监听失败事件
   * @param handler 事件处理函数
   */
  public onFailure(handler: (failure: FailureRecord) => void): void {
    this.events.on('failure', handler);
  }

  /**
   * 监听特定Agent的失败事件
   * @param agentId Agent ID
   * @param handler 事件处理函数
   */
  public onAgentFailure(agentId: string, handler: (failure: FailureRecord) => void): void {
    this.events.on(`failure:${agentId}`, handler);
  }

  /**
   * 监听失败阈值超出事件
   * @param handler 事件处理函数
   */
  public onThresholdExceeded(handler: (data: {count: number, threshold: number}) => void): void {
    this.events.on('threshold_exceeded', handler);
  }

  /**
   * 计算指数退避延迟时间
   * @param attempt 重试次数
   * @returns 延迟毫秒数
   * @private
   */
  private calculateBackoffDelay(attempt: number): number {
    // 基础指数退避
    let delay = Math.min(
      this.config.maxDelay,
      this.config.initialDelay * Math.pow(this.config.backoffFactor, attempt - 1)
    );
    
    // 添加随机抖动（避免惊群效应）
    if (this.config.enableJittering) {
      const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15的随机因子
      delay = Math.floor(delay * jitter);
    }
    
    return delay;
  }

  /**
   * 清理旧的失败记录
   * @private
   */
  private cleanupOldFailures(): void {
    const now = Date.now();
    const cutoff = now - this.config.monitoringPeriod * 2; // 保留2个监控周期的记录
    
    let removedCount = 0;
    
    // 清理每个Agent的旧记录
    for (const [agentId, failures] of this.failures.entries()) {
      const newFailures = failures.filter(f => f.timestamp >= cutoff);
      removedCount += failures.length - newFailures.length;
      this.failures.set(agentId, newFailures);
    }
    
    // 更新全局计数
    if (removedCount > 0) {
      this.globalFailureCount = Math.max(0, this.globalFailureCount - removedCount);
      logger.debug(`Cleaned up ${removedCount} old failure records`);
    }
    
    this.lastCleanupTime = now;
  }
} 