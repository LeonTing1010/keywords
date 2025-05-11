/**
 * EnhancedAgent.ts - 增强型Agent
 * 具有工具使用、缓存等增强能力的Agent实现
 */

import { BaseAgent } from './Agent';
import { LLMService } from '../../core/llm/LLMService';
import { Tool } from '../../tools/Tool';
import { 
  AgentInput, 
  AgentOutput, 
  ToolParams, 
  ToolResult,
  EnhancedAgentOptions
} from '../../types/schemas';
import { ValidationService } from '../../utils/ValidationService';
import { 
  toolRegistry, 
  ToolRegistry, 
  ToolCategory, 
  ToolSelectionCriteria 
} from '../../infrastructure/ToolRegistry';
import { z } from 'zod';

/**
 * 自主工具选择结果模式
 */
export const ToolSelectionResultSchema = z.object({
  selectedTool: z.string(),
  reason: z.string(),
  params: z.record(z.string(), z.unknown())
});

export type ToolSelectionResultType = z.infer<typeof ToolSelectionResultSchema>;

/**
 * 增强Agent选项扩展
 */
export interface EnhancedAgentExtendedOptions extends EnhancedAgentOptions {
  // 是否启用自主工具选择
  enableAutonomousToolSelection?: boolean;
  // 默认工具类别
  defaultToolCategory?: ToolCategory;
  // 使用全局工具注册中心
  useGlobalToolRegistry?: boolean;
  // 工具评分更新阈值
  toolRatingUpdateThreshold?: number;
}

/**
 * 增强型Agent类
 * 扩展基础Agent，提供工具调用、结果缓存等功能
 */
export abstract class EnhancedAgent extends BaseAgent {
  // 已注册的工具映射
  private tools: Map<string, Tool> = new Map();
  
  // 结果缓存
  private cache: Map<string, { 
    result: any; 
    timestamp: number 
  }> = new Map();
  
  // 工具使用历史
  private toolUsageHistory: Array<{
    toolName: string;
    timestamp: number;
    task: string;
    success: boolean;
  }> = [];
  
  // 选项
  private options: EnhancedAgentExtendedOptions;
  
  // 当前工具注册中心
  protected toolRegistry: ToolRegistry;
  
  /**
   * 构造函数
   * @param name Agent名称
   * @param description Agent描述
   * @param role Agent角色
   * @param llmService LLM服务
   * @param options 选项
   * @param capabilities Agent能力
   */
  constructor(
    name: string,
    description: string,
    role: string,
    llmService: LLMService,
    options: EnhancedAgentExtendedOptions = {},
    capabilities: string[] = []
  ) {
    super(name, description, role, capabilities, '1.0.0', 'System', llmService);
    
    // 初始化选项，设置默认值
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTTL: options.cacheTTL ?? 60 * 1000, // 默认缓存1分钟
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      toolTimeout: options.toolTimeout ?? 30 * 1000,
      enableAutonomousToolSelection: options.enableAutonomousToolSelection ?? true,
      defaultToolCategory: options.defaultToolCategory ?? ToolCategory.OTHER,
      useGlobalToolRegistry: options.useGlobalToolRegistry !== false,
      toolRatingUpdateThreshold: options.toolRatingUpdateThreshold ?? 0.3,
      ...options
    };
    
