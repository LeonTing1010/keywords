/**
 * LLMService.ts - LLM服务接口
 * 定义了LLM服务的通用接口和类型
 */

import { ValidationService } from '../../utils/ValidationService';
import { 
  ChatMessage, 
  LLMRequestOptions, 
  LLMServiceConfig 
} from '../../types/schemas';

/**
 * LLM服务接口
 * 所有LLM服务实现都应遵循此接口
 */
export interface LLMService {
  /**
   * 获取模型名称
   * @returns 模型名称
   */
  getModelName(): string;

  /**
   * 执行聊天完成
   * @param messages 消息列表
   * @param options 可选参数
   * @returns 完成的消息
   */
  chat(messages: ChatMessage[], options?: LLMRequestOptions): Promise<ChatMessage>;
  
  /**
   * 聊天完成的别名方法
   * 与chat方法功能相同，用于向后兼容
   * @param messages 消息列表
   * @param options 可选参数
   * @returns 完成的消息
   */
  chatCompletion(messages: ChatMessage[], options?: LLMRequestOptions): Promise<ChatMessage>;

  /**
   * 将聊天结果解析为JSON
   * @param messages 消息列表
   * @param jsonSchema 预期的JSON Schema
   * @param options 可选参数
   * @returns 解析后的JSON对象
   */
  chatToJSON<T>(messages: ChatMessage[], jsonSchema: any, options?: LLMRequestOptions): Promise<T>;

  /**
   * 生成嵌入
   * @param text 文本内容
   * @returns 嵌入向量
   */
  embedText(text: string): Promise<number[]>;

  /**
   * 更新LLM配置
   * @param newConfig 新配置
   */
  updateConfig(newConfig: Partial<LLMServiceConfig>): void;

  /**
   * 获取上下文窗口大小（token计数）
   * @returns 上下文窗口大小
   */
  getContextWindowSize(): number;

  /**
   * 估算文本token数量
   * @param text 文本内容
   * @returns 估计的token数量
   */
  estimateTokenCount(text: string): number;

  /**
   * 根据指定模板将对象转换为提示
   * @param template 提示模板
   * @param variables 变量对象
   * @returns 格式化后的提示
   */
  formatPrompt(template: string, variables: Record<string, any>): string;

  /**
   * 检查LLM服务健康状态
   * @returns 健康状态
   */
  checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    latencyMs?: number;
  }>;
}

/**
 * 基础LLM服务抽象类
 * 提供一些共用实现
 */
export abstract class BaseLLMService implements LLMService {
  protected config: LLMServiceConfig;

  /**
   * 构造函数
   * @param config LLM服务配置
   */
  constructor(config: LLMServiceConfig) {
    // 直接赋值，不通过Zod验证（因为类型已经确保了类型安全）
    this.config = config;
  }

  /**
   * 获取模型名称
   * @returns 模型名称
   */
  getModelName(): string {
    return this.config.model;
  }

  /**
   * 执行聊天完成
   * @param messages 消息列表
   * @param options 可选参数
   * @returns 完成的消息
   */
  async chat(messages: ChatMessage[], options?: LLMRequestOptions): Promise<ChatMessage> {
    try {
      // 验证输入
      const validatedMessages = ValidationService.validateChatMessages(messages);
      const validatedOptions = options ? ValidationService.validateLLMRequestOptions(options) : undefined;
      
      // 执行聊天
      const result = await this.chatInternal(validatedMessages, validatedOptions);
      
      // 验证输出
      return ValidationService.validateChatMessage(result);
    } catch (error) {
      throw new Error(`LLM聊天调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 聊天完成的别名方法
   * 与chat方法功能相同，用于向后兼容
   * @param messages 消息列表
   * @param options 可选参数
   * @returns 完成的消息
   */
  async chatCompletion(messages: ChatMessage[], options?: LLMRequestOptions): Promise<ChatMessage> {
    return this.chat(messages, options);
  }

  /**
   * 将聊天结果解析为JSON
   * @param messages 消息列表
   * @param jsonSchema 预期的JSON Schema
   * @param options 可选参数
   * @returns 解析后的JSON对象
   */
  async chatToJSON<T>(messages: ChatMessage[], jsonSchema: any, options?: LLMRequestOptions): Promise<T> {
    try {
      // 添加系统提示以强制JSON输出
      const systemMessage: ChatMessage = {
        role: 'system',
        content: '你是一个专门输出JSON的助手。所有回复必须是有效的JSON格式，准确遵循指定的模式。不要包含任何解释或前缀，只输出纯JSON。'
      };
      
      const messagesWithJsonInstruction = [systemMessage, ...messages];
      
      // 执行聊天
      const response = await this.chat(messagesWithJsonInstruction, {
        ...options,
        temperature: (options?.temperature ?? 0.2) // 默认较低温度以获得一致结果
      });
      
      // 尝试解析JSON
      try {
        const content = response.content.trim();
        // 提取JSON部分（如果助手添加了额外文本）
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                         content.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, content];
        
        const jsonContent = jsonMatch[1] || content;
        
        // 解析JSON
        return JSON.parse(jsonContent) as T;
      } catch (parseError) {
        throw new Error(`JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}\n原始内容: ${response.content}`);
      }
    } catch (error) {
      throw new Error(`chatToJSON调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 内部聊天实现
   * @param messages 验证后的消息列表
   * @param options 验证后的可选参数
   * @returns 完成的消息
   */
  protected abstract chatInternal(
    messages: ChatMessage[], 
    options?: LLMRequestOptions
  ): Promise<ChatMessage>;

  /**
   * 更新LLM配置
   * @param newConfig 新配置
   */
  updateConfig(newConfig: Partial<LLMServiceConfig>): void {
    // 直接合并配置，不经过Zod验证（因为类型已经确保了类型安全）
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 根据指定模板将对象转换为提示
   * @param template 提示模板
   * @param variables 变量对象
   * @returns 格式化后的提示
   */
  formatPrompt(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : match;
    });
  }

  /**
   * 估算文本token数量的默认实现
   * 这是一个简单实现，子类可能需要覆盖此方法
   * @param text 文本内容
   * @returns 估计的token数量
   */
  estimateTokenCount(text: string): number {
    // 简单估算：大约每4个字符是1个token
    return Math.ceil(text.length / 4);
  }

  /**
   * 获取上下文窗口大小（token计数）的默认实现
   * 子类应该覆盖此方法以提供准确数值
   * @returns 上下文窗口大小
   */
  getContextWindowSize(): number {
    // 默认返回一个较小值
    return 4096;
  }

  /**
   * 生成嵌入向量
   * @param text 文本内容
   * @returns 嵌入向量
   */
  abstract embedText(text: string): Promise<number[]>;

  /**
   * 检查LLM服务健康状态
   * 默认实现是简单的ping，子类可能需要覆盖
   * @returns 健康状态
   */
  async checkHealth(): Promise<{status: 'healthy' | 'degraded' | 'unhealthy'; message?: string; latencyMs?: number;}> {
    try {
      const startTime = Date.now();
      // 发送一个简单请求来测试服务可用性
      await this.chat([{ role: 'user', content: 'ping' }], { maxTokens: 1 });
      const latencyMs = Date.now() - startTime;
      
      const status = latencyMs < 1000 ? 'healthy' : 'degraded';
      return {
        status,
        message: status === 'healthy' ? 'LLM服务正常' : '延迟较高',
        latencyMs
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `LLM服务不可用: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 