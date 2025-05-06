import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { SearchEngine } from '../../infrastructure/search/engines/SearchEngine';
import { logger } from '../../infrastructure/error/logger';
import { AutocompleteSuggestion } from '../../infrastructure/search/types';
import { MarketInsight } from '../analysis/types/AnalysisTypes';

export interface KeywordDiscoveryResult {
  keywords: string[];
  unmetNeeds: UnmetNeed[];
  analysis: {
    categories: Record<string, string[]>;
    patterns: string[];
    insights: string[];
  };
  initialInsights: MarketInsight[];
  trendKeywords: string[];
  directionSummary: string;
}

export interface UnmetNeed {
  keyword: string;
  isUnmetNeed: boolean;
  contentQuality: number;
  reason: string;
}

export interface KeywordDiscoveryConfig {
  llmService: LLMServiceHub;
  searchEngine: SearchEngine;
}

// 关键词精细化选项
export interface RefinementOptions {
  themes?: string[];
  excludeExisting?: string[];
  maxKeywords?: number;
}

// 趋势分析结果接口
export interface TrendAnalysisResult {
  trendingKeywords: string[];
  growthPatterns: string[];
  emergingTopics: string[];
  directionSummary: string;
}

/**
 * 简单关键词发现器
 * 通过搜索引擎自动补全和LLM分析发现相关关键词
 * 核心职责：挖掘趋势关键词，发现市场大方向
 */
export class SimpleKeywordDiscovery {
  private llm: LLMServiceHub;
  private searchEngine: SearchEngine;

  constructor(config: KeywordDiscoveryConfig) {
    this.llm = config.llmService;
    this.searchEngine = config.searchEngine;
  }

  /**
   * 发现相关关键词
   * @param mainKeyword 主关键词
   * @param options 精细化选项（可选）
   */
  public async discoverKeywords(
    mainKeyword: string, 
    options?: RefinementOptions
  ): Promise<KeywordDiscoveryResult> {
    try {
      logger.info('开始关键词发现', { mainKeyword });

      // 1. 获取搜索引擎自动补全
      const autoCompleteResults = await this.searchEngine.getSuggestions(mainKeyword);
      logger.debug('获取自动补全结果', { count: autoCompleteResults.length });
      
      // 提取查询关键词数组
      const keywordQueries = autoCompleteResults.map(result => result.query);
      
      // 2. 使用LLM分析关键词
      const analyzedKeywords = await this.analyzeKeywords(mainKeyword, keywordQueries);
      logger.debug('关键词分析完成', { count: analyzedKeywords.keywords.length });

      // 3. 识别未满足需求
      const unmetNeeds = await this.identifyUnmetNeeds(analyzedKeywords.keywords);
      const validUnmetNeeds = unmetNeeds || [];
      logger.debug('未满足需求识别完成', { count: validUnmetNeeds.length });

      // 4. 分析关键词模式
      const patterns = await this.analyzePatterns(analyzedKeywords.keywords);
      logger.debug('模式分析完成', { count: (patterns?.patterns?.length || 0) });

      // 5. 核心职责：分析趋势关键词
      const trendAnalysis = await this.analyzeTrendKeywords(
        mainKeyword,
        analyzedKeywords.keywords,
        autoCompleteResults
      );
      logger.debug('趋势关键词分析完成', { 
        trendingCount: trendAnalysis.trendingKeywords.length,
        emergingTopicsCount: trendAnalysis.emergingTopics.length 
      });

      // 6. 核心职责：发现市场趋势和大方向
      const marketInsights = await this.discoverMarketDirections(
        mainKeyword,
        analyzedKeywords.keywords,
        patterns?.insights || [],
        trendAnalysis
      );
      logger.debug('市场方向发现完成', { count: marketInsights.length });

      // 7. 如果有精细化选项，执行关键词精细化
      let refinedKeywords = analyzedKeywords.keywords;
      if (options?.themes && options.themes.length > 0) {
        const themeRefinedKeywords = await this.refineKeywordsByThemes(
          mainKeyword,
          options.themes,
          options.excludeExisting || []
        );
        
        // 合并并去重
        refinedKeywords = [...new Set([...refinedKeywords, ...themeRefinedKeywords])];
        logger.debug('主题精细化完成', { 
          additionalKeywords: themeRefinedKeywords.length,
          totalKeywords: refinedKeywords.length 
        });
      }

      return {
        keywords: refinedKeywords,
        unmetNeeds: validUnmetNeeds,
        analysis: {
          categories: analyzedKeywords.categories,
          patterns: patterns?.patterns || [],
          insights: patterns?.insights || []
        },
        initialInsights: marketInsights,
        trendKeywords: trendAnalysis.trendingKeywords,
        directionSummary: trendAnalysis.directionSummary
      };

    } catch (error) {
      logger.error('关键词发现失败', { error });
      throw error;
    }
  }

