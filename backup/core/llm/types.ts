/**
 * LLM service related types
 */

/**
 * LLM message interface
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

/**
 * LLM options interface
 */
export interface LLMOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  systemPrompt?: string;
  format?: 'json' | 'text' | 'markdown';
  language?: 'zh' | 'en';
  model?: string;
  strictFormat?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  stream?: boolean;
  enableCache?: boolean;
  autoModelSelection?: boolean;
  complexityLevel?: 'simple' | 'medium' | 'complex';
  batchId?: string;
  progressCallback?: (progress: number) => void;
  [key: string]: any;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  call(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  getName(): string;
  streamCall?(messages: LLMMessage[], options?: LLMOptions, onChunk?: (chunk: string) => void): Promise<string>;
}

/**
 * LLM service configuration
 */
export interface LLMServiceConfig {
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  mockMode?: boolean;
  apiEndpoint?: string;
  mockResponses?: Record<string, any>;
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  autoModelSelection?: boolean;
  modelTiers?: ModelTierConfig;
  enableStreamingByDefault?: boolean;
}

/**
 * 模型层级配置
 */
export interface ModelTierConfig {
  simple: string;
  medium: string;
  complex: string;
}

/**
 * Analysis options
 */
export interface AnalyzeOptions {
  analysisType?: string;
  maxRetries?: number;
  retryDelay?: number;
  systemPrompt?: string;
  format?: 'json' | 'text' | 'markdown';
  temperature?: number;
  maxTokens?: number;
  strictFormat?: boolean;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
  enableCache?: boolean;
  autoModelSelection?: boolean;
  complexityLevel?: 'simple' | 'medium' | 'complex';
  progressCallback?: (progress: number) => void;
  customOutput?: {
    format?: 'json' | 'text' | 'html' | 'markdown' | 'csv';
    dimensions?: string[];
    includeVisualization?: boolean;
    interactive?: boolean;
  };
  model?: string;
  batchId?: string;
}

/**
 * 缓存条目接口
 */
export interface LLMCacheEntry {
  result: any;
  timestamp: number;
  model: string;
  accessCount: number;
}

/**
 * 流式响应块接口
 */
export interface StreamChunk {
  content: string;
  done: boolean;
  totalChunks?: number;
  chunkIndex?: number;
}

/**
 * 批处理配置接口
 */
export interface BatchProcessConfig {
  maxBatchSize: number;
  batchWindow: number;
  enabled: boolean;
} 