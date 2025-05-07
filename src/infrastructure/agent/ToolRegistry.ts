/**
 * ToolRegistry - 工具注册中心
 * 管理所有可用工具，供Agent调用
 */
import { Tool } from './Tool';
import { logger } from '../core/logger';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  constructor() {
    logger.info('工具注册中心初始化完成');
  }
  
  /**
   * 注册工具
   */
  public registerTool(tool: Tool): void {
    if (this.tools.has(tool.getId())) {
      throw new Error(`工具ID "${tool.getId()}" 已存在`);
    }
    
    this.tools.set(tool.getId(), tool);
    logger.info(`已注册工具: ${tool.getName()} (${tool.getId()})`);
  }
  
  /**
   * 获取工具
   */
  public getTool(id: string): Tool {
    const tool = this.tools.get(id);
    if (!tool) {
      throw new Error(`找不到工具: ${id}`);
    }
    return tool;
  }
  
  /**
   * 获取所有工具
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * 按类别获取工具
   */
  public getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter(tool => tool.getCategory() === category);
  }
} 