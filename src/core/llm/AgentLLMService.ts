/**
 * AgentLLMService.ts - 代理系统专用的LLM服务
 * 封装EnhancedLLMService以便代理系统使用
 */
import { EnhancedLLMService } from './EnhancedLLMService';
import { LLMMessage, LLMOptions, LLMProvider } from './types';
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { MessageContent } from "@langchain/core/messages";
import { logger } from '../../infra/logger';

/**
 * AgentLLMService配置接口
 */
export interface AgentLLMServiceConfig {
  model?: string;
  temperature?: number;
  apiKey?: string;
  apiBaseUrl?: string;
  maxTokens?: number;
  mockMode?: boolean;
  // 新增配置项
  enableCache?: boolean;
  autoModelSelection?: boolean;
  enableStreaming?: boolean;
  batchProcessing?: boolean;
  collectFeedback?: boolean;
}

/**
 * 代理系统专用的LLM服务
 * 提供与LangChain兼容的接口，同时支持高级功能
 */
export class AgentLLMService extends BaseChatModel {
  private llmService: EnhancedLLMService;
  private config: AgentLLMServiceConfig;
  
  /**
   * 创建AgentLLMService实例
   */
  constructor(config: AgentLLMServiceConfig = {}) {
    super({});
    
    // 配置信息
    this.config = {
      model: config.model || process.env.LLM_MODEL || 'gpt-3.5-turbo',
      temperature: config.temperature || 0.7,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      apiBaseUrl: config.apiBaseUrl || process.env.LLM_BASE_URL,
      maxTokens: config.maxTokens || 4000,
      mockMode: config.mockMode || (process.env.MOCK_LLM === 'true'),
      enableCache: config.enableCache !== false,
      autoModelSelection: config.autoModelSelection !== false,
      enableStreaming: config.enableStreaming || false,
      batchProcessing: config.batchProcessing !== false,
      collectFeedback: config.collectFeedback || false
    };
    
    // 创建增强版LLM服务
    this.llmService = new EnhancedLLMService({
      model: this.config.model,
      apiKey: this.config.apiKey,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiEndpoint: this.config.apiBaseUrl,
      mockMode: this.config.mockMode,
      enableCache: this.config.enableCache,
      autoModelSelection: this.config.autoModelSelection,
      enableStreamingByDefault: this.config.enableStreaming,
      batchProcessingEnabled: this.config.batchProcessing,
      collectFeedback: this.config.collectFeedback
    });
    
    logger.debug('AgentLLMService initialized with enhanced features', {
      model: this.config.model,
      mockMode: this.config.mockMode,
      features: {
        cache: this.config.enableCache,
        autoModelSelection: this.config.autoModelSelection,
        streaming: this.config.enableStreaming,
        batchProcessing: this.config.batchProcessing
      }
    });
  }
  
  /**
   * 转换LangChain消息为LLM消息
   */
  private convertMessages(messages: BaseMessage[]): LLMMessage[] {
    return messages.map(message => {
      if (message instanceof HumanMessage) {
        return { role: 'user', content: message.content as string };
      } else if (message instanceof AIMessage) {
        return { role: 'assistant', content: message.content as string };
      } else if (message instanceof SystemMessage) {
        return { role: 'system', content: message.content as string };
      } else {
        // 默认为用户消息
        return { role: 'user', content: message.content as string };
      }
    });
  }
  
  /**
   * 实现LangChain的_generate方法
   */
  async _generate(messages: BaseMessage[], options: any = {}): Promise<any> {
    try {
      logger.debug('Generating LLM response');
      
      // 转换消息格式
      const llmMessages = this.convertMessages(messages);
      
      // 设置选项
      const llmOptions: LLMOptions = {
        temperature: options.temperature || this.config.temperature,
        maxTokens: options.maxTokens || this.config.maxTokens,
        model: options.model || this.config.model,
        format: options.format || 'text',
        complexityLevel: options.complexityLevel,
        stream: options.stream || this.config.enableStreaming,
        enableCache: options.enableCache !== false && this.config.enableCache,
        autoModelSelection: options.autoModelSelection !== false && this.config.autoModelSelection
      };
      
      // 设置流式处理回调（如果提供）
      if (llmOptions.stream && options.streamCallback) {
        llmOptions.onChunk = (chunk: string) => {
          if (options.streamCallback) {
            options.streamCallback(chunk);
          }
        };
      }
      
      // 创建一个LLMProvider实例
      const provider: LLMProvider = {
        call: async (msgs: LLMMessage[], opts?: LLMOptions) => {
          // 使用增强版LLM服务的analyze方法
          const prompt = msgs
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n\n');
          
          const result = await this.llmService.analyze(prompt, 'agent-request', {
            temperature: opts?.temperature,
            maxTokens: opts?.maxTokens,
            format: 'text',
            stream: opts?.stream,
            onChunk: opts?.onChunk,
            autoModelSelection: opts?.autoModelSelection,
            complexityLevel: opts?.complexityLevel,
            enableCache: opts?.enableCache
          });
          
          return typeof result === 'string' ? result : 
                 typeof result.content === 'string' ? result.content : 
                 JSON.stringify(result);
        },
        getName: () => `AgentLLM-${this.config.model}`,
        
        // 实现流式调用（如果需要）
        streamCall: async (msgs: LLMMessage[], opts?: LLMOptions, onChunk?: (chunk: string) => void) => {
          if (!onChunk) {
            // 如果没有提供onChunk回调，使用普通调用
            return await provider.call(msgs, opts);
          }
          
          const prompt = msgs
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n\n');
          
          // 更新onChunk回调
          const streamOpts = { ...opts, stream: true, onChunk };
          
          const result = await this.llmService.analyze(prompt, 'agent-stream-request', {
            temperature: streamOpts.temperature,
            maxTokens: streamOpts.maxTokens,
            format: 'text',
            stream: true,
            onChunk,
            autoModelSelection: streamOpts.autoModelSelection,
            complexityLevel: streamOpts.complexityLevel,
            enableCache: streamOpts.enableCache
          });
          
          return typeof result === 'string' ? result : 
                 typeof result.content === 'string' ? result.content : 
                 JSON.stringify(result);
        }
      };
      
      // 如果需要强制JSON格式，使用JSON强制提供者
      const actualProvider = options.format === 'json' 
        ? this.llmService.llmHub.createJsonEnforcedProvider(provider)
        : provider;
      
      // 调用LLM
      const response = await actualProvider.call(llmMessages, llmOptions);
      
      // 创建LangChain兼容的响应格式
      return {
        generations: [
          {
            text: response,
            message: new AIMessage(response)
          }
        ]
      };
    } catch (error) {
      logger.error('LLM generation error', { error });
      throw error;
    }
  }
  
  /**
   * 实现LangChain的getNumTokens方法
   */
  async getNumTokens(content: MessageContent): Promise<number> {
    // 将内容转换为字符串
    const text = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);
    
    // 简单估计：大约4个字符一个token
    return Math.ceil(text.length / 4);
  }
  
  _llmType(): string {
    return "AgentLLM";
  }
  
  _modelType(): string {
    return this.config.model || "gpt-3.5-turbo";
  }
  
  /**
   * 获取LLM服务统计信息
   */
  public getServiceStats(): any {
    return this.llmService.getStats();
  }
  
  /**
   * 提交用户反馈
   */
  public submitFeedback(requestId: string, rating: number, feedback?: string): void {
    if (this.config.collectFeedback) {
      this.llmService.submitFeedback(requestId, rating, feedback);
    }
  }
} 