/**
 * UserJourneySim - 用户搜索旅程模拟器
 * 模拟用户在搜索引擎中的整个搜索旅程，识别决策点和查询修改模式
 * 核心职责：基于关键词和市场洞察，模拟用户行为，找到痛点和机会
 */
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { SearchEngine } from '../../infrastructure/search/engines/SearchEngine';
import { logger } from '../../infrastructure/error/logger';
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
        if (step.satisfaction > 0.8) {
          break;
        }

        // 选择下一步查询 - 确保存在nextQueries
        if (!step.nextQueries || step.nextQueries.length === 0) {
          break;
        }
        
        // 如果有相关关键词，考虑将它们纳入决策
        let nextOptions = [...step.nextQueries];
        if (relatedKeywords && relatedKeywords.length > 0) {
          // 选择1-2个相关关键词，但避免重复
          const relevantOptions = relatedKeywords
            .filter(k => !nextOptions.includes(k) && k !== currentQuery)
            .slice(0, 2);
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
    
    const prompt = `分析以下搜索查询和自动补全建议，并考虑相关市场洞察:
查询: ${query}
自动补全建议:
${suggestions.join('\n')}

市场洞察:
${relevantInsights.join('\n')}

请分析:
1. 用户查询意图
2. 建议满意度(0-1)
3. 可能的下一步查询
4. 查询与市场洞察的关联度`;

    const result = await this.llm.analyze(prompt, 'search_step_with_insights', {
      format: 'json',
      temperature: 0.3
    });

    return {
      query,
      intent: result.intent,
      satisfaction: result.satisfaction,
      nextQueries: result.nextQueries
    };
  }

  /**
   * 分析当前步骤（使用自动补全建议）
   */
  private async analyzeStepWithSuggestions(
    query: string,
    suggestions: string[]
  ): Promise<JourneyStep> {
    const prompt = `分析以下搜索查询和自动补全建议:
查询: ${query}
自动补全建议:
${suggestions.join('\n')}

请分析:
1. 用户查询意图
2. 建议满意度(0-1)
3. 可能的下一步查询`;

    const result = await this.llm.analyze(prompt, 'search_step_analysis', {
      format: 'json',
      temperature: 0.3
    });

    return {
      query,
      intent: result.intent,
      satisfaction: result.satisfaction,
      nextQueries: result.nextQueries
    };
  }

  /**
   * 识别用户旅程中的痛点
   * 核心职责：找到用户搜索过程中的痛点
   */
  private async identifyPainPoints(journey: EnhancedUserJourney): Promise<PainPoint[]> {
    const prompt = `分析以下用户搜索旅程，识别用户痛点:
起始关键词: ${journey.startKeyword}
搜索步骤:
${journey.steps.map((step, index) => 
  `步骤${index+1}: ${step.query} (意图: ${step.intent}, 满意度: ${step.satisfaction})`
).join('\n')}

决策点:
${journey.decisionPoints.map((point, index) => 
  `决策${index+1}: 从 "${point.query}" 到 "${point.chosenOption}"\n原因: ${point.reason}`
).join('\n')}

请识别:
1. 主要痛点
2. 痛点严重程度(1-5)
3. 受影响步骤编号
4. 可能的解决方案`;

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
    
    const prompt = `分析以下用户搜索旅程和旅程洞察，识别内容机会:
起始关键词: ${journey.startKeyword}
搜索步骤:
${journey.steps.map((step, index) => 
  `步骤${index+1}: ${step.query} (意图: ${step.intent}, 满意度: ${step.satisfaction})`
).join('\n')}

旅程洞察:
${journey.insights.map(insight => insight.description).join('\n')}

${insightsText}

请识别:
1. 内容机会点
2. 机会潜力(1-5)
3. 与主题相关度(0-1)
4. 实施建议`;

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
    options: string[]
  ): Promise<DecisionPoint> {
    const prompt = `基于当前查询"${currentQuery}"，从以下选项中选择最可能的下一步查询:
${options.join('\n')}

请考虑:
1. 查询的相关性
2. 信息获取进展
3. 用户可能的思维路径`;

    const result = await this.llm.analyze(prompt, 'decision_making', {
      format: 'json',
      temperature: 0.5
    });

    return {
      query: currentQuery,
      options,
      chosenOption: result.chosenOption,
      reason: result.reason
    };
  }

  /**
   * 生成旅程洞察
   */
  private async generateInsights(journey: UserJourney): Promise<JourneyInsight[]> {
    const prompt = `分析以下用户搜索旅程:
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

请提供:
1. 用户行为模式
2. 关键决策点分析
3. 潜在的内容机会`;

    const result = await this.llm.analyze(prompt, 'journey_insights', {
      format: 'json',
      temperature: 0.5
    });

    return result?.insights || [];
  }
} 