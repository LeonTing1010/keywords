/**
 * ToolRegistry.ts - 全局工具注册中心
 * 
 * 维护所有可用工具，并提供工具选择能力
 */

import { Tool } from '../tools/Tool';
import { z } from 'zod';

/**
 * 工具注册中心配置
 */
export interface ToolRegistryConfig {
  // 启用缓存
  enableCache?: boolean;
  // 自动刷新工具列表的频率（毫秒）
  refreshIntervalMs?: number;
}

/**
 * 工具类别
 */
export enum ToolCategory {
  SEARCH = 'search',          // 搜索相关工具
  ANALYSIS = 'analysis',      // 分析工具
  EVALUATION = 'evaluation',  // 评估工具
  DATA = 'data',              // 数据操作工具
  UTILITY = 'utility',        // 通用工具
  OTHER = 'other'             // 其他工具
}

/**
 * 工具登记信息
 */
export interface ToolRegistration {
  tool: Tool;
  category: ToolCategory;
  tags: string[];
  lastUsed?: number;
  usageCount: number;
  rating: number; // 工具评分 (1-10)
}

/**
 * 工具选择标准
 */
export interface ToolSelectionCriteria {
  // 任务描述
  taskDescription: string;
  // 首选类别（可选）
  preferredCategory?: ToolCategory;
  // 所需标签（可选） 
  requiredTags?: string[];
  // 首选标签（可选）
  preferredTags?: string[];
  // 最低评分（可选）
  minRating?: number;
  // 最大工具数量（可选）
  maxTools?: number;
  // 尝试推荐类似工具
  recommendSimilar?: boolean;
}

// 工具选择标准的Zod验证模式
export const ToolSelectionCriteriaSchema = z.object({
  taskDescription: z.string().min(1, "任务描述不能为空"),
  preferredCategory: z.nativeEnum(ToolCategory).optional(),
  requiredTags: z.array(z.string()).optional(),
  preferredTags: z.array(z.string()).optional(),
  minRating: z.number().min(1).max(10).optional(),
  maxTools: z.number().positive().optional(),
  recommendSimilar: z.boolean().optional()
});

/**
 * 工具选择结果
 */
export interface ToolSelectionResult {
  selectedTools: Tool[];
  reasonings: string[];
  fallbackRecommendations?: Tool[];
}

