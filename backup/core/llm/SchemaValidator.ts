import { z } from 'zod';
import { logger } from '../../infra/logger';

/**
 * Schema验证工具类 - 用于在各Agent中重用
 * 提供统一的schema验证和处理逻辑
 */
export class SchemaValidator {
  /**
   * 解析LLM结果为数组并验证schema
   */
  public static async validateArrayResult<T>(
    llmResult: any,
    schema: z.ZodType<T[]>,
    defaultValue: T[] = []
  ): Promise<T[]> {
    try {
      // 首先解析响应为JSON
      let parsedResponse: any = null;
      
      if (typeof llmResult === 'string') {
        try {
          parsedResponse = JSON.parse(llmResult);
        } catch (parseError) {
          // Try to extract JSON from text that might have extra content
          const jsonMatch = llmResult.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              parsedResponse = JSON.parse(jsonMatch[0]);
            } catch (innerError) {
              logger.warn({ error: innerError }, 'Failed to extract JSON from string');
              parsedResponse = null;
            }
          } else {
            logger.warn({ error: parseError }, 'Failed to parse string as JSON');
            parsedResponse = null;
          }
        }
      } else if (llmResult && llmResult.content) {
        // Handle content property
        if (typeof llmResult.content === 'string') {
          try {
            parsedResponse = JSON.parse(llmResult.content);
          } catch (parseError) {
            // Try to extract JSON from text that might have extra content
            const jsonMatch = llmResult.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                parsedResponse = JSON.parse(jsonMatch[0]);
              } catch (innerError) {
                logger.warn({ error: innerError }, 'Failed to extract JSON from content string');
                parsedResponse = null;
              }
            } else {
              logger.warn({ error: parseError }, 'Failed to parse content as JSON');
              parsedResponse = null;
            }
          }
        } else {
          parsedResponse = llmResult.content;
        }
      } else if (llmResult && llmResult.data) {
        parsedResponse = llmResult.data;
      } else if (llmResult && typeof llmResult === 'object' && llmResult.raw) {
        // Handle raw property that some LLM response formats might include
        try {
          if (typeof llmResult.raw === 'string') {
            const jsonMatch = llmResult.raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                parsedResponse = JSON.parse(jsonMatch[0]);
              } catch (innerError) {
                logger.warn({ error: innerError }, 'Failed to extract JSON from raw string');
                parsedResponse = null;
              }
            } else {
              logger.warn('No JSON array found in raw string');
              parsedResponse = null;
            }
          } else {
            parsedResponse = llmResult.raw;
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to parse raw property');
          parsedResponse = null;
        }
      } else {
        parsedResponse = llmResult;
      }
      
      // 如果不是数组，尝试获取数组属性
      if (parsedResponse && typeof parsedResponse === 'object' && !Array.isArray(parsedResponse)) {
        // 查找是否有data字段且为数组
        if (parsedResponse.data && Array.isArray(parsedResponse.data)) {
          parsedResponse = parsedResponse.data;
        } else {
          // 查找第一个数组类型的属性
          for (const key in parsedResponse) {
            if (Array.isArray(parsedResponse[key])) {
              parsedResponse = parsedResponse[key];
              break;
            }
          }
        }
      }
      
      // 如果不是数组，返回默认值
      if (!Array.isArray(parsedResponse)) {
        logger.error({ parsedResponse }, 'Failed to parse response as array');
        return defaultValue;
      }
      
      // 使用schema验证
      const result = schema.safeParse(parsedResponse);
      if (!result.success) {
        logger.error({ errors: result.error.errors }, 'Schema validation failed');
        
        // Try to fix common issues in the data
        const fixedData = parsedResponse.map((item: any) => {
          // Ensure all required fields are present with default values
          const fixedItem: any = { ...item };
          
          // Extract field names from error messages
          const missingFields = result.error.errors
            .filter(err => err.code === 'invalid_type' && err.message === 'Required')
            .map(err => err.path.length > 0 ? err.path[err.path.length - 1] : null)
            .filter(Boolean);
          
          // Add default values for missing fields
          for (const field of missingFields) {
            if (typeof field === 'string') {
              if (field === 'question') fixedItem.question = '';
              else if (field === 'domain') fixedItem.domain = [];
              else if (field === 'relationshipToOthers') fixedItem.relationshipToOthers = [];
              else if (field === 'tags') fixedItem.tags = [];
              else if (field === 'overallScore') fixedItem.overallScore = 5;
              else if (field === 'reasoning') fixedItem.reasoning = 'No reasoning provided';
              else fixedItem[field] = ''; // Default string value
            }
          }
          
          return fixedItem;
        });
        
        // Try validating the fixed data
        const fixedResult = schema.safeParse(fixedData);
        if (fixedResult.success) {
          logger.info('Successfully fixed schema validation issues');
          return fixedResult.data;
        }
        
        return defaultValue;
      }
      
      return result.data;
    } catch (error) {
      logger.error({ error }, 'Failed to parse or validate LLM response');
      return defaultValue;
    }
  }
  
  /**
   * 解析LLM结果为对象并验证schema
   */
  public static async validateObjectResult<T extends object>(
    llmResult: any,
    schema: z.ZodType<T>,
    defaultValue: T
  ): Promise<T> {
    try {
      // 首先解析响应为JSON
      let parsedResponse: any = null;
      
      if (typeof llmResult === 'string') {
        parsedResponse = JSON.parse(llmResult);
      } else if (llmResult && llmResult.content) {
        parsedResponse = typeof llmResult.content === 'string' ? 
                      JSON.parse(llmResult.content) : 
                      llmResult.content;
      } else if (llmResult && llmResult.data) {
        parsedResponse = llmResult.data;
      } else {
        parsedResponse = llmResult;
      }
      
      // 使用schema验证
      const result = schema.safeParse(parsedResponse);
      if (!result.success) {
        logger.error({ errors: result.error.errors }, 'Schema validation failed');
        return defaultValue;
      }
      
      return result.data;
    } catch (error) {
      logger.error({ error }, 'Failed to parse or validate LLM response');
      return defaultValue;
    }
  }
  
  /**
   * 为提示词添加schema接口定义
   */
  public static enhancePromptWithSchema(
    prompt: string,
    schema: z.ZodTypeAny
  ): string {
    const schemaDescription = this.schemaToInterfaceString(schema);
    
    return `${prompt}\n\n请确保你的响应严格符合以下TypeScript接口定义:\n\n${schemaDescription}\n\n只返回符合此格式的JSON数据，不要添加任何其他文本或解释。`;
  }
  
  /**
   * 将schema转换为TypeScript接口字符串
   */
  private static schemaToInterfaceString(schema: z.ZodTypeAny): string {
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
  private static getSimpleTypeName(zodType: any): string {
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