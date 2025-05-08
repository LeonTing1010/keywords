/**
 * UserJourneySim - 用户搜索旅程模拟器
 * 模拟用户在搜索引擎中的整个搜索旅程，识别决策点和查询修改模式
 * 核心职责：基于关键词和市场洞察，模拟用户行为，找到痛点和机会
 */
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { SearchEngine } from '../../infrastructure/search/engines/SearchEngine';
import { logger } from '../../infrastructure/core/logger';
import {
  UserJourney,
  JourneyStep,
  DecisionPoint,
  JourneyInsight,
  MarketInsight
} from '../analysis/types/AnalysisTypes';

// 痛点接口
export interface PainPoint {
  description: string;
  severity: number; // 1-5
  affectedSteps: number[];
  possibleSolutions: string[];
}

// 机会接口
export interface Opportunity {
  description: string;
  potential: number; // 1-5
  relevance: number; // 0-1
  implementationIdeas: string[];
}

// 增强后的用户旅程接口
export interface EnhancedUserJourney extends UserJourney {
  painPoints: PainPoint[];
  opportunities: Opportunity[];
  satisfactionScore: number;
  completionRate: number;
}

// 模拟器配置接口
export interface UserJourneySimConfig {
  llmService: LLMServiceHub;
  searchEngine: SearchEngine;
  maxSteps?: number;
  verbose?: boolean;
  marketInsights?: MarketInsight[]; // 可选的市场洞察，用于指导模拟
}

/**
 * UserJourneySim是一个用于模拟用户搜索行为的组件
 * 核心职责：模拟用户行为路径，识别痛点和机会
 */
export class UserJourneySim {
  private llm: LLMServiceHub;
  private searchEngine: SearchEngine;
  private maxSteps: number;
  private verbose: boolean;
  