/**
 * 工具注册中心类 - 单例模式
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolRegistration> = new Map();
  private config: ToolRegistryConfig;
  private refreshInterval?: NodeJS.Timeout;

  /**
   * 私有构造函数
   * @param config 配置选项
   */
  private constructor(config: ToolRegistryConfig = {}) {
    this.config = {
      enableCache: true,
      refreshIntervalMs: 30 * 60 * 1000, // 默认30分钟刷新一次
      ...config
    };

    // 设置自动刷新
    if (this.config.refreshIntervalMs && this.config.refreshIntervalMs > 0) {
      this.refreshInterval = setInterval(() => {
        this.refreshTools();
      }, this.config.refreshIntervalMs);
    }
  }

  /**
   * 获取单例实例
   * @param config 配置选项
   * @returns ToolRegistry实例
   */
  public static getInstance(config?: ToolRegistryConfig): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry(config);
    }
    return ToolRegistry.instance;
  }

  /**
   * 注册工具
   * @param tool 工具实例
   * @param category 工具类别
   * @param tags 工具标签
   * @returns 是否注册成功
   */
  public registerTool(
    tool: Tool, 
    category: ToolCategory = ToolCategory.OTHER, 
    tags: string[] = []
  ): boolean {
    try {
      const toolName = tool.getName();
      
      // 已存在则更新
      if (this.tools.has(toolName)) {
        const existing = this.tools.get(toolName)!;
        this.tools.set(toolName, {
          ...existing,
          tool,
          category,
          tags: [...new Set([...existing.tags, ...tags])]
        });
        return true;
      }
      
      // 新增工具
      this.tools.set(toolName, {
        tool,
        category,
        tags,
        usageCount: 0,
        rating: 5, // 默认评分5分
      });
      
      return true;
    } catch (error) {
      console.error(`注册工具失败: ${error}`);
      return false;
    }
  }

  /**
   * 注册多个工具
   * @param tools 工具数组
   * @param defaultCategory 默认类别
   * @returns 成功注册的工具数量
   */
  public registerTools(
    tools: Tool[], 
    defaultCategory: ToolCategory = ToolCategory.OTHER
  ): number {
    let successCount = 0;
    
    for (const tool of tools) {
      // 尝试从工具名称推断类别和标签
      const { category, tags } = this.inferCategoryAndTags(tool);
      
      if (this.registerTool(tool, category || defaultCategory, tags)) {
        successCount++;
      }
    }
    
    return successCount;
  }

  /**
   * 从工具名称推断类别和标签
   * @param tool 工具实例
   * @returns 推断的类别和标签
   */
  private inferCategoryAndTags(tool: Tool): { category?: ToolCategory; tags: string[] } {
    const name = tool.getName().toLowerCase();
    const description = tool.getDescription().toLowerCase();
    const tags: string[] = [];
    let category: ToolCategory | undefined;

    // 根据名称和描述推断类别和标签
    if (name.includes('search') || description.includes('搜索')) {
      category = ToolCategory.SEARCH;
      tags.push('search');
    } else if (name.includes('analyz') || description.includes('分析')) {
      category = ToolCategory.ANALYSIS;
      tags.push('analysis');
    } else if (name.includes('evaluat') || description.includes('评估')) {
      category = ToolCategory.EVALUATION;
      tags.push('evaluation');
    } else if (name.includes('data') || description.includes('数据')) {
      category = ToolCategory.DATA;
      tags.push('data');
    }

    // 根据词典提取可能的标签
    const potentialTags = [
      'web', 'market', 'trend', 'community', 'suggestion', 'content',
      'statistics', 'report', 'visualization', 'validation'
    ];

    for (const tag of potentialTags) {
      if (name.includes(tag) || description.includes(tag)) {
        tags.push(tag);
      }
    }

    return { category, tags };
  }

  /**
   * 获取所有工具
   * @returns 所有工具实例
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values()).map(registration => registration.tool);
  }

  /**
   * 获取所有工具注册信息
   * @returns 所有工具注册信息
   */
  public getAllToolRegistrations(): ToolRegistration[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取工具
   * @param toolName 工具名称
   * @returns 工具实例或undefined
   */
  public getTool(toolName: string): Tool | undefined {
    const registration = this.tools.get(toolName);
    return registration?.tool;
  }

  /**
   * 获取指定类别的工具
   * @param category 工具类别
   * @returns 工具实例数组
   */
  public getToolsByCategory(category: ToolCategory): Tool[] {
    return Array.from(this.tools.values())
      .filter(registration => registration.category === category)
      .map(registration => registration.tool);
  }

  /**
   * 获取带有指定标签的工具
   * @param tag 标签
   * @returns 工具实例数组
   */
  public getToolsByTag(tag: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(registration => registration.tags.includes(tag))
      .map(registration => registration.tool);
  }

  /**
   * 根据标准自动选择工具
   * @param criteria 选择标准
   * @returns 工具选择结果
   */
  public selectTools(criteria: ToolSelectionCriteria): ToolSelectionResult {
    try {
      // 验证输入
      const validatedCriteria = ToolSelectionCriteriaSchema.parse(criteria);
      
      // 获取所有工具注册信息
      const registrations = Array.from(this.tools.values());
      
      // 初始化结果和推理
      const result: ToolSelectionResult = {
        selectedTools: [],
        reasonings: [],
        fallbackRecommendations: []
      };
      
      // 第一步：应用必须条件筛选
      let filteredTools = registrations;
      
      // 如果有必须标签，进行筛选
      if (validatedCriteria.requiredTags && validatedCriteria.requiredTags.length > 0) {
        filteredTools = filteredTools.filter(reg => 
          validatedCriteria.requiredTags!.every(tag => reg.tags.includes(tag))
        );
        
        result.reasonings.push(`应用必须标签筛选：${validatedCriteria.requiredTags.join(', ')}`);
      }
      
      // 如果有最低评分要求，进行筛选
      if (validatedCriteria.minRating) {
        filteredTools = filteredTools.filter(reg => reg.rating >= validatedCriteria.minRating!);
        result.reasonings.push(`应用最低评分标准：${validatedCriteria.minRating}`);
      }
      
      // 第二步：应用偏好条件计算得分
      const scoredTools = filteredTools.map(reg => {
        let score = reg.rating * 10; // 基础分 = 评分 × 10
        
        // 如果有首选类别，对应类别加分
        if (validatedCriteria.preferredCategory && reg.category === validatedCriteria.preferredCategory) {
          score += 50;
        }
        
        // 如果有首选标签，每命中一个加分
        if (validatedCriteria.preferredTags && validatedCriteria.preferredTags.length > 0) {
          const matchedTags = validatedCriteria.preferredTags.filter(tag => reg.tags.includes(tag));
          score += matchedTags.length * 30;
        }
        
        // 使用频率加分
        score += Math.min(reg.usageCount, 10) * 5;
        
        return { registration: reg, score };
      });
      
      // 按分数排序
      scoredTools.sort((a, b) => b.score - a.score);
      
      // 选择最佳工具
      const maxTools = validatedCriteria.maxTools || 3;
      const selectedRegistrations = scoredTools.slice(0, maxTools);
      
      // 更新选择结果
      result.selectedTools = selectedRegistrations.map(item => item.registration.tool);
      
      // 添加选择理由
      result.reasonings.push(`根据任务描述"${validatedCriteria.taskDescription}"选择了${result.selectedTools.length}个最适合的工具`);
      selectedRegistrations.forEach(item => {
        const reg = item.registration;
        result.reasonings.push(
          `工具"${reg.tool.getName()}"，评分${reg.rating}，类别${reg.category}，标签[${reg.tags.join(', ')}]，综合得分${item.score}`
        );
      });
      
      // 如果开启推荐类似工具，添加备选推荐
      if (validatedCriteria.recommendSimilar && scoredTools.length > maxTools) {
        result.fallbackRecommendations = scoredTools
          .slice(maxTools, maxTools + 2)
          .map(item => item.registration.tool);
          
        result.reasonings.push(`额外推荐${result.fallbackRecommendations.length}个备选工具`);
      }
      
      // 更新使用统计
      for (const tool of result.selectedTools) {
        this.updateToolUsage(tool.getName());
      }
      
      return result;
    } catch (error) {
      console.error(`工具选择失败: ${error}`);
      // 返回空结果
      return {
        selectedTools: [],
        reasonings: [`工具选择失败: ${error}`]
      };
    }
  }
  
  /**
   * 根据任务描述智能选择工具
   * @param taskDescription 任务描述
   * @param maxTools 最大工具数量
   * @returns 选择的工具
   */
  public selectToolsByTaskDescription(taskDescription: string, maxTools = 3): Tool[] {
    const criteria: ToolSelectionCriteria = {
      taskDescription,
      maxTools,
      recommendSimilar: true
    };
    
    const result = this.selectTools(criteria);
    return result.selectedTools;
  }

  /**
   * 更新工具使用情况
   * @param toolName 工具名称
   * @param rating 评分（可选）
   */
  public updateToolUsage(toolName: string, rating?: number): void {
    const registration = this.tools.get(toolName);
    if (!registration) return;
    
    this.tools.set(toolName, {
      ...registration,
      usageCount: registration.usageCount + 1,
      lastUsed: Date.now(),
      rating: rating !== undefined ? rating : registration.rating
    });
  }

  /**
   * 更新工具评分
   * @param toolName 工具名称
   * @param rating 评分 (1-10)
   * @returns 是否更新成功
   */
  public updateToolRating(toolName: string, rating: number): boolean {
    if (rating < 1 || rating > 10) {
      return false;
    }
    
    const registration = this.tools.get(toolName);
    if (!registration) return false;
    
    this.tools.set(toolName, {
      ...registration,
      rating
    });
    
    return true;
  }

  /**
   * 移除工具
   * @param toolName 工具名称
   * @returns 是否移除成功
   */
  public removeTool(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  /**
   * 刷新工具列表
   * 用于定期清理和维护
   */
  private refreshTools(): void {
    // 可以加入轮询动态工具源、清理长期未使用的工具等逻辑
    console.log(`[ToolRegistry] 刷新工具列表，当前共有${this.tools.size}个工具`);
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// 导出单例实例
export const toolRegistry = ToolRegistry.getInstance(); 