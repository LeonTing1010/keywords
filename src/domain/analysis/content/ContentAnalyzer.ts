import { LLMServiceHub } from '../../../infrastructure/llm/LLMServiceHub';
import { logger } from '../../../infrastructure/core/logger';
import { MarketInsight, ValidationResult, JourneyInsight } from '../types/AnalysisTypes';
import { PainPoint, Opportunity } from '../../journey/UserJourneySim';
import { SearchEngine } from '../../../infrastructure/search/engines/SearchEngine';

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
  marketGapSeverity?: number;
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

interface ExistingSolution {
  keyword: string;
  title: string;
  url: string;
  snippet: string;
}

/**
 * 内容分析器
 * 核心职责：整合前面的发现，找到未被满足的具体需求
 */
export class ContentAnalyzer {
  private llm: LLMServiceHub;
  private jsonLlm: LLMServiceHub; // JSON强制LLM
  private searchEngine?: SearchEngine;

  constructor(llm?: LLMServiceHub, searchEngine?: SearchEngine) {
    this.llm = llm || new LLMServiceHub();
    this.searchEngine = searchEngine;
    
    // 创建一个默认的JSON强制LLM服务，用于需要强制JSON格式的场景
    this.jsonLlm = new LLMServiceHub();
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
   * 抓取市场已有解决方案
   * 使用注入的搜索引擎获取关键词的市场现有内容
   */
  private async fetchExistingSolutions(keywords: string[]): Promise<ExistingSolution[]> {
    // 如果没有注入搜索引擎，返回空数组
    if (!this.searchEngine) {
      logger.warn('未配置搜索引擎，无法获取市场现有解决方案');
      return [];
    }

    try {
      // 确保搜索引擎已初始化
      try {
        // 尝试调用getConfig方法来检查是否已初始化
        // 如果未初始化则会抛出异常
        if (!this.searchEngine.getConfig) {
          logger.info('搜索引擎未初始化，正在初始化');
          await this.searchEngine.initialize();
        }
      } catch (initError) {
        logger.error('搜索引擎初始化失败', { error: initError });
        // 尝试重新初始化
        try {
          await this.searchEngine.initialize();
        } catch (reinitError) {
          logger.error('搜索引擎重新初始化失败', { error: reinitError });
          return []; // 如果无法初始化，就返回空数组
        }
      }
      
      const allResults: ExistingSolution[] = [];
      // 限制关键词数量避免过多请求
      const limitedKeywords = keywords.slice(0, 5);
      
      logger.info(`开始获取 ${limitedKeywords.length} 个关键词的解决方案`);
      
      for (const keyword of limitedKeywords) {
        try {
          logger.info(`正在搜索关键词: ${keyword}`);
          const results = await this.searchEngine.getSearchResults(keyword, { maxResults: 3 });
          logger.info(`搜索关键词结果: ${keyword} 获取到 ${results.length} 条结果`);
          
          for (const r of results) {
            allResults.push({
              keyword,
              title: r.title || '无标题',
              url: r.url || '#',
              snippet: r.snippet || '无内容摘要'
            });
          }
        } catch (e) {
          logger.warn(`获取关键词 "${keyword}" 的解决方案失败`, { error: e });
          // 忽略单个关键词失败，继续处理其他关键词
        }
      }
      
      logger.info(`共获取到 ${allResults.length} 条解决方案`);
      return allResults;
    } catch (error) {
      logger.error('抓取市场已有解决方案失败', { error });
      return [];
    } finally {
      // 不在这里关闭搜索引擎，因为它可能在其他地方还会被使用
      // 搜索引擎的生命周期应该由调用方管理
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
    // 1. 抓取市场已有解决方案
    const existingSolutions = await this.fetchExistingSolutions([mainKeyword]);
  
    // 2. 组装已有方案文本
    const existingSolutionsText = existingSolutions && existingSolutions.length > 0
      ? `市场已有相关解决方案:\n${existingSolutions.map(s =>
          `- [${s.keyword}] ${s.title}：${s.snippet && s.snippet.length > 100 ? s.snippet.substring(0, 100) + '...' : s.snippet}`
        ).join('\n')}`
      : '';
    logger.info('市场已有解决方案', { relatedKeywords: relatedKeywords.length, existingSolutionsText: existingSolutionsText });
    // 提取痛点为字符串，包括严重程度和可能解决方案
    const painPointsText = painPoints && painPoints.length > 0
      ? `用户痛点:\n${painPoints.map(p => {
          let solutions = '无';
          if (Array.isArray(p.possibleSolutions)) {
            solutions = p.possibleSolutions.join(', ');
          } else if (typeof p.possibleSolutions === 'string') {
            solutions = p.possibleSolutions;
          } else if (p.possibleSolutions && typeof p.possibleSolutions === 'object') {
            solutions = JSON.stringify(p.possibleSolutions);
          }
          return `- ${p.description} (严重程度: ${p.severity}, 可能解决方案: ${solutions})`;
        }).join('\n')}`
      : '';
      
    const prompt = `你是一位专业的内容策略分析师。请基于以下信息，深入分析市场未满足的需求，并返回JSON格式的分析结果。

分析背景:
主关键词: ${mainKeyword}
趋势相关关键词: ${relatedKeywords?.join(', ')}

${painPointsText}

${existingSolutionsText}

分析要求:
1. 系统性评估每个关键词对应的市场机会，分析维度包括搜索意图层级、竞争格局、内容质量差距
2. 运用证据识别真正的市场缺口，不仅关注信息缺失，还要分析质量差距、深度不足、视角单一等方面
3. 深入挖掘每个未满足需求背后的用户心理模型和决策路径
4. 引入多层次分析框架，确保洞察的深度、广度和准确性

请返回以下JSON格式的精准未满足需求分析:
{
  "unmetNeeds": [
    {
      "keyword": "关键词",
      "contentQuality": 0-1之间的浮点数, // 现有内容质量评分，1表示质量最高
      "reason": "未满足原因深度分析，包括内容缺口、质量问题、用户真实需求与现有内容的差距",
      "painPointRelevance": 0-1之间的浮点数, // 与用户痛点的关联度
      "marketGapSeverity": 1-5的整数, // 市场缺口严重程度，5表示最严重
      "searchVolume": "高/中/低", // 搜索量评估
      "competitionLevel": "高/中/低", // 竞争程度评估
      "opportunityType": "内容质量/用户痛点/市场空白/趋势机会" // 机会类型
    }
  ]
}

评估标准与方法:
1. 内容质量评分(contentQuality)标准:
   - 评估现有内容的准确性、深度、全面性、实用性和针对性
   - 考虑内容格式是否符合用户习惯和需求场景
   - 分析内容是否提供独特见解或解决方案

2. 未满足原因(reason)分析框架:
   - 识别内容与用户目标间的具体差距
   - 分析现有解决方案的结构性缺陷
   - 明确用户真实需求与内容供给的错位点

3. 评估指标量化标准:
   - searchVolume: 高=月搜索量>10K, 中=1K-10K, 低<1K
   - competitionLevel: 高=主要竞争对手>5, 中=2-5, 低=0-1
   - marketGapSeverity: 基于市场需求量、竞争不足度和解决方案缺口综合评分`;

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
      ? `用户机会点:\n${opportunities.map(o => {
          let implementationIdeasText = '暂无实现想法';
          if (Array.isArray(o.implementationIdeas)) {
            implementationIdeasText = o.implementationIdeas.join(', ');
          } else if (typeof o.implementationIdeas === 'string') {
            implementationIdeasText = o.implementationIdeas;
          } else if (o.implementationIdeas && typeof o.implementationIdeas === 'object') {
            implementationIdeasText = JSON.stringify(o.implementationIdeas);
          }
          return `- ${o.description} (潜力: ${o.potential}, 相关度: ${o.relevance}, 实现想法: ${implementationIdeasText})`;
        }).join('\n')}`
      : '';
    
    // 提取已有洞察为字符串，包含更多属性
    const existingInsightsText = existingInsights && existingInsights.length > 0
      ? `已有市场洞察:\n${existingInsights.map(i => 
          `- ${i.description} (类型: ${i.type}, 趋势: ${i.trend}, 影响: ${i.impact || 'medium'}, 信心度: ${i.confidence || 0.7})`
        ).join('\n')}`  
      : '';
    
    const prompt = `作为市场战略分析专家，整合以下多维度信息，生成系统化的市场洞察:

主关键词: ${mainKeyword}

未满足需求:
${unmetNeeds.map(need => `- ${need.keyword}: ${need.reason} (内容质量: ${need.contentQuality}, 市场缺口: ${need.marketGapSeverity || '未评估'})`).join('\n')}

${opportunitiesText}

${existingInsightsText}

请生成以下JSON格式的战略洞察数组:
{
  "insights": [
    {
      "description": "洞察描述，包含市场趋势、机会缺口和战略意义",
      "type": "trend/opportunity/gap/strategy",
      "trend": "rising/stable/declining",
      "impact": "high/medium/low",
      "confidence": 0-1之间的浮点数,
      "relevance": 0-1之间的浮点数,
      "implementation": "系统化实施建议，包含具体策略与执行路径"
    }
  ]
}

洞察生成要求:
1. 战略思维：每个洞察必须具有明确的战略价值，能够指导决策与行动
2. 数据基础：每个洞察必须基于已有数据点，避免主观臆测
3. 结构化分析：应用PESTLE或Porter's Five Forces等框架确保分析全面性
4. 验证标准：每个洞察需提供可验证的指标或数据支持
5. 前瞻性：洞察应具有预见性，能够预测市场发展方向
6. 业务导向：洞察必须能够转化为具体商业行动和策略

分类标准:
- type分类依据：trend(市场趋势)，opportunity(具体机会)，gap(市场缺口)，strategy(策略指导)
- trend判断标准：需考虑历史数据、现有搜索趋势、市场信号和前沿发展
- impact评估框架：基于市场规模、竞争格局、用户影响范围和业务重要性
- confidence计算：采用证据质量、数量和一致性进行综合评分
- relevance评估：基于与主关键词的直接相关性、对业务目标的贡献度`;

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
    
    const prompt = `分析以下数据并返回JSON格式的具体未满足需求数组:

主关键词: ${mainKeyword}

未满足关键词需求:
${unmetNeedsText}

用户痛点:
${painPointsText}

市场机会:
${opportunitiesText}

市场洞察:
${insightsText}

请返回以下JSON格式的结果:
{
  "concreteNeeds": [
    {
      "keyword": "未满足需求关键词",
      "description": "详细的需求描述",
      "painPointRelation": "与用户痛点的关系",
      "trendRelevance": 0-1之间的浮点数,
      "marketGap": "市场空白和竞争机会描述",
      "potentialValue": 1-5之间的整数,
      "targetAudience": "目标受众描述",
      "solution": "可能的解决方案或内容方向"
    }
  ]
}

注意:
- keyword: 必须是最具价值的未满足需求关键词
- description: 必须提供详细的需求描述
- painPointRelation: 必须说明与用户痛点的关系
- trendRelevance: 必须是0-1之间的浮点数
- marketGap: 必须描述市场空白和竞争机会
- potentialValue: 必须是1-5之间的整数
- targetAudience: 必须明确目标受众
- solution: 必须提供具体的解决方案或内容方向

分析重点:
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

请返回以下JSON格式的验证结果数组:
{
  "validationResults": [
    {
      "aspect": "验证的方面(一致性/商业价值/时效性/可行性/置信度)",
      "score": 0-1之间的浮点数,
      "findings": "具体发现和评估",
      "recommendations": "改进建议",
      "confidence": 0-1之间的浮点数
    }
  ]
}

注意:
- aspect: 必须是"一致性/商业价值/时效性/可行性/置信度"之一
- score: 必须是0-1之间的浮点数
- findings: 必须提供具体的评估发现
- recommendations: 必须提供具体的改进建议
- confidence: 必须是0-1之间的浮点数

评估重点:
1. 各元素之间的内在一致性和相互支持程度
2. 未满足需求的商业价值与实现难度
3. 市场机会的时效性和竞争威胁
4. 实施建议的可行性评估
5. 整体置信度和需要进一步验证的方面`;

    const result = await this.jsonLlm.analyze(prompt, 'comprehensive_validation', {
      format: 'json',
      temperature: 0.3,
      strictFormat: true // 明确指定严格格式模式
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

请返回以下JSON格式的验证结果数组:
{
  "validationResults": [
    {
      "insightType": "trend/opportunity/gap/strategy",
      "description": "验证的洞察描述",
      "consistency": 0-1之间的浮点数,
      "marketFit": 0-1之间的浮点数,
      "feasibility": 0-1之间的浮点数,
      "timeliness": 0-1之间的浮点数,
      "confidence": 0-1之间的浮点数,
      "findings": ["具体发现1", "具体发现2"],
      "recommendations": ["改进建议1", "改进建议2"]
    }
  ]
}

注意:
- insightType: 必须是"trend/opportunity/gap/strategy"之一
- description: 必须是对原洞察的准确描述
- consistency/marketFit/feasibility/timeliness/confidence: 必须是0-1之间的浮点数
- findings: 必须提供具体的评估发现数组
- recommendations: 必须提供具体的改进建议数组

评估重点:
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