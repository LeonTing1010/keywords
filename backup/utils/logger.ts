import * as fs from 'fs';
import * as path from 'path';

/**
 * 日志系统工具类
 * 提供统一的日志记录功能，支持控制台彩色输出和文件记录
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 4,
  NONE = 5
}

interface LogColors {
  [key: string]: string;
}

export class Logger {
  private context: string;
  private level: LogLevel;
  private logDir: string;
  private logFile: string;
  private debugLogFile: string;
  private colors: LogColors = {
    DEBUG: '\x1b[36m',    // Cyan
    INFO: '\x1b[37m',     // White
    WARN: '\x1b[33m',     // Yellow
    ERROR: '\x1b[31m',    // Red
    SUCCESS: '\x1b[32m',  // Green
    RESET: '\x1b[0m'
  };
  private isDebugMode: boolean;

  constructor(context: string, level: LogLevel = LogLevel.INFO, logDir?: string) {
    this.context = context;
    this.isDebugMode = process.env.DEBUG === 'true';
    
    // 在调试模式下，自动设置日志级别为DEBUG
    this.level = this.isDebugMode ? LogLevel.DEBUG : level;
    
    this.logDir = logDir || path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `${context.toLowerCase()}.log`);
    this.debugLogFile = path.join(this.logDir, 'debug', `${context.toLowerCase()}_debug.log`);
    this.ensureLogDirectory();
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    // 仅当不是调试模式时才允许更改日志级别
    if (!this.isDebugMode) {
      this.level = level;
    }
  }

  /**
   * 获取当前时间戳
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 获取高精度时间戳（毫秒）
   */
  private getPreciseTimestamp(): string {
    const now = new Date();
    return `${now.toISOString()}.${process.hrtime()[1] / 1000000}`;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: string, message: string, useHighPrecisionTime: boolean = false): string {
    const timestamp = useHighPrecisionTime ? this.getPreciseTimestamp() : this.getTimestamp();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }

  /**
   * 调试日志
   */
  debug(message: string, includeStackTrace: boolean = false): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.getColoredMessage('DEBUG', message));
      this.logToFile('DEBUG', message, includeStackTrace, true);
    }
  }

  /**
   * 信息日志
   */
  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.getColoredMessage('INFO', message));
      this.logToFile('INFO', message);
    }
  }

  /**
   * 警告日志
   */
  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.getColoredMessage('WARN', message));
      this.logToFile('WARN', message);
    }
  }

  /**
   * 错误日志
   */
  error(message: string, includeStackTrace: boolean = true): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.getColoredMessage('ERROR', message));
      this.logToFile('ERROR', message, includeStackTrace);
    }
  }

  /**
   * 成功日志
   */
  success(message: string): void {
    if (this.level <= LogLevel.SUCCESS) {
      console.log(this.getColoredMessage('SUCCESS', message));
      this.logToFile('SUCCESS', message);
    }
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // 确保调试日志目录存在
    const debugDir = path.join(this.logDir, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
  }

  /**
   * 记录日志到文件
   */
  private logToFile(
    level: string, 
    message: string, 
    includeStackTrace: boolean = false, 
    debugOnly: boolean = false
  ): void {
    const isDebugLevel = level === 'DEBUG';
    const highPrecision = isDebugLevel || level === 'ERROR';
    
    let logEntry = `${this.formatMessage(level, message, highPrecision)}\n`;
    
    // 如果需要包含堆栈跟踪
    if (includeStackTrace) {
      const stackTrace = new Error().stack?.split('\n').slice(3).join('\n') || '';
      logEntry += `${stackTrace}\n`;
    }
    
    // 记录到常规日志文件（非调试专用消息）
    if (!debugOnly) {
      fs.appendFileSync(this.logFile, logEntry);
    }
    
    // 调试日志和错误日志都记录到调试日志文件
    if (isDebugLevel || level === 'ERROR' || this.isDebugMode) {
      fs.appendFileSync(this.debugLogFile, logEntry);
    }
  }

  /**
   * 获取彩色日志消息
   */
  private getColoredMessage(level: string, message: string): string {
    const color = this.colors[level] || this.colors.RESET;
    return `${color}${this.formatMessage(level, message)}${this.colors.RESET}`;
  }

  /**
   * 清理旧日志文件
   * @param days 保留最近几天的日志
   */
  public cleanOldLogs(days: number = 7): void {
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000;

    if (fs.existsSync(this.logDir)) {
      fs.readdirSync(this.logDir).forEach(file => {
        const filePath = path.join(this.logDir, file);
        
        // 如果是目录，跳过
        if (fs.statSync(filePath).isDirectory()) {
          return;
        }
        
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`已清理过期日志文件: ${file}`);
        }
      });
      
      // 清理调试日志目录
      const debugDir = path.join(this.logDir, 'debug');
      if (fs.existsSync(debugDir)) {
        fs.readdirSync(debugDir).forEach(file => {
          const filePath = path.join(debugDir, file);
          const stats = fs.statSync(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`已清理过期调试日志文件: ${file}`);
          }
        });
      }
    }
  }
  
  /**
   * 记录对象信息（JSON格式）
   * @param label 标签
   * @param data 要记录的数据对象
   */
  public debugObject(label: string, data: any): void {
    if (this.level <= LogLevel.DEBUG) {
      try {
        const jsonStr = JSON.stringify(data, null, 2);
        this.debug(`${label}:\n${jsonStr}`);
      } catch (error) {
        this.error(`无法序列化对象 ${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * 记录请求和响应信息（用于调试网络通信）
   * @param requestInfo 请求信息
   * @param responseInfo 响应信息
   */
  public debugRequest(
    method: string, 
    url: string, 
    requestHeaders?: Record<string, string>, 
    responseStatus?: number,
    responseData?: any
  ): void {
    if (this.level <= LogLevel.DEBUG) {
      const reqMsg = `${method} ${url}`;
      const headerMsg = requestHeaders ? `\n请求头: ${JSON.stringify(requestHeaders, null, 2)}` : '';
      const respMsg = responseStatus ? `\n响应状态: ${responseStatus}` : '';
      const dataMsg = responseData ? `\n响应数据: ${JSON.stringify(responseData, null, 2)}` : '';
      
      this.debug(`API请求/响应: ${reqMsg}${headerMsg}${respMsg}${dataMsg}`);
    }
  }
}