/**
 * ValueEvaluator.ts - 价值评估Agent
 * 评估问题的潜在商业价值、市场规模和增长潜力
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../base/EnhancedAgent';
import { AgentInput, AgentOutput, AgentCritique, ProblemInfo } from '../../types';
import { LLMService, ChatMessage } from '../../core/llm/LLMService';

/**
 * ValueEvaluator配置选项
 */
export interface ValueEvaluatorOptions {
  // 价值阈值(0-100)，低于此值的问题被视为低价值
  valueThreshold?: number;
  // 是否分析市场趋势
  analyzeMarketTrends?: boolean;
  // 是否执行ROI分析
  performROIAnalysis?: boolean;
  // 评估维度的权重
  dimensionWeights?: {
    marketSize?: number;
    urgency?: number;
    solutionCost?: number;
    competition?: number;
    growthPotential?: number;
  };
  // 其他选项
  [key: string]: any;
}

/**
 * 价值评估Agent类
 * 负责评估问题的商业价值和潜力
 */
export class ValueEvaluator extends EnhancedAgent {
  // LLM服务
  private llmService: LLMService;
  // 配置选项
  private evaluatorOptions: ValueEvaluatorOptions;

  /**
   * 构造函数
   * @param llmService LLM服务实例
   * @param options 配置选项
   */
  constructor(llmService: LLMService, options: ValueEvaluatorOptions = {}) {
    super(
      'ValueEvaluator',
      '价值评估专家，负责评估问题的商业价值和市场潜力',
      '市场分析师',
      [
        '市场规模评估',
        '增长趋势分析',
        'ROI计算',
        '竞争强度评估',
        '商业价值预测'
      ]
    );

    this.llmService = llmService;
    this.evaluatorOptions = {
      valueThreshold: 50,
      analyzeMarketTrends: true,
      performROIAnalysis: true,
      dimensionWeights: {
        marketSize: 0.3,
        urgency: 0.2,
        solutionCost: 0.15,
        competition: 0.15,
        growthPotential: 0.2
      },
      ...options
    };
  }

