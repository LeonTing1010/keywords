/**
 * Logger - 系统日志记录模块
 * 提供统一的日志记录机制，支持不同级别的日志记录和格式化输出
 */
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// 日志级别枚举
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// 日志配置接口
export interface LoggerConfig {
  level: LogLevel; // 日志级别
  useConsole: boolean; // 是否输出到控制台
  useFile: boolean; // 是否输出到文件
  logDir: string; // 日志文件目录
  logFileName: string; // 日志文件名
  formatTimestamp: boolean; // 是否格式化时间戳
  includeContext: boolean; // 是否包含上下文信息
  maxErrorDepth: number; // 错误对象检查的最大深度
  prettyPrint: boolean; // 是否美化输出
}

// 默认日志配置
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  useConsole: true,
  useFile: true,
  logDir: process.env.LOG_DIR || path.join(process.cwd(), 'output', 'logs'),
  logFileName: 'keywordintent.log',
  formatTimestamp: true,
  includeContext: true,
  maxErrorDepth: 5,
  prettyPrint: true
};

/**
 * 日志记录器类
 * 提供统一的日志记录功能，支持控制台和文件输出
 */
export class Logger {
  private config: LoggerConfig;
  private logFilePath: string = '';
  private logStream: fs.WriteStream | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 确保日志目录存在
    if (this.config.useFile) {
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }
      
      this.logFilePath = path.join(this.config.logDir, this.config.logFileName);
      this.openLogStream();
    }
  }

  /**
   * 打开日志文件流
   */
  private openLogStream(): void {
    if (this.config.useFile && !this.logStream) {
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.logStream.on('error', (err) => {
        console.error(`[Logger] 无法写入日志文件: ${err.message}`);
        this.config.useFile = false; // 禁用文件日志
      });
    }
  }

  /**
   * 关闭日志流
   */
  public close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param context 上下文数据
   */
  public error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param context 上下文数据
   */
  public warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param context 上下文数据
   */
  public info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 记录调试级别日志
   * @param message 日志消息
   * @param context 上下文数据
   */
  public debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 记录跟踪级别日志
   * @param message 日志消息
   * @param context 上下文数据
   */
  public trace(message: string, context?: any): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * 格式化错误对象
   * 提取错误的详细信息，包括嵌套错误和堆栈跟踪
   * @param error 错误对象
   * @returns 格式化后的错误信息对象
   */
  private formatError(error: any, depth: number = 0): any {
    if (!error || depth > this.config.maxErrorDepth) {
      return null;
    }

    const formatted: Record<string, any> = {};

    // 基本错误属性
    if (error instanceof Error) {
      formatted.name = error.name;
      formatted.message = error.message;
      formatted.stack = error.stack;

      // 提取自定义属性
      Object.getOwnPropertyNames(error).forEach(prop => {
        if (!['name', 'message', 'stack'].includes(prop)) {
          const key = prop as string;
          formatted[key] = (error as any)[key];
        }
      });
    } else if (typeof error === 'object') {
      // 非Error对象，直接返回
      return error;
    } else {
      // 非对象值，返回字符串
      return String(error);
    }

    // 处理嵌套错误 (cause 是 ES2022 特性)
    if ('cause' in error && error.cause) {
      formatted.cause = this.formatError(error.cause, depth + 1);
    }

    // 处理内部错误
    if ('errors' in error && Array.isArray(error.errors)) {
      formatted.errors = error.errors.map((e: any) => this.formatError(e, depth + 1));
    }

    return formatted;
  }

  /**
   * 检查和处理上下文中的错误对象
   * @param context 上下文数据
   * @returns 处理后的上下文数据
   */
  private processContext(context: any): any {
    if (!context) return context;
    
    // 如果上下文直接是错误对象
    if (context instanceof Error) {
      return this.formatError(context);
    }
    
    // 处理上下文中的错误属性
    if (typeof context === 'object') {
      const processed = { ...context };
      
      // 检查所有顶级属性
      Object.keys(processed).forEach(key => {
        if (processed[key] instanceof Error) {
          processed[key] = this.formatError(processed[key]);
        }
      });
      
      // 特殊处理常见错误属性名
      ['error', 'err', 'exception', 'e'].forEach(errorKey => {
        if (processed[errorKey]) {
          processed[errorKey] = this.formatError(processed[errorKey]);
        }
      });
      
      return processed;
    }
    
    return context;
  }

  /**
   * 记录日志
   * @param level 日志级别
   * @param message 日志消息
   * @param context 上下文数据
   */
  private log(level: LogLevel, message: string, context?: any): void {
    if (level > this.config.level) return;

    const timestamp = this.formatTimestamp();
    const levelName = LogLevel[level];
    
    // 处理上下文中的错误对象
    const processedContext = this.processContext(context);
    
    // 格式化上下文数据
    let contextStr = '';
    if (this.config.includeContext && processedContext) {
      try {
        // 使用更好的格式化选项
        contextStr = util.inspect(processedContext, { 
          depth: this.config.maxErrorDepth, 
          colors: false,
          compact: !this.config.prettyPrint,
          breakLength: 100,
          maxArrayLength: 10,
          sorted: true
        });
      } catch (error) {
        contextStr = '[无法序列化上下文]';
      }
    }
    
    // 构建日志条目
    const logEntry = `[${timestamp}] [${levelName}] ${message}${contextStr ? ' ' + contextStr : ''}`;
    
    // 输出到控制台
    if (this.config.useConsole) {
      const consoleMethod = this.getConsoleMethod(level);
      consoleMethod(logEntry);
    }
    
    // 输出到文件
    if (this.config.useFile && this.logStream) {
      this.logStream.write(logEntry + '\n');
    }
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(): string {
    const now = new Date();
    
    if (this.config.formatTimestamp) {
      return now.toISOString();
    } else {
      return now.getTime().toString();
    }
  }

  /**
   * 获取对应级别的控制台方法
   */
  private getConsoleMethod(level: LogLevel): (message: string) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.TRACE:
        return console.trace;
      case LogLevel.INFO:
      default:
        return console.info;
    }
  }
}

// 创建全局单例日志记录器实例
export const logger = new Logger({
  level: process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : 
         process.env.LOG_LEVEL === 'trace' ? LogLevel.TRACE : 
         process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN : 
         process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR : LogLevel.INFO,
  useFile: process.env.LOG_TO_FILE !== 'false',
  prettyPrint: process.env.PRETTY_LOGS !== 'false'
}); 