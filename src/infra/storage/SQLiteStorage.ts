/**
 * SQLiteStorage.ts
 * SQLite 存储模块，提供数据持久化功能
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

// 数据表枚举
export enum DataTable {
  BROWSER_DATA = 'browser_data',
  AGENT_DATA = 'agent_data',
  LLM_DATA = 'llm_data',
  SESSION = 'session'
}

// 会话状态枚举
export enum SessionStatus {
  STARTED = 'started',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 浏览器数据接口
export interface BrowserData {
  sessionId: string;
  timestamp: number;
  url?: string;
  searchQuery?: string;
  pageTitle?: string;
  contentType?: string;
  content: string;
  metadata?: Record<string, any>;
}

// Agent数据接口
export interface AgentData {
  sessionId: string;
  agentId: string;
  timestamp: number;
  agentType: string;
  inputData: string;
  outputData: string;
  processingTimeMs: number;
  metadata?: Record<string, any>;
}

// LLM数据接口
export interface LLMData {
  sessionId: string;
  timestamp: number;
  model: string;
  prompt: string;
  completion: string;
  processingTimeMs: number;
  tokens: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

// 会话接口
export interface Session {
  id: string;
  keyword: string;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  model: string;
  options?: Record<string, any>;
  reportPath?: string;
  metadata?: Record<string, any>;
}

/**
 * SQLite存储类
 * 提供数据持久化功能
 */
export class SQLiteStorage {
  private db!: Database.Database;
  private initialized: boolean = false;

  /**
   * 构造函数
   * @param dbPath 数据库文件路径
   */
  constructor(private dbPath: string = './data/analytics.db') {
    this.ensureDirectoryExists();
  }

  /**
   * 确保数据库目录存在
   */
  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 初始化数据库
   */
  public async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      
      // 启用WAL模式以提高性能
      this.db.pragma('journal_mode = WAL');
      
      // 创建表
      this.createTables();
      
