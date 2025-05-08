/**
 * logger/index.ts
 * 提供统一的日志记录服务
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  logFilePath?: string;
  format?: 'json' | 'text';
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}

/**
 * 日志服务
 */
class Logger {
  private config: Required<LoggerConfig>;
  
  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile ?? false,
      logFilePath: config.logFilePath ?? './logs/app.log',
      format: config.format ?? 'json'
    };
  }
  
  /**
   * 记录错误级别日志
   */
  public error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }
  
  /**
   * 记录警告级别日志
   */
  public warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  /**
   * 记录信息级别日志
   */
  public info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  /**
   * 记录调试级别日志
   */
  public debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  /**
   * 记录跟踪级别日志
   */
  public trace(message: string, context?: any): void {
    this.log(LogLevel.TRACE, message, context);
  }
  
  /**
   * 设置日志级别
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }
  
  /**
   * 记录日志
   * @private
   */
  private log(level: LogLevel, message: string, context?: any): void {
    // 检查是否应该记录此级别的日志
    if (level > this.config.level) {
      return;
    }
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };
    
    // 控制台输出
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }
    
    // 文件输出
    if (this.config.enableFile) {
      // 这里可以添加文件日志记录的实现
      // 目前先简单实现控制台输出
    }
  }
  
  /**
   * 输出日志到控制台
   * @private
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    
    let consoleMethod: 'error' | 'warn' | 'info' | 'debug' | 'log';
    switch (entry.level) {
      case LogLevel.ERROR:
        consoleMethod = 'error';
        break;
      case LogLevel.WARN:
        consoleMethod = 'warn';
        break;
      case LogLevel.INFO:
        consoleMethod = 'info';
        break;
      case LogLevel.DEBUG:
        consoleMethod = 'debug';
        break;
      default:
        consoleMethod = 'log';
    }
    
    if (this.config.format === 'json') {
      const logObject = {
        timestamp,
        level: levelName,
        message: entry.message,
        ...entry.context
      };
      console[consoleMethod](JSON.stringify(logObject));
    } else {
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      console[consoleMethod](`[${timestamp}] ${levelName}: ${entry.message}${contextStr}`);
    }
  }
}

// 创建默认的日志实例
export const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  format: 'text'
}); 