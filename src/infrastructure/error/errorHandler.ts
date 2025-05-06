export enum ErrorType {
  VALIDATION = 'VALIDATION',
  RUNTIME = 'RUNTIME',
  NETWORK = 'NETWORK',
  LLM = 'LLM',
  UNKNOWN = 'UNKNOWN'
}

export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType = ErrorType.UNKNOWN
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    console.error(`[${error.type}] ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`[${ErrorType.UNKNOWN}] ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`[${ErrorType.UNKNOWN}] An unknown error occurred:`, error);
  }
} 