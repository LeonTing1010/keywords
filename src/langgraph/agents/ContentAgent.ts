/**
 * ContentAgent.ts - 内容分析与未满足需求识别Agent
 */
import { BaseAgent, BaseAgentConfig } from './BaseAgent';
import { GraphStateType } from '../state/schema';
import { BaiduSearchEngine } from '../../infrastructure/search/engines/BaiduSearchEngine';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '../../infrastructure/core/logger';

// 内容分析Agent配置
export interface ContentAgentConfig extends BaseAgentConfig {
  searchEngine?: any;
  maxContentSamples?: number;
  detailedAnalysis?: boolean;
}

/**
 * 内容分析Agent
 * 负责分析搜索结果内容质量和识别未满足的用户需求
 */
export class ContentAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchEngine: any;
  private maxContentSamples: number;
  private detailedAnalysis: boolean;
  
  constructor(config: ContentAgentConfig = {}) {
    super(config);
    
    this.maxContentSamples = config.maxContentSamples || 5;
    this.detailedAnalysis = config.detailedAnalysis !== false;
    this.searchEngine = config.searchEngine || new BaiduSearchEngine();
    
    logger.debug('ContentAgent initialized', { 
      maxContentSamples: this.maxContentSamples,
      detailedAnalysis: this.detailedAnalysis
    });
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // TODO: 实现内容分析相关工具
  }
  
  /**
   * 获取关键词的搜索结果
   */
  private async getSearchResults(keyword: string): Promise<any[]> {
    try {
      logger.debug('Getting search results', { keyword });
      const results = await this.searchEngine.search(keyword);
      return results.slice(0, this.maxContentSamples);
    } catch (error) {
      logger.error('Failed to get search results', { keyword, error });
      return [];
    }
  }
  
  /**
   * 分析内容质量和未满足需求
   */
  private async analyzeContentQuality(
    keyword: string, 
    searchResults: any[]
  ): Promise<any> {
    try {
      logger.debug('Analyzing content quality', { keyword });
      
      // 将搜索结果转换为文本格式
      const resultsText = searchResults.map((result, index) => 
        `结果 ${index + 1}: ${result.title}\n描述: ${result.description}\n链接: ${result.url}\n`
      ).join('\n');
      
      // 修改提示模板，移除对searchResults数组的直接引用
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的内容分析专家，擅长评估搜索结果对特定查询的满足程度。
        
        请分析以下搜索关键词和对应的搜索结果:
        
        关键词: {keyword}
        
        搜索结果:
        {resultsText}
        
        请评估这些搜索结果对用户需求的满足程度，并以JSON格式返回:
        
        {
          "isUnmetNeed": true/false,  // 这是否是一个未被满足的需求?
          "contentQuality": 0.1-1.0,  // 现有内容质量评分(0.1最低，1.0最高)
          "marketGapSeverity": 1-10,  // 市场空白严重程度(1最低，10最高)
          "reason": "详细解释为什么这是/不是未满足需求"
        }
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ 
        keyword, 
        resultsText
      });
      
      // 解析结果
      const content = response.content.toString();
      const jsonMatch = content.match(/\{.*\}/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for content analysis', { content });
        return {
          isUnmetNeed: false,
          contentQuality: 0.5,
          marketGapSeverity: 3,
          reason: "无法解析分析结果"
        };
      }
      
      const result = JSON.parse(jsonMatch[0]);
      logger.debug('Content analysis result', { 
        keyword,
        isUnmetNeed: result.isUnmetNeed,
        contentQuality: result.contentQuality
      });
      
      return {
        keyword,
        ...result
      };
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
          {
            "keyword": "关键词",
            "description": "详细描述",
            "painPointRelation": "与痛点关联",
            "trendRelevance": 8,
            "marketGap": "市场空白具体表现",
            "potentialValue": 7,
            "targetAudience": "目标受众",
            "possibleSolutions": ["解决方案1", "解决方案2"]
          }
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ 
        unmetNeedsText,
        painPointsText
      });
      
      // 解析结果
      const content = response.content.toString();
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for concrete unmet needs', { content });
        return [];
      }
      
      const concreteNeeds = JSON.parse(jsonMatch[0]);
      logger.debug('Generated concrete unmet needs', { count: concreteNeeds.length });
      
      return concreteNeeds;
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
          {
            "title": "洞察标题",
            "description": "详细描述",
            "evidenceType": "content-analysis",
            "confidenceScore": 0.8,
            "relevantKeywords": ["关键词1", "关键词2"]
          }
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ 
        unmetNeedsText,
        concreteNeedsText
      });
      
      // 解析结果
      const content = response.content.toString();
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for market insights', { content });
        return [];
      }
      
      const insights = JSON.parse(jsonMatch[0]);
      logger.debug('Generated market insights', { count: insights.length });
      
      return insights;
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
   * 执行内容分析Agent的主要逻辑
   * @param state - 当前GraphStateType
   * @returns Partial<GraphStateType>，其中contentAnalysis字段严格对齐ContentAnalysisResult类型
   */
  public async execute(state: GraphStateType): Promise<Partial<GraphStateType>> {
    try {
      logger.info('ContentAgent execution started');
      
      // 获取关键词
      let mainKeyword = state.input.keyword;
      let keywords: string[] = [mainKeyword];
      let painPoints: any[] = [];
      
      // 从关键词发现阶段获取更多关键词
      if (state.keywordDiscovery && state.keywordDiscovery.potentialUnmetNeeds) {
        keywords = [
          mainKeyword,
          ...state.keywordDiscovery.potentialUnmetNeeds
            .filter((need: any) => need.confidence > 0.7)
            .map((need: any) => need.keyword as string)
        ].slice(0, 10); // 限制关键词数量
      }
      
      // 获取用户旅程中的痛点
      if (state.journeySimulation && state.journeySimulation.painPoints) {
        painPoints = state.journeySimulation.painPoints as any[];
      }
      
      // 分析每个关键词的内容质量
      const unmetNeeds: any[] = [];
      for (const keyword of keywords) {
        // 获取搜索结果
        const searchResults = await this.getSearchResults(keyword);
        
        // 如果没有搜索结果，跳过此关键词
        if (searchResults.length === 0) {
          logger.warn('No search results for keyword', { keyword });
          continue;
        }
        
        // 分析内容质量和未满足需求
        const analysisResult = await this.analyzeContentQuality(keyword, searchResults);
        unmetNeeds.push(analysisResult);
      }
      
      // 生成具体的未满足需求机会
      const concreteUnmetNeeds: any[] = await this.generateConcreteUnmetNeeds(unmetNeeds, painPoints);
      
      // 生成市场洞察
      const marketInsights: any[] = await this.generateMarketInsights(unmetNeeds, concreteUnmetNeeds);
      
      // 计算统计信息
      const statistics = this.calculateStatistics(unmetNeeds, marketInsights, concreteUnmetNeeds);
      
      // 更新状态
      return {
        contentAnalysis: {
          keyword: mainKeyword,
          unmetNeeds,
          marketInsights,
          concreteUnmetNeeds,
          statistics
        },
        executionMetadata: {
          ...state.executionMetadata,
          completedNodes: [
            ...(state.executionMetadata?.completedNodes || []),
            'contentAnalysis'
          ]
        }
      };
    } catch (error) {
      logger.error('ContentAgent execution failed', { error });
      throw error;
    }
  }
} 