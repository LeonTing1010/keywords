/**
 * KeywordIntent 错误处理模块
 * 提供统一的错误处理和日志机制
 */
import { logger } from './logger';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  /** 验证错误 */
  VALIDATION = 'validation',
  /** 网络错误 */
  NETWORK = 'network',
  /** API错误 */
  API = 'api',
  /** 浏览器错误 */
  BROWSER = 'browser',
  /** 文件系统错误 */
  FILE_SYSTEM = 'file_system',
  /** 未知错误 */
  UNKNOWN = 'unknown'
}

/**
 * 应用程序错误类
 */
export class AppError extends Error {
  /** 错误类型 */
  type: ErrorType;
  /** 原始错误 */
  originalError?: Error;

  /**
   * 创建应用错误实例
   * @param message 错误消息
   * @param type 错误类型
   * @param originalError 原始错误
   */
  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN, originalError?: Error) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * 错误处理函数
 * @param error 捕获的错误
 */
export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    // 已经是应用错误，直接处理
    logError(error);
  } else if (error instanceof Error) {
    // 包装原生错误
    const appError = new AppError(error.message, determineErrorType(error), error);
    logError(appError);
  } else {
    // 未知错误类型
    const appError = new AppError(String(error));
    logError(appError);
  }
}

/**
 * 确定错误类型
 * @param error 原始错误
 */
function determineErrorType(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  if (error.name === 'ValidationError') return ErrorType.VALIDATION;
  if (error.name === 'NetworkError' || message.includes('network') || message.includes('timeout')) return ErrorType.NETWORK;
  if (error.name === 'APIError' || message.includes('api') || message.includes('response')) return ErrorType.API;
  if (message.includes('browser') || message.includes('playwright') || message.includes('element')) return ErrorType.BROWSER;
  if (message.includes('file') || message.includes('directory') || message.includes('permission')) return ErrorType.FILE_SYSTEM;
  
  return ErrorType.UNKNOWN;
}

/**
 * 记录错误日志
 * @param error 应用错误
 */
function logError(error: AppError): void {
  // 创建包含错误信息的上下文对象
  const context: Record<string, any> = {
    errorType: error.type,
    stack: error.stack
  };
  
  if (error.originalError) {
    context.originalError = {
      message: error.originalError.message,
      name: error.originalError.name,
      stack: error.originalError.stack
    };
  }
  
  // 根据错误类型选择不同的日志消息
  switch (error.type) {
    case ErrorType.VALIDATION:
      logger.error(`验证错误: ${error.message}`, context);
      break;
    case ErrorType.NETWORK:
      logger.error(`网络错误: ${error.message}`, context);
      break;
    case ErrorType.API:
      logger.error(`API错误: ${error.message}`, context);
      break;
    case ErrorType.BROWSER:
      logger.error(`浏览器错误: ${error.message}`, context);
      break;
    case ErrorType.FILE_SYSTEM:
      logger.error(`文件系统错误: ${error.message}`, context);
      break;
    default:
      logger.error(`未知错误: ${error.message}`, context);
  }
} 