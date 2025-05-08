/**
 * ModelSelectionService.ts
 * 提供自动模型选择功能，根据任务复杂度选择合适的LLM模型
 */
import { LLMMessage, LLMOptions, ModelTierConfig } from './types';
import { logger } from '../../infra/logger';

/**
 * 模型选择服务配置
 */
export interface ModelSelectionConfig {
  enabled?: boolean; // 是否启用自动模型选择
  modelTiers?: ModelTierConfig; // 模型层级配置
  tokenEstimator?: (content: string) => number; // token估算器
}

/**
 * 模型选择服务
 * 根据任务复杂度自动选择合适的LLM模型，优化成本与性能
 */
export class ModelSelectionService {
  private enabled: boolean;
  private modelTiers: ModelTierConfig;
  private tokenThresholds = {
    simple: 2000,   // 简单任务token阈值
    medium: 7000    // 中等任务token阈值 (超过此值视为复杂任务)
  };

  /**
   * 创建模型选择服务
   */
  constructor(config: ModelSelectionConfig = {}) {
    this.enabled = config.enabled !== false;
    
    // 默认模型层级配置
    this.modelTiers = config.modelTiers || {
      simple: 'gpt-3.5-turbo',
      medium: 'gpt-3.5-turbo-16k',
      complex: 'gpt-4-turbo'
    };
    
    logger.info('模型选择服务初始化完成', {
      enabled: this.enabled,
      modelTiers: this.modelTiers
    });
  }

  /**
   * 选择适合任务的模型
   * @param messages 消息列表
   * @param options LLM选项
   * @returns 选择的模型名称
   */
  public selectModel(messages: LLMMessage[], options: LLMOptions = {}): string {
    // 如果禁用自动选择或已指定模型，返回选项中指定的模型
    if (!this.enabled || options.autoModelSelection === false || options.model) {
      return options.model || this.modelTiers.medium;
    }

    // 如果明确指定了复杂度级别，直接使用对应的模型
    if (options.complexityLevel) {
      const model = this.modelTiers[options.complexityLevel];
      logger.debug(`根据指定复杂度级别选择模型: ${options.complexityLevel}`, { model });
      return model;
    }

    // 根据消息内容和选项评估任务复杂度
    const complexity = this.evaluateComplexity(messages, options);
    let selectedModel = this.modelTiers.medium; // 默认使用中等复杂度模型

    switch (complexity) {
      case 'simple':
        selectedModel = this.modelTiers.simple;
        break;
      case 'medium':
        selectedModel = this.modelTiers.medium;
        break;
      case 'complex':
        selectedModel = this.modelTiers.complex;
        break;
    }

    logger.debug(`自动选择模型: ${complexity}级任务`, { model: selectedModel });
    return selectedModel;
  }

  /**
   * 评估任务复杂度
   * @param messages 消息列表
   * @param options LLM选项
   * @returns 复杂度级别
   */
  private evaluateComplexity(messages: LLMMessage[], options: LLMOptions): 'simple' | 'medium' | 'complex' {
    // 估算总token数
    const totalTokens = this.estimateTokenCount(messages);
    
    // 根据token数初步判断复杂度
    let complexity: 'simple' | 'medium' | 'complex';
    if (totalTokens < this.tokenThresholds.simple) {
      complexity = 'simple';
    } else if (totalTokens < this.tokenThresholds.medium) {
      complexity = 'medium';
    } else {
      complexity = 'complex';
    }
    
    // 考虑其他因素调整复杂度评估
    
    // 1. 如果需要严格JSON格式，提高一级复杂度
    if (options.format === 'json' && options.strictFormat === true) {
      complexity = this.upgradeComplexity(complexity);
    }
    
    // 2. 如果需要长上下文理解，考虑提高复杂度
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length > 5) {
      complexity = this.upgradeComplexity(complexity);
    }
    
    // 3. 如果存在复杂指令关键词，提高复杂度
    const complexityKeywords = [
      'analyze', '分析', 'complex', '复杂', 'detailed', '详细',
      'comprehensive', '全面', 'reasoning', '推理', 'critique', '评论'
    ];
    
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      const hasComplexKeywords = complexityKeywords.some(
        keyword => lastUserMessage.content.toLowerCase().includes(keyword)
      );
      
      if (hasComplexKeywords) {
        complexity = this.upgradeComplexity(complexity);
      }
    }
    
    return complexity;
  }
  
  /**
   * 提高复杂度级别
   */
  private upgradeComplexity(current: 'simple' | 'medium' | 'complex'): 'simple' | 'medium' | 'complex' {
    if (current === 'simple') return 'medium';
    return 'complex';
  }
  
  /**
   * 估算消息列表的总token数
   * 使用简单启发式方法: 每4个字符约1个token
   */
  private estimateTokenCount(messages: LLMMessage[]): number {
    // 基础token开销 (每条消息的基本开销)
    const baseTokens = messages.length * 4;
    
    // 计算所有消息内容的总字符数
    const totalChars = messages.reduce((sum, msg) => {
      return sum + (msg.content?.length || 0);
    }, 0);
    
    // 估算token数 (约4个字符1个token)
    return baseTokens + Math.ceil(totalChars / 4);
  }
  
  /**
   * 更新模型层级配置
   */
  public updateModelTiers(tiers: Partial<ModelTierConfig>): void {
    this.modelTiers = {
      ...this.modelTiers,
      ...tiers
    };
    
    logger.info('已更新模型层级配置', { modelTiers: this.modelTiers });
  }
  
  /**
   * 启用自动模型选择
   */
  public enable(): void {
    this.enabled = true;
    logger.info('已启用自动模型选择');
  }
  
  /**
   * 禁用自动模型选择
   */
  public disable(): void {
    this.enabled = false;
    logger.info('已禁用自动模型选择');
  }
  
  /**
   * 获取当前配置信息
   */
  public getConfig(): any {
    return {
      enabled: this.enabled,
      modelTiers: this.modelTiers,
      tokenThresholds: this.tokenThresholds
    };
  }
} 