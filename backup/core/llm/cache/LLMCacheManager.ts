/**
 * LLMCacheManager.ts
 * 大语言模型缓存管理器，提供LLM响应的高效缓存服务
 */
import { LLMCacheEntry, LLMMessage, LLMOptions } from '../types';
import { logger } from '../../../infra/logger';
import * as crypto from 'crypto';

/**
 * LLM缓存管理器配置
 */
export interface LLMCacheManagerConfig {
  maxSize?: number;   // 最大缓存条目数，默认1000
  ttl?: number;       // 缓存有效期（毫秒），默认1小时
  enabled?: boolean;  // 是否启用缓存，默认true
}

/**
 * LLM缓存管理器
 * 提供高效的缓存机制，减少重复LLM调用
 */
export class LLMCacheManager {
  private cache: Map<string, LLMCacheEntry>;
  private readonly maxSize: number;
  private readonly ttl: number;
  private enabled: boolean;
  private stats = {
    hits: 0,
    misses: 0,
    totalSaved: 0 // 估计节省的请求时间（毫秒）
  };

  /**
   * 创建LLM缓存管理器
   */
  constructor(config: LLMCacheManagerConfig = {}) {
    this.maxSize = config.maxSize || 1000;
    this.ttl = config.ttl || 3600000; // 默认1小时
    this.enabled = config.enabled !== false;
    this.cache = new Map<string, LLMCacheEntry>();

    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredEntries(), Math.min(this.ttl / 2, 60000));
    
    logger.info({ enabled: this.enabled, maxSize: this.maxSize, ttl: `${this.ttl / 1000}秒` }, 'LLM缓存管理器初始化完成');
  }

  /**
   * 生成缓存键
   * @param messages 消息列表
   * @param options LLM选项
   */
  private generateCacheKey(messages: LLMMessage[], options: LLMOptions = {}): string {
    // 提取关键选项，这些选项影响LLM输出
    const keyOptions = {
      temperature: options.temperature || 0.7,
      model: options.model || 'default',
      maxTokens: options.maxTokens,
      format: options.format || 'text'
    };

    // 序列化消息和选项
    const serialized = JSON.stringify({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      options: keyOptions
    });

    // 生成哈希作为缓存键
    return crypto.createHash('md5').update(serialized).digest('hex');
  }

  /**
   * 获取缓存结果
   * @param messages 消息列表
   * @param options LLM选项
   */
  public get(messages: LLMMessage[], options: LLMOptions = {}): any | null {
    if (!this.enabled || options.enableCache === false) {
      return null;
    }

    const cacheKey = this.generateCacheKey(messages, options);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    // 更新访问计数和统计数据
    entry.accessCount++;
    this.stats.hits++;
    this.stats.totalSaved += 2000; // 假设每个缓存命中节省2秒

    logger.debug('命中LLM缓存', {
      model: entry.model,
      accessCount: entry.accessCount,
      age: `${(Date.now() - entry.timestamp) / 1000}秒`
    });

    return entry.result;
  }

  /**
   * 设置缓存结果
   * @param messages 消息列表
   * @param result 结果
   * @param options LLM选项
   */
  public set(messages: LLMMessage[], result: any, options: LLMOptions = {}): void {
    if (!this.enabled || options.enableCache === false) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(messages, options);

      // 缓存新条目
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        model: options.model || 'default',
        accessCount: 1
      });

      // 检查缓存大小限制
      if (this.cache.size > this.maxSize) {
        this.evictLeastUsed();
      }

      logger.debug('设置LLM缓存', {
        model: options.model,
        cacheSize: this.cache.size
      });
    } catch (error) {
      logger.warn('设置LLM缓存失败', { error });
    }
  }

  /**
   * 清除所有缓存
   */
  public clear(): void {
    this.cache.clear();
    logger.info('LLM缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): any {
    const hitRate = (this.stats.hits + this.stats.misses) > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      enabled: this.enabled,
      hitRate: `${hitRate.toFixed(2)}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      estimatedTimeSaved: `${(this.stats.totalSaved / 1000).toFixed(2)}秒`
    };
  }

  /**
   * 启用缓存
   */
  public enable(): void {
    this.enabled = true;
    logger.info({}, 'LLM缓存已启用');
  }

  /**
   * 禁用缓存
   */
  public disable(): void {
    this.enabled = false;
    logger.info('LLM缓存已禁用');
  }

  /**
   * 清理过期缓存条目
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // 找出所有过期条目
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    }

    // 删除过期条目
    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => this.cache.delete(key));
      logger.debug(`清理过期LLM缓存条目`, { count: expiredKeys.length });
    }
  }

  /**
   * 淘汰最少使用的缓存条目
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let leastUsedCount = Infinity;

    // 找到访问次数最少的条目
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < leastUsedCount) {
        leastUsedCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    // 删除访问次数最少的条目
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }
} 