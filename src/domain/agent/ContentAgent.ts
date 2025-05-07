/**
 * ContentAgent - 内容分析Agent
 * 负责评估内容质量和识别未满足需求
 */
import { Agent, AgentConfig, AgentTask } from '../../infrastructure/agent/Agent';
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { logger } from '../../infrastructure/core/logger';
import { EnhancedUserJourney, PainPoint, Opportunity } from './JourneyAgent';

interface ContentAgentConfig extends AgentConfig {
  llm?: LLMServiceHub;
}

export interface UnmetNeed {
  keyword: string;
  isUnmetNeed: boolean;
  contentQuality: number;
  reason: string;
  marketGapSeverity?: number;
}

export interface MarketInsight {
  title: string;
  description: string;
  evidenceType: 'search-data' | 'user-behavior' | 'content-analysis';
  confidenceScore: number;
  relevantKeywords: string[];
}

export interface ConcreteUnmetNeed {
  keyword: string;
  description: string;
  painPointRelation: string;
  trendRelevance: number;
  marketGap: string;
  potentialValue: number;
  targetAudience: string;
  possibleSolutions: string[];
}

export class ContentAgent extends Agent {
  private llm: LLMServiceHub;
  
  constructor(config: ContentAgentConfig) {
    super({
      id: config.id,
      name: config.name || '内容分析Agent',
      description: config.description || '负责评估内容质量和识别未满足需求',
      verbose: config.verbose,
      maxRetries: config.maxRetries
    });
    
    this.llm = config.llm || new LLMServiceHub();
  }
  
  /**
   * 执行内容分析任务
   */
  public async execute(task: AgentTask): Promise<any> {
    logger.info(`ContentAgent 开始执行任务: ${task.task}`, { data: task.data });
    
    try {
      switch (task.task) {
        case 'analyzeContent':
          return await this.analyzeContent(
            task.data.keyword,
            task.data.discoveredKeywords,
            task.data.journeyResult
          );
          
        case 'evaluateSearchResults':
          return await this.evaluateSearchResults(task.data.keyword);
          
        default:
          throw new Error(`未知任务类型: ${task.task}`);
      }
    } catch (error) {
      logger.error(`ContentAgent 执行任务失败: ${task.task}`, { error });
      throw error;
    }
  }
  
  /**
   * 分析内容质量和未满足需求
   */
  private async analyzeContent(
    keyword: string,
    discoveredKeywords: string[],
    journeyResult: EnhancedUserJourney
  ): Promise<any> {
    logger.info('开始内容分析', { 
      keyword, 
      keywordCount: discoveredKeywords.length,
      journeySteps: journeyResult?.steps?.length || 0
    });
    
    try {
      // 1. 获取搜索结果内容
      const searchResultsTool = this.getTool('searchResults');
      const searchResults = await searchResultsTool.execute({ keyword, maxResults: 5 });
      
      if (!searchResults.success) {
        throw new Error(`获取搜索结果失败: ${searchResults.error}`);
      }
      
      const results = searchResults.data.results || [];
      const resultsText = results
        .map(r => `- 标题: ${r.title}\n  摘要: ${r.snippet}\n  URL: ${r.url}`)
        .join('\n\n');
      
      // 2. 分析未满足需求
      const unmetNeeds = await this.analyzeUnmetNeeds(
        keyword, 
        discoveredKeywords,
        journeyResult.painPoints,
        resultsText
      );
      
      // 3. 获取市场洞察
      const insights = await this.getMarketInsights(
        keyword,
        unmetNeeds,
        journeyResult.opportunities,
        discoveredKeywords
      );
      
      // 4. 识别具体的未满足需求
      const concreteUnmetNeeds = await this.identifyConcreteUnmetNeeds(
        keyword,
        unmetNeeds,
        journeyResult.painPoints,
        journeyResult.opportunities,
        insights
      );
      
      logger.info('内容分析完成', { 
        unmetNeedsCount: unmetNeeds.length,
        insightsCount: insights.length,
        concreteUnmetNeedsCount: concreteUnmetNeeds.length
      });
      
      return {
        keyword,
        unmetNeeds,
        insights,
        concreteUnmetNeeds
      };
      
    } catch (error) {
      logger.error('内容分析失败', { error, keyword });
      throw error;
    }
  }
  
