/**
 * ValidationService.ts - 中央验证服务
 * 提供全局的验证功能
 */

import { z } from 'zod';
import {
  ToolParamsSchema,
  ToolResultSchema,
  ProblemInfoSchema,
  AgentInputSchema,
  AgentOutputSchema,
  ChatMessageSchema,
  LLMRequestOptionsSchema,
  WorkflowInputSchema,
  WorkflowOutputSchema,
  WorkflowContextSchema
} from '../types/schemas';

/**
 * 特定工具的参数验证模式
 */
const TOOL_PARAM_SCHEMAS: Record<string, z.ZodType> = {
  // 搜索自动补全工具参数
  'searchCompletion': z.object({
    query: z.string(),
    depth: z.number().positive().optional()
  }),

  // 社区洞察工具参数
  'communityInsight': z.object({
    keyword: z.string(),
    sources: z.array(z.string()).optional()
  }),

  // 搜索证据工具参数
  'searchEvidence': z.object({
    query: z.string(),
    depth: z.number().positive().optional(),
    maxResults: z.number().positive().optional()
  }),

  // 社区搜索工具参数
  'searchCommunity': z.object({
    keyword: z.string(),
    sources: z.array(z.string()).optional(),
    limit: z.number().positive().optional()
  }),

  // 趋势分析工具参数
  'analyzeTrends': z.object({
    keyword: z.string(),
    timeRange: z.string().optional()
  }),

  // 搜索解决方案工具参数
  'searchSolutions': z.object({
    query: z.string(),
    maxResults: z.number().positive().optional()
  }),

  // 评论分析工具参数
  'analyzeReviews': z.object({
    productName: z.string(),
    maxReviews: z.number().positive().optional()
  }),

  // 市场规模估算工具参数
  'estimateMarketSize': z.object({
    keyword: z.string(),
    problem: z.string()
  }),

  // 趋势数据获取工具参数
  'getTrendData': z.object({
    query: z.string(),
    period: z.string().optional()
  })
};

/**
 * 验证服务
 * 提供集中的数据验证功能
 */
export class ValidationService {
  /**
   * 验证工具参数
   * @param toolName 工具名称
   * @param params 参数对象
   * @returns 验证后的参数对象
   */
  static validateToolParams(toolName: string, params: unknown): any {
    // 获取特定工具的验证模式，如果不存在则使用通用模式
    const schema = TOOL_PARAM_SCHEMAS[toolName] || ToolParamsSchema;
    
    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`工具参数验证失败(${toolName}): ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证工具结果
   * @param result 工具执行结果
   * @returns 验证后的结果对象
   */
  static validateToolResult(result: unknown): any {
    try {
      return ToolResultSchema.parse(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`工具结果验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证问题信息
   * @param problem 问题信息对象
   * @returns 验证后的问题信息
   */
  static validateProblemInfo(problem: unknown): any {
    try {
      return ProblemInfoSchema.parse(problem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`问题信息验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证问题信息列表
   * @param problems 问题信息列表
   * @returns 验证后的问题信息列表
   */
  static validateProblemInfoList(problems: unknown): any {
    try {
      return z.array(ProblemInfoSchema).parse(problems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`问题列表验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证Agent输入
   * @param input Agent输入
   * @returns 验证后的Agent输入
   */
  static validateAgentInput(input: unknown): any {
    try {
      return AgentInputSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Agent输入验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证Agent输出
   * @param output Agent输出
   * @returns 验证后的Agent输出
   */
  static validateAgentOutput(output: unknown): any {
    try {
      return AgentOutputSchema.parse(output);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Agent输出验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证聊天消息
   * @param message 聊天消息
   * @returns 验证后的聊天消息
   */
  static validateChatMessage(message: unknown): any {
    try {
      return ChatMessageSchema.parse(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`聊天消息验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证聊天消息列表
   * @param messages 聊天消息列表
   * @returns 验证后的聊天消息列表
   */
  static validateChatMessages(messages: unknown): any {
    try {
      return z.array(ChatMessageSchema).parse(messages);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`聊天消息列表验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证LLM请求选项
   * @param options LLM请求选项
   * @returns 验证后的LLM请求选项
   */
  static validateLLMRequestOptions(options: unknown): any {
    try {
      return LLMRequestOptionsSchema.parse(options);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`LLM请求选项验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证工作流输入
   * @param input 工作流输入
   * @returns 验证后的工作流输入
   */
  static validateWorkflowInput(input: unknown): any {
    try {
      return WorkflowInputSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`工作流输入验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证工作流输出
   * @param output 工作流输出
   * @returns 验证后的工作流输出
   */
  static validateWorkflowOutput(output: unknown): any {
    try {
      return WorkflowOutputSchema.parse(output);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`工作流输出验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 验证工作流上下文
   * @param context 工作流上下文
   * @returns 验证后的工作流上下文
   */
  static validateWorkflowContext(context: unknown): any {
    try {
      return WorkflowContextSchema.parse(context);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`工作流上下文验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * 安全解析JSON
   * @param jsonString JSON字符串
   * @param schema 验证模式
   * @returns 解析和验证后的对象
   */
  static safeParseJSON<T>(jsonString: string, schema: z.ZodType): T {
    try {
      const data = JSON.parse(jsonString);
      return schema.parse(data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON解析失败: ${error.message}`);
      }
      if (error instanceof z.ZodError) {
        throw new Error(`JSON验证失败: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
} 