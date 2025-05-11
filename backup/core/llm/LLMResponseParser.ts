import { logger } from '../../infra/logger';

/**
 * 统一处理LLM响应的解析工具类
 */
export class LLMResponseParser {
  /**
   * 将各种格式的LLM响应解析为JSON对象
   * @param result LLM响应 - 可能是字符串、对象或包含content属性的对象
   * @param fallback 解析失败时返回的默认值
   * @returns 解析后的JSON对象
   */
  public static parseJsonResponse(result: any, fallback: any = null): any {
    try {
      if (!result) {
        logger.error({ result }, 'Empty or invalid LLM response');
        return fallback;
      }

      let parsedResponse;
      
      // 处理字符串响应
      if (typeof result === 'string') {
        parsedResponse = JSON.parse(result);
      } 
      // 处理带content属性的对象响应
      else if (result.content) {
        parsedResponse = typeof result.content === 'string' ? 
                       JSON.parse(result.content) : 
                       result.content;
      } 
      // 处理带data属性的对象响应
      else if (result.data) {
        parsedResponse = result.data;
      } 
      // 当作对象直接使用
      else {
        parsedResponse = result;
      }
      
      return parsedResponse;
    } catch (error) {
      logger.error({ result, error }, 'Failed to parse LLM response');
      return fallback;
    }
  }

  /**
   * 将LLM响应解析为文本
   * @param result LLM响应
   * @returns 解析后的文本
   */
  public static parseTextResponse(result: any): string {
    if (typeof result === 'string') {
      return result;
    } else if (result && result.content && typeof result.content === 'string') {
      return result.content;
    } else if (result && typeof result === 'object') {
      return JSON.stringify(result);
    }
    return '';
  }

  /**
   * 解析为数组响应
   * @param result LLM响应
   * @returns 数组（如果解析失败则返回空数组）
   */
  public static parseArrayResponse(result: any): any[] {
    const parsed = this.parseJsonResponse(result, []);
    
    // 检查是否是带有data属性的对象
    if (parsed && typeof parsed === 'object' && parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    
    // 检查是否直接是数组
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    logger.error({ parsed }, 'Response is not an array or does not contain a data array');
    return [];
  }

  /**
   * 带类型验证的JSON解析方法
   * @param result LLM响应
   * @param validator 验证函数
   * @param fallback 验证失败时返回的默认值
   */
  public static parseAndValidate<T>(
    result: any, 
    validator: (data: any) => boolean, 
    fallback: T
  ): T {
    const parsed = this.parseJsonResponse(result, null);
    if (parsed !== null && validator(parsed)) {
      return parsed as T;
    }
    return fallback;
  }
} 