  /**
   * 分析未满足需求
   */
  private async analyzeUnmetNeeds(
    keyword: string,
    discoveredKeywords: string[],
    painPoints: PainPoint[],
    searchResultsText: string
  ): Promise<UnmetNeed[]> {
    // 使用LLM分析未满足需求
    const analysisPrompt = `分析以下搜索关键词"${keyword}"的相关信息，识别未满足的用户需求:

相关关键词:
${discoveredKeywords.slice(0, 10).map(k => `- ${k}`).join('\n')}

搜索结果:
${searchResultsText}

用户痛点:
${painPoints ? painPoints.map(p => `- ${p.description} (严重程度: ${p.severity})`).join('\n') : '无'}

请识别哪些关键词代表着未被满足的用户需求，评估内容质量，并解释原因。对于每个关键词，返回:
1. 关键词本身
2. 是否代表未满足需求(true/false)
3. 相关内容质量分数(0-1)
4. 详细原因分析
5. 市场空白严重程度(1-10)
`;

    const analysis = await this.llm.analyze(analysisPrompt, 'unmet_needs_analysis', {
      temperature: 0.4,
      format: 'json'
    });
    
    return analysis.unmetNeeds || [];
  }
  
  /**
   * 获取市场洞察
   */
  private async getMarketInsights(
    keyword: string,
    unmetNeeds: UnmetNeed[],
    opportunities: Opportunity[],
    discoveredKeywords: string[]
  ): Promise<MarketInsight[]> {
    // 使用LLM获取市场洞察
    const insightsPrompt = `基于以下分析结果，提供关于"${keyword}"市场的深度洞察:

未满足需求:
${unmetNeeds.map(n => `- ${n.keyword} (质量: ${n.contentQuality}, 原因: ${n.reason})`).join('\n')}

市场机会:
${opportunities ? opportunities.map(o => `- ${o.description} (价值: ${o.potentialValue}, 受众: ${o.targetAudience})`).join('\n') : '无'}

请提供3-5个市场洞察，包括:
1. 洞察标题
2. 详细描述
3. 证据类型(搜索数据/用户行为/内容分析)
4. 置信度(0-1)
5. 相关关键词
`;

    const insights = await this.llm.analyze(insightsPrompt, 'market_insights', {
      temperature: 0.5,
      format: 'json'
    });
    
    return insights.marketInsights || [];
  }
  
  /**
   * 识别具体未满足需求
   */
  private async identifyConcreteUnmetNeeds(
    keyword: string,
    unmetNeeds: UnmetNeed[],
    painPoints: PainPoint[],
    opportunities: Opportunity[],
    marketInsights: MarketInsight[]
  ): Promise<ConcreteUnmetNeed[]> {
    // 使用LLM识别具体的未满足需求
    const concreteNeedsPrompt = `整合以下分析结果，识别关于"${keyword}"的具体未满足需求:

未满足需求:
${unmetNeeds.map(n => `- ${n.keyword} (质量: ${n.contentQuality}, 原因: ${n.reason})`).join('\n')}

用户痛点:
${painPoints ? painPoints.map(p => `- ${p.description} (严重程度: ${p.severity})`).join('\n') : '无'}

市场机会:
${opportunities ? opportunities.map(o => `- ${o.description} (价值: ${o.potentialValue})`).join('\n') : '无'}

市场洞察:
${marketInsights.map(i => `- ${i.title}: ${i.description}`).join('\n')}

请识别2-4个具体的未满足需求，包括:
1. 关键词
2. 需求描述
3. 与用户痛点的关系
4. 趋势相关性(1-10)
5. 市场空白描述
6. 潜在价值(1-10)
7. 目标受众
8. 2-3个可能的解决方案
`;

    const concreteNeeds = await this.llm.analyze(concreteNeedsPrompt, 'concrete_unmet_needs', {
      temperature: 0.5,
      format: 'json'
    });
    
    return concreteNeeds.concreteUnmetNeeds || [];
  }
  
  /**
   * 评估搜索结果
   */
  private async evaluateSearchResults(keyword: string): Promise<any> {
    // 实现搜索结果评估逻辑
    return {
      keyword,
      contentQuality: 0.7,
      insights: []
    };
  }
} 