  /**
   * 处理输入并返回结果
   * @param input Agent输入
   * @returns Agent输出
   */
  async process(input: AgentInput): Promise<AgentOutput> {
    try {
      // 提取关键词和问题列表
      const { keyword, previousOutputs } = input.data;
      
      if (!keyword || typeof keyword !== 'string') {
        return {
          status: 'failed',
          error: '无效的关键词输入',
          data: null
        };
      }

      // 获取SolutionAnalyzer的输出
      const solutionOutput = previousOutputs?.SolutionAnalyzer;
      if (!solutionOutput || !solutionOutput.problems || !Array.isArray(solutionOutput.problems)) {
        return {
          status: 'failed',
          error: '缺少SolutionAnalyzer的有效输出',
          data: null
        };
      }

      const problems = solutionOutput.problems as ProblemInfo[];
      this.log(`开始评估关键词"${keyword}"的问题价值，问题数量: ${problems.length}`);

      // 评估每个问题的价值
      const problemsWithValue = await this.evaluateProblemsValue(keyword, problems);

      // 根据价值排序问题
      const sortedProblems = this.rankProblemsByValue(problemsWithValue);

      // 最终处理结果
      const result = {
        keyword,
        problems: sortedProblems,
        metadata: {
          totalProblemsEvaluated: problems.length,
          highValueProblems: sortedProblems.filter(
            (p: ProblemInfo) => p.valueAssessment && p.valueAssessment.overallValue >= this.evaluatorOptions.valueThreshold!
          ).length,
          processingTimeMs: Date.now() - input.context.state.executionMetadata.currentTime
        }
      };

      this.log(`完成价值评估: ${keyword}, 高价值问题数量: ${result.metadata.highValueProblems}`);

      return {
        status: 'success',
        data: result,
        metadata: {
          evaluatedProblemCount: sortedProblems.length,
          highValueProblemCount: result.metadata.highValueProblems
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`处理错误: ${errorMessage}`, 'error');
      
      return {
        status: 'failed',
        error: `价值评估失败: ${errorMessage}`,
        data: null
      };
    }
  }

  /**
   * 对其他Agent的结果进行质疑
   * @param agentName 目标Agent名称
   * @param output 目标Agent的输出
   * @returns 质疑内容
   */
  async critiquePeerOutput(agentName: string, output: AgentOutput): Promise<AgentCritique | null> {
    // 主要对ProblemMiner的输出进行质疑
    if (agentName === 'ProblemMiner' && output.status === 'success') {
      const data = output.data;
      
      // 检查是否有问题的描述过于笼统或不具体
      if (data.problems && Array.isArray(data.problems)) {
        const vagueProblemDescriptions = data.problems.filter((problem: any) => {
          const description = problem.description || '';
          // 检查描述是否足够具体和详细
          return (
            description.length < 50 || // 过短的描述
            !description.includes(' ') || // 不包含空格的异常描述
            /^(这是|此问题|问题是)/i.test(description.trim()) // 以模板语言开头的描述
          );
        });
        
        if (vagueProblemDescriptions.length > 0) {
          return {
            content: `一些问题描述过于笼统，缺乏具体细节`,
            reasons: [
              '问题描述不够具体会导致价值评估偏差',
              '缺乏细节的问题难以准确评估市场规模和紧迫性',
              '模糊的问题描述使解决方案分析变得困难'
            ],
            severity: 3,
            suggestions: [
              '提供更具体的问题场景和影响',
              '量化问题的影响范围和严重程度',
              '描述具体的用户痛点和使用场景'
            ],
            metadata: {
              vagueProblems: vagueProblemDescriptions.map((p: any) => p.title)
            }
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 评估问题的价值
   * @param keyword 关键词
   * @param problems 问题列表
   * @returns 带有价值评估的问题列表
   */
  private async evaluateProblemsValue(keyword: string, problems: ProblemInfo[]): Promise<ProblemInfo[]> {
    const evaluatedProblems: ProblemInfo[] = [];
    
    for (const problem of problems) {
      this.log(`评估问题"${problem.title}"的价值`);
      
      // 收集评估所需的信息
      const evaluationContext = await this.collectEvaluationContext(keyword, problem);
      
      // 执行基础价值评估
      const valueAssessment = await this.performBasicValueAssessment(problem, evaluationContext);
      
      // 如果启用，分析市场趋势
      let enhancedAssessment = valueAssessment;
      if (this.evaluatorOptions.analyzeMarketTrends) {
        enhancedAssessment = await this.enhanceWithMarketTrends(enhancedAssessment, keyword, problem);
      }
      
      // 如果启用，执行ROI分析
      if (this.evaluatorOptions.performROIAnalysis) {
        enhancedAssessment = await this.enhanceWithROIAnalysis(enhancedAssessment, problem);
      }
      
      // 计算整体价值评分
      const overallValue = this.calculateOverallValue(enhancedAssessment);
      
      // 添加增强后的问题
      evaluatedProblems.push({
        ...problem,
        valueAssessment: {
          ...enhancedAssessment,
          overallValue
        }
      });
    }
    
    return evaluatedProblems;
  }

  /**
   * 收集价值评估的上下文信息
   * @param keyword 关键词
   * @param problem 问题
   * @returns 评估上下文
   */
  private async collectEvaluationContext(keyword: string, problem: ProblemInfo): Promise<any> {
    const context: any = {
      marketInfo: {},
      competitiveInfo: {},
      trendInfo: {}
    };
    
    // 从问题的解决方案和缺口分析中提取信息
    if (problem.existingSolutions) {
      context.competitiveInfo.solutionCount = problem.existingSolutions.length;
      
      // 计算平均满足度
      if (problem.existingSolutions.length > 0) {
        const avgSatisfaction = problem.existingSolutions.reduce(
          (sum, solution) => sum + (solution.satisfactionScore || 0), 
          0
        ) / problem.existingSolutions.length;
        
        context.competitiveInfo.averageSatisfaction = avgSatisfaction;
      }
    }
    
    if (problem.solutionGap) {
      context.competitiveInfo.gapSize = problem.solutionGap.gapSize;
      context.marketInfo.unmetNeeds = problem.solutionGap.unmetNeeds;
    }
    
    // 如果有市场规模估算工具，使用工具
    if (this.hasToolRegistered('estimateMarketSize')) {
      try {
        const result = await this.useTool('estimateMarketSize', {
          keyword,
          problem: problem.title
        });
        
        if (result.success && result.data) {
          context.marketInfo = {
            ...context.marketInfo,
            ...result.data
          };
        }
      } catch (error) {
        this.log(`市场规模估算失败: ${error}`, 'error');
      }
    }
    
    // 如果有趋势分析工具，使用工具
    if (this.hasToolRegistered('analyzeTrends')) {
      try {
        const result = await this.useTool('analyzeTrends', {
          keyword: `${keyword} ${problem.title}`,
          timeRange: 'last_5_years'
        });
        
        if (result.success && result.data) {
          context.trendInfo = result.data;
        }
      } catch (error) {
        this.log(`趋势分析失败: ${error}`, 'error');
      }
    }
    
    return context;
  }

  /**
   * 执行基础价值评估
   * @param problem 问题
   * @param context 评估上下文
   * @returns 价值评估
   */
  private async performBasicValueAssessment(problem: ProblemInfo, context: any): Promise<any> {
    // 使用LLM进行评估
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个市场机会评估专家。请对给定的问题进行全面的价值评估，考虑市场规模、问题紧迫性、解决成本、竞争强度和增长潜力等维度。每个维度评分范围为1-10，其中10表示最高价值/最有利的情况。请基于所提供的问题信息和市场上下文，提供客观且数据驱动的评估。`
      },
      {
        role: 'user',
        content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n请基于以下上下文信息，评估该问题的商业价值:\n\n市场信息: ${JSON.stringify(context.marketInfo, null, 2)}\n\n竞争信息: ${JSON.stringify(context.competitiveInfo, null, 2)}\n\n证据: ${JSON.stringify(problem.evidence || [], null, 2)}`
      }
    ];

    try {
      // 调用LLM评估
      return await this.llmService.chatToJSON<{
        marketSize: number;
        urgency: number;
        solutionCost: number;
        competition: number;
        growthPotential: number;
        reasoning: {
          marketSize?: string;
          urgency?: string;
          solutionCost?: string;
          competition?: string;
          growthPotential?: string;
        };
      }>(
        messages,
        {
          type: 'object',
          properties: {
            marketSize: { type: 'number' },
            urgency: { type: 'number' },
            solutionCost: { type: 'number' },
            competition: { type: 'number' },
            growthPotential: { type: 'number' },
            reasoning: {
              type: 'object',
              properties: {
                marketSize: { type: 'string' },
                urgency: { type: 'string' },
                solutionCost: { type: 'string' },
                competition: { type: 'string' },
                growthPotential: { type: 'string' }
              }
            }
          },
          required: ['marketSize', 'urgency', 'solutionCost', 'competition', 'growthPotential']
        },
        { temperature: 0.3 }
      );
    } catch (error) {
      this.log(`基础价值评估失败: ${error}`, 'error');
      
      // 提供默认评估
      return {
        marketSize: 5,
        urgency: 5,
        solutionCost: 5,
        competition: 5,
        growthPotential: 5,
        reasoning: {
          marketSize: '无法获取详细市场数据',
          urgency: '无法评估紧迫性',
          solutionCost: '无法评估解决成本',
          competition: '无法评估竞争强度',
          growthPotential: '无法评估增长潜力'
        }
      };
    }
  }

  /**
   * 增强评估结果：市场趋势分析
   * @param assessment 当前评估结果
   * @param keyword 关键词
   * @param problem 问题
   * @returns 增强后的评估结果
   */
  private async enhanceWithMarketTrends(assessment: any, keyword: string, problem: ProblemInfo): Promise<any> {
    // 如果有市场趋势数据，使用LLM分析
    if (this.hasToolRegistered('getTrendData')) {
      try {
        const result = await this.useTool('getTrendData', {
          query: `${keyword} ${problem.title}`,
          period: '5y'
        });
        
        if (!result.success || !result.data) {
          return assessment;
        }
        
        const trendData = result.data;
        
        // 使用LLM分析趋势
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: `你是一个市场趋势分析专家。请根据提供的趋势数据，分析相关问题的增长潜力，并对现有的价值评估进行调整。特别关注趋势的方向、变化速度和变化持续性。`
          },
          {
            role: 'user',
            content: `问题: ${problem.title}\n现有评估: ${JSON.stringify(assessment, null, 2)}\n\n请基于以下趋势数据，调整增长潜力和市场规模评分:\n\n${JSON.stringify(trendData, null, 2)}`
          }
        ];

        // 调用LLM分析
        const enhancedAssessment = await this.llmService.chatToJSON<{
          marketSize: number;
          growthPotential: number;
          trendAnalysis: string;
        }>(
          messages,
          {
            type: 'object',
            properties: {
              marketSize: { type: 'number' },
              growthPotential: { type: 'number' },
              trendAnalysis: { type: 'string' }
            },
            required: ['marketSize', 'growthPotential', 'trendAnalysis']
          },
          { temperature: 0.3 }
        );
        
        // 合并评估结果
        return {
          ...assessment,
          marketSize: enhancedAssessment.marketSize,
          growthPotential: enhancedAssessment.growthPotential,
          trendAnalysis: enhancedAssessment.trendAnalysis
        };
      } catch (error) {
        this.log(`市场趋势分析失败: ${error}`, 'error');
      }
    }
    
    return assessment;
  }

  /**
   * 增强评估结果：ROI分析
   * @param assessment 当前评估结果
   * @param problem 问题
   * @returns 增强后的评估结果
   */
  private async enhanceWithROIAnalysis(assessment: any, problem: ProblemInfo): Promise<any> {
    try {
      // 使用LLM进行ROI分析
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个投资回报率分析专家。请基于给定的价值评估和问题信息，分析解决该问题可能带来的ROI。考虑潜在市场规模、解决成本、可能的收入流和风险因素。提供定性分析和ROI评分(1-10)。`
        },
        {
          role: 'user',
          content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n价值评估: ${JSON.stringify(assessment, null, 2)}\n\n解决方案缺口: ${JSON.stringify(problem.solutionGap || {}, null, 2)}\n\n请分析解决该问题的潜在ROI。`
        }
      ];

      // 调用LLM分析
      const roiAnalysis = await this.llmService.chatToJSON<{
        roiScore: number;
        analysis: string;
        riskFactors: string[];
        timeToValue: string;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            roiScore: { type: 'number' },
            analysis: { type: 'string' },
            riskFactors: { type: 'array', items: { type: 'string' } },
            timeToValue: { type: 'string' }
          },
          required: ['roiScore', 'analysis', 'riskFactors', 'timeToValue']
        },
        { temperature: 0.4 }
      );
      
