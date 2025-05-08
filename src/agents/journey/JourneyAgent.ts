/**
 * 旅程Agent (用户行为分析专家)
 * 
 * 核心职责:
 * 1. 模拟具有不同搜索行为和偏好的多样化用户角色
 * 2. 映射用户从初始查询到最终行动或放弃的完整旅程
 * 3. 识别搜索旅程中的摩擦点和决策分支
 * 4. 从搜索优化和放弃模式中提取隐含需求
 * 5. 分析跨设备和跨平台的搜索连续性
 * 
 * 主要功能:
 * - 模拟用户完整搜索旅程并识别关键决策点
 * - 分析每个搜索步骤的用户满意度
 * - 识别搜索过程中的主要痛点和困难
 * - 发现搜索行为中隐含的机会
 * - 生成相关搜索查询以扩展分析范围
 */
import { BaseAgent, BaseAgentConfig } from '../base/BaseAgent';
import { GraphStateType } from '../../types/schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../../infra/logger';
import { SearchEngine } from '../../infra/search/SearchEngine';
import { MockSearchEngine } from '../../infra/search/engines/MockSearchEngine';
import { SearchTools } from '../../tools/search/SearchTools';

// 用户旅程Agent配置
export interface JourneyAgentConfig extends BaseAgentConfig {
  maxSteps?: number;
  minSatisfactionScore?: number;
  maxQueryDepth?: number;
  painPointThreshold?: number;
  enableRelatedQueries?: boolean;
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
}

/**
 * 用户旅程模拟Agent
 * 负责模拟用户搜索行为和识别用户痛点
 */
