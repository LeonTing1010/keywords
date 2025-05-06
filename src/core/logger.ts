/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  useConsole?: boolean;
  formatTimestamp?: boolean;
  includeContext?: boolean;
}

/**
 * 日志记录器类
 */
export class Logger {
  private config: LoggerConfig;
  private static instance: Logger;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      useConsole: config.useConsole ?? true,
      formatTimestamp: config.formatTimestamp ?? true,
      includeContext: config.includeContext ?? true
    };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: string, message: string, context?: any): string {
    const parts = [];

    if (this.config.formatTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${level}]`);
    parts.push(message);

    if (this.config.includeContext && context) {
      parts.push(JSON.stringify(context));
    }

    return parts.join(' ');
  }

  /**
   * 记录错误日志
   */
  public error(message: string, context?: any): void {
    if (this.config.level >= LogLevel.ERROR) {
      const formattedMessage = this.formatMessage('ERROR', message, context);
      if (this.config.useConsole) {
        console.error(formattedMessage);
      }
    }
  }

  /**
   * 记录警告日志
   */
  public warn(message: string, context?: any): void {
    if (this.config.level >= LogLevel.WARN) {
      const formattedMessage = this.formatMessage('WARN', message, context);
      if (this.config.useConsole) {
        console.warn(formattedMessage);
      }
    }
  }

  /**
   * 记录信息日志
   */
  public info(message: string, context?: any): void {
    if (this.config.level >= LogLevel.INFO) {
      const formattedMessage = this.formatMessage('INFO', message, context);
      if (this.config.useConsole) {
        console.info(formattedMessage);
      }
    }
  }

  /**
   * 记录调试日志
   */
  public debug(message: string, context?: any): void {
    if (this.config.level >= LogLevel.DEBUG) {
      const formattedMessage = this.formatMessage('DEBUG', message, context);
      if (this.config.useConsole) {
        console.debug(formattedMessage);
      }
    }
  }

  /**
   * 记录跟踪日志
   */
  public trace(message: string, context?: any): void {
    if (this.config.level >= LogLevel.TRACE) {
      const formattedMessage = this.formatMessage('TRACE', message, context);
      if (this.config.useConsole) {
        console.trace(formattedMessage);
      }
    }
  }

  /**
   * 关闭日志记录器
   */
  public close(): void {
    // 在这里可以添加清理逻辑，比如关闭文件流等
  }
}

// 导出默认日志实例
export const logger = Logger.getInstance(); 