      // 合并评估结果
      return {
        ...assessment,
        roi: {
          score: roiAnalysis.roiScore,
          analysis: roiAnalysis.analysis,
          riskFactors: roiAnalysis.riskFactors,
          timeToValue: roiAnalysis.timeToValue
        }
      };
    } catch (error) {
      this.log(`ROI分析失败: ${error}`, 'error');
      return assessment;
    }
  }

  /**
   * 计算问题的整体价值评分
   * @param assessment 价值评估
   * @returns 整体价值评分(0-100)
   */
  private calculateOverallValue(assessment: any): number {
    // 获取权重
    const weights = this.evaluatorOptions.dimensionWeights!;
    
    // 计算加权平均分
    let weightedScore = 0;
    let totalWeight = 0;
    
    if (assessment.marketSize !== undefined) {
      weightedScore += assessment.marketSize * (weights.marketSize || 0.3);
      totalWeight += (weights.marketSize || 0.3);
    }
    
    if (assessment.urgency !== undefined) {
      weightedScore += assessment.urgency * (weights.urgency || 0.2);
      totalWeight += (weights.urgency || 0.2);
    }
    
    if (assessment.solutionCost !== undefined) {
      weightedScore += assessment.solutionCost * (weights.solutionCost || 0.15);
      totalWeight += (weights.solutionCost || 0.15);
    }
    
    if (assessment.competition !== undefined) {
      weightedScore += assessment.competition * (weights.competition || 0.15);
      totalWeight += (weights.competition || 0.15);
    }
    
    if (assessment.growthPotential !== undefined) {
      weightedScore += assessment.growthPotential * (weights.growthPotential || 0.2);
      totalWeight += (weights.growthPotential || 0.2);
    }
    
    // 如果有ROI评分，额外加成
    if (assessment.roi && assessment.roi.score !== undefined) {
      // ROI作为加成因子，最多增加10%
      const roiBonus = assessment.roi.score / 10; // 0-1
      weightedScore *= (1 + roiBonus * 0.1);
    }
    
    // 将1-10的评分转换为0-100的最终评分
    let finalScore = totalWeight > 0 ? (weightedScore / totalWeight) * 10 : 50;
    
    // 确保评分在0-100范围内
    finalScore = Math.min(100, Math.max(0, finalScore));
    
    // 四舍五入到整数
    return Math.round(finalScore);
  }

  /**
   * 根据价值排序问题
   * @param problems 带有价值评估的问题列表
   * @returns 排序后的问题列表
   */
  private rankProblemsByValue(problems: ProblemInfo[]): ProblemInfo[] {
    return [...problems].sort((a, b) => {
      const valueA = a.valueAssessment?.overallValue || 0;
      const valueB = b.valueAssessment?.overallValue || 0;
      return valueB - valueA; // 降序排列
    });
  }

  /**
   * 记录日志
   * @param message 日志消息
   * @param level 日志级别
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}] [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'info':
        console.info(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }
} 