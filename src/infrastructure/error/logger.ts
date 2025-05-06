/**
 * Simple logger implementation
 */
export const logger = {
  debug: (message: string, meta?: Record<string, any>) => {
    console.debug(`[DEBUG] ${message}`, meta || '');
  },
  info: (message: string, meta?: Record<string, any>) => {
    console.info(`[INFO] ${message}`, meta || '');
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  error: (message: string, meta?: Record<string, any>) => {
    console.error(`[ERROR] ${message}`, meta || '');
  }
}; 