  /**
   * 核心职责方法：分析趋势关键词
   * 识别当前正在上升的趋势关键词
   */
  private async analyzeTrendKeywords(
    mainKeyword: string,
    keywords: string[],
    autocompleteResults: AutocompleteSuggestion[]
  ): Promise<TrendAnalysisResult> {
    try {
      // 提取排名信息
      const rankData = autocompleteResults
        .map((result, index) => `${index + 1}. ${result.query}`)
        .join('\n');

      const trendPrompt = `分析以下主关键词和自动补全建议，识别趋势关键词和市场方向:
主关键词: "${mainKeyword}"

自动补全建议及其排名:
${rankData}

相关关键词:
${keywords.slice(0, 20).join('\n')}

请深入分析:
1. 识别正在上升的趋势关键词（基于位置、修饰词和意图）
2. 发现新兴话题和用户关注点
3. 总结市场整体发展方向
4. 提取关键词中隐含的增长模式

分析时考虑:
- 自动补全排名位置（靠前的可能是当前趋势）
- 修饰词特征（"最新"、"2024"等时间性词语可能代表趋势）
- 查询意图转变（从信息到交易的转变可能代表市场成熟）
- 词语组合新模式`;

      const result = await this.llm.analyze(trendPrompt, 'trend_keyword_analysis', {
        format: 'json',
        temperature: 0.4
      });

      // 确保返回有效结果
      return {
        trendingKeywords: result?.trendingKeywords || [],
        growthPatterns: result?.growthPatterns || [],
        emergingTopics: result?.emergingTopics || [],
        directionSummary: result?.directionSummary || "无法确定市场方向"
      };
    } catch (error) {
      logger.warn('趋势关键词分析失败', { error });
      return {
        trendingKeywords: [],
        growthPatterns: [],
        emergingTopics: [],
        directionSummary: "分析过程发生错误"
      };
    }
  }

  /**
   * 根据主题精细化关键词
   * 基于特定主题定向发现更多相关关键词
   */
  private async refineKeywordsByThemes(
    mainKeyword: string,
    themes: string[],
    excludeKeywords: string[] = [],
    maxKeywords: number = 20
  ): Promise<string[]> {
    try {
      logger.debug('开始主题精细化关键词', { mainKeyword, themes });
      
      const themePrompt = `基于主关键词 "${mainKeyword}" 和以下主题，生成更多相关的搜索关键词：
主题：
${themes.join('\n')}

请考虑：
1. 主题相关度
2. 搜索意图匹配
3. 市场趋势契合度
4. 避免提供这些已知关键词:
${excludeKeywords.join('\n')}`;

      const result = await this.llm.analyze(themePrompt, 'theme_based_discovery', {
        format: 'json',
        temperature: 0.5
      });

      const refinedKeywords = result?.keywords || [];
      return refinedKeywords.slice(0, maxKeywords);
    } catch (error) {
      logger.warn('主题精细化关键词失败', { error });
      return [];
    }
  }

