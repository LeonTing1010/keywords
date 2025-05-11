/**
 * Agent.ts - 基础Agent接口
 * 定义了所有Agent必须实现的接口
 */

import { 
  AgentInput, 
  AgentOutput, 
  AgentCritique, 
  AgentResponse, 
  AgentMetadata, 
  WorkflowContext 
} from '../../types/schemas';
import { ValidationService } from '../../utils/ValidationService';
import { LLMService } from '../../core/llm/LLMService';

/**
 * Agent接口 - 定义所有Agent必须实现的方法
 */
export interface Agent {
  /**
   * 获取Agent元数据
   * @returns Agent元数据
   */
  getMetadata(): AgentMetadata;

  /**
   * 执行Agent任务
   * @param input Agent输入
   * @returns Agent输出
   */
  execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * 处理来自其他Agent的批评
   * @param critique 批评内容
   * @param currentOutput 当前输出
   * @returns Agent的回应
   */
  receiveCritique(critique: AgentCritique, currentOutput: AgentOutput): Promise<AgentResponse>;

  /**
   * 批评其他Agent的输出
   * @param targetAgentName 目标Agent名称
   * @param output 目标Agent的输出
   * @returns 批评内容
   */
  criticizeOutput(targetAgentName: string, output: AgentOutput): Promise<AgentCritique | null>;
}

/**
 * 基础Agent抽象类
 * 提供一些通用实现
 */
export abstract class BaseAgent implements Agent {
  protected name: string;
  protected description: string;
  protected role: string;
  protected version: string;
  protected author: string;
  protected capabilities: string[];
  protected llmService: LLMService;

  /**
   * 构造函数
   * @param name Agent名称
   * @param description Agent描述
   * @param role Agent角色
   * @param capabilities Agent能力/职责
   * @param version Agent版本
   * @param author Agent作者
   * @param llmService LLM服务
   */
  constructor(
    name: string,
    description: string,
    role: string,
    capabilities: string[] = [],
    version: string = '1.0.0',
    author: string = 'System',
    llmService: LLMService
  ) {
    this.name = name;
    this.description = description;
    this.role = role;
    this.capabilities = capabilities;
    this.version = version;
    this.author = author;
    this.llmService = llmService;
  }

  /**
   * 获取Agent元数据
   * @returns Agent元数据
   */
  getMetadata(): AgentMetadata {
    return {
      name: this.name,
      description: this.description,
      role: this.role,
      capabilities: this.capabilities,
      version: this.version,
      author: this.author
    };
  }

  /**
   * 执行Agent任务
   * @param input Agent输入
   * @returns Agent输出
   */
  async execute(input: AgentInput): Promise<AgentOutput> {
    try {
      // 验证输入
      const validatedInput = ValidationService.validateAgentInput(input);
      
      // 执行实际任务
      const output = await this.executeInternal(validatedInput);
      
      // 验证输出
      return ValidationService.validateAgentOutput(output);
    } catch (error) {
      return this.createErrorOutput(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 内部执行逻辑 - 子类必须实现
   * @param input 验证后的Agent输入
   * @returns Agent输出
   */
  protected abstract executeInternal(input: AgentInput): Promise<AgentOutput>;

  /**
   * 处理来自其他Agent的批评
   * @param critique 批评内容
   * @param currentOutput 当前输出
   * @returns Agent的回应
   */
  async receiveCritique(critique: AgentCritique, currentOutput: AgentOutput): Promise<AgentResponse> {
    // 默认实现：接受所有批评并返回原始输出
    return {
      accepted: true,
      content: `接受来自${critique.content.substring(0, 30)}...的批评`,
      updatedOutput: currentOutput
    };
  }

  /**
   * 批评其他Agent的输出
   * @param targetAgentName 目标Agent名称
   * @param output 目标Agent的输出
   * @returns 批评内容，如果没有批评则返回null
   */
  async criticizeOutput(targetAgentName: string, output: AgentOutput): Promise<AgentCritique | null> {
    // 默认实现：不进行批评
    return null;
  }

  /**
   * 创建成功的输出
   * @param data 输出数据
   * @param metadata 元数据
   * @returns 成功的Agent输出
   */
  protected createSuccessOutput(data: any, metadata?: Record<string, any>): AgentOutput {
    return {
      data,
      status: 'success',
      metadata: {
        agentName: this.name,
        timestamp: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * 创建部分成功的输出
   * @param data 输出数据
   * @param metadata 元数据
   * @returns 部分成功的Agent输出
   */
  protected createPartialOutput(data: any, metadata?: Record<string, any>): AgentOutput {
    return {
      data,
      status: 'partial',
      metadata: {
        agentName: this.name,
        timestamp: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * 创建失败的输出
   * @param error 错误信息
   * @param metadata 元数据
   * @returns 失败的Agent输出
   */
  protected createErrorOutput(error: string, metadata?: Record<string, any>): AgentOutput {
    return {
      data: null,
      status: 'failed',
      error,
      metadata: {
        agentName: this.name,
        timestamp: Date.now(),
        ...metadata
      }
    };
  }

  /**
   * 记录调试信息
   * @param message 消息内容
   * @param data 相关数据
   */
  protected debug(message: string, data?: any): void {
    console.debug(`[${this.name}] ${message}`, data || '');
  }
} 