/**
 * Tool - 工具接口
 * 定义Agent可用的标准化工具接口
 */

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  category?: string;
  parameters?: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface ToolInput {
  [key: string]: any;
}

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * 工具基类
 */
export abstract class Tool {
  protected id: string;
  protected name: string;
  protected description: string;
  protected category: string;
  protected parameters: ToolParameter[];
  
  constructor(config: ToolConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.category = config.category || 'general';
    this.parameters = config.parameters || [];
  }
  
  /**
   * 获取工具ID
   */
  public getId(): string {
    return this.id;
  }
  
  /**
   * 获取工具名称
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * 获取工具描述
   */
  public getDescription(): string {
    return this.description;
  }
  
  /**
   * 获取工具类别
   */
  public getCategory(): string {
    return this.category;
  }
  
  /**
   * 获取工具参数
   */
  public getParameters(): ToolParameter[] {
    return this.parameters;
  }
  
  /**
   * 验证输入
   */
  protected validateInput(input: ToolInput): boolean {
    for (const param of this.parameters) {
      if (param.required && (input[param.name] === undefined || input[param.name] === null)) {
        throw new Error(`必需参数 "${param.name}" 缺失`);
      }
    }
    return true;
  }
  
  /**
   * 执行工具
   * 由具体的工具子类实现
   */
  public abstract execute(input: ToolInput): Promise<ToolResult>;
} 