  /**
   * 发现市场趋势和大方向
   * 核心职责实现：提供市场大方向的洞察
   */
  private async discoverMarketDirections(
    mainKeyword: string,
    relatedKeywords: string[],
    patternInsights: string[],
    trendAnalysis: TrendAnalysisResult
  ): Promise<MarketInsight[]> {
    try {
      // 增强市场方向分析，结合趋势关键词分析结果
      const trendingKeywordsText = trendAnalysis.trendingKeywords.length > 0
        ? `趋势关键词:\n${trendAnalysis.trendingKeywords.join('\n')}`
        : '';
        
      const emergingTopicsText = trendAnalysis.emergingTopics.length > 0
        ? `新兴话题:\n${trendAnalysis.emergingTopics.join('\n')}`
        : '';
        
      const growthPatternsText = trendAnalysis.growthPatterns.length > 0
        ? `增长模式:\n${trendAnalysis.growthPatterns.join('\n')}`
        : '';

      const directionsPrompt = `基于以下数据，深入分析市场趋势和大方向：
主关键词: "${mainKeyword}"

相关关键词:
${relatedKeywords.slice(0, 15).join('\n')}

关键词模式洞察:
${patternInsights.join('\n')}

${trendingKeywordsText}

${emergingTopicsText}

${growthPatternsText}

市场方向概要:
${trendAnalysis.directionSummary}

请提供全面的市场分析:
1. 主要市场趋势及其强度
2. 用户关注的大方向变化
3. 潜在的市场机会及其时机
4. 关键词背后的用户意图演变
5. 市场成熟度和竞争状况评估`;

      const result = await this.llm.analyze(directionsPrompt, 'enhanced_market_direction_analysis', {
        format: 'json',
        temperature: 0.4
      });

      // 提取并格式化市场洞察，增加洞察类型多样性
      const insights = (result?.marketInsights || []).map((insight: any) => ({
        type: insight.type || 'trend',
        description: insight.description,
        confidence: insight.confidence || 0.7,
        trend: insight.trend || 'rising',
        impact: insight.impact || 'medium'
      }));
      
      // 补充大方向汇总洞察
      if (trendAnalysis.directionSummary && insights.length > 0) {
        insights.unshift({
          type: 'direction',
          description: trendAnalysis.directionSummary,
          confidence: 0.85,
          trend: 'defining',
          impact: 'high'
        });
      }

      return insights;
    } catch (error) {
      logger.warn('市场方向分析失败', { error });
      return [];
    }
  }

  /**
   * 分析关键词
   */
  private async analyzeKeywords(
    mainKeyword: string,
    relatedKeywords: string[]
  ): Promise<{
    keywords: string[];
    categories: Record<string, string[]>;
  }> {
    const prompt = `分析以下关键词组合:
主关键词: ${mainKeyword}
相关关键词:
${relatedKeywords.join('\n')}

请:
1. 过滤掉不相关的关键词
2. 对关键词进行分类
3. 识别主要的用户意图类别`;

    const result = await this.llm.analyze(prompt, 'keyword_analysis', {
      format: 'json',
      temperature: 0.3
    });

    return {
      keywords: result.relevantKeywords,
      categories: result.categories
    };
  }

  /**
   * 识别未满足需求
   */
  private async identifyUnmetNeeds(keywords: string[]): Promise<UnmetNeed[]> {
    const prompt = `分析以下关键词，识别可能代表未满足需求的关键词:
${keywords.join('\n')}

请考虑:
1. 搜索意图与现有解决方案的匹配度
2. 用户痛点的解决程度
3. 市场空白的可能性`;

    const result = await this.llm.analyze(prompt, 'unmet_needs', {
      format: 'json',
      temperature: 0.4
    });

    return result.unmetNeeds;
  }

  /**
   * 分析关键词模式
   */
  private async analyzePatterns(
    keywords: string[]
  ): Promise<{
    patterns: string[];
    insights: string[];
  }> {
    const prompt = `分析以下关键词集合中的模式:
${keywords.join('\n')}

请识别:
1. 重复出现的词语组合
2. 常见的修饰词
3. 用户意图指示词
4. 潜在的市场趋势`;

    const result = await this.llm.analyze(prompt, 'pattern_analysis', {
      format: 'json',
      temperature: 0.4
    });

    return {
      patterns: result.patterns,
      insights: result.insights
    };
  }
} 