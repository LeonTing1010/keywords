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
import { z } from 'zod';

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
          
          const result = await this.llmService.analyze(prompt, {
            analysisType: 'agent-request',
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
          
          const result = await this.llmService.analyze(prompt, {
            analysisType: 'agent-stream-request',
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

  /**
   * 直接调用EnhancedLLMService的analyze方法
   * 提供更灵活的文本分析能力
   */
  public async analyze(prompt: string, analysisType: string, options: any = {}): Promise<any> {
    try {
      logger.debug('Calling EnhancedLLMService analyze method');
      options.analysisType = analysisType;
      return await this.llmService.analyze(prompt, options);
    } catch (error) {
      logger.error('LLM analyze error', { error, analysisType });
      throw error;
    }
  }

  /**
   * 使用schema分析并返回验证后的结果
   */
  public async analyzeWithSchema<T>(
    prompt: string,
    analysisType: string,
    schema: z.ZodTypeAny,
    options: any = {}
  ): Promise<T> {
    // 创建 JSON 强制提供者，但不使用 SchemaValidated 提供者
    // 因为 getDefaultProvider 尚未实现
    const provider = this.llmService.llmHub.createJsonEnforcedProvider({
      call: async (messages, opts) => {
        // 将提示转换为消息
        const fullPrompt = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
        
        const result = await this.llmService.analyze(fullPrompt, {
          analysisType: analysisType,
          temperature: opts?.temperature || 0.7,
          format: 'json',
          strictFormat: true
        });
        
        return typeof result === 'string' ? result : 
               typeof result.content === 'string' ? result.content : 
               JSON.stringify(result);
      },
      getName: () => 'DirectLLMProvider'
    });
    
    // 将提示转换为消息
    const messages: LLMMessage[] = [
      { role: 'system' as const, content: options.systemPrompt || 'You are a helpful assistant that returns valid JSON.' },
      { role: 'user' as const, content: prompt }
    ];
    
    // 添加 schema 提示
    const systemMessage = messages[0];
    const schemaDescription = this.schemaToInterfaceString(schema);
    systemMessage.content = `${systemMessage.content}\n\n请确保你的输出严格符合以下TypeScript接口定义的JSON格式:\n\n${schemaDescription}\n\n不要返回任何其他文本、注释或解释，只返回符合接口的有效JSON。`;
    
    // 设置选项
    const callOptions = {
      ...options,
      format: 'json',
      strictFormat: true,
      temperature: options.temperature || 0.7,
      maxRetries: options.maxRetries || 2
    };
    
    try {
      // 调用provider
      const response = await provider.call(messages, callOptions);
      
      // 解析响应
      const parsedResponse = JSON.parse(response);
      
      // 使用Zod验证
      const validationResult = schema.safeParse(parsedResponse);
      if (validationResult.success) {
        return validationResult.data as T;
      } else {
        // 验证失败
        const errorMessage = `Schema验证失败: ${validationResult.error.errors.map(e => e.message).join(', ')}`;
        logger.error(errorMessage, { analysisType });
        
        // 如果提供了默认值，返回默认值
        if (options.defaultValue !== undefined) {
          return options.defaultValue as T;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      logger.error(`Schema验证分析失败: ${error.message}`, { analysisType });
      
      // 如果提供了默认值，返回默认值
      if (options.defaultValue !== undefined) {
        return options.defaultValue as T;
      }
      
      throw error;
    }
  }

  /**
   * 将Zod schema转换为TypeScript接口定义字符串
   */
  private schemaToInterfaceString(schema: z.ZodTypeAny): string {
    if (schema instanceof z.ZodObject) {
      const shape = schema._def.shape();
      const properties = Object.entries(shape)
        .map(([key, value]) => {
          const isOptional = value instanceof z.ZodOptional;
          const baseType = isOptional ? (value as any)._def.innerType : value;
          
          let typeStr = 'any';
          if (baseType instanceof z.ZodString) {
            typeStr = 'string';
          } else if (baseType instanceof z.ZodNumber) {
            typeStr = 'number';
          } else if (baseType instanceof z.ZodBoolean) {
            typeStr = 'boolean';
          } else if (baseType instanceof z.ZodArray) {
            const itemType = this.getSimpleTypeName(baseType._def.type);
            typeStr = `${itemType}[]`;
          } else if (baseType instanceof z.ZodObject) {
            typeStr = '{ ' + Object.entries(baseType._def.shape())
              .map(([k, v]) => `${k}: ${this.getSimpleTypeName(v)}`)
              .join('; ') + ' }';
          } else if (baseType instanceof z.ZodEnum) {
            const values = baseType._def.values;
            typeStr = values.map((v: string) => `"${v}"`).join(' | ');
          }
          
          return `  ${key}${isOptional ? '?' : ''}: ${typeStr};`;
        })
        .join('\n');
      
      return `interface ExpectedOutput {\n${properties}\n}`;
    } else if (schema instanceof z.ZodArray) {
      const itemType = this.getSimpleTypeName(schema._def.type);
      return `type ExpectedOutput = ${itemType}[];`;
    }
    
    // 其他类型简化处理
    return `type ExpectedOutput = any;`;
  }

  /**
   * 获取简化的类型名称
   */
  private getSimpleTypeName(zodType: any): string {
    if (zodType instanceof z.ZodString) return 'string';
    if (zodType instanceof z.ZodNumber) return 'number';
    if (zodType instanceof z.ZodBoolean) return 'boolean';
    if (zodType instanceof z.ZodArray) return `${this.getSimpleTypeName(zodType._def.type)}[]`;
    if (zodType instanceof z.ZodObject) return 'object';
    if (zodType instanceof z.ZodEnum) {
      const values = zodType._def.values;
      return values.map((v: string) => `"${v}"`).join(' | ');
    }
    return 'any';
  }

  /**
   * 分析并返回数组结果，通过schema验证
   */
  public async analyzeToArray<T>(
    prompt: string,
    analysisType: string,
    arraySchema: z.ZodTypeAny,
    options: any = {}
  ): Promise<T[]> {
    // 如果提供的不是数组schema，创建一个
    const schema = arraySchema instanceof z.ZodArray 
      ? arraySchema 
      : z.array(arraySchema);
    
    return this.analyzeWithSchema<T[]>(
      prompt,
      analysisType,
      schema,
      {
        ...options,
        defaultValue: options.defaultValue || []
      }
    );
  }

  /**
   * 分析并返回对象结果，通过schema验证
   */
  public async analyzeToObject<T extends object>(
    prompt: string,
    analysisType: string,
    objectSchema: z.ZodTypeAny,
    options: any = {}
  ): Promise<T> {
    // 确保使用的是对象schema
    let schema: z.ZodTypeAny;
    
    if (objectSchema instanceof z.ZodObject) {
      schema = objectSchema;
    } else {
      // 如果不是ZodObject，我们需要直接传递schema，而不是尝试转换
      schema = objectSchema;
    }
    
    return this.analyzeWithSchema<T>(
      prompt,
      analysisType,
      schema,
      {
        ...options,
        defaultValue: options.defaultValue || {}
      }
    );
  }
} 