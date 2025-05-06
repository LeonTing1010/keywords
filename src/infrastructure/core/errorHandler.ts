/**
 * Error types for application-wide error handling
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  BROWSER = 'BROWSER',
  VALIDATION = 'VALIDATION',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Application-specific error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
} 