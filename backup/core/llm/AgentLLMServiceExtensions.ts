import { z } from 'zod';
import { logger } from '../../infra/logger';
import { AgentLLMService } from './AgentLLMService';
import { SchemaValidator } from './SchemaValidator';

/**
 * 为AgentLLMService添加扩展方法
 * 提供方便的schema验证和分析功能
 */
export class AgentLLMServiceExtensions {
  /**
   * 使用schema分析并验证数组结果
   */
  public static async analyzeWithArraySchema<T>(
    agentLLM: AgentLLMService,
    prompt: string,
    analysisType: string,
    schema: z.ZodType<T[]>,
    options: any = {}
  ): Promise<T[]> {
    try {
      // 增强提示词
      const enhancedPrompt = SchemaValidator.enhancePromptWithSchema(prompt, schema);
      
      // 调用LLM
      const result = await agentLLM.analyze(enhancedPrompt, analysisType, {
        format: 'json',
        temperature: options.temperature || 0.7,
        ...options
      });
      
      // 验证结果
      return await SchemaValidator.validateArrayResult(result, schema, options.defaultValue || []);
    } catch (error) {
      logger.error({ error, analysisType }, 'Failed to analyze with array schema');
      return options.defaultValue || [] as T[];
    }
  }
  
  /**
   * 使用schema分析并验证对象结果
   */
  public static async analyzeWithObjectSchema<T extends object>(
    agentLLM: AgentLLMService,
    prompt: string,
    analysisType: string,
    schema: z.ZodType<T>,
    options: any = {}
  ): Promise<T> {
    try {
      // 增强提示词
      const enhancedPrompt = SchemaValidator.enhancePromptWithSchema(prompt, schema);
      
      // 调用LLM
      const result = await agentLLM.analyze(enhancedPrompt, analysisType, {
        format: 'json',
        temperature: options.temperature || 0.7,
        ...options
      });
      
      // 验证结果
      return await SchemaValidator.validateObjectResult(result, schema, options.defaultValue);
    } catch (error) {
      logger.error({ error, analysisType }, 'Failed to analyze with object schema');
      return options.defaultValue;
    }
  }
} 