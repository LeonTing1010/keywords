import { LLMProvider, LLMMessage, LLMOptions } from './types';
import { logger } from '../../infra/logger';

// 扩展LLMOptions接口
interface EnhancedLLMOptions {
  format?: 'json' | 'text' | 'markdown';
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
  strictFormat?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  [key: string]: any; // 允许其他属性
}

/**
 * JSON强制提供者 - 装饰器模式
 * 
 * 这个类包装了一个LLM提供者，确保当需要JSON格式时，
 * 响应一定是有效的JSON，否则将重试请求。
 * 符合OOP的装饰器模式，增强了原有LLMProvider的功能。
 */
export class JsonEnforcedLLMProvider implements LLMProvider {
  private provider: LLMProvider;
  private maxJsonRetries: number;
  
  /**
   * 创建一个JSON强制LLM提供者
   * @param provider 被包装的LLM提供者
   * @param maxJsonRetries 最大JSON格式重试次数
   */
  constructor(provider: LLMProvider, maxJsonRetries: number = 3) {
    this.provider = provider;
    this.maxJsonRetries = maxJsonRetries;
  }
  
  /**
   * 调用LLM模型，确保在需要时返回JSON格式
   */
  async call(messages: LLMMessage[], options?: EnhancedLLMOptions): Promise<string> {
    // 如果不需要JSON格式，直接调用原始提供者
    if (options?.format !== 'json' || options?.strictFormat !== true) {
      return this.provider.call(messages, options);
    }
    
    // 需要JSON格式，创建一个副本以便添加JSON强制参数
    const jsonOptions = { ...options, strictFormat: true };
    
    let retryCount = 0;
    let lastError: Error | null = null;
    
    // 尝试获取有效的JSON响应
    while (retryCount < this.maxJsonRetries) {
      try {
        // 调用原始提供者
        const response = await this.provider.call(messages, jsonOptions);
        
        // 验证是否为有效的JSON
        try {
          // 尝试解析为JSON以验证格式
          JSON.parse(response);
          return response; // 成功解析则返回
        } catch (e) {
          // 尝试清理JSON
          const cleanedResponse = this.cleanJsonResponse(response);
          try {
            // 再次尝试解析
            JSON.parse(cleanedResponse);
            return cleanedResponse; // 清理后成功解析则返回
          } catch (e2) {
            // 仍然不是有效的JSON，准备重试
            lastError = new Error(`返回的内容不是有效的JSON格式: ${response.substring(0, 100)}...`);
            throw lastError;
          }
        }
      } catch (error: any) {
        lastError = error;
        retryCount++;
        
        if (retryCount < this.maxJsonRetries) {
          // 等待一段时间再重试，指数退避
          const delay = 1000 * Math.pow(2, retryCount - 1);
          logger.warn(`JSON格式验证失败，第${retryCount}次重试`, { error: error.message, delay });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试均失败，抛出最后一个错误
    if (lastError) {
      throw lastError;
    }
    
    // 防止编译器警告，实际不会执行到这里
    throw new Error('无法获取有效的JSON响应');
  }
  
  /**
   * 获取提供者名称
   */
  getName(): string {
    return `JsonEnforced-${this.provider.getName()}`;
  }
  
  /**
   * 清理JSON响应，尝试处理常见的格式问题
   */
  private cleanJsonResponse(response: string): string {
    // 1. 移除Markdown代码块
    let cleaned = response.replace(/^```(?:json|javascript|js)?\s*\n/m, '')
                         .replace(/\n```\s*$/m, '')
                         .trim();
    
    // 2. 如果没有变化，尝试查找第一个{和最后一个}之间的内容
    if (cleaned === response) {
      const match = response.match(/(\{[\s\S]*\})/m);
      if (match && match[1]) {
        cleaned = match[1].trim();
      }
    }
    
    // 3. 修复常见的JSON错误
    // 3.1 未转义的引号
    cleaned = cleaned.replace(/([^\\])"/g, '$1\\"');
    
    // 3.2 单引号替换为双引号
    cleaned = cleaned.replace(/'/g, '"');
    
    // 3.3 尾部逗号删除
    cleaned = cleaned.replace(/,\s*}/g, '}')
                   .replace(/,\s*\]/g, ']');
    
    return cleaned;
  }
} 