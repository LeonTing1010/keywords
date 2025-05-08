/**
 * JourneyAgent.ts - 用户旅程模拟Agent
 * 负责模拟用户在搜索引擎中的查询旅程，发现痛点和机会
 */
import { BaseAgent, BaseAgentConfig } from './BaseAgent';
import { GraphStateType } from '../state/schema';
import { BaiduSearchEngine } from '../../infrastructure/search/engines/BaiduSearchEngine';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '../../infrastructure/core/logger';

// 用户旅程Agent配置
export interface JourneyAgentConfig extends BaseAgentConfig {
  maxSteps?: number;
  searchEngine?: any;
  minSatisfactionScore?: number;
}

/**
 * 用户旅程模拟Agent
 * 模拟用户在搜索引擎中的查询旅程，识别痛点和机会
 */
export class JourneyAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchEngine: any;
  private maxSteps: number;
  private minSatisfactionScore: number;
  
  constructor(config: JourneyAgentConfig = {}) {
    super(config);
    
    this.maxSteps = config.maxSteps || 5;
    this.minSatisfactionScore = config.minSatisfactionScore || 0.7;
    this.searchEngine = config.searchEngine || new BaiduSearchEngine();
    
    logger.debug('JourneyAgent initialized', { 
      maxSteps: this.maxSteps,
      minSatisfactionScore: this.minSatisfactionScore
    });
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // TODO: 实现搜索相关工具
  }
  
  /**
   * 获取搜索建议
   */
  private async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const suggestions = await this.searchEngine.getAutocompleteSuggestions(query);
      return suggestions.slice(0, 5); // 只取前5个建议
    } catch (error) {
      logger.warn('Error getting search suggestions', { query, error });
      return [];
    }
  }
  
  /**
   * 模拟单个搜索步骤
   */
  private async simulateSearchStep(
    query: string,
    previousSteps: Array<{
      query: string;
      suggestions: string[];
      nextQueries: Array<{
        suggestion: string;
        satisfaction: number;
        reason: string;
      }>;
      satisfaction: number;
    }>
  ): Promise<{
    query: string;
    suggestions: string[];
    nextQueries: Array<{
      suggestion: string;
      satisfaction: number;
      reason: string;
    }>;
    satisfaction: number;
  }> {
    try {
      logger.debug('Simulating search step', { query });
      
      // 获取搜索建议
      const suggestions = await this.searchEngine.getAutocompleteSuggestions(query);
      
      // 分析当前步骤
      const prompt = ChatPromptTemplate.fromTemplate(`
        分析用户搜索查询"${query}"和以下搜索建议:
        
        ${suggestions.map((s: string) => `- ${s}`).join('\n')}
        
        1. 这些建议对用户的满意度如何？(0-1分数)
        2. 用户可能会选择哪些查询作为下一步？
        3. 对于每个可能的下一步查询，评估满意度和选择理由。
        
        以JSON格式返回结果:
        {
          "satisfaction": 0.7,
          "nextQueries": [
            {
              "suggestion": "下一步查询",
              "satisfaction": 0.8,
              "reason": "选择理由"
            }
          ]
        }
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ query, suggestions });
      
      // 解析结果
      const content = response.content.toString();
      const jsonMatch = content.match(/\{.*\}/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for search step', { content });
        return {
          query,
          suggestions,
          nextQueries: [],
          satisfaction: 0.5
        };
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      return {
        query,
        suggestions,
        nextQueries: result.nextQueries || [],
        satisfaction: result.satisfaction || 0.5
      };
    } catch (error) {
      logger.error('Failed to simulate search step', { error, query });
      return {
        query,
        suggestions: [],
        nextQueries: [],
        satisfaction: 0.5
      };
    }
  }
  
  /**
   * 基于当前步骤决定下一步查询
   */
  private async decideNextQuery(
    currentStep: {
      query: string;
      suggestions: string[];
      nextQueries: Array<{
        suggestion: string;
        satisfaction: number;
        reason: string;
      }>;
      satisfaction: number;
    },
    previousSteps: Array<{
      query: string;
      suggestions: string[];
      nextQueries: Array<{
        suggestion: string;
        satisfaction: number;
        reason: string;
      }>;
      satisfaction: number;
    }>
  ): Promise<{ query: string; reason: string } | null> {
    // 如果当前步骤满意度高于阈值，可能不需要继续查询
    if (currentStep.satisfaction >= this.minSatisfactionScore && previousSteps.length > 1) {
      return null;
    }
    
    // 如果有下一步查询建议，选择满意度最高的
    if (currentStep.nextQueries && currentStep.nextQueries.length > 0) {
      // 按满意度排序
      const sortedQueries = [...currentStep.nextQueries]
        .sort((a, b) => b.satisfaction - a.satisfaction);
      
      // 选择最高满意度的查询
      const nextQuery = sortedQueries[0];
      return {
        query: nextQuery.suggestion,
        reason: nextQuery.reason
      };
    }
    
    return null;
  }
  
  /**
   * 分析用户旅程，识别痛点和机会
   */
  private async analyzeJourneyInsights(steps: Array<{
    query: string;
    suggestions: string[];
    nextQueries: Array<{
      suggestion: string;
      satisfaction: number;
      reason: string;
    }>;
    satisfaction: number;
  }>): Promise<{
    painPoints: Array<{
      description: string;
      severity: number;
      relatedQueries: string[];
      possibleSolutions: string[];
    }>;
    opportunities: Array<{
      description: string;
      potentialValue: number;
      targetAudience: string;
      implementationDifficulty: number;
    }>;
    insights: string[];
  }> {
    try {
      logger.debug('Analyzing journey insights');
      
      // 构建提示文本
      const stepsText = steps.map((step, index) => `
步骤 ${index + 1}:
- 查询: "${step.query}"
- 满意度: ${step.satisfaction}
- 建议的下一步: ${step.nextQueries.map(q => 
  `"${q.suggestion}" (满意度: ${q.satisfaction})`
).join(', ')}
`).join('\n');

      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
分析以下用户搜索旅程，提供关键洞察:

{{stepsText}}

请提供:

1. 主要用户痛点 (3-5个):
   - 描述
   - 严重程度(1-10)
   - 相关查询
   - 可能的解决方案

2. 潜在市场机会 (2-4个):
   - 描述
   - 潜在价值(1-10)
   - 目标受众
   - 实施难度(1-10)

3. 关键洞察 (3-5点)

以JSON格式返回，格式如下:
{
  "painPoints": [
    {
      "description": "痛点描述",
      "severity": 8,
      "relatedQueries": ["相关查询1", "相关查询2"],
      "possibleSolutions": ["可能解决方案1", "可能解决方案2"]
    }
  ],
  "opportunities": [
    {
      "description": "机会描述",
      "potentialValue": 7,
      "targetAudience": "目标受众",
      "implementationDifficulty": 6
    }
  ],
  "insights": [
    "洞察1",
    "洞察2"
  ]
}

只返回JSON，不要有其他文字。
`);
      
      // 执行LLM分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ stepsText });
      
      // 解析结果
      const content = response.content.toString();
      const jsonMatch = content.match(/\{.*\}/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for journey insights', { content });
        return {
          painPoints: [],
          opportunities: [],
          insights: []
        };
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      return {
        painPoints: result.painPoints || [],
        opportunities: result.opportunities || [],
        insights: result.insights || []
      };
    } catch (error) {
      logger.error('Failed to analyze journey insights', { error });
      return {
        painPoints: [],
        opportunities: [],
        insights: []
      };
    }
  }
  
  /**
   * 计算用户旅程的指标
   */
  private calculateJourneyMetrics(
    steps: Array<{
      query: string;
      suggestions: string[];
      nextQueries: Array<{
        suggestion: string;
        satisfaction: number;
        reason: string;
      }>;
      satisfaction: number;
    }>,
    painPoints: Array<{
      description: string;
      severity: number;
      relatedQueries: string[];
      possibleSolutions: string[];
    }>,
    opportunities: Array<{
      description: string;
      potentialValue: number;
      targetAudience: string;
      implementationDifficulty: number;
    }>
  ): {
    satisfactionScore: number;
    completionRate: number;
    averageStepCount: number;
    totalPainPoints: number;
    totalOpportunities: number;
  } {
    // 计算平均满意度
    const satisfactionSum = steps.reduce((sum, step) => sum + step.satisfaction, 0);
    const satisfactionScore = steps.length > 0 ? satisfactionSum / steps.length : 0;
    
    // 完成率 (基于是否达到高满意度)
    const highSatisfactionSteps = steps.filter(
      step => step.satisfaction >= this.minSatisfactionScore
    );
    const completionRate = steps.length > 0 ? highSatisfactionSteps.length / steps.length : 0;
    
    return {
      satisfactionScore,
      completionRate,
      averageStepCount: steps.length,
      totalPainPoints: painPoints.length,
      totalOpportunities: opportunities.length
    };
  }
  
  /**
   * 执行用户旅程模拟的主要逻辑
   * @param state - 当前GraphStateType
   * @returns Partial<GraphStateType>，其中journeySimulation字段严格对齐JourneySimulationResult类型
   */
  public async execute(state: GraphStateType): Promise<Partial<GraphStateType>> {
    try {
      logger.info('JourneyAgent execution started');
      
      // 获取关键词
      let keyword = state.input.keyword;
      if (state.keywordDiscovery && state.keywordDiscovery.discoveredKeywords.length > 0) {
        // 如果有发现的关键词，使用原始关键词
        keyword = state.keywordDiscovery.keyword;
      }
      
      if (!keyword) {
        throw new Error('Missing keyword for journey simulation');
      }
      
      // 执行用户旅程模拟
      const steps: Array<{
        query: string;
        suggestions: string[];
        nextQueries: Array<{
          suggestion: string;
          satisfaction: number;
          reason: string;
        }>;
        satisfaction: number;
      }> = [];
      
      const decisionPoints: Array<{
        currentQuery: string;
        chosenOption: string;
        reasonForChoice: string;
      }> = [];
      
      // 第一步使用原始关键词
      let currentQuery = keyword;
      
      // 执行模拟步骤
      for (let i = 0; i < this.maxSteps; i++) {
        logger.debug(`Simulating journey step ${i+1}`, { currentQuery });
        
        // 执行当前步骤
        const currentStep = await this.simulateSearchStep(currentQuery, steps);
        steps.push(currentStep);
        
        // 决定下一步
        const nextStep = await this.decideNextQuery(currentStep, steps);
        
        // 如果没有下一步或已达到最大步骤数，结束模拟
        if (!nextStep || i === this.maxSteps - 1) {
          break;
        }
        
        // 记录决策点
        decisionPoints.push({
          currentQuery: currentStep.query,
          chosenOption: nextStep.query,
          reasonForChoice: nextStep.reason
        });
        
        // 更新当前查询
        currentQuery = nextStep.query;
      }
      
      // 分析旅程洞察
      const { painPoints, opportunities, insights } = await this.analyzeJourneyInsights(steps);
      
      // 计算指标
      const metrics = this.calculateJourneyMetrics(steps, painPoints, opportunities);
      
      // 更新状态
      return {
        journeySimulation: {
          startKeyword: keyword,
          steps,
          decisionPoints,
          painPoints,
          opportunities,
          insights,
          metrics
        },
        executionMetadata: {
          ...state.executionMetadata,
          completedNodes: [
            ...(state.executionMetadata?.completedNodes || []),
            'journeySimulation'
          ]
        }
      };
    } catch (error) {
      logger.error('JourneyAgent execution failed', { error });
      throw error;
    }
  }
} 