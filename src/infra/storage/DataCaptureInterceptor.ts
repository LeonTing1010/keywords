/**
 * DataCaptureInterceptor.ts
 * 数据捕获拦截器 - 用于捕获浏览器、Agent和LLM的数据
 */

import { StorageManager } from './StorageManager';
import { SessionStatus } from './SQLiteStorage';
import { logger } from '../logger';

/**
 * 浏览器数据捕获接口
 */
export interface BrowserDataCapture {
  url?: string;
  searchQuery?: string;
  pageTitle?: string;
  contentType?: string;
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

/**
 * Agent数据捕获接口
 */
export interface AgentDataCapture {
  agentId: string;
  agentType: string;
  inputData: string;
  outputData: string;
  processingTimeMs: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

/**
 * LLM数据捕获接口
 */
export interface LLMDataCapture {
  model: string;
  prompt: string;
  completion: string;
  processingTimeMs: number;
  tokens: number;
  timestamp?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

/**
 * 数据捕获拦截器类
 * 用于捕获各种数据并存储到数据库
 */
export class DataCaptureInterceptor {
  private storageManager: StorageManager;
  private initialized = false;

  /**
   * 构造函数
   * @param dbPath 可选的数据库路径
   */
  constructor(dbPath?: string) {
    this.storageManager = StorageManager.getInstance(dbPath);
  }

  /**
   * 初始化拦截器
   */
  public async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.storageManager.initialize();
      this.initialized = true;
      logger.info('数据捕获拦截器已初始化');
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('DataCaptureInterceptor not initialized. Call initialize() first.');
    }
  }

  /**
   * 开始新会话
   * @param keyword 关键词
   * @param model 模型名称
   * @param options 选项
   * @returns 会话ID
   */
  public startSession(
    keyword: string,
    model: string,
    options?: Record<string, any>
  ): string {
    this.ensureInitialized();
    
    return this.storageManager.startSession({
      keyword,
      model,
      options
    });
  }

  /**
   * 完成会话
   * @param sessionId 会话ID（可选，默认使用当前活跃会话）
   * @param reportPath 报告路径
   */
  public completeSession(sessionId?: string, reportPath?: string): void {
    this.ensureInitialized();
    
    const session = sessionId || this.storageManager.getActiveSessionId();
    if (!session) {
      throw new Error('No active session to complete.');
    }
    
    this.storageManager.updateSessionStatus(
      session,
      SessionStatus.COMPLETED,
      reportPath
    );
  }

  /**
   * 标记会话失败
   * @param sessionId 会话ID（可选，默认使用当前活跃会话）
   */
  public failSession(sessionId?: string): void {
    this.ensureInitialized();
    
    const session = sessionId || this.storageManager.getActiveSessionId();
    if (!session) {
      throw new Error('No active session to fail.');
    }
    
    this.storageManager.updateSessionStatus(session, SessionStatus.FAILED);
  }

  /**
   * 捕获浏览器数据
   * @param data 浏览器数据
   * @param sessionId 会话ID（可选，默认使用当前活跃会话）
   * @returns 记录ID
   */
  public captureBrowserData(
    data: BrowserDataCapture,
    sessionId?: string
  ): number {
    this.ensureInitialized();
    
    // 确保设置时间戳
    const dataWithTimestamp = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };
    
    return this.storageManager.saveBrowserData(dataWithTimestamp, sessionId);
  }

  /**
   * 捕获Agent数据
   * @param data Agent数据
   * @param sessionId 会话ID（可选，默认使用当前活跃会话）
   * @returns 记录ID
   */
  public captureAgentData(
    data: AgentDataCapture,
    sessionId?: string
  ): number {
    this.ensureInitialized();
    
    // 确保设置时间戳
    const dataWithTimestamp = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };
    
    return this.storageManager.saveAgentData(dataWithTimestamp, sessionId);
  }

  /**
   * 捕获LLM数据
   * @param data LLM数据
   * @param sessionId 会话ID（可选，默认使用当前活跃会话）
   * @returns 记录ID
   */
  public captureLLMData(
    data: LLMDataCapture,
    sessionId?: string
  ): number {
    this.ensureInitialized();
    
    // 确保设置时间戳
    const dataWithTimestamp = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };
    
    return this.storageManager.saveLLMData(dataWithTimestamp, sessionId);
  }

  /**
   * 获取当前活跃会话ID
   * @returns 活跃会话ID，如果没有则返回null
   */
  public getActiveSessionId(): string | null {
    return this.storageManager.getActiveSessionId();
  }

  /**
   * 获取会话数据
   * @param sessionId 会话ID（可选，默认使用当前活跃会话）
   * @returns 会话数据，如果未找到则返回undefined
   */
  public getSession(sessionId?: string): any {
    this.ensureInitialized();
    
    const session = sessionId || this.storageManager.getActiveSessionId();
    if (!session) {
      throw new Error('No active session found. Provide sessionId or start a session first.');
    }
    
    return this.storageManager.getSession(session);
  }

  /**
   * 关闭拦截器
   */
  public close(): void {
    if (this.initialized) {
      this.storageManager.close();
      this.initialized = false;
      logger.info('数据捕获拦截器已关闭');
    }
  }
} 