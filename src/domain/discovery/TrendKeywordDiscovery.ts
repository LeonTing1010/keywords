import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { SearchEngine } from '../../infrastructure/search/engines/SearchEngine';
import { logger } from '../../infrastructure/core/logger';
import { AutocompleteSuggestion } from '../../infrastructure/search/types';
import { MarketInsight } from '../analysis/types/AnalysisTypes';

export interface KeywordDiscoveryResult {
  keywords: string[];
  analysis: {
    categories: Record<string, string[]>;
    patterns: string[];
    insights: string[];
  };
  initialInsights: MarketInsight[];
  trendKeywords: string[]; // 趋势关键词
  directionSummary: string; // 市场大方向总结
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
 * 趋势关键词与市场方向发现器
 * 通过搜索引擎自动补全和LLM分析发现趋势关键词和市场大方向
 * 核心职责：挖掘趋势关键词，发现市场大方向
 */
export class TrendKeywordDiscovery {
  private llm: LLMServiceHub;
  private searchEngine: SearchEngine;

  constructor(config: KeywordDiscoveryConfig) {
    this.llm = config.llmService;
    this.searchEngine = config.searchEngine;
  }

  /**
   * 发现趋势关键词和市场方向
   * @param mainKeyword 主关键词
   * @param options 精细化选项（可选）
   */
  public async discoverKeywords(
    mainKeyword: string, 
    options?: RefinementOptions
  ): Promise<KeywordDiscoveryResult> {
    try {
      logger.info('开始趋势关键词和市场方向分析', { mainKeyword });

      // 1. 获取搜索引擎自动补全
      // Generate autocomplete suggestions by appending a-z letters to main keyword
      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
      // Process letters sequentially
      const autoCompleteResults = [];
      for (const letter of letters) {
        const result = await this.searchEngine.getSuggestions(`${mainKeyword} ${letter}`);
        autoCompleteResults.push(...result);
      }
      logger.debug('获取自动补全结果', { count: autoCompleteResults.length });
      
      // 提取查询关键词数组
      const keywordQueries = autoCompleteResults.map(result => result.query);
      
      // 2. 使用LLM分析关键词
      const analyzedKeywords = await this.analyzeKeywords(mainKeyword, keywordQueries);
      
      // 添加防御性检查，确保分析结果和keywords属性都存在
      if (!analyzedKeywords || !analyzedKeywords.keywords) {
        logger.warn('LLM分析未返回有效的关键词数据，使用原始查询作为备用', { 
          mainKeyword,
          keywordQueries: keywordQueries.length
        });
        
        // 创建一个备用的分析结果
        const fallbackKeywords = keywordQueries.filter(
          q => q.toLowerCase().includes(mainKeyword.toLowerCase())
        );
        
        return {
          keywords: fallbackKeywords,
          analysis: {
            categories: { '未分类': fallbackKeywords },
            patterns: [],
            insights: []
          },
          initialInsights: [],
          trendKeywords: [],
          directionSummary: "分析失败，无法确定市场方向"
        };
      }
      
      logger.debug('关键词分析完成', { count: analyzedKeywords.keywords.length });

      // 3. 分析关键词模式 - 添加防御性检查
      const patterns = await this.analyzePatterns(analyzedKeywords.keywords || []);
      logger.debug('模式分析完成', { count: (patterns?.patterns?.length || 0) });

      // 4. 核心职责：分析趋势关键词 - 添加防御性检查
      const trendAnalysis = await this.analyzeTrendKeywords(
        mainKeyword,
        analyzedKeywords.keywords || [],
        autoCompleteResults
      );
      logger.debug('趋势关键词分析完成', { 
        trendingCount: trendAnalysis?.trendingKeywords?.length || 0,
        emergingTopicsCount: trendAnalysis?.emergingTopics?.length || 0
      });

      // 5. 核心职责：发现市场趋势和大方向 - 添加防御性检查
      const marketInsights = await this.discoverMarketDirections(
        mainKeyword,
        analyzedKeywords.keywords || [],
        patterns?.insights || [],
        trendAnalysis || { 
          trendingKeywords: [], 
          growthPatterns: [], 
          emergingTopics: [], 
          directionSummary: "无法确定市场方向" 
        }
      );
      logger.debug('市场方向发现完成', { count: marketInsights?.length || 0 });

      // 6. 如果有精细化选项，执行关键词精细化
      let refinedKeywords = analyzedKeywords.keywords || [];
      if (options?.themes && options.themes.length > 0) {
        const themeRefinedKeywords = await this.refineKeywordsByThemes(
          mainKeyword,
          options.themes,
          options.excludeExisting || []
        );
        
        // 合并并去重 - 添加防御性检查
        if (themeRefinedKeywords && themeRefinedKeywords.length > 0) {
          refinedKeywords = [...new Set([...refinedKeywords, ...themeRefinedKeywords])];
          logger.debug('主题精细化完成', { 
            additionalKeywords: themeRefinedKeywords.length,
            totalKeywords: refinedKeywords.length 
          });
        }
      }

      return {
        keywords: refinedKeywords,
        analysis: {
          categories: analyzedKeywords.categories || {},
          patterns: patterns?.patterns || [],
          insights: patterns?.insights || []
        },
        initialInsights: marketInsights || [],
        trendKeywords: trendAnalysis?.trendingKeywords || [],
        directionSummary: trendAnalysis?.directionSummary || "无法确定市场方向"
      };

    } catch (error) {
      logger.error('趋势关键词和市场方向分析失败', { error });
      
      // 返回一个最小可行的结果，避免抛出异常
      return {
        keywords: [],
        analysis: {
          categories: {},
          patterns: [],
          insights: []
        },
        initialInsights: [],
        trendKeywords: [],
        directionSummary: "分析过程发生错误"
      };
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

      const trendPrompt = `作为趋势分析专家，对以下主关键词和自动补全建议进行深度分析，识别市场趋势和方向:

主关键词: "${mainKeyword}"

自动补全建议及其排名:
${rankData}

相关关键词:
${keywords.slice(0, 20).join('\n')}

请进行系统化分析并严格按照以下JSON格式返回:
{
  "trendingKeywords": [
    {
      "keyword": "趋势关键词",
      "confidence": 0-1之间的浮点数,
      "reason": "基于数据的趋势判断理由，包含具体的市场信号和用户行为变化",
      "growthStage": "emerging/rising/peaking/stable"
    }
  ],
  "growthPatterns": [
    {
      "pattern": "增长模式的精确描述，捕捉用户行为或市场变化模式",
      "evidence": ["具体数据点1", "具体数据点2", "搜索行为特征"],
      "impact": "high/medium/low",
      "implication": "这一模式对内容创作者或企业的战略意义"
    }
  ],
  "emergingTopics": [
    {
      "topic": "新兴话题的具体表述",
      "relevance": 0-1之间的浮点数,
      "potential": "high/medium/low",
      "timeframe": "immediate/short-term/long-term",
      "audienceSegment": "目标受众群体"
    }
  ],
  "directionSummary": "基于数据和趋势分析的市场整体发展方向总结，包含具体的行动指导"
}

分析要求:
1. 准确识别：从数据中识别真实趋势而非噪音，运用关键词排名、共现频率、搜索意图等进行判断
2. 深入挖掘：分析关键词背后的用户需求变化和市场动态，而非停留在表面现象
3. 多维分析：考虑搜索量变化、用户群体迁移、垂直领域发展等多角度因素
4. 趋势预测：基于现有数据预测发展趋势，并提供具体依据
5. 实用洞察：确保每个发现都有具体的应用价值和行动指导意义`;

      const result = await this.llm.analyze(trendPrompt, 'trend_keyword_analysis', {
        format: 'json',
        temperature: 0.4,
        maxRetries: 3,
        retryDelay: 1000
      });

      // 确保返回有效结果
      return {
        trendingKeywords: result?.trendingKeywords?.map((k: { keyword: string }) => k.keyword) || [],
        growthPatterns: result?.growthPatterns?.map((p: { pattern: string }) => p.pattern) || [],
        emergingTopics: result?.emergingTopics?.map((t: { topic: string }) => t.topic) || [],
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
      
      const themePrompt = `作为趋势发现专家，基于主关键词 "${mainKeyword}" 和以下市场主题，生成具有战略价值的趋势关键词:

市场主题:
${themes.join('\n')}

关键词生成要求:
1. 识别与主题相关的高潜力趋势关键词
2. 挖掘隐藏在主题背后的搜索意图层次和需求变化
3. 关注用户行为模式转变带来的新兴搜索需求
4. 预测搜索意图的未来发展方向

需要排除的已知关键词:
${excludeKeywords.join('\n')}

请返回以下JSON格式结果:
{
  "keywords": [
    {
      "keyword": "趋势关键词",
      "intent": "该关键词背后的主要搜索意图",
      "trendSignal": "表明该词具有趋势特性的市场信号",
      "audience": "目标受众群体"
    }
  ]
}

分析标准:
- 趋势相关性评估：关键词必须体现明确的趋势信号或增长潜力
- 差异化价值：关键词应当填补现有市场内容空白或需求缺口
- 商业潜力：关键词应当具有明确的变现路径或业务价值
- 搜索意图完整性：关键词应当能满足完整的用户搜索旅程需求
- 受众定位准确性：关键词应当能精准定位特定用户群体的需求`;

      const result = await this.llm.analyze(themePrompt, 'theme_based_discovery', {
        format: 'json',
        temperature: 0.5
      });

      // 验证返回结果的结构
      if (!result || !Array.isArray(result.keywords)) {
        logger.warn('主题精细化关键词返回结果格式无效', { result });
        return [];
      }

      return result.keywords.slice(0, maxKeywords);
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
      const directionsPrompt = `作为市场战略顾问，基于以下多维数据，进行系统化的市场趋势分析:

主关键词: "${mainKeyword}"

相关关键词:
${relatedKeywords.slice(0, 15).join('\n')}

关键词模式洞察:
${patternInsights.join('\n')}

趋势关键词:
${trendAnalysis.trendingKeywords.join('\n')}

新兴话题:
${trendAnalysis.emergingTopics.join('\n')}

增长模式:
${trendAnalysis.growthPatterns.join('\n')}

市场方向概要:
${trendAnalysis.directionSummary}

请提供战略级市场洞察，返回以下JSON格式:
{
  "marketInsights": [
    {
      "type": "trend|direction|opportunity|intent|maturity",
      "description": "具体、可执行的洞察描述，包含战略意义和应用价值",
      "confidence": 0.0-1.0,
      "trend": "rising|stable|declining|defining",
      "impact": "high|medium|low",
      "timeHorizon": "immediate|short-term|mid-term|long-term",
      "competitiveAdvantage": "具体的竞争优势描述",
      "actionableStrategy": "基于此洞察的具体行动建议"
    }
  ],
  "marketMaturityAssessment": {
    "stage": "nascent|growth|mature|saturated|declining",
    "evidence": ["支持判断的证据1", "支持判断的证据2"],
    "opportunityWindow": "开放|即将关闭|高度竞争"
  }
}

分析框架与方法:
1. PESTLE分析：考虑政治、经济、社会、技术、法律和环境因素对市场的影响
2. 需求层次分析：应用马斯洛需求层次理论分析用户搜索背后的动机变化
3. 技术采用生命周期：评估市场在技术采用曲线中的位置(创新者/早期采用者/早期大众/晚期大众/落后者)
4. 价值创新：识别价值曲线中的差异化机会和蓝海战略可能性
5. 竞争分析：评估市场竞争格局、进入壁垒和差异化空间`;

      const result = await this.llm.analyze(directionsPrompt, 'enhanced_market_direction_analysis', {
        format: 'json',
        temperature: 0.4,
      });

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
    const prompt = `分析以下关键词组合，识别可能的趋势关键词:

主关键词: ${mainKeyword}
相关关键词:
${relatedKeywords.join('\n')}

请返回以下JSON格式的分析结果:
{
  "relevantKeywords": ["关键词1", "关键词2", ...],
  "categories": {
    "分类1": ["关键词1", "关键词2", ...],
    "分类2": ["关键词3", "关键词4", ...]
  }
}

注意:
- keywords: 筛选出的相关性高的关键词数组
- categories: 关键词分类对象，key为分类名称，value为该分类下的关键词数组
- 优先保留可能是趋势的关键词
- 确保返回的JSON格式完全符合上述结构`;

    const result = await this.llm.analyze(prompt, 'keyword_analysis', {
      format: 'json',
      temperature: 0.3,
      maxRetries: 3,
      retryDelay: 1000
    });

    return {
      keywords: result.relevantKeywords || [],
      categories: result.categories || {}
    };
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
    const prompt = `分析以下关键词集合中的趋势模式:
${keywords.join('\n')}

请返回以下JSON格式的分析结果:
{
  "patterns": [
    "重复出现的词语组合1",
    "重复出现的词语组合2",
    ...
  ],
  "insights": [
    "关于修饰词和用户意图的洞察1",
    "关于市场趋势的洞察2",
    ...
  ]
}

注意:
- patterns: 识别出的重复词语组合和模式数组
- insights: 关于修饰词、用户意图和市场趋势的洞察数组
- 确保返回的JSON格式完全符合上述结构`;

    const result = await this.llm.analyze(prompt, 'pattern_analysis', {
      format: 'json',
      temperature: 0.4,
      maxRetries: 3,
      retryDelay: 1000
    });

    return {
      patterns: result?.patterns || [],
      insights: result?.insights || []
    };
  }
} 