import { LLMProvider, LLMMessage, LLMOptions } from './types';
import { z } from 'zod';
import { logger } from '../../infra/logger';

interface SchemaValidationOptions extends LLMOptions {
  schema?: z.ZodTypeAny;
  strictValidation?: boolean;
  maxValidationRetries?: number;
  defaultValue?: any;
}

/**
 * Schema验证LLM提供者 - 装饰器模式
 * 确保LLM输出符合指定的Zod Schema
 */
export class SchemaValidatedLLMProvider implements LLMProvider {
  private provider: LLMProvider;
  
  constructor(provider: LLMProvider) {
    this.provider = provider;
  }
  
  async call(messages: LLMMessage[], options?: SchemaValidationOptions): Promise<string> {
    // 如果未提供schema，直接调用原始提供者
    if (!options?.schema) {
      return this.provider.call(messages, options);
    }
    
    const schema = options.schema;
    const maxRetries = options.maxValidationRetries || 2;
    const strictValidation = options.strictValidation !== false;
    
    let retryCount = 0;
    let lastError: Error | null = null;
    let lastResponse: string = '';
    
    // 向提示中添加schema要求
    const enhancedMessages = this.enhanceMessagesWithSchema(messages, schema);
    
    while (retryCount <= maxRetries) {
      try {
        // 调用原始提供者
        const response = await this.provider.call(enhancedMessages, options);
        lastResponse = response;
        
        try {
          // 解析JSON
          const parsedData = JSON.parse(response);
          
          // 验证schema
          const validationResult = schema.safeParse(parsedData);
          
          if (validationResult.success) {
            // 验证成功，返回格式化后的JSON
            return JSON.stringify(validationResult.data);
          } else if (!strictValidation) {
            // 不严格验证时，返回原始响应
            logger.warn('Schema验证失败，但strictValidation为false，返回原始响应', {
              errors: validationResult.error.errors.map(e => e.message).join(', ')
            });
            return response;
          } else {
            // 验证失败，需要重试
            throw new Error(`Schema验证失败: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
          }
        } catch (error: any) {
          lastError = error;
          retryCount++;
          
          if (retryCount <= maxRetries) {
            // 增强提示以修正问题
            enhancedMessages.push({
              role: 'user',
              content: `您的上一个响应不符合要求的JSON格式或数据结构。请修正错误并确保返回符合schema的有效JSON。错误: ${error.message}`
            });
            logger.warn(`Schema验证失败，第${retryCount}次重试`, { error: error.message });
          }
        }
      } catch (error: any) {
        lastError = error;
        retryCount++;
        
        if (retryCount <= maxRetries) {
          // 增强提示以修正问题
          enhancedMessages.push({
            role: 'user',
            content: `您的上一个响应遇到错误。请修正并返回有效的JSON。错误: ${error.message}`
          });
          logger.warn(`调用失败，第${retryCount}次重试`, { error: error.message });
        }
      }
    }
    
    // 所有重试均失败
    if (options.defaultValue !== undefined) {
      // 使用默认值
      logger.warn('所有重试均失败，返回默认值', { lastError: lastError?.message });
      return JSON.stringify(options.defaultValue);
    }
    
    // 没有默认值则抛出错误
    if (lastError) {
      throw lastError;
    }
    
    throw new Error('无法获取有效的符合schema的响应');
  }
  
  getName(): string {
    return `SchemaValidated-${this.provider.getName()}`;
  }
  
  /**
   * 根据schema增强提示消息
   */
  private enhanceMessagesWithSchema(messages: LLMMessage[], schema: z.ZodTypeAny): LLMMessage[] {
    // 创建消息副本
    const enhancedMessages = [...messages];
    
    // 将schema描述转换为TypeScript接口字符串
    const schemaDescription = this.schemaToInterfaceString(schema);
    
    // 查找系统消息
    const systemMessageIndex = enhancedMessages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // 更新系统消息
      enhancedMessages[systemMessageIndex] = {
        role: 'system',
        content: `${enhancedMessages[systemMessageIndex].content}\n\n请确保你的输出严格符合以下TypeScript接口定义的JSON格式:\n\n${schemaDescription}\n\n不要返回任何其他文本、注释或解释，只返回符合接口的有效JSON。`
      };
    } else {
      // 添加新的系统消息
      enhancedMessages.unshift({
        role: 'system',
        content: `请确保你的输出严格符合以下TypeScript接口定义的JSON格式:\n\n${schemaDescription}\n\n不要返回任何其他文本、注释或解释，只返回符合接口的有效JSON。`
      });
    }
    
    return enhancedMessages;
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
} 