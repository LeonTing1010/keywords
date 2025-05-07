/**
 * Agent - 基础Agent接口
 * 所有专业Agent的基础类，定义标准交互方式
 */
import { Tool } from './Tool';
import { logger } from '../core/logger';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  verbose?: boolean;
  maxRetries?: number;
}

export interface AgentTask {
  task: string;
  data: any;
}

export interface AgentResult {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * 基础Agent类
 */
export abstract class Agent {
  protected id: string;
  protected name: string;
  protected description: string;
  protected tools: Map<string, Tool> = new Map();
  protected config: AgentConfig;
  
  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.config = {
      ...config,
      verbose: config.verbose || false,
      maxRetries: config.maxRetries || 3
    };
    
    logger.info(`Agent "${this.name}" (${this.id}) 初始化完成`);
  }
  
  /**
   * 注册工具
   */
  public registerTool(tool: Tool): void {
    this.tools.set(tool.getId(), tool);
    logger.debug(`Agent "${this.name}" 注册了工具: ${tool.getName()}`);
  }
  
  /**
   * 获取工具
   */
  protected getTool(id: string): Tool {
    const tool = this.tools.get(id);
    if (!tool) {
      throw new Error(`Agent "${this.name}" 找不到工具: ${id}`);
    }
    return tool;
  }
  
  /**
   * 执行任务
   * 由具体的Agent子类实现
   */
  public abstract execute(task: AgentTask): Promise<any>;
  
  /**
   * 获取Agent ID
   */
  public getId(): string {
    return this.id;
  }
  
  /**
   * 获取Agent名称
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * 获取Agent描述
   */
  public getDescription(): string {
    return this.description;
  }
} 