  constructor(config: UserJourneySimConfig) {
    this.llm = config.llmService;
    this.searchEngine = config.searchEngine;
    this.maxSteps = config.maxSteps || 5;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      logger.info(`初始化完成，最大步骤: ${this.maxSteps}`);
    }
  }
  
  /**
   * 模拟用户搜索旅程
   * @param keyword 主关键词
   * @param relatedKeywords 可选的相关关键词，用于增强模拟
   * @param marketInsights 可选的市场洞察，用于指导模拟
   */
  public async simulateJourney(
    keyword: string,
    relatedKeywords?: string[],
    marketInsights?: MarketInsight[]
  ): Promise<EnhancedUserJourney> {
    try {
      logger.info('开始模拟用户旅程', { keyword });

      // 1. 初始化旅程
      const journey: EnhancedUserJourney = {
        startKeyword: keyword,
        steps: [],
        insights: [],
        decisionPoints: [],
        painPoints: [],
        opportunities: [],
        satisfactionScore: 0,
        completionRate: 0
      };

      // 2. 模拟搜索步骤
      let currentQuery = keyword;
      let stepCount = 0;

      while (stepCount < this.maxSteps) {
        // 获取搜索结果和自动补全建议的组合方法
        const autoCompleteResults = await this.searchEngine.getSuggestions(currentQuery);
        
        // 提取自动补全建议
        const suggestions = autoCompleteResults.map(suggestion => suggestion.query);
        
        // 增强的步骤分析 - 如果有市场洞察，将其纳入考虑
        const step = marketInsights && marketInsights.length > 0
          ? await this.analyzeStepWithInsights(currentQuery, suggestions, marketInsights)
          : await this.analyzeStepWithSuggestions(currentQuery, suggestions);
          
        journey.steps.push(step);

        // 如果用户满意度高，结束旅程
        if (step.satisfaction > 0.9) {
          break;
        }

        // 选择下一步查询 - 确保存在nextQueries
        if (!step.nextQueries || step.nextQueries.length === 0) {
          break;
        }
        
        // 如果有相关关键词，考虑将它们纳入决策
        let nextOptions = [...step.nextQueries];
        if (relatedKeywords && relatedKeywords.length > 0) {
          // 选择1-3个相关关键词，但避免重复
          const relevantOptions = relatedKeywords
            .filter(k => !nextOptions.map(opt => opt.suggestion).includes(k) && k !== currentQuery)
            .slice(0, 3)
            .map(k => ({
              suggestion: k,
              satisfaction: 0.7, // 默认相关性较高
              reason: '用户提供的相关关键词'
            }));
          nextOptions = [...nextOptions, ...relevantOptions];
        }
        
        const decisionPoint = await this.makeDecision(currentQuery, nextOptions);
        journey.decisionPoints.push(decisionPoint);
        
        // 确保选择了有效的下一步查询
        if (!decisionPoint.chosenOption) {
          break;
        }
        
        currentQuery = decisionPoint.chosenOption;
        stepCount++;
      }

      // 3. 生成基础旅程洞察
      journey.insights = await this.generateInsights(journey);
      
      // 4. 核心职责：识别痛点
      journey.painPoints = await this.identifyPainPoints(journey);
      
      // 5. 核心职责：发现机会
      journey.opportunities = await this.identifyOpportunities(journey, marketInsights || []);
      
      // 6. 计算满意度和完成率
      const journeyMetrics = await this.calculateJourneyMetrics(journey);
      journey.satisfactionScore = journeyMetrics.satisfaction;
      journey.completionRate = journeyMetrics.completion;

      logger.info('用户旅程模拟完成', { 
        steps: journey.steps.length,
        insights: journey.insights.length,
        painPoints: journey.painPoints.length,
        opportunities: journey.opportunities.length
      });

      return journey;

    } catch (error) {
      logger.error('用户旅程模拟失败', { error });
      throw error;
    }
  }

  /**
   * 使用市场洞察分析步骤
   * 将市场洞察纳入查询步骤分析
   */
  private async analyzeStepWithInsights(
    query: string,
    suggestions: string[],
    marketInsights: MarketInsight[]
  ): Promise<JourneyStep> {
    // 提取最相关的市场洞察
    const relevantInsights = marketInsights
      .filter(insight => insight.confidence > 0.7)
      .slice(0, 3)
      .map(insight => insight.description);
    
    const prompt = `分析以下搜索查询和自动补全建议，并结合市场洞察深入理解用户行为模式:

查询: ${query}
自动补全建议:
${suggestions.join('\n')}

市场洞察:
${relevantInsights.join('\n')}

请严格按照以下要求生成JSON格式结果:

1. 对每个自动补全建议进行单独评估:
{
  "suggestions": [
    {
      "suggestion": "建议1原文",
      "satisfaction": 0.0-1.0之间的数值,
      "reason": "满意度评分理由"
    },
    // ... 所有建议的评估 ...
  ],
  "intent": "用户的具体查询意图，详细描述用户真实目标、背后需求与痛点",
  "satisfaction": 0.0-1.0之间的数值，整体评估用户对建议的满意程度,
  "insightRelevance": 0.0-1.0之间的数值，量化查询与市场洞察的关联度与价值
}

评估要求:
- 每个suggestion必须包含原始建议文本、满意度评分和评分理由
- satisfaction评分标准必须考虑与用户意图的匹配度、信息价值和查询相关性
- 必须对所有自动补全建议进行评估，不得遗漏
- 最终nextQueries将由系统自动从suggestions中选取满意度最高的3个形成`;

    const result = await this.llm.analyze(prompt, 'search_step_with_insights', {
      format: 'json',
      temperature: 0.3
    });

    // 处理评估结果，选择满意度最高的3个建议作为nextQueries
    const topSuggestions = result.suggestions
      ? [...result.suggestions].sort((a, b) => b.satisfaction - a.satisfaction).slice(0, 3)
      : [];

    return {
      query,
      intent: result.intent,
      satisfaction: result.satisfaction,
      nextQueries: topSuggestions
    };
  }

  /**
   * 分析当前步骤（使用自动补全建议）
   */
  private async analyzeStepWithSuggestions(
    query: string,
    suggestions: string[]
  ): Promise<JourneyStep> {
    const prompt = `分析以下搜索查询和自动补全建议，通过深度思考生成全面的行为洞察:

查询: ${query}
自动补全建议:
${suggestions.join('\n')}

请严格按照以下要求生成JSON格式结果:

1. 对每个自动补全建议进行单独评估:
{
  "suggestions": [
    {
      "suggestion": "建议1原文",
      "satisfaction": 0.0-1.0之间的数值,
      "reason": "满意度评分理由"
    },
    // ... 所有建议的评估 ...
  ],
  "intent": "用户的具体查询意图，深入分析背后目标、需求层次和可能的情境"
}

评估要求:
- intent分析必须挖掘查询背后的真实用户需求，考虑可能的使用场景和目标
- 每个suggestion必须包含原始建议文本、满意度评分和评分理由
- satisfaction评分标准：
  * 0.0-0.3：建议与意图几乎无关，无法满足需求
  * 0.4-0.6：建议部分相关，但缺乏深度或全面性
  * 0.7-0.9：建议高度相关，能满足大部分需求
  * 1.0：建议完全匹配意图，覆盖全面且深入
- 必须对所有自动补全建议进行评估，不得遗漏
- 最终nextQueries将由系统自动从suggestions中选取满意度最高的3个形成`;

    const result = await this.llm.analyze(prompt, 'search_step_analysis', {
      format: 'json',
      temperature: 0.3
    });

    // 处理评估结果，选择满意度最高的3个建议作为nextQueries
    const topSuggestions = result.suggestions
      ? [...result.suggestions].sort((a, b) => b.satisfaction - a.satisfaction).slice(0, 3)
      : [];

    // 计算整体满意度作为步骤的满意度（可以是平均值或加权平均）
    const overallSatisfaction = result.suggestions && result.suggestions.length > 0
      ? result.suggestions.reduce((sum: number, item: {satisfaction: number}) => sum + item.satisfaction, 0) / result.suggestions.length
      : 0;

    return {
      query,
      intent: result.intent,
      satisfaction: overallSatisfaction,
      nextQueries: topSuggestions
    };
  }

  /**
   * 识别用户旅程中的痛点
   * 核心职责：找到用户搜索过程中的痛点
   */
  private async identifyPainPoints(journey: EnhancedUserJourney): Promise<PainPoint[]> {
    const prompt = `系统性分析以下用户搜索旅程，识别核心痛点并构建解决方案:

起始关键词: ${journey.startKeyword}
搜索步骤:
${journey.steps.map((step, index) => 
  `步骤${index+1}: ${step.query} (意图: ${step.intent}, 满意度: ${step.satisfaction})`
).join('\n')}

决策点:
${journey.decisionPoints.map((point, index) => 
  `决策${index+1}: 从 "${point.query}" 到 "${point.chosenOption}"\n原因: ${point.reason}`
).join('\n')}

请返回以下JSON格式的系统化痛点分析:
{
  "painPoints": [
    {
      "description": "痛点的详细描述，阐明问题本质和根本原因",
      "severity": 1-5的整数,
      "affectedSteps": [受影响的步骤编号数组],
      "possibleSolutions": [
        "解决方案1 - 详细说明",
        "解决方案2 - 详细说明"
      ]
    }
  ]
}

分析要求:
- 深入挖掘：不要仅关注表面现象，而要分析导致用户困惑或不满的根本原因
- 全面评估：考虑用户旅程中的转折点、倒退行为和重复尝试等
- 分类痛点：区分导航问题、信息不足、结果无关性等不同类型的痛点
- 解决方案：提供具体、可操作且基于数据的解决方案，而非泛泛而谈的建议
- 痛点评分考量：频率、对用户体验的影响程度、解决难度和业务价值`;

    const result = await this.llm.analyze(prompt, 'pain_points_analysis', {
      format: 'json',
      temperature: 0.4
    });

    return result?.painPoints || [];
  }

  /**
   * 识别用户旅程中的机会
   * 核心职责：找到用户搜索过程中的机会点
   */
  private async identifyOpportunities(
    journey: EnhancedUserJourney,
    marketInsights: MarketInsight[]
  ): Promise<Opportunity[]> {
    // 提取市场洞察为字符串
    const insightsText = marketInsights.length > 0
      ? `市场洞察:\n${marketInsights.map(i => i.description).join('\n')}`
      : '';
    
    const prompt = `系统性分析以下用户搜索旅程和市场洞察，识别高价值内容机会:

起始关键词: ${journey.startKeyword}
搜索步骤:
${journey.steps.map((step, index) => 
  `步骤${index+1}: ${step.query} (意图: ${step.intent}, 满意度: ${step.satisfaction})`
).join('\n')}

旅程洞察:
${journey.insights.map(insight => insight.description).join('\n')}

${insightsText}

请返回以下JSON格式的战略性机会分析:
{
  "opportunities": [
    {
      "description": "机会的深入描述，包括市场空白点和用户未满足需求",
      "potential": 1-5的整数,
      "relevance": 0-1之间的浮点数,
      "implementationIdeas": [
        "实施方案1 - 详细说明",
        "实施方案2 - 详细说明"
      ]
    }
  ]
}

分析要求:
- 机会识别：基于用户旅程断点、满意度低的步骤、决策犹豫点等识别机会
- 市场验证：所识别机会必须与市场洞察相互印证，避免主观臆测
- 机会评估：
  * potential评分：综合市场规模、增长潜力、竞争状况、实现难度等因素
  * relevance评分：基于与核心用户需求的契合度、与业务目标的一致性等
- 实施方案：必须具体、可行、有创新性，并能直接解决用户痛点`;

    const result = await this.llm.analyze(prompt, 'opportunity_analysis', {
      format: 'json',
      temperature: 0.4
    });

    return result?.opportunities || [];
  }

  /**
   * 计算旅程指标
   */
  private async calculateJourneyMetrics(
    journey: EnhancedUserJourney
  ): Promise<{satisfaction: number; completion: number}> {
    // 平均满意度
    const avgSatisfaction = journey.steps.length > 0
      ? journey.steps.reduce((sum, step) => sum + step.satisfaction, 0) / journey.steps.length
      : 0;
    
    // 完成率基于最后一步的满意度和旅程长度
    const lastStepSatisfaction = journey.steps.length > 0
      ? journey.steps[journey.steps.length - 1].satisfaction
      : 0;
    
    // 旅程步骤比例 (实际步骤/最大步骤)
    const stepRatio = journey.steps.length / this.maxSteps;
    
    // 完成率 = 最后一步满意度 * (1 - 步骤比例)
    // 步骤少且满意度高 = 高完成率
    const completionRate = lastStepSatisfaction * (1 - 0.5 * stepRatio);
    
    return {
      satisfaction: avgSatisfaction,
      completion: completionRate
    };
  }

  /**
   * 做出下一步决策
   */
  private async makeDecision(
    currentQuery: string,
    options: Array<{suggestion: string; satisfaction: number; reason: string;}>
  ): Promise<DecisionPoint> {
    const optionsArray = options.map(opt => opt.suggestion);
    
    const prompt = `分析当前搜索查询"${currentQuery}"，从以下选项中选择最合适的下一步查询:

选项列表:
${optionsArray.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

请严格按照以下JSON格式返回结果:
{
  "query": "${currentQuery}",
  "options": ${JSON.stringify(optionsArray)},
  "chosenOption": "必须从选项列表中选择一个选项",
  "reason": "详细说明选择理由，包括: 1)与当前主题的相关性 2)信息获取的进展和深度 3)用户可能的思维路径和意图"
}

注意:
- chosenOption必须完全匹配选项列表中的某个选项
- reason必须包含上述三个方面的分析
- 不要返回任何其他字段或格式`;

    const result = await this.llm.analyze(prompt, 'decision_making', {
      format: 'json',
      temperature: 0.5
    });

    return {
      query: result.query,
      options: optionsArray,
      chosenOption: result.chosenOption,
      reason: result.reason
    };
  }

  /**
   * 生成旅程洞察
   */
  private async generateInsights(journey: UserJourney): Promise<JourneyInsight[]> {
    const prompt = `分析以下用户搜索旅程并生成结构化的洞察:

起始关键词: ${journey.startKeyword}

搜索步骤:
${journey.steps.map(step => 
  `- 查询: ${step.query}
   意图: ${step.intent}
   满意度: ${step.satisfaction}`
).join('\n')}

决策点:
${journey.decisionPoints.map(point =>
  `- 从 "${point.query}" 选择 "${point.chosenOption}"
   原因: ${point.reason}`
).join('\n')}

请严格按照以下JSON格式返回结果:
{
  "insights": [
    {
      "type": "行为模式|决策分析|内容机会",
      "title": "洞察标题",
      "description": "详细描述",
      "confidence": 0.0-1.0,
      "evidence": ["支持证据1", "支持证据2"],
      "implications": ["潜在影响1", "潜在影响2"]
    }
  ]
}

注意:
- type: 必须是"行为模式/决策分析/内容机会"之一
- title: 简短的洞察标题
- description: 详细的洞察描述
- confidence: 必须是0-1之间的浮点数
- evidence: 支持该洞察的证据数组
- implications: 潜在影响和建议数组
- 确保返回的JSON格式完全符合上述结构`;

    const result = await this.llm.analyze(prompt, 'journey_insights', {
      format: 'json',
      temperature: 0.5
    });

    // 添加防御性检查
    if (!result || !Array.isArray(result.insights)) {
      logger.warn('旅程洞察生成失败，返回空数组', { journey: journey.startKeyword });
      return [];
    }

    return result.insights;
  }
} 