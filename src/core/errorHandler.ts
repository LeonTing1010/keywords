import { logger } from '../infrastructure/error/logger';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION',   // 验证错误
  RUNTIME = 'RUNTIME',        // 运行时错误
  NETWORK = 'NETWORK',        // 网络错误
  BROWSER = 'BROWSER',        // 浏览器错误
  LLM = 'LLM',               // LLM相关错误
  UNKNOWN = 'UNKNOWN',        // 未知错误
  API = 'API',
  SYSTEM = 'SYSTEM'
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  public type: ErrorType;
  public details?: any;

  constructor(
    message: string,
    type: ErrorType = ErrorType.SYSTEM,
    public originalError?: Error,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    
    // 保留原始错误堆栈
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
    this.details = details;
  }
}

/**
 * 错误处理函数
 */
export function handleError(error: any): void {
  if (error instanceof AppError) {
    switch (error.type) {
      case ErrorType.VALIDATION:
        logger.warn(error.message, error.details);
        break;
      case ErrorType.NETWORK:
        logger.error(`网络错误: ${error.message}`, error.details);
        break;
      case ErrorType.API:
        logger.error(`API错误: ${error.message}`, error.details);
        break;
      default:
        logger.error(`系统错误: ${error.message}`, error.details);
    }
  } else if (error instanceof Error) {
    console.error(`[${ErrorType.UNKNOWN}] ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    logger.error('未知错误', { error });
  }
} 