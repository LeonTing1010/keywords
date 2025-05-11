/**
 * BatchProcessor.ts
 * 提供LLM请求批处理功能，合并小型请求减少API调用
 */
import { LLMMessage, LLMOptions, BatchProcessConfig } from './types';
import { logger } from '../../infra/logger';
import * as crypto from 'crypto';

/**
 * 批处理项接口
 */
interface BatchItem {
  id: string;
  messages: LLMMessage[];
  options: LLMOptions;
  resolver: (result: string) => void;
  rejecter: (error: Error) => void;
  timestamp: number;
}

/**
 * 批处理队列
 */
interface BatchQueue {
  items: BatchItem[];
  timer: NodeJS.Timeout | null;
  processing: boolean;
}

/**
 * LLM批处理器类
 * 优化性能和成本，通过合并请求减少API调用
 */
export class BatchProcessor {
  private queues: Map<string, BatchQueue> = new Map();
  private config: BatchProcessConfig;
  private batchProcessor: (
    messages: LLMMessage[][],
    options: LLMOptions[]
  ) => Promise<string[]>;
  private stats = {
    totalBatches: 0,
    totalRequests: 0,
    averageBatchSize: 0,
    estimatedSavings: 0
  };

  /**
   * 创建批处理器
   * @param config 批处理配置
   * @param processor 批处理函数
   */
  constructor(
    config: Partial<BatchProcessConfig> = {},
    processor: (messages: LLMMessage[][], options: LLMOptions[]) => Promise<string[]>
  ) {
    this.config = {
      maxBatchSize: config.maxBatchSize || 5,
      batchWindow: config.batchWindow || 200, // 默认200毫秒
      enabled: config.enabled !== false
    };
    
    this.batchProcessor = processor;
    
    logger.info({ enabled: this.config.enabled, maxBatchSize: this.config.maxBatchSize, batchWindow: `${this.config.batchWindow}毫秒` }, 'LLM批处理器初始化完成');
  }

  /**
   * 添加请求到批处理队列
   * @returns 返回promise，在批处理完成后解析
   */
  public async addToBatch(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): Promise<string> {
    // 如果禁用批处理或明确指定不使用批处理，直接处理请求
    if (!this.config.enabled || options.batchId === 'none') {
      return this.processSingle(messages, options);
    }

    // 如果是流式请求，不进行批处理
    if (options.stream) {
      return this.processSingle(messages, options);
    }

    // 生成或使用批处理ID
    const batchId = options.batchId || this.generateBatchId(messages, options);
    
    // 创建批处理项
    return new Promise<string>((resolve, reject) => {
      const item: BatchItem = {
        id: crypto.randomBytes(8).toString('hex'),
        messages,
        options,
        resolver: resolve,
        rejecter: reject,
        timestamp: Date.now()
      };
      
      // 获取或创建队列
      if (!this.queues.has(batchId)) {
        this.queues.set(batchId, {
          items: [],
          timer: null,
          processing: false
        });
      }
      
      const queue = this.queues.get(batchId)!;
      queue.items.push(item);
      this.stats.totalRequests++;
      
      // 如果队列达到最大大小，立即处理
      if (queue.items.length >= this.config.maxBatchSize) {
        this.processBatch(batchId);
      }
      // 否则设置延迟处理定时器
      else if (!queue.timer && !queue.processing) {
        queue.timer = setTimeout(() => {
          this.processBatch(batchId);
        }, this.config.batchWindow);
      }
    });
  }

  /**
   * 处理单个请求
   * @private
   */
  private async processSingle(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<string> {
    try {
      const results = await this.batchProcessor([messages], [options]);
      return results[0];
    } catch (error) {
      logger.error({ error }, '处理单个LLM请求失败');
      throw error;
    }
  }

  /**
   * 处理指定ID的批处理队列
   * @private
   */
  private async processBatch(batchId: string): Promise<void> {
    const queue = this.queues.get(batchId);
    if (!queue || queue.items.length === 0 || queue.processing) {
      return;
    }
    
    // 清除定时器
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    
    // 标记为处理中
    queue.processing = true;
    
    // 获取要处理的项
    const batchItems = [...queue.items];
    queue.items = [];
    
    try {
      // 准备批处理数据
      const messagesArray = batchItems.map(item => item.messages);
      const optionsArray = batchItems.map(item => item.options);
      
      // 更新统计信息
      this.stats.totalBatches++;
      this.stats.averageBatchSize = 
        (this.stats.averageBatchSize * (this.stats.totalBatches - 1) + batchItems.length) / 
        this.stats.totalBatches;
      this.stats.estimatedSavings += batchItems.length - 1;
      
      logger.debug('开始处理LLM批处理', {
        batchId,
        size: batchItems.length,
        averageSize: this.stats.averageBatchSize.toFixed(2)
      });
      
      // 执行批处理
      const results = await this.batchProcessor(messagesArray, optionsArray);
      
      // 处理结果
      if (results.length !== batchItems.length) {
        throw new Error(`批处理结果数量不匹配: ${results.length} vs ${batchItems.length}`);
      }
      
      // 分发结果
      for (let i = 0; i < batchItems.length; i++) {
        batchItems[i].resolver(results[i]);
      }
    } catch (error) {
      logger.error('LLM批处理失败', { error, batchId, size: batchItems.length });
      
      // 向所有项传递错误
      for (const item of batchItems) {
        item.rejecter(error as Error);
      }
    } finally {
      // 重置处理状态
      queue.processing = false;
      
      // 如果队列中仍有项，启动新的定时器
      if (queue.items.length > 0) {
        queue.timer = setTimeout(() => {
          this.processBatch(batchId);
        }, this.config.batchWindow);
      } else {
        // 队列为空，可以移除
        this.queues.delete(batchId);
      }
    }
  }

  /**
   * 为请求生成批处理ID
   * @private
   */
  private generateBatchId(messages: LLMMessage[], options: LLMOptions): string {
    // 基于模型和格式生成批处理ID，相似请求会被分到同一批
    const model = options.model || 'default';
    const format = options.format || 'text';
    
    // 获取系统消息内容的哈希 (系统消息通常定义任务类型)
    const systemMsgs = messages.filter(m => m.role === 'system');
    const systemHash = systemMsgs.length > 0 
      ? crypto.createHash('md5').update(systemMsgs[0].content).digest('hex').substring(0, 8)
      : 'no-system';
    
    return `${model}:${format}:${systemHash}`;
  }

  /**
   * 获取批处理统计信息
   */
  public getStats(): any {
    return {
      ...this.stats,
      currentQueues: this.queues.size,
      enabled: this.config.enabled
    };
  }

  /**
   * 启用批处理
   */
  public enable(): void {
    this.config.enabled = true;
    logger.info({}, '已启用LLM批处理');
  }

  /**
   * 禁用批处理
   */
  public disable(): void {
    this.config.enabled = false;
    logger.info({}, '已禁用LLM批处理');
    
    // 处理所有剩余队列
    for (const [batchId] of this.queues) {
      this.processBatch(batchId);
    }
  }

  /**
   * 更新批处理配置
   */
  public updateConfig(config: Partial<BatchProcessConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    logger.info({ config: this.config }, '已更新批处理配置');
  }
} 