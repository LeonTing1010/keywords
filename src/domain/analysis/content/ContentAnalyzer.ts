import { LLMServiceHub } from '../../../infrastructure/llm/LLMServiceHub';
import { logger } from '../../../infrastructure/error/logger';
import { MarketInsight, ValidationResult, JourneyInsight } from '../types/AnalysisTypes';
import { PainPoint, Opportunity } from '../../journey/UserJourneySim';

interface ContentAnalysisResult {
  unmetNeeds: UnmetNeed[];
  insights: MarketInsight[];
  validationResults: ValidationResult[];
  concreteUnmetNeeds: ConcreteUnmetNeed[];
}

interface UnmetNeed {
  keyword: string;
  isUnmetNeed: boolean;
  contentQuality: number;
  reason: string;
}

interface ConcreteUnmetNeed {
  keyword: string;
  description: string;
  painPointRelation: string;
  trendRelevance: number;
  marketGap: string;
  potentialValue: number;
  targetAudience: string;
  possibleSolutions: string[];
}

/**
 * 内容分析器
 * 核心职责：整合前面的发现，找到未被满足的具体需求
 */
export class ContentAnalyzer {
  private llm: LLMServiceHub;

  constructor(llm: LLMServiceHub) {
    this.llm = llm;
  }

  /**
   * 分析内容质量和未满足需求
   * 核心职责实现：整合前面的发现，找到未被满足的具体需求
   * @param mainKeyword 主关键词
   * @param relatedKeywords 相关关键词（优先使用趋势关键词）
   * @param painPoints 可选的用户痛点
   * @param opportunities 可选的机会点
   * @param existingInsights 可选的已有市场洞察
   */
  public async analyzeContent(
    mainKeyword: string,
    relatedKeywords: string[],
    painPoints?: PainPoint[],
    opportunities?: Opportunity[],
    existingInsights?: MarketInsight[]
  ): Promise<ContentAnalysisResult> {
    try {
      logger.info('开始内容分析与未满足需求整合', { 
        mainKeyword,
        keywordCount: relatedKeywords.length,
        painPointsCount: painPoints?.length || 0,
        opportunitiesCount: opportunities?.length || 0,
        existingInsightsCount: existingInsights?.length || 0
      });

      // 1. 分析未满足需求 - 整合痛点和关键词
      const unmetNeeds = await this.analyzeUnmetNeeds(
        mainKeyword, 
        relatedKeywords,
        painPoints
      );
      const validUnmetNeeds = unmetNeeds || [];
      logger.debug('未满足需求分析完成', { count: validUnmetNeeds.length });

      // 2. 获取市场洞察 - 整合机会点和已有洞察
      const insights = await this.getMarketInsights(
        mainKeyword, 
        validUnmetNeeds, 
        opportunities,
        existingInsights
      );
      const validInsights = insights || [];
      logger.debug('市场洞察分析完成', { count: validInsights.length });

      // 3. 新增：识别具体的未满足需求 - 整合前面所有发现
      const concreteUnmetNeeds = await this.identifyConcreteUnmetNeeds(
        mainKeyword,
        validUnmetNeeds,
        painPoints || [],
        opportunities || [],
        validInsights
      );
      logger.debug('具体未满足需求识别完成', { count: concreteUnmetNeeds.length });

      // 4. 验证分析结果
      const validationResults = await this.validateFindings(
        mainKeyword, 
        validUnmetNeeds, 
        validInsights,
        concreteUnmetNeeds
      );
      const validValidationResults = validationResults || [];
      logger.debug('验证分析完成', { count: validValidationResults.length });

      return {
        unmetNeeds: validUnmetNeeds,
        insights: validInsights,
        validationResults: validValidationResults,
        concreteUnmetNeeds: concreteUnmetNeeds
      };

    } catch (error) {
      logger.error('内容分析失败', { error });
      throw error;
    }
  }

  /**
   * 分析未满足需求
   * 整合用户痛点和趋势关键词寻找未满足需求
   */
  private async analyzeUnmetNeeds(
    mainKeyword: string,
    relatedKeywords: string[],
    painPoints?: PainPoint[]
  ): Promise<UnmetNeed[]> {
    // 提取痛点为字符串，包括严重程度和可能解决方案
    const painPointsText = painPoints && painPoints.length > 0
      ? `用户痛点:\n${painPoints.map(p => 
          `- ${p.description} (严重程度: ${p.severity}, 可能解决方案: ${p.possibleSolutions.join(', ')})`
        ).join('\n')}`
      : '';
      
    // 重点关注趋势关键词和痛点的关系
    const prompt = `整合分析以下关键词和用户痛点，识别未满足的用户需求:
主关键词: ${mainKeyword}

趋势相关关键词:
${relatedKeywords.join('\n')}

${painPointsText}

请深入分析关键词与痛点的关系:
1. 识别哪些关键词代表未满足的需求
2. 对应内容质量评分(0-1)
3. 未满足原因深度分析
4. 关键词与用户痛点的关联程度
5. 潜在市场空白的严重程度

重点关注以下情况:
- 高搜索量但内容质量低的关键词
- 与用户痛点高度相关的关键词需求
- 竞争不充分但需求明确的领域
- 趋势关键词与痛点交叉的机会点`;

    const result = await this.llm.analyze(prompt, 'integrated_unmet_needs_analysis', {
      format: 'json',
      temperature: 0.3
    });

    return result?.unmetNeeds || [];
  }

