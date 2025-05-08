/**
 * Simple logger implementation
 */

// Logger interface
export interface LoggerInterface {
  info(message: string, context?: any): void;
  debug(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

// Default implementation
export const logger: LoggerInterface = {
  info(message: string, context?: any) {
    console.log(`[INFO] ${message}`, context || '');
  },
  debug(message: string, context?: any) {
    console.log(`[DEBUG] ${message}`, context || '');
  },
  warn(message: string, context?: any) {
    console.warn(`[WARN] ${message}`, context || '');
  },
  error(message: string, context?: any) {
    console.error(`[ERROR] ${message}`, context || '');
  }
}; 