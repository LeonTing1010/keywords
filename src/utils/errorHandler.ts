/**
 * 错误处理工具
 * 提供统一的错误处理机制
 */

/**
 * 应用错误类型
 */
export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  BROWSER = 'BROWSER_ERROR',
  CAPTCHA = 'CAPTCHA_ERROR',
  PARSING = 'PARSING_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  FILE_SYSTEM = 'FILE_SYSTEM_ERROR',
  PROCESS = 'PROCESS_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  type: ErrorType;
  details?: any;

  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN, details?: any) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
  }
}

/**
 * 处理错误并打印友好的错误信息
 * @param error 捕获的错误
 * @param context 错误上下文信息
 */
export function handleError(error: any, context?: string): void {
  // 确定错误类型
  let appError: AppError;
  
  if (error instanceof AppError) {
    appError = error;
  } else {
    // 将普通错误转换为应用错误
    appError = new AppError(
      error.message || '发生未知错误',
      ErrorType.UNKNOWN,
      { originalError: error }
    );
  }

  // 打印错误信息
  console.error('\n❌ 错误:', appError.message);
  if (context) {
    console.error(`📍 位置: ${context}`);
  }
  console.error(`🔍 类型: ${appError.type}`);
  
  // 根据错误类型提供具体建议
  switch (appError.type) {
    case ErrorType.NETWORK:
      console.error('💡 建议: 请检查网络连接或代理设置，或者目标网站可能暂时不可用');
      break;
    case ErrorType.BROWSER:
      console.error('💡 建议: 浏览器操作失败，请尝试使用临时浏览器或更新Playwright');
      break;
    case ErrorType.CAPTCHA:
      console.error('💡 建议: 遇到验证码，请手动处理或稍后再试');
      break;
    case ErrorType.PARSING:
      console.error('💡 建议: 网页结构可能已更改，请更新选择器或报告此问题');
      break;
    case ErrorType.FILE_SYSTEM:
      console.error('💡 建议: 请检查文件权限或磁盘空间');
      break;
    case ErrorType.PROCESS:
      console.error('💡 建议: 处理过程中出错，请检查输入数据或查看日志了解详情');
      break;
    default:
      console.error('💡 建议: 请尝试重新运行程序，如果问题持续存在，请报告此错误');
  }

  // 如果有详细信息，打印调试信息
  if (process.env.DEBUG && appError.details) {
    console.error('\n🔧 调试信息:', appError.details);
  }
}

/**
 * 创建特定类型的错误
 * @param message 错误消息
 * @param type 错误类型
 * @param details 错误详情
 */
export function createError(message: string, type: ErrorType, details?: any): AppError {
  return new AppError(message, type, details);
}