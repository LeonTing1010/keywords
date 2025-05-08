/**
 * ContentAgent.ts - 内容分析与未满足需求识别Agent
 * 
 * 核心职责:
 * 1. 对搜索结果进行深度内容缺口分析
 * 2. 评估解决方案的全面性、权威性和可访问性
 * 3. 识别信息质量问题(过时、不完整、矛盾)
 * 4. 根据用户需求维度评估竞争对手解决方案
 * 5. 计算客观需求满足度分数并提供可信度指标
 * 
 * 主要功能:
 * - 分析搜索结果内容质量及其满足用户需求的程度
 * - 识别具体的内容缺口和市场空白
 * - 评估现有解决方案的权威性和可靠性
 * - 生成未满足需求的机会分析
 * - 提供内容差距严重度和市场机会评分
 */
import { BaseAgent, BaseAgentConfig } from '../base/BaseAgent';
import { GraphStateType } from '../../types/schema';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '../../infra/logger';
import { SearchEngine } from '../../infra/search/SearchEngine';
import { SearchOptions } from '../../infra/search/types';
import { AutocompleteSuggestion } from '../../infra/search/types';
import { MockSearchEngine } from '../../infra/search/engines/MockSearchEngine';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { SearchTools } from '../../tools/search/SearchTools';

// 内容分析Agent配置
export interface ContentAgentConfig extends BaseAgentConfig {
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  maxContentSamples?: number;
  detailedAnalysis?: boolean;
}

/**
 * 内容分析Agent
 * 负责分析搜索结果内容质量和识别未满足的用户需求
 */