export class JourneyAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private maxSteps: number;
  private minSatisfactionScore: number;
  private maxQueryDepth: number;
  private painPointThreshold: number;
  private enableRelatedQueries: boolean;
  
  constructor(config: JourneyAgentConfig = {}) {
    super(config);
    
    this.maxSteps = config.maxSteps || 3;
    this.minSatisfactionScore = config.minSatisfactionScore || 0.7; // 0-1之间
    this.maxQueryDepth = config.maxQueryDepth || 3;
    this.painPointThreshold = config.painPointThreshold || 3; // 1-10之间
    this.enableRelatedQueries = config.enableRelatedQueries !== false; // 默认开启
    
    logger.debug('JourneyAgent initialized', {
      maxSteps: this.maxSteps,
      minSatisfactionScore: this.minSatisfactionScore,
      maxQueryDepth: this.maxQueryDepth,
      painPointThreshold: this.painPointThreshold,
      enableRelatedQueries: this.enableRelatedQueries
    });
    
    // 在constructor最后初始化SearchTools，确保在setupTools之后
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具 - 在constructor的最后调用，避免继承初始化顺序问题
   */
  private initializeSearchTools(config: JourneyAgentConfig): void {
    // 优先使用提供的SearchTools，其次使用SearchEngine创建SearchTools，最后创建默认的SearchTools
    if (config.searchTools) {
      this.searchTools = config.searchTools;
      logger.debug('Using provided SearchTools instance');
    } else if (config.searchEngine) {
      logger.debug('Creating SearchTools with provided searchEngine');
      this.searchTools = new SearchTools({ searchEngine: config.searchEngine });
    } else {
      logger.debug('Creating default SearchTools instance');
      this.searchTools = new SearchTools();
      logger.warn('No search engine/tools provided to JourneyAgent, using default web search');
    }
    
    // 如果工具还没有注册，现在注册它们
    if (this.tools.length === 0 && this.searchTools) {
      try {
        const tools = this.searchTools.getAllTools();
        this.registerTools(tools);
        logger.debug('JourneyAgent tools registered', { count: this.tools.length });
      } catch (error) {
        logger.error('Failed to register search tools', { error });
      }
    }
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // 在BaseAgent构造函数中调用时，searchTools可能还不存在
    // 我们将在构造函数完成后手动注册工具
    logger.debug('setupTools called, will register tools later');
  }
  
  /**
   * 获取搜索建议
   */
  private async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      logger.debug('Getting search suggestions', { query });
      
      // 确保searchTools已初始化
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // 使用搜索建议工具获取相关建议
      const suggestionsTool = this.searchTools.getSearchSuggestionsTool();
      const result = await suggestionsTool.invoke({ keyword: query });
      
      try {
        // 解析工具返回的JSON
        const suggestions = JSON.parse(result);
        const queries = suggestions.map((s: any) => s.query);
        return queries.slice(0, 5); // 返回前5个建议
      } catch (error) {
        logger.error('Failed to parse search suggestions', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get search suggestions', { error });
      return [];
    }
  }
  
  /**
   * 模拟搜索步骤
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
      logger.debug('Simulating search step', { query, stepCount: previousSteps.length + 1 });
      
      // 获取搜索建议
      const suggestions = await this.getSearchSuggestions(query);
      
      // 如果没有建议，直接返回
      if (suggestions.length === 0) {
        return {
          query,
          suggestions: [],
          nextQueries: [],
          satisfaction: 0.5 // 默认满意度
        };
      }
      
      // 确保searchTools已初始化
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // 获取搜索结果以便分析
      const searchResultsTool = this.searchTools.getSearchResultsTool();
      const searchResultsJson = await searchResultsTool.invoke({ keyword: query, maxResults: 3 });
      let searchResults = [];
      
      try {
        searchResults = JSON.parse(searchResultsJson);
      } catch (e) {
        logger.warn('Failed to parse search results', { error: e });
      }
      
      // 为LLM准备搜索结果文本
      const searchResultsText = searchResults.map((r: any, i: number) => 
        `结果 ${i+1}:\n标题: ${r.title}\n摘要: ${r.snippet}\n`
      ).join('\n');
      
      // 准备之前步骤的历史
      const previousStepsText = previousSteps.map((step, i) => 
        `步骤 ${i+1}:\n查询: "${step.query}"\n满意度: ${step.satisfaction}\n`
      ).join('\n');
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个模拟用户搜索行为的专家。请评估用户搜索以下查询的满意度，并推荐下一步可能的查询。
        
        当前查询: "${query}"
        
        搜索结果:
        ${searchResultsText}
        
        搜索建议:
        ${suggestions.map((s, i) => `${i+1}. ${s}`).join('\n')}
        
        ${previousSteps.length > 0 ? `之前的搜索步骤:\n${previousStepsText}` : '这是第一次搜索。'}
        
        请分析:
        1. 用户对当前搜索结果的满意度(0-1，1为完全满意)
        2. 如果用户不满意，他们会选择哪个搜索建议继续搜索？为每个可能的下一步查询评分。
        
        以JSON格式返回:
        {{
          "satisfaction": 0.6,
          "nextQueries": [
            {{
              "suggestion": "搜索建议1",
              "satisfaction": 0.4,
              "reason": "为什么用户会选择这个查询"
            }},
            {{
              "suggestion": "搜索建议2",
              "satisfaction": 0.7,
              "reason": "为什么用户会选择这个查询"
            }}
          ]
        }}
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const content = await chain.invoke({});
      
      // 解析LLM返回的JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
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
   * 识别用户旅程中的痛点
   */
  private async identifyPainPoints(searchSteps: any[]): Promise<any[]> {
    if (searchSteps.length === 0) {
      return [];
    }
    
    try {
      logger.debug('Identifying pain points from search journey');
      
      // 将搜索步骤转换为文本
      const stepsText = searchSteps.map((step, i) => `
      步骤 ${i+1}:
      查询: "${step.query}"
      建议: ${step.suggestions.slice(0, 3).join(', ')}
      满意度: ${step.satisfaction}
      ${step.nextQueries && step.nextQueries.length > 0 ? 
        `下一步可能查询: ${step.nextQueries.map((q: any) => 
          `"${q.suggestion}" (满意度预期: ${q.satisfaction})`).join(', ')}` : 
        '没有下一步查询'}
      `).join('\n');
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个用户体验专家，擅长从用户搜索行为中识别用户痛点。
        
        以下是用户的搜索旅程:
        ${stepsText}
        
        请分析这个搜索旅程，识别用户可能遇到的痛点。痛点是指:
        1. 用户遇到的阻碍或困难
        2. 搜索结果不能满足用户的需求
        3. 用户需要多次修改查询才能找到所需信息
        4. 用户可能因不满意而放弃搜索
        
        对每个识别出的痛点，提供:
        1. 痛点描述
        2. 严重度评分(1-10)
        3. 发生在哪个搜索步骤
        4. 可能的解决方案建议
        
        以JSON数组格式返回:
        [
          {{
            "description": "痛点描述",
            "severity": 7,
            "step": 2,
            "solution": "可能的解决方案"
          }}
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for pain points', { content });
          return [];
        }
        
        const painPoints = JSON.parse(jsonMatch[0]);
        
        // 过滤出严重度高于阈值的痛点
        const significantPainPoints = painPoints.filter(
          (p: any) => p.severity >= this.painPointThreshold
        );
        
        logger.debug('Identified pain points', { 
          total: painPoints.length, 
          significant: significantPainPoints.length 
        });
        
        return significantPainPoints;
      } catch (parseError) {
        logger.error('Failed to parse pain points JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to identify pain points', { error });
      return [];
    }
  }
  
  /**
   * 生成相关搜索查询
   */
  private async generateRelatedQueries(keyword: string, searchSteps: any[]): Promise<string[]> {
    if (!this.enableRelatedQueries) {
      return [];
    }
    
    try {
      logger.debug('Generating related search queries');
      
      // 从已有步骤中提取查询
      const existingQueries = searchSteps.map(step => step.query);
      
      // 使用搜索建议工具获取相关查询
      const suggestions = await this.getSearchSuggestions(keyword);
      
      // 过滤掉已经使用过的查询
      const newQueries = suggestions.filter(q => !existingQueries.includes(q));
      
      return newQueries.slice(0, 5);
    } catch (error) {
      logger.error('Failed to generate search queries', { error });
      return [];
    }
  }
  
  /**
   * 执行用户旅程Agent的主要逻辑
   * @param state - GraphStateType状态
   * @returns Partial<GraphStateType>，更新后的状态
   */
  public async execute(state: any): Promise<any> {
    try {
      logger.info('JourneyAgent execution started');
      
      // 从状态中获取关键词
      const keyword = state.input?.keyword || state.keyword;
      if (!keyword) {
        throw new Error('Missing keyword in state');
      }
      
      // 初始化搜索步骤数组
      const searchSteps = [];
      
      // 执行第一次搜索
      let currentStep = await this.simulateSearchStep(keyword, []);
      searchSteps.push(currentStep);
      
      // 如果满意度未达到阈值且未超过最大步骤数量，继续搜索
      let stepCount = 1;
      while (
        currentStep.satisfaction < this.minSatisfactionScore && 
        stepCount < this.maxSteps &&
        currentStep.nextQueries &&
        currentStep.nextQueries.length > 0
      ) {
        // 找出满意度最高的下一步查询
        const nextQuery = currentStep.nextQueries.reduce(
          (prev, current) => current.satisfaction > prev.satisfaction ? current : prev, 
          { suggestion: '', satisfaction: 0, reason: '' }
        );
        
        // 如果没有有效的下一步查询，或者已经达到最大查询深度，则停止
        if (!nextQuery.suggestion || stepCount >= this.maxQueryDepth) {
          break;
        }
        
        // 执行下一次搜索
        currentStep = await this.simulateSearchStep(nextQuery.suggestion, searchSteps);
        searchSteps.push(currentStep);
        stepCount++;
      }
      
      // 识别搜索旅程中的痛点
      const painPoints = await this.identifyPainPoints(searchSteps);
      
      // 生成相关搜索查询
      const relatedQueries = await this.generateRelatedQueries(keyword, searchSteps);
      
      // 计算旅程统计信息
      const finalSatisfaction = searchSteps[searchSteps.length - 1].satisfaction;
      const averageSatisfaction = searchSteps.reduce((sum, s) => sum + s.satisfaction, 0) / searchSteps.length;
      
      const journeyStatistics = {
        steps: searchSteps.length,
        finalSatisfaction,
        averageSatisfaction,
        painPointsCount: painPoints.length,
        queryRefinements: searchSteps.length - 1,
        relatedQueriesCount: relatedQueries.length,
      };
      
      // 更新状态
      return {
        journeySimulation: {
          keyword,
          searchSteps,
          painPoints,
          relatedQueries,
          statistics: journeyStatistics
        }
      };
    } catch (error) {
      logger.error('JourneyAgent execution failed', { error });
      throw error;
    }
  }
} 