    // 初始化工具注册中心
    this.toolRegistry = this.options.useGlobalToolRegistry 
      ? toolRegistry 
      : ToolRegistry.getInstance();
  }
  
  /**
   * 注册工具
   * @param tool 工具实例
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.getName(), tool);
    
    // 同时注册到全局工具注册中心
    if (this.options.useGlobalToolRegistry) {
      this.toolRegistry.registerTool(tool, this.options.defaultToolCategory);
    }
  }
  
  /**
   * 注册多个工具
   * @param tools 工具实例数组
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }
  
  /**
   * 获取已注册的工具名称列表
   * @returns 工具名称数组
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 检查指定工具是否已注册
   * @param toolName 工具名称
   * @returns 是否已注册
   */
  hasToolRegistered(toolName: string): boolean {
    return this.tools.has(toolName);
  }
  
  /**
   * 自主选择工具
   * 
   * 根据任务描述自动选择合适的工具
   * 
   * @param taskDescription 任务描述
   * @param preferredCategory 偏好类别（可选）
   * @param preferredTags 偏好标签（可选）
   * @returns 选择的工具
   */
  protected selectToolsAutonomously(
    taskDescription: string,
    preferredCategory?: ToolCategory,
    preferredTags?: string[]
  ): Tool[] {
    if (!this.options.enableAutonomousToolSelection) {
      return [];
    }
    
    const criteria: ToolSelectionCriteria = {
      taskDescription,
      preferredCategory,
      preferredTags,
      maxTools: 3,
      recommendSimilar: true
    };
    
    const result = this.toolRegistry.selectTools(criteria);
    
    // 记录选择
    this.debug(`自主选择了${result.selectedTools.length}个工具: ${result.selectedTools.map(t => t.getName()).join(', ')}`);
    this.debug(`选择理由: ${result.reasonings.join(' | ')}`);
    
    return result.selectedTools;
  }
  
  /**
   * 根据任务自主选择最合适的工具并执行
   * 
   * @param taskDescription 任务描述
   * @param context 任务上下文（可选）
   * @returns 执行结果
   */
  protected async executeWithAutonomousToolSelection(
    taskDescription: string, 
    context: Record<string, any> = {}
  ): Promise<ToolResult> {
    // 选择合适的工具
    const selectedTools = this.selectToolsAutonomously(taskDescription);
    
    if (selectedTools.length === 0) {
      return {
        success: false,
        error: `没有找到适合任务"${taskDescription}"的工具`,
        metadata: {
          agentName: this.name,
          timestamp: Date.now()
        }
      };
    }
    
    // 简单情况：只有一个工具可用时直接使用
    if (selectedTools.length === 1) {
      const tool = selectedTools[0];
      this.debug(`为任务"${taskDescription}"自动选择工具: ${tool.getName()}`);
      
      try {
        // 推断参数
        const params = this.inferToolParameters(tool, taskDescription, context);
        
        // 执行工具
        const startTime = Date.now();
        const result = await this.useTool(tool.getName(), params);
        const duration = Date.now() - startTime;
        
        // 记录工具使用
        this.recordToolUsage(tool.getName(), taskDescription, result.success, duration);
        
        return result;
      } catch (error) {
        this.debug(`工具"${tool.getName()}"执行失败: ${error}`);
        return {
          success: false,
          error: `工具执行失败: ${error}`,
          metadata: {
            toolName: tool.getName(),
            agentName: this.name,
            timestamp: Date.now()
          }
        };
      }
    }
    
    // 复杂情况：多个备选工具时，由Agent决策使用哪个
    // 请求LLM选择最合适的工具
    const toolDecision = await this.decideToolToUse(taskDescription, selectedTools, context);
    
    if (!toolDecision) {
      return {
        success: false,
        error: `无法为任务"${taskDescription}"决定使用哪个工具`,
        metadata: {
          agentName: this.name,
          timestamp: Date.now(),
          availableTools: selectedTools.map(t => t.getName())
        }
      };
    }
    
    this.debug(`LLM为任务"${taskDescription}"选择工具: ${toolDecision.selectedTool}，原因: ${toolDecision.reason}`);
    
    // 执行选择的工具
    try {
      const startTime = Date.now();
      const result = await this.useTool(toolDecision.selectedTool, toolDecision.params);
      const duration = Date.now() - startTime;
      
      // 记录工具使用
      this.recordToolUsage(toolDecision.selectedTool, taskDescription, result.success, duration);
      
      return result;
    } catch (error) {
      this.debug(`工具"${toolDecision.selectedTool}"执行失败: ${error}`);
      return {
        success: false,
        error: `工具执行失败: ${error}`,
        metadata: {
          toolName: toolDecision.selectedTool,
          agentName: this.name,
          timestamp: Date.now(),
          reason: toolDecision.reason
        }
      };
    }
  }
  
  /**
   * 决定使用哪个工具
   * 
   * 使用LLM帮助决策最适合当前任务的工具
   * 
   * @param taskDescription 任务描述
   * @param tools 可用工具列表
   * @param context 任务上下文
   * @returns 决策结果
   */
  private async decideToolToUse(
    taskDescription: string,
    tools: Tool[],
    context: Record<string, any>
  ): Promise<ToolSelectionResultType | null> {
    try {
      // 构建工具信息
      const toolInfos = tools.map(tool => ({
        name: tool.getName(),
        description: tool.getDescription(),
        parameters: tool.getParameterDescriptions()
      }));
      
      // 构建提示
      const prompt = `
你是一个智能助手，需要为以下任务选择最合适的工具：

任务: ${taskDescription}

可用工具:
${toolInfos.map((tool, i) => `
${i+1}. ${tool.name}
   描述: ${tool.description}
   参数: ${Object.entries(tool.parameters).map(([k, v]) => `${k}: ${v}`).join(', ')}
`).join('')}

相关上下文:
${Object.entries(context).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}

请选择一个最合适的工具，并提供使用原因和必要的参数。输出应该是一个有效的JSON对象，包含以下字段：
{
  "selectedTool": "工具名称",
  "reason": "选择该工具的理由",
  "params": {
    // 工具需要的参数
  }
}
      `;
      
      // 请求LLM
      const response = await this.llmService.chatCompletion([
        { role: 'system', content: '你是一个智能的工具选择助手，擅长为特定任务选择最合适的工具' },
        { role: 'user', content: prompt }
      ]);
      
      if (!response || !response.content) {
        this.debug('LLM没有返回有效内容');
        return null;
      }
      
      // 提取JSON
      try {
        const jsonRegex = /{[\s\S]*}/;
        const match = response.content.match(jsonRegex);
        
        if (!match) {
          this.debug('无法从LLM响应中提取JSON');
          return null;
        }
        
        const jsonStr = match[0];
        const result = JSON.parse(jsonStr);
        
        // 验证结果
        return ToolSelectionResultSchema.parse(result);
      } catch (error) {
        this.debug(`解析工具选择结果失败: ${error}`);
        return null;
      }
    } catch (error) {
      this.debug(`决定工具使用失败: ${error}`);
      return null;
    }
  }
  
  /**
   * 推断工具参数
   * 
   * 根据任务描述和上下文推断工具可能需要的参数
   * 
   * @param tool 工具实例
   * @param taskDescription 任务描述
   * @param context 上下文
   * @returns 推断的参数
   */
  private inferToolParameters(
    tool: Tool,
    taskDescription: string,
    context: Record<string, any>
  ): ToolParams {
    const paramDescriptions = tool.getParameterDescriptions();
    const params: ToolParams = {};
    
    // 从任务和上下文中提取可能的参数值
    for (const [paramName, description] of Object.entries(paramDescriptions)) {
      // 1. 直接从上下文匹配
      if (paramName in context) {
        params[paramName] = context[paramName];
        continue;
      }
      
      // 2. 尝试从任务描述中提取
      // 这里是简化版实现，实际可能需要更复杂的提取逻辑或LLM辅助
      const potentialValues = this.extractPotentialValues(taskDescription, paramName, description);
      if (potentialValues.length > 0) {
        params[paramName] = potentialValues[0];
      }
    }
    
    return params;
  }
  
  /**
   * 从文本中提取潜在参数值
   * 
   * @param text 文本
   * @param paramName 参数名称
   * @param description 参数描述
   * @returns 潜在值数组
   */
  private extractPotentialValues(
    text: string,
    paramName: string,
    description: string
  ): string[] {
    // 简单实现，实际可能需要更复杂的提取逻辑
    // 此处只是根据参数名和描述中的关键词进行简单匹配
    
    const values: string[] = [];
    const paramRegex = new RegExp(`${paramName}[:\\s]+(\\S+)`, 'i');
    const match = text.match(paramRegex);
    
    if (match && match[1]) {
      values.push(match[1]);
    }
    
    return values;
  }
  
  /**
   * 记录工具使用情况
   * 
   * @param toolName 工具名称
   * @param task 任务描述
   * @param success 是否成功
   * @param duration 执行时长（毫秒）
   */
  private recordToolUsage(
    toolName: string,
    task: string,
    success: boolean,
    duration?: number
  ): void {
    // 添加到使用历史
    this.toolUsageHistory.push({
      toolName,
      timestamp: Date.now(),
      task,
      success
    });
    
    // 如果使用了全局注册中心，更新使用情况
    if (this.options.useGlobalToolRegistry) {
      // 计算简单的使用评分
      if (duration !== undefined && this.options.toolRatingUpdateThreshold) {
        // 查询当前评分
        const tools = this.toolRegistry.getAllToolRegistrations();
        const registration = tools.find(r => r.tool.getName() === toolName);
        
        if (registration) {
          const currentRating = registration.rating;
          let newRating = currentRating;
          
          // 成功且速度快，提高评分
          if (success && duration < 1000) {
            newRating = Math.min(10, currentRating + this.options.toolRatingUpdateThreshold);
          } 
          // 失败，降低评分
          else if (!success) {
            newRating = Math.max(1, currentRating - this.options.toolRatingUpdateThreshold);
          }
          
          // 如果评分有变化，更新
          if (newRating !== currentRating) {
            this.toolRegistry.updateToolRating(toolName, newRating);
          }
        }
      }
      
      // 更新使用统计
      this.toolRegistry.updateToolUsage(toolName);
    }
  }
  
  /**
   * 使用工具
   * @param toolName 工具名称
   * @param params 工具参数
   * @returns 工具执行结果
   */
  async useTool(toolName: string, params: ToolParams): Promise<ToolResult> {
    // 验证参数
    const validatedParams = ValidationService.validateToolParams(toolName, params);
    
    // 检查工具是否存在
    if (!this.tools.has(toolName)) {
      // 尝试从全局注册中心获取工具
      if (this.options.useGlobalToolRegistry) {
        const tool = this.toolRegistry.getTool(toolName);
        if (tool) {
          this.registerTool(tool);
          this.debug(`从全局注册中心获取并注册工具: ${toolName}`);
        } else {
          return {
            success: false,
            error: `工具 "${toolName}" 未注册`,
            metadata: {
              agentName: this.name,
              timestamp: Date.now()
            }
          };
        }
      } else {
        return {
          success: false,
          error: `工具 "${toolName}" 未注册`,
          metadata: {
            agentName: this.name,
            timestamp: Date.now()
          }
        };
      }
    }
    
    // 如果启用了缓存，尝试从缓存获取结果
    if (this.options.enableCache) {
      const cacheKey = this.generateCacheKey(toolName, validatedParams);
      const cachedItem = this.cache.get(cacheKey);
      
      // 检查缓存是否有效
      if (cachedItem && Date.now() - cachedItem.timestamp < this.options.cacheTTL!) {
        return {
          success: true,
          data: cachedItem.result,
          metadata: {
            cached: true,
            agentName: this.name,
            timestamp: Date.now(),
            originalTimestamp: cachedItem.timestamp
          }
        };
      }
    }
    
    // 获取工具实例
    const tool = this.tools.get(toolName)!;
    
    // 执行工具，并处理重试
    let result: ToolResult | null = null;
    let error: Error | null = null;
    let attempts = 0;
    
    const maxRetries = this.options.maxRetries!;
    const retryDelay = this.options.retryDelay!;
    
    while (attempts <= maxRetries) {
      try {
        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`工具执行超时: ${toolName}`)), this.options.toolTimeout);
        });
        
        // 执行工具
        const toolPromise = tool.execute(validatedParams);
        
        // 等待工具执行或超时
        result = await Promise.race([toolPromise, timeoutPromise]);
        
        // 工具执行成功，跳出循环
        break;
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        
        // 达到最大重试次数，退出
        if (attempts >= maxRetries) {
          break;
        }
        
        // 重试延迟
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        attempts++;
      }
    }
    
    // 如果有结果，且启用了缓存，则缓存结果
    if (result && result.success && this.options.enableCache) {
      const cacheKey = this.generateCacheKey(toolName, validatedParams);
      this.cache.set(cacheKey, {
        result: result.data,
        timestamp: Date.now()
      });
    }
    
    // 如果没有结果，返回错误
    if (!result) {
      return {
        success: false,
        error: error ? error.message : `工具 "${toolName}" 执行失败`,
        metadata: {
          agentName: this.name,
          timestamp: Date.now(),
          attempts: attempts
        }
      };
    }
    
    return result;
  }
  
  /**
   * 清除缓存
   * @param toolName 可选的特定工具名称，不提供则清除所有缓存
   */
  clearCache(toolName?: string): void {
    if (toolName) {
      // 删除指定工具的所有缓存
      Array.from(this.cache.keys())
        .filter(key => key.startsWith(`${toolName}:`))
        .forEach(key => this.cache.delete(key));
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }
  
  /**
   * 生成缓存键
   * @param toolName 工具名称
   * @param params 工具参数
   * @returns 缓存键
   */
  private generateCacheKey(toolName: string, params: ToolParams): string {
    return `${toolName}:${JSON.stringify(params)}`;
  }
  
  /**
   * 记录调试信息
   * @param message 信息内容
   * @param level 日志级别
   */
  protected log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    const prefix = `[${this.name}]`;
    
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`);
        break;
      case 'info':
        console.info(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }
} 