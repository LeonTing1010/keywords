/**
 * AgentLLMService.ts - 代理系统专用的LLM服务
 * 封装LLMServiceHub以便代理系统使用
 */
import { LLMServiceHub } from './LLMServiceHub';
import { OpenAIProvider } from './providers/OpenAIProvider';
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
}

/**
 * 代理系统专用的LLM服务
 * 提供与LangChain兼容的接口
 */
export class AgentLLMService extends BaseChatModel {
  private llmHub: LLMServiceHub;
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
      mockMode: config.mockMode || (process.env.MOCK_LLM === 'true')
    };
    
    // 创建LLM服务中心
    this.llmHub = new LLMServiceHub({
      model: this.config.model,
      apiKey: this.config.apiKey,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiEndpoint: this.config.apiBaseUrl,
      mockMode: this.config.mockMode
    });
    
    logger.debug('AgentLLMService initialized', {
      model: this.config.model,
      mockMode: this.config.mockMode
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
        model: options.model || this.config.model
      };
      
      // 创建一个LLMProvider实例
      const provider: LLMProvider = {
        call: async (msgs: LLMMessage[], opts?: LLMOptions) => {
          // 使用LLM服务中心的analyze方法
          const prompt = msgs
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n\n');
          
          const result = await this.llmHub.analyze(prompt, 'agent-request', {
            temperature: opts?.temperature,
            maxTokens: opts?.maxTokens,
            format: 'text'
          });
          
          return typeof result === 'string' ? result : JSON.stringify(result);
        },
        getName: () => `AgentLLM-${this.config.model}`
      };
      
      // 如果需要强制JSON格式，使用JSON强制提供者
      const actualProvider = options.format === 'json' 
        ? this.llmHub.createJsonEnforcedProvider(provider)
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
} 