export class ContentAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private maxContentSamples: number;
  private detailedAnalysis: boolean;
  
  constructor(config: ContentAgentConfig = {}) {
    super(config);
    
    this.maxContentSamples = config.maxContentSamples || 5;
    this.detailedAnalysis = config.detailedAnalysis !== false;
    
    logger.debug('ContentAgent initialized', { 
      maxContentSamples: this.maxContentSamples,
      detailedAnalysis: this.detailedAnalysis
    });
    
    // 在constructor最后初始化SearchTools，确保在setupTools之后
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具 - 在constructor的最后调用，避免继承初始化顺序问题
   */
  private initializeSearchTools(config: ContentAgentConfig): void {
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
      logger.warn('No search engine/tools provided to ContentAgent, using default web search');
    }
    
    // 如果工具还没有注册，现在注册它们
    if (this.tools.length === 0 && this.searchTools) {
      try {
        const tools = this.searchTools.getAllTools();
        this.registerTools(tools);
        logger.debug('ContentAgent tools registered', { count: this.tools.length });
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
   * 获取关键词的搜索结果
   */
  private async getSearchResults(keyword: string): Promise<any[]> {
    try {
      logger.debug('Getting search results', { keyword });
      
      // 确保searchTools已初始化
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // 使用内容分析工具获取格式化的搜索结果
      const contentTool = this.searchTools.getContentAnalysisTool();
      const result = await contentTool.invoke({ 
        keyword, 
        maxResults: this.maxContentSamples 
      });
      
      try {
        // 解析工具返回的JSON
        const contentData = JSON.parse(result);
        return contentData.searchResults || [];
      } catch (error) {
        logger.error('Failed to parse search results', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get search results', { keyword, error });
      return [];
    }
  }
  
  /**
   * 分析内容质量以判断是否为未满足需求
   */
  private async analyzeContentQuality(keyword: string, searchResults: any[]): Promise<any> {
    try {
      logger.debug('Analyzing content quality', { keyword });
      
      // 将搜索结果转换为文本
      const resultText = searchResults.map((r, i) => `
        #${i+1} ${r.title}
        URL: ${r.url}
        摘要: ${r.snippet}
      `).join('\n');
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的内容质量分析师，擅长评估搜索结果是否满足用户需求。
        
        请分析以下关键词的搜索结果，并判断这是否是一个未被满足的市场需求:
        
        关键词: {keyword}
        
        搜索结果:
        {resultText}
        
        评估标准:
        1. 内容质量 - 现有内容是否全面、准确、深入
        2. 内容格式 - 是否以用户易于理解的方式呈现
        3. 内容权威性 - 内容来源是否可靠权威
        4. 用户满意度 - 现有内容是否能真正解决用户问题
        
        请以JSON格式返回你的分析结果:
        {{
          "isUnmetNeed": true,
          "contentQuality": 0.7,
          "marketGapSeverity": 8,
          "reason": "详细解释为什么这是/不是未满足需求"
        }}
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({ 
        keyword,
        resultText
      });
      
      try {
        // 尝试解析JSON
        const content = response.toString();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for content quality', { content });
          return {
            isUnmetNeed: false,
            contentQuality: 0.5,
            marketGapSeverity: 5,
            reason: "无法解析LLM响应"
          };
        }
        
        const result = JSON.parse(jsonMatch[0]);
        return result;
      } catch (parseError) {
        logger.error('Failed to parse content quality JSON', { parseError, response });
        return {
          isUnmetNeed: false,
          contentQuality: 0.5,
          marketGapSeverity: 5,
          reason: "解析JSON时出错"
        };
      }
    } catch (error) {
      logger.error('Failed to analyze content quality', { keyword, error });
      throw error;
    }
  }
  
  /**
   * 生成具体的未满足需求机会
   */
  private async generateConcreteUnmetNeeds(
    unmetNeeds: any[],
    painPoints: any[] = []
  ): Promise<any[]> {
    if (unmetNeeds.length === 0) {
      return [];
    }
    
    try {
      logger.debug('Generating concrete unmet needs');
      
      // 过滤出真正的未满足需求
      const actualUnmetNeeds: any[] = unmetNeeds.filter((need: any) => need.isUnmetNeed);
      if (actualUnmetNeeds.length === 0) {
        return [];
      }
      
      // 将数组转换为文本格式
      const unmetNeedsText = actualUnmetNeeds.map(need => `
      关键词: "${need.keyword}"
      内容质量: ${need.contentQuality}
      市场空白严重度: ${need.marketGapSeverity}
      原因: ${need.reason}
      `).join('\n');
      
      // 组合痛点信息
      const painPointsText: string = painPoints.length > 0 
        ? `用户痛点:\n${painPoints.map((p: any) => `- ${p.description} (严重度: ${p.severity})`).join('\n')}`
        : '没有用户痛点数据。';
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的产品战略顾问，擅长将抽象的未满足需求转化为具体的市场机会。
        
        以下是一些被识别出的未满足需求:
        {unmetNeedsText}
        
        {painPointsText}
        
        请为每个未满足需求提供更具体的分析:
        1. 关键词
        2. 详细描述这个未满足需求
        3. 与用户痛点的关联
        4. 相关趋势的重要性(1-10)
        5. 市场空白具体表现
        6. 潜在价值(1-10)
        7. 目标受众
        8. 2-3个可能的解决方案方向
        
        以JSON数组形式返回结果:
        [
          {{
            "keyword": "关键词",
            "description": "详细描述",
            "painPointRelation": "与痛点关联",
            "trendRelevance": 8,
            "marketGap": "市场空白具体表现",
            "potentialValue": 7,
            "targetAudience": "目标受众",
            "possibleSolutions": ["解决方案1", "解决方案2"]
          }}
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({ 
        unmetNeedsText,
        painPointsText
      });
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for concrete unmet needs', { content });
          return [];
        }
        
        const concreteNeeds = JSON.parse(jsonMatch[0]);
        logger.debug('Generated concrete unmet needs', { count: concreteNeeds.length });
        
        return concreteNeeds;
      } catch (parseError) {
        logger.error('Failed to parse concrete unmet needs JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to generate concrete unmet needs', { error });
      return [];
    }
  }
  
  /**
   * 生成市场洞察
   */
  private async generateMarketInsights(
    unmetNeeds: any[],
    concreteNeeds: any[]
  ): Promise<any[]> {
    try {
      logger.debug('Generating market insights');
      
      // 将数组转换为文本格式
      const unmetNeedsText = unmetNeeds.map(need => `- "${need.keyword}": ${need.reason}`).join('\n');
      
      const concreteNeedsText = concreteNeeds.map(need => `
      - ${need.keyword}: ${need.description}
        目标受众: ${need.targetAudience}
        潜在价值: ${need.potentialValue}/10
      `).join('\n');
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个市场洞察专家，擅长从数据中总结关键市场趋势和机会。
        
        基于以下未满足需求分析，总结3-5个关键市场洞察:
        
        未满足需求:
        {unmetNeedsText}
        
        具体机会:
        {concreteNeedsText}
        
        请提供洞察，每个包含:
        1. 洞察标题
        2. 详细描述
        3. 证据类型(search-data, user-behavior, content-analysis)
        4. 置信度(0-1)
        5. 相关关键词
        
        以JSON数组返回:
        [
          {{
            "title": "洞察标题",
            "description": "详细描述",
            "evidenceType": "content-analysis",
            "confidenceScore": 0.8,
            "relevantKeywords": ["关键词1", "关键词2"]
          }}
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({ 
        unmetNeedsText,
        concreteNeedsText
      });
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for market insights', { content });
          return [];
        }
        
        const insights = JSON.parse(jsonMatch[0]);
        logger.debug('Generated market insights', { count: insights.length });
        
        return insights;
      } catch (parseError) {
        logger.error('Failed to parse market insights JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to generate market insights', { error });
      return [];
    }
  }
  
  /**
   * 计算统计信息
   */
  private calculateStatistics(
    unmetNeeds: any[],
    marketInsights: any[],
    concreteUnmetNeeds: any[]
  ): any {
    // 计算未满足需求的平均内容质量和市场空白严重度
    let totalContentQuality = 0;
    let totalMarketGapSeverity = 0;
    let count = 0;
    
    for (const need of unmetNeeds) {
      if (need.isUnmetNeed) {
        totalContentQuality += need.contentQuality;
        totalMarketGapSeverity += need.marketGapSeverity;
        count++;
      }
    }
    
    return {
      unmetNeedsCount: count,
      insightsCount: marketInsights.length,
      concreteNeedsCount: concreteUnmetNeeds.length,
      averageContentQuality: count > 0 ? totalContentQuality / count : 0,
      averageMarketGapSeverity: count > 0 ? totalMarketGapSeverity / count : 0
    };
  }
  
  /**
   * 执行内容分析的主要逻辑
   * @param state - GraphStateType状态
   * @returns Partial<GraphStateType>，更新后的状态
   */
  public async execute(state: any): Promise<any> {
    try {
      logger.info('ContentAgent execution started');
      
      // 从状态中获取关键词
      const keyword = state.input?.keyword || state.keyword;
      if (!keyword) {
        throw new Error('Missing keyword in state');
      }

      // 获取搜索结果
      const searchResults = await this.getSearchResults(keyword);
      logger.info(`Found ${searchResults.length} search results for keyword: ${keyword}`);

      // 分析搜索结果的内容质量和是否存在未满足需求
      const contentQualityAnalysis = await this.analyzeContentQuality(keyword, searchResults);
      
      // 获取用户旅程中的痛点信息（如果有）
      const painPoints = state.journeySimulation?.painPoints || [];
      
      // 生成具体的未满足需求机会
      const concreteUnmetNeeds = await this.generateConcreteUnmetNeeds([contentQualityAnalysis], painPoints);
      
      // 生成市场洞察
      const marketInsights = await this.generateMarketInsights([contentQualityAnalysis], concreteUnmetNeeds);
      
      // 计算统计信息
      const statistics = this.calculateStatistics(
        [contentQualityAnalysis], 
        marketInsights, 
        concreteUnmetNeeds
      );
      
      // 更新状态
      return {
        contentAnalysis: {
          keyword,
          unmetNeeds: [contentQualityAnalysis],
          marketInsights,
          concreteUnmetNeeds,
          statistics
        }
      };
    } catch (error) {
      logger.error('ContentAgent execution failed', { error });
      throw error;
    }
  }
} 