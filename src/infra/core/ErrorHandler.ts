/**
 * Error types enumeration
 */
export enum ErrorType {
  BROWSER = 'BROWSER_ERROR',
  NETWORK = 'NETWORK_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  PARSE = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * Application error class
 */
export class AppError extends Error {
  public type: ErrorType;
  public originalError?: Error;

  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN, originalError?: Error) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.originalError = originalError;
  }
} 