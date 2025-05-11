/**
 * Tool.ts - 工具接口定义
 * 所有工具都应实现此接口
 */

import { ToolParams, ToolResult } from '../types/schemas';
import { ValidationService } from '../utils/ValidationService';

/**
 * 工具接口 - 定义所有工具必须实现的方法
 */
export interface Tool {
  /**
   * 获取工具名称
   * @returns 工具名称
   */
  getName(): string;

  /**
   * 获取工具描述
   * @returns 工具描述
   */
  getDescription(): string;

  /**
   * 获取工具详细使用说明
   * @returns 使用说明
   */
  getUsage(): string;

  /**
   * 获取工具所需参数描述
   * @returns 参数描述对象
   */
  getParameterDescriptions(): Record<string, string>;

  /**
   * 执行工具
   * @param params 工具参数
   * @returns 工具执行结果
   */
  execute(params: ToolParams): Promise<ToolResult>;
}

/**
 * 基础工具抽象类 - 提供一些通用实现
 */
export abstract class BaseTool implements Tool {
  protected name: string;
  protected description: string;
  protected usage: string;
  protected parameterDescriptions: Record<string, string>;

  /**
   * 构造函数
   * @param name 工具名称
   * @param description 工具描述
   * @param usage 使用说明
   * @param parameterDescriptions 参数描述
   */
  constructor(
    name: string,
    description: string,
    usage: string,
    parameterDescriptions: Record<string, string> = {}
  ) {
    this.name = name;
    this.description = description;
    this.usage = usage;
    this.parameterDescriptions = parameterDescriptions;
  }

  /**
   * 获取工具名称
   * @returns 工具名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取工具描述
   * @returns 工具描述
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * 获取工具详细使用说明
   * @returns 使用说明
   */
  getUsage(): string {
    return this.usage;
  }

  /**
   * 获取工具所需参数描述
   * @returns 参数描述对象
   */
  getParameterDescriptions(): Record<string, string> {
    return this.parameterDescriptions;
  }

  /**
   * 执行工具 - 子类必须实现
   * @param params 工具参数
   */
  async execute(params: ToolParams): Promise<ToolResult> {
    try {
      // 验证参数
      const validatedParams = ValidationService.validateToolParams(this.name, params);
      
      // 执行具体工具逻辑
      const result = await this.executeInternal(validatedParams);
      
      // 验证结果
      return ValidationService.validateToolResult(result);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 内部执行逻辑 - 子类必须实现
   * @param params 已验证的参数
   * @returns 工具执行结果
   */
  protected abstract executeInternal(params: ToolParams): Promise<ToolResult>;

  /**
   * 验证参数
   * @param params 传入的参数
   * @param requiredParams 必须的参数列表
   * @throws Error 如果缺少必要参数
   */
  protected validateParams(params: ToolParams, requiredParams: string[]): void {
    const missingParams = requiredParams.filter(param => !(param in params));
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }
  }

  /**
   * 创建成功的工具结果
   * @param data 结果数据
   * @param metadata 可选的元数据
   * @returns 成功的工具结果
   */
  protected createSuccessResult(data: any, metadata?: Record<string, any>): ToolResult {
    return {
      success: true,
      data,
      metadata: {
        toolName: this.name,
        timestampMs: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * 创建失败的工具结果
   * @param error 错误信息
   * @param metadata 可选的元数据
   * @returns 失败的工具结果
   */
  protected createErrorResult(error: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: false,
      error,
      metadata: {
        toolName: this.name,
        timestampMs: Date.now(),
        ...metadata
      }
    };
  }
} 