      this.initialized = true;
      logger.info('SQLite数据库已初始化', { dbPath: this.dbPath });
    } catch (error) {
      logger.error('初始化SQLite数据库失败', { error, dbPath: this.dbPath });
      throw error;
    }
  }

  /**
   * 创建所需的表
   */
  private createTables(): void {
    // 创建会话表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${DataTable.SESSION} (
        id TEXT PRIMARY KEY,
        keyword TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        options TEXT,
        report_path TEXT,
        metadata TEXT
      )
    `);

    // 创建浏览器数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${DataTable.BROWSER_DATA} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        url TEXT,
        search_query TEXT,
        page_title TEXT,
        content_type TEXT,
        content TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES ${DataTable.SESSION} (id)
      )
    `);

    // 创建Agent数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${DataTable.AGENT_DATA} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        agent_type TEXT NOT NULL,
        input_data TEXT NOT NULL,
        output_data TEXT NOT NULL,
        processing_time_ms INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES ${DataTable.SESSION} (id)
      )
    `);

    // 创建LLM数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${DataTable.LLM_DATA} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        model TEXT NOT NULL,
        prompt TEXT NOT NULL,
        completion TEXT NOT NULL,
        processing_time_ms INTEGER NOT NULL,
        tokens INTEGER NOT NULL,
        temperature REAL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES ${DataTable.SESSION} (id)
      )
    `);

    // 创建索引以提高查询性能
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_browser_data_session ON ${DataTable.BROWSER_DATA} (session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_data_session ON ${DataTable.AGENT_DATA} (session_id, agent_type)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_llm_data_session ON ${DataTable.LLM_DATA} (session_id, model)`);
  }

  /**
   * 检查数据库是否已初始化
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('SQLiteStorage not initialized. Call initialize() before using.');
    }
  }

  /**
   * 创建新会话
   * @param session 会话数据
   * @returns 会话ID
   */
  public createSession(session: Session): string {
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${DataTable.SESSION} 
        (id, keyword, start_time, status, model, options, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        session.id,
        session.keyword,
        session.startTime,
        session.status,
        session.model,
        session.options ? JSON.stringify(session.options) : null,
        session.metadata ? JSON.stringify(session.metadata) : null
      );
      
      logger.info('创建新会话', { sessionId: session.id, keyword: session.keyword });
      return session.id;
    } catch (error) {
      logger.error('创建会话失败', { error, session });
      throw error;
    }
  }

  /**
   * 更新会话状态
   * @param sessionId 会话ID
   * @param status 新状态
   * @param endTime 结束时间（如果完成）
   * @param reportPath 报告路径（如果有）
   */
  public updateSession(
    sessionId: string, 
    status: SessionStatus,
    endTime?: number,
    reportPath?: string
  ): void {
    this.checkInitialized();
    
    try {
      let sql = `UPDATE ${DataTable.SESSION} SET status = ?`;
      const params: any[] = [status];
      
      if (endTime !== undefined) {
        sql += ', end_time = ?';
        params.push(endTime);
      }
      
      if (reportPath !== undefined) {
        sql += ', report_path = ?';
        params.push(reportPath);
      }
      
      sql += ' WHERE id = ?';
      params.push(sessionId);
      
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
      
      logger.info('更新会话状态', { sessionId, status, endTime, reportPath });
    } catch (error) {
      logger.error('更新会话状态失败', { error, sessionId, status });
      throw error;
    }
  }

  /**
   * 保存浏览器数据
   * @param data 浏览器数据
   * @returns 插入的记录ID
   */
  public saveBrowserData(data: BrowserData): number {
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${DataTable.BROWSER_DATA}
        (session_id, timestamp, url, search_query, page_title, content_type, content, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        data.sessionId,
        data.timestamp,
        data.url || null,
        data.searchQuery || null,
        data.pageTitle || null,
        data.contentType || null,
        data.content,
        data.metadata ? JSON.stringify(data.metadata) : null
      );
      
      logger.debug('保存浏览器数据', { sessionId: data.sessionId, dataId: result.lastInsertRowid });
      return Number(result.lastInsertRowid);
    } catch (error) {
      logger.error('保存浏览器数据失败', { error, data });
      throw error;
    }
  }

  /**
   * 保存Agent数据
   * @param data Agent数据
   * @returns 插入的记录ID
   */
  public saveAgentData(data: AgentData): number {
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${DataTable.AGENT_DATA}
        (session_id, agent_id, timestamp, agent_type, input_data, output_data, processing_time_ms, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        data.sessionId,
        data.agentId,
        data.timestamp,
        data.agentType,
        data.inputData,
        data.outputData,
        data.processingTimeMs,
        data.metadata ? JSON.stringify(data.metadata) : null
      );
      
      logger.debug('保存Agent数据', { 
        sessionId: data.sessionId, 
        agentType: data.agentType,
        dataId: result.lastInsertRowid 
      });
      
      return Number(result.lastInsertRowid);
    } catch (error) {
      logger.error('保存Agent数据失败', { error, data });
      throw error;
    }
  }

  /**
   * 保存LLM数据
   * @param data LLM数据
   * @returns 插入的记录ID
   */
  public saveLLMData(data: LLMData): number {
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${DataTable.LLM_DATA}
        (session_id, timestamp, model, prompt, completion, processing_time_ms, tokens, temperature, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        data.sessionId,
        data.timestamp,
        data.model,
        data.prompt,
        data.completion,
        data.processingTimeMs,
        data.tokens,
        data.temperature || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      );
      
      logger.debug('保存LLM数据', { 
        sessionId: data.sessionId, 
        model: data.model,
        dataId: result.lastInsertRowid 
      });
      
      return Number(result.lastInsertRowid);
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
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${DataTable.SESSION} WHERE id = ?`);
      const row = stmt.get(sessionId);
      
      if (!row) return undefined;
      
      const typedRow = row as any;
      return {
        id: typedRow.id,
        keyword: typedRow.keyword,
        startTime: typedRow.start_time,
        endTime: typedRow.end_time,
        status: typedRow.status as SessionStatus,
        model: typedRow.model,
        options: typedRow.options ? JSON.parse(typedRow.options as string) : undefined,
        reportPath: typedRow.report_path,
        metadata: typedRow.metadata ? JSON.parse(typedRow.metadata as string) : undefined
      };
    } catch (error) {
      logger.error('获取会话数据失败', { error, sessionId });
      throw error;
    }
  }

  /**
   * 获取会话的浏览器数据
   * @param sessionId 会话ID
   * @returns 浏览器数据列表
   */
  public getBrowserData(sessionId: string): BrowserData[] {
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${DataTable.BROWSER_DATA} WHERE session_id = ? ORDER BY timestamp ASC`);
      const rows = stmt.all(sessionId);
      
      return rows.map((row: any) => {
        return {
          sessionId: row.session_id,
          timestamp: row.timestamp,
          url: row.url,
          searchQuery: row.search_query,
          pageTitle: row.page_title,
          contentType: row.content_type,
          content: row.content,
          metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
        };
      });
    } catch (error) {
      logger.error('获取浏览器数据失败', { error, sessionId });
      throw error;
    }
  }

  /**
   * 获取会话的Agent数据
   * @param sessionId 会话ID
   * @param agentType 可选的Agent类型过滤
   * @returns Agent数据列表
   */
  public getAgentData(sessionId: string, agentType?: string): AgentData[] {
    this.checkInitialized();
    
    try {
      let sql = `SELECT * FROM ${DataTable.AGENT_DATA} WHERE session_id = ?`;
      const params: any[] = [sessionId];
      
      if (agentType) {
        sql += ' AND agent_type = ?';
        params.push(agentType);
      }
      
      sql += ' ORDER BY timestamp ASC';
      
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      
      return rows.map((row: any) => {
        return {
          sessionId: row.session_id,
          agentId: row.agent_id,
          timestamp: row.timestamp,
          agentType: row.agent_type,
          inputData: row.input_data,
          outputData: row.output_data,
          processingTimeMs: row.processing_time_ms,
          metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
        };
      });
    } catch (error) {
      logger.error('获取Agent数据失败', { error, sessionId, agentType });
      throw error;
    }
  }

  /**
   * 获取会话的LLM数据
   * @param sessionId 会话ID
   * @param model 可选的模型过滤
   * @returns LLM数据列表
   */
  public getLLMData(sessionId: string, model?: string): LLMData[] {
    this.checkInitialized();
    
    try {
      let sql = `SELECT * FROM ${DataTable.LLM_DATA} WHERE session_id = ?`;
      const params: any[] = [sessionId];
      
      if (model) {
        sql += ' AND model = ?';
        params.push(model);
      }
      
      sql += ' ORDER BY timestamp ASC';
      
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      
      return rows.map((row: any) => {
        return {
          sessionId: row.session_id,
          timestamp: row.timestamp,
          model: row.model,
          prompt: row.prompt,
          completion: row.completion,
          processingTimeMs: row.processing_time_ms,
          tokens: row.tokens,
          temperature: row.temperature,
          metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
        };
      });
    } catch (error) {
      logger.error('获取LLM数据失败', { error, sessionId, model });
      throw error;
    }
  }

  /**
   * 获取所有会话列表
   * @param limit 限制返回的记录数量
   * @param offset 偏移量（用于分页）
   * @returns 会话列表
   */
  public getAllSessions(limit: number = 100, offset: number = 0): Session[] {
    this.checkInitialized();
    
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${DataTable.SESSION} 
        ORDER BY start_time DESC 
        LIMIT ? OFFSET ?
      `);
      
      const rows = stmt.all(limit, offset);
      
      return rows.map(row => ({
        id: (row as any).id,
        keyword: (row as any).keyword,
        startTime: (row as any).start_time,
        endTime: (row as any).end_time,
        status: (row as any).status as SessionStatus,
        model: (row as any).model,
        options: (row as any).options ? JSON.parse((row as any).options as string) : undefined,
        reportPath: (row as any).report_path,
        metadata: (row as any).metadata ? JSON.parse((row as any).metadata as string) : undefined
      }));
    } catch (error) {
      logger.error('获取所有会话失败', { error, limit, offset });
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.initialized && this.db) {
      this.db.close();
      this.initialized = false;
      logger.info('SQLite数据库连接已关闭');
    }
  }
} 