  /**
   * 获取市场洞察
   * 整合机会点和已有洞察生成更全面的市场洞察
   */
  private async getMarketInsights(
    mainKeyword: string, 
    unmetNeeds: UnmetNeed[],
    opportunities?: Opportunity[],
    existingInsights?: MarketInsight[]
  ): Promise<MarketInsight[]> {
    // 提取机会点为字符串，包含实现想法 
    const opportunitiesText = opportunities && opportunities.length > 0 
      ? `用户机会点:\n${opportunities.map(o => 
          `- ${o.description} (潜力: ${o.potential}, 相关度: ${o.relevance}, 实现想法: ${o.implementationIdeas.join(', ')})`
        ).join('\n')}`
      : '';
    
    // 提取已有洞察为字符串，包含更多属性
    const existingInsightsText = existingInsights && existingInsights.length > 0
      ? `已有市场洞察:\n${existingInsights.map(i => 
          `- ${i.description} (类型: ${i.type}, 趋势: ${i.trend}, 影响: ${i.impact || 'medium'}, 信心度: ${i.confidence || 0.7})`
        ).join('\n')}`  
      : '';
    
    // 强化未满足需求与机会点的联系
    const prompt = `整合分析以下信息，生成全面的市场洞察:
主关键词: ${mainKeyword}

未满足需求:
${unmetNeeds.map(need => `- ${need.keyword}: ${need.reason} (内容质量: ${need.contentQuality})`).join('\n')}

${opportunitiesText}

${existingInsightsText}

请基于未满足需求与机会点的交叉分析，提供:
1. 关键市场趋势与用户需求的关联性
2. 竞争差距分析与具体市场空白
3. 用户需求与趋势的演变轨迹
4. 潜在机会的价值评估与时机判断
5. 基于未满足需求的内容策略建议
6. 目标受众细分与精准定位`;

    const result = await this.llm.analyze(prompt, 'integrated_market_insights', {
      format: 'json',
      temperature: 0.4
    });

    // 如果有已有洞察，合并并去重，保留高价值洞察
    let combinedInsights = result?.insights || [];
    
    if (existingInsights && existingInsights.length > 0) {
      // 建立查重集
      const existingDescriptions = new Set(
        combinedInsights.map((insight: MarketInsight) => insight.description)
      );
      
      // 合并不重复的洞察，但优先保留高影响力和高信心度的洞察
      for (const insight of existingInsights) {
        // 如果是高价值洞察(high impact或confidence > 0.8)或是不重复的洞察
        if ((insight.impact === 'high' || insight.confidence > 0.8) || 
            !existingDescriptions.has(insight.description)) {
          combinedInsights.push(insight);
          existingDescriptions.add(insight.description);
        }
      }
      
      // 按信心度和影响力排序
      combinedInsights = combinedInsights.sort((a: MarketInsight, b: MarketInsight) => {
        const impactValue = { high: 3, medium: 2, low: 1 };
        const aImpact = impactValue[a.impact as keyof typeof impactValue] || 2;
        const bImpact = impactValue[b.impact as keyof typeof impactValue] || 2;
        
        // 优先考虑影响力，其次是信心度
        return (bImpact * 2 + b.confidence) - (aImpact * 2 + a.confidence);
      });
    }

    return combinedInsights;
  }

