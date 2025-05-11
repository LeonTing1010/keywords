/**
 * StateRegistry.ts
 * 提供Agent间状态共享和数据缓存的中心机制
 */
import { EventEmitter } from 'events';

/**
 * 状态注册中心配置
 */
export interface StateRegistryConfig {
  cacheSize?: number;        // 缓存大小限制
  ttl?: number;              // 缓存条目过期时间（毫秒）
  enableWatchers?: boolean;  // 是否启用状态变更监听
}

/**
 * 状态缓存条目
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  source: string;
  accessCount: number;
}

/**
 * 状态变更事件
 */
export interface StateChangeEvent<T = any> {
  key: string;
  oldValue: T | null;
  newValue: T;
  timestamp: number;
  source: string;
}

/**
 * 状态注册中心
 * 提供高效的Agent间状态共享机制，支持缓存、事件通知和过期策略
 */
export class StateRegistry {
  private cache: Map<string, CacheEntry<any>>;
  private readonly events: EventEmitter;
  private readonly config: Required<StateRegistryConfig>;
  private readonly defaultTTL: number = 5 * 60 * 1000; // 默认5分钟过期
  private readonly defaultCacheSize: number = 1000;

  /**
   * 创建状态注册中心实例
   */
  constructor(config: StateRegistryConfig = {}) {
    this.config = {
      cacheSize: config.cacheSize || this.defaultCacheSize,
      ttl: config.ttl || this.defaultTTL,
      enableWatchers: config.enableWatchers !== false
    };

    this.cache = new Map<string, CacheEntry<any>>();
    this.events = new EventEmitter();
    
    // 设置最大监听器数量，避免内存泄漏警告
    this.events.setMaxListeners(100);

    // 定期清理过期缓存
    if (this.config.ttl > 0) {
      setInterval(() => this.cleanExpiredEntries(), Math.min(this.config.ttl / 2, 60000));
    }
  }

  /**
   * 获取状态值
   * @param key 状态键
   * @param defaultValue 默认值（如果键不存在）
   */
  public get<T>(key: string, defaultValue: T | null = null): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return defaultValue;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return defaultValue;
    }

    // 更新访问计数
    entry.accessCount++;
    return entry.value;
  }

  /**
   * 设置状态值
   * @param key 状态键
   * @param value 状态值
   * @param source 数据来源（通常是Agent名称）
   * @param ttl 可选的自定义TTL（毫秒）
   */
  public set<T>(key: string, value: T, source: string, ttl?: number): void {
    const now = Date.now();
    const oldEntry = this.cache.get(key);
    const oldValue = oldEntry?.value;
    
    // 检查缓存大小限制
    if (!oldEntry && this.cache.size >= this.config.cacheSize) {
      this.evictLeastUsed();
    }

    // 保存新值
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      source,
      accessCount: 0
    };
    
    this.cache.set(key, entry);

    // 触发事件通知
    if (this.config.enableWatchers) {
      const event: StateChangeEvent<T> = {
        key,
        oldValue: oldValue || null,
        newValue: value,
        timestamp: now,
        source
      };
      this.events.emit(`change:${key}`, event);
      this.events.emit('change', event);
    }
  }

  /**
   * 删除状态值
   * @param key 状态键
   * @returns 是否成功删除
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有状态
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * 监听特定键的状态变更
   * @param key 状态键
   * @param handler 变更处理函数
   */
  public watch<T>(key: string, handler: (event: StateChangeEvent<T>) => void): void {
    if (!this.config.enableWatchers) {
      throw new Error('State watchers are disabled in configuration');
    }
    this.events.on(`change:${key}`, handler);
  }

  /**
   * 监听所有状态变更
   * @param handler 变更处理函数
   */
  public watchAll(handler: (event: StateChangeEvent) => void): void {
    if (!this.config.enableWatchers) {
      throw new Error('State watchers are disabled in configuration');
    }
    this.events.on('change', handler);
  }

  /**
   * 取消监听特定键的状态变更
   * @param key 状态键
   * @param handler 变更处理函数
   */
  public unwatch<T>(key: string, handler: (event: StateChangeEvent<T>) => void): void {
    this.events.off(`change:${key}`, handler);
  }

  /**
   * 取消监听所有状态变更
   * @param handler 变更处理函数
   */
  public unwatchAll(handler: (event: StateChangeEvent) => void): void {
    this.events.off('change', handler);
  }

  /**
   * 获取缓存中所有键的列表
   */
  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): { size: number, maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize
    };
  }

  /**
   * 获取特定前缀的所有键
   * @param prefix 键前缀
   */
  public getKeysByPrefix(prefix: string): string[] {
    return this.getKeys().filter(key => key.startsWith(prefix));
  }

  /**
   * 检查缓存条目是否过期
   * @param entry 缓存条目
   * @private
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * 清理所有过期的缓存条目
   * @private
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 淘汰最少使用的缓存条目
   * @private
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