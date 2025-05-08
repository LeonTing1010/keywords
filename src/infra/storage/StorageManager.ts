/**
 * StorageManager.ts
 * 存储管理器 - 处理数据存储和会话管理
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  SQLiteStorage, 
  Session, 
  SessionStatus, 
  BrowserData, 
  AgentData, 
  LLMData 
} from './SQLiteStorage';
import { logger } from '../logger';

/**
 * 用于存储的会话参数
 */
export interface SessionParams {
  keyword: string;
  model: string;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * 存储管理器类
 * 提供简化的接口用于数据持久化
 */
export class StorageManager {
  private static instance: StorageManager;
  private storage: SQLiteStorage;
  private activeSession: string | null = null;
  private initialized = false;

  /**
   * 私有构造函数 - 单例模式
   */
  private constructor(dbPath?: string) {
    this.storage = new SQLiteStorage(dbPath);
  }

  /**
   * 获取单例实例
   * @param dbPath 数据库路径 - 仅首次调用时有效
   * @returns StorageManager实例
   */
  public static getInstance(dbPath?: string): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager(dbPath);
    }
    return StorageManager.instance;
  }

  /**
   * 初始化存储管理器
   */
  public async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.storage.initialize();
      this.initialized = true;
      logger.info('存储管理器已初始化');
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized. Call initialize() first.');
    }
  }

  /**
   * 开始新会话
   * @param params 会话参数
   * @returns 会话ID
   */
  public startSession(params: SessionParams): string {
    this.ensureInitialized();
    
    try {
      const sessionId = uuidv4();
      const session: Session = {
        id: sessionId,
        keyword: params.keyword,
        startTime: Date.now(),
        status: SessionStatus.STARTED,
        model: params.model,
        options: params.options,
        metadata: params.metadata
      };
      
      this.storage.createSession(session);
      this.activeSession = sessionId;
      
      logger.info('开始新的分析会话', { 
        sessionId,
        keyword: params.keyword,
        model: params.model
      });
      
      return sessionId;
    } catch (error) {
      logger.error('开始会话失败', { error, params });
      throw error;
    }
  }

  /**
   * 更新会话状态
   * @param sessionId 会话ID
   * @param status 新状态
   * @param reportPath 可选的报告路径
   */
  public updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    reportPath?: string
  ): void {
    this.ensureInitialized();
    
    try {
      // 如果是完成或失败状态，记录结束时间
      const endTime = (status === SessionStatus.COMPLETED || status === SessionStatus.FAILED)
        ? Date.now()
        : undefined;
      
      this.storage.updateSession(sessionId, status, endTime, reportPath);
      
      // 如果会话结束，清除活跃会话
      if (status === SessionStatus.COMPLETED || status === SessionStatus.FAILED) {
        if (this.activeSession === sessionId) {
          this.activeSession = null;
        }
      }
      
      logger.info('更新会话状态', { sessionId, status });
    } catch (error) {
      logger.error('更新会话状态失败', { error, sessionId, status });
      throw error;
    }
  }

  /**
   * 获取当前活跃的会话ID
   * @returns 当前活跃的会话ID，如果没有则返回null
   */
  public getActiveSessionId(): string | null {
    return this.activeSession;
  }

  /**
   * 保存浏览器数据
   * @param data 浏览器数据（不包含sessionId）
   * @param sessionId 可选的会话ID，如不提供则使用当前活跃会话
   * @returns 记录ID
   */
  public saveBrowserData(
    data: Omit<BrowserData, 'sessionId'>, 
    sessionId?: string
  ): number {
    this.ensureInitialized();
    
    const session = sessionId || this.activeSession;
    if (!session) {
      throw new Error('No active session. Call startSession() first or provide sessionId.');
    }
    
    try {
      const fullData: BrowserData = {
        ...data,
        sessionId: session,
        timestamp: data.timestamp || Date.now()
      };
      
      return this.storage.saveBrowserData(fullData);
    } catch (error) {
      logger.error('保存浏览器数据失败', { error, data });
      throw error;
    }
  }

  /**
   * 保存Agent数据
   * @param data Agent数据（不包含sessionId）
   * @param sessionId 可选的会话ID，如不提供则使用当前活跃会话
   * @returns 记录ID
   */
  public saveAgentData(
    data: Omit<AgentData, 'sessionId'>,
    sessionId?: string
  ): number {
    this.ensureInitialized();
    
    const session = sessionId || this.activeSession;
    if (!session) {
      throw new Error('No active session. Call startSession() first or provide sessionId.');
    }
    
    try {
      const fullData: AgentData = {
        ...data,
        sessionId: session,
        timestamp: data.timestamp || Date.now()
      };
      
      return this.storage.saveAgentData(fullData);
    } catch (error) {
      logger.error('保存Agent数据失败', { error, data });
      throw error;
    }
  }

  /**
   * 保存LLM数据
   * @param data LLM数据（不包含sessionId）
   * @param sessionId 可选的会话ID，如不提供则使用当前活跃会话
   * @returns 记录ID
   */
  public saveLLMData(
    data: Omit<LLMData, 'sessionId'>,
    sessionId?: string
  ): number {
    this.ensureInitialized();
    
    const session = sessionId || this.activeSession;
    if (!session) {
      throw new Error('No active session. Call startSession() first or provide sessionId.');
    }
    
    try {
      const fullData: LLMData = {
        ...data,
        sessionId: session,
        timestamp: data.timestamp || Date.now()
      };
      
      return this.storage.saveLLMData(fullData);
    } catch (error) {
      logger.error('保存LLM数据失败', { error, data });
      throw error;
    }
  }

  /**
   * 获取会话数据
   * @param sessionId 会话ID
   * @returns 会话数据
   */
  public getSession(sessionId: string): Session | undefined {
    this.ensureInitialized();
    return this.storage.getSession(sessionId);
  }

  /**
   * 获取所有会话
   * @param limit 限制数量
   * @param offset 偏移量（用于分页）
   * @returns 会话列表
   */
  public getAllSessions(limit?: number, offset?: number): Session[] {
    this.ensureInitialized();
    return this.storage.getAllSessions(limit, offset);
  }

  /**
   * 获取会话的浏览器数据
   * @param sessionId 会话ID
   * @returns 浏览器数据列表
   */
  public getBrowserData(sessionId: string): BrowserData[] {
    this.ensureInitialized();
    return this.storage.getBrowserData(sessionId);
  }

  /**
   * 获取会话的Agent数据
   * @param sessionId 会话ID
   * @param agentType 可选的Agent类型过滤
   * @returns Agent数据列表
   */
  public getAgentData(sessionId: string, agentType?: string): AgentData[] {
    this.ensureInitialized();
    return this.storage.getAgentData(sessionId, agentType);
  }

  /**
   * 获取会话的LLM数据
   * @param sessionId 会话ID
   * @param model 可选的模型过滤
   * @returns LLM数据列表
   */
  public getLLMData(sessionId: string, model?: string): LLMData[] {
    this.ensureInitialized();
    return this.storage.getLLMData(sessionId, model);
  }

  /**
   * 关闭存储管理器
   */
  public close(): void {
    if (this.initialized) {
      this.storage.close();
      this.initialized = false;
      this.activeSession = null;
      logger.info('存储管理器已关闭');
    }
  }
} 