  /**
   * 新增：识别具体的未满足需求
   * 核心职责方法：整合所有发现，确定具体的未满足需求
   */
  private async identifyConcreteUnmetNeeds(
    mainKeyword: string,
    unmetNeeds: UnmetNeed[],
    painPoints: PainPoint[],
    opportunities: Opportunity[],
    marketInsights: MarketInsight[]
  ): Promise<ConcreteUnmetNeed[]> {
    // 如果没有足够的数据，返回空数组
    if (unmetNeeds.length === 0 && painPoints.length === 0) {
      return [];
    }
    
    // 提取关键信息转为文本
    const unmetNeedsText = unmetNeeds.map(need => 
      `- ${need.keyword}: ${need.reason} (内容质量: ${need.contentQuality})`
    ).join('\n');
    
    const painPointsText = painPoints.map(point => 
      `- ${point.description} (严重程度: ${point.severity})`
    ).join('\n');
    
    const opportunitiesText = opportunities.map(opp => 
      `- ${opp.description} (潜力: ${opp.potential}, 相关度: ${opp.relevance})`
    ).join('\n');
    
    const insightsText = marketInsights.slice(0, 5).map(insight => 
      `- ${insight.description} (${insight.type}, 趋势: ${insight.trend})`
    ).join('\n');
    
    // 整合分析用于识别具体未满足需求的提示
    const prompt = `整合以下所有分析结果，识别具体的未满足用户需求:
主关键词: ${mainKeyword}

未满足关键词需求:
${unmetNeedsText}

用户痛点:
${painPointsText}

市场机会:
${opportunitiesText}

市场洞察:
${insightsText}

请通过痛点、趋势和机会的交叉分析，确定具体的未满足需求:
1. 识别最具价值的未满足需求关键词
2. 提供详细的需求描述
3. 分析需求与用户痛点的关系
4. 评估需求与市场趋势的相关度(0-1)
5. 明确市场空白和竞争机会
6. 评估潜在价值(1-5)
7. 确定目标受众
8. 提供可能的解决方案或内容方向

重点聚焦:
- 高价值痛点与趋势关键词的交叉点
- 竞争不充分但搜索意图明确的领域
- 有明确实现路径的机会
- 具有差异化优势的市场空白`;

    const result = await this.llm.analyze(prompt, 'concrete_unmet_needs', {
      format: 'json',
      temperature: 0.3
    });

    return result?.concreteNeeds || [];
  }

  /**
   * 验证发现结果
   * 扩展验证范围，包括具体未满足需求
   */
  private async validateFindings(
    mainKeyword: string,
    unmetNeeds: UnmetNeed[],
    insights: MarketInsight[],
    concreteNeeds?: ConcreteUnmetNeed[]
  ): Promise<ValidationResult[]> {
    // 添加具体未满足需求的验证
    const concreteNeedsText = concreteNeeds && concreteNeeds.length > 0
      ? `具体未满足需求:\n${concreteNeeds.map(need => 
          `- ${need.keyword}: ${need.description} (目标受众: ${need.targetAudience}, 潜在价值: ${need.potentialValue})`
        ).join('\n')}`
      : '';
      
    const prompt = `验证以下关键词、未满足需求和市场洞察的相关性和价值:
主关键词: ${mainKeyword}

未满足需求:
${unmetNeeds.map(need => `- ${need.keyword}: ${need.reason}`).join('\n')}

市场洞察:
${insights.map(insight => `- ${insight.type}: ${insight.description}`).join('\n')}

${concreteNeedsText}

请全面评估:
1. 各元素之间的内在一致性和相互支持程度
2. 未满足需求的商业价值与实现难度
3. 市场机会的时效性和竞争威胁
4. 实施建议的可行性评估
5. 整体置信度和需要进一步验证的方面`;

    const result = await this.llm.analyze(prompt, 'comprehensive_validation', {
      format: 'json',
      temperature: 0.3
    });

    return result?.validationResults || [];
  }

  /**
   * 获取未满足需求
   * 专门用于外部调用的辅助方法
   */
  public async getUnmetNeeds(
    mainKeyword: string,
    marketInsights: MarketInsight[],
    userJourneys: any[]
  ): Promise<UnmetNeed[]> {
    try {
      // 提取旅程痛点
      const painPoints = userJourneys.flatMap(journey => journey.painPoints || []);
      
      // 提取关键词（从旅程步骤中）
      const relatedKeywords = userJourneys.flatMap(journey => 
        journey.steps?.map((step: any) => step.query) || []
      );
      
      // 分析未满足需求
      return this.analyzeUnmetNeeds(
        mainKeyword,
        relatedKeywords,
        painPoints
      );
    } catch (error) {
      logger.warn('获取未满足需求失败', { error });
      return [];
    }
  }

  /**
   * 验证市场洞察
   */
  public async validateInsights(
    mainKeyword: string,
    marketInsights: MarketInsight[]
  ): Promise<ValidationResult[]> {
    try {
      const prompt = `验证以下市场洞察的准确性和价值:
主关键词: ${mainKeyword}

市场洞察:
${marketInsights.map(insight => `- ${insight.type}: ${insight.description}`).join('\n')}

请评估:
1. 洞察的内在一致性
2. 洞察的市场适用性
3. 可行性和时效性
4. 整体置信度`;

      const result = await this.llm.analyze(prompt, 'insights_validation', {
        format: 'json',
        temperature: 0.3
      });

      return result?.validationResults || [];
    } catch (error) {
      logger.warn('验证市场洞察失败', { error });
      return [];
    }
  }
} 