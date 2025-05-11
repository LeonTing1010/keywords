/**
 * CriticalThinker.ts - 质疑与反思Agent
 * 挑战其他Agent的结果，提供批判性思考
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../base/EnhancedAgent';
import { AgentInput, AgentOutput, AgentCritique, ProblemInfo } from '../../types';
import { LLMService, ChatMessage } from '../../core/llm/LLMService';

/**
 * CriticalThinker配置选项
 */
export interface CriticalThinkerOptions {
  // 批判强度(1-10)
  criticalIntensity?: number;
  // 是否应用假设检验
  applyHypothesisTesting?: boolean;
  // 最大质疑问题数量
  maxChallengedProblems?: number;
  // 其他选项
  [key: string]: any;
}

/**
 * 质疑与反思Agent类
 * 负责挑战其他Agent的结果，提供批判性思考
 */
export class CriticalThinker extends EnhancedAgent {
  // LLM服务
  private llmService: LLMService;
  // 配置选项
  private thinkerOptions: CriticalThinkerOptions;

  /**
   * 构造函数
   * @param llmService LLM服务实例
   * @param options 配置选项
   */
  constructor(llmService: LLMService, options: CriticalThinkerOptions = {}) {
    super(
      'CriticalThinker',
      '批判性思考专家，负责挑战假设和提供不同视角',
      '批判思想家',
      [
        '逻辑谬误识别',
        '假设检验',
        '证据评估',
        '替代解释提出',
        '风险评估'
      ]
    );

    this.llmService = llmService;
    this.thinkerOptions = {
      criticalIntensity: 7,
      applyHypothesisTesting: true,
      maxChallengedProblems: 3,
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

      // 获取ValueEvaluator的输出
      const valueOutput = previousOutputs?.ValueEvaluator;
      if (!valueOutput || !valueOutput.problems || !Array.isArray(valueOutput.problems)) {
        return {
          status: 'failed',
          error: '缺少ValueEvaluator的有效输出',
          data: null
        };
      }

      const problems = valueOutput.problems as ProblemInfo[];
      this.log(`开始为关键词"${keyword}"的问题提供批判性思考，问题数量: ${problems.length}`);

      // 批判性思考
      const challengedProblems = await this.challengeProblems(keyword, problems);

      // 最终处理结果
      const result = {
        keyword,
        problems: challengedProblems,
        metadata: {
          totalProblemsReviewed: problems.length,
          challengedProblemCount: challengedProblems.filter((p: any) => p.criticalAnalysis).length,
          processingTimeMs: Date.now() - input.context.state.executionMetadata.currentTime
        }
      };

      this.log(`完成批判性思考: ${keyword}, 质疑问题数量: ${result.metadata.challengedProblemCount}`);

      return {
        status: 'success',
        data: result,
        metadata: {
          challengedProblemCount: result.metadata.challengedProblemCount
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`处理错误: ${errorMessage}`, 'error');
      
      return {
        status: 'failed',
        error: `批判性思考失败: ${errorMessage}`,
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
    // 对所有Agent的输出都可能进行质疑
    if (output.status === 'success' && output.data) {
      // 针对不同Agent进行特定质疑
      switch (agentName) {
        case 'ValueEvaluator':
          // 质疑价值评估
          return this.critiqueValueEvaluation(output.data);
        
        case 'SolutionAnalyzer':
          // 质疑解决方案分析
          return this.critiqueSolutionAnalysis(output.data);
        
        case 'EvidenceCollector':
          // 质疑证据收集
          return this.critiqueEvidenceCollection(output.data);
      }
    }
    
    return null;
  }

  /**
   * 批判性思考挑战问题
   * @param keyword 关键词
   * @param problems 问题列表
   * @returns 挑战后的问题列表
   */
  private async challengeProblems(keyword: string, problems: ProblemInfo[]): Promise<ProblemInfo[]> {
    const result: ProblemInfo[] = [];
    
    // 仅挑战高价值问题
    const highValueProblems = problems
      .filter(p => p.valueAssessment && p.valueAssessment.overallValue >= 70)
      .slice(0, this.thinkerOptions.maxChallengedProblems);
    
    // 其余问题保持不变
    const unchangedProblems = problems.filter(p => 
      !highValueProblems.some(hvp => hvp.id === p.id)
    );
    
    // 对高价值问题进行批判性思考
    for (const problem of highValueProblems) {
      this.log(`对问题"${problem.title}"进行批判性思考`);
      
      // 进行批判性思考分析
      const criticalAnalysis = await this.performCriticalAnalysis(keyword, problem);
      
      result.push({
        ...problem,
        criticalAnalysis
      });
    }
    
    // 合并结果
    return [...result, ...unchangedProblems];
  }

  /**
   * 对问题进行批判性分析
   * @param keyword 关键词
   * @param problem 问题
   * @returns 批判性分析
   */
  private async performCriticalAnalysis(keyword: string, problem: ProblemInfo): Promise<any> {
    try {
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个批判性思考专家，擅长挑战假设和提供不同视角。你的任务是对给定的问题及其价值评估进行批判性分析。考虑以下几个方面:
1. 问题定义是否精确? 是否可能存在其他解释?
2. 价值评估是否基于可靠的证据? 是否考虑了不同视角?
3. 解决方案分析是否全面? 是否忽略了某些重要因素?
4. 证据是否足够? 是否存在确认偏误?
5. 市场评估是否现实? 是否考虑了潜在风险?

你的分析应该深入、有洞察力，并提供具体建议。强度级别为${this.thinkerOptions.criticalIntensity}/10。`
        },
        {
          role: 'user',
          content: `关键词: ${keyword}
问题: ${problem.title}
问题描述: ${problem.description}
证据: ${JSON.stringify(problem.evidence || [], null, 2)}
现有解决方案: ${JSON.stringify(problem.existingSolutions || [], null, 2)}
解决方案缺口: ${JSON.stringify(problem.solutionGap || {}, null, 2)}
价值评估: ${JSON.stringify(problem.valueAssessment || {}, null, 2)}

请对上述问题和评估进行批判性分析。`
        }
      ];

      // 调用LLM进行批判性分析
      return await this.llmService.chatToJSON<{
        challenges: string[];
        alternativeViewpoints: string[];
        potentialBiases: string[];
        evidenceGaps: string[];
        riskFactors: string[];
        finalVerdict: string;
        confidenceAdjustment: number;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            challenges: { type: 'array', items: { type: 'string' } },
            alternativeViewpoints: { type: 'array', items: { type: 'string' } },
            potentialBiases: { type: 'array', items: { type: 'string' } },
            evidenceGaps: { type: 'array', items: { type: 'string' } },
            riskFactors: { type: 'array', items: { type: 'string' } },
            finalVerdict: { type: 'string' },
            confidenceAdjustment: { type: 'number' }
          },
          required: ['challenges', 'alternativeViewpoints', 'potentialBiases', 'finalVerdict', 'confidenceAdjustment']
        },
        { temperature: 0.7 }
      );
    } catch (error) {
      this.log(`批判性分析失败: ${error}`, 'error');
      
      return {
        challenges: ['分析过程中出错'],
        alternativeViewpoints: ['无法提供替代视角'],
        potentialBiases: ['无法识别潜在偏见'],
        evidenceGaps: ['无法评估证据缺口'],
        riskFactors: ['无法评估风险因素'],
        finalVerdict: '分析失败，请检查问题数据',
        confidenceAdjustment: 0
      };
    }
  }

  /**
   * 质疑价值评估
   * @param data 价值评估数据
   * @returns 质疑内容
   */
  private async critiqueValueEvaluation(data: any): Promise<AgentCritique | null> {
    if (!data.problems || !Array.isArray(data.problems)) {
      return null;
    }
    
    // 检查是否存在可能过高估计的问题
    const potentiallyOvervaluedProblems = data.problems.filter((problem: any) => {
      return (
        problem.valueAssessment && 
        problem.valueAssessment.overallValue > 80 && 
        (!problem.evidence || problem.evidence.length < 3)
      );
    });
    
    if (potentiallyOvervaluedProblems.length > 0) {
      return {
        content: `一些高价值评分的问题可能缺乏足够支持证据`,
        reasons: [
          '高价值评分应基于充分的证据支持',
          '证据不足的情况下应当降低价值评估的确定性',
          '市场规模和增长潜力评估需要数据支持'
        ],
        severity: 4,
        suggestions: [
          '为高价值问题收集更多支持证据',
          '在证据有限的情况下降低价值评分的确定性',
          '明确标注基于有限证据的评估假设'
        ],
        metadata: {
          overvaluedProblems: potentiallyOvervaluedProblems.slice(0, 3).map((p: any) => p.title)
        }
      };
    }
    
    return null;
  }

  /**
   * 质疑解决方案分析
   * @param data 解决方案分析数据
   * @returns 质疑内容
   */
  private async critiqueSolutionAnalysis(data: any): Promise<AgentCritique | null> {
    if (!data.problems || !Array.isArray(data.problems)) {
      return null;
    }
    
    // 检查是否存在解决方案分析不全面的问题
    const problemsWithIncompleteAnalysis = data.problems.filter((problem: any) => {
      return (
        problem.existingSolutions && 
        problem.existingSolutions.length <= 2 && 
        problem.solutionGap && 
        problem.solutionGap.gapSize > 7
      );
    });
    
    if (problemsWithIncompleteAnalysis.length > 0) {
      return {
        content: `一些问题的解决方案分析可能不够全面`,
        reasons: [
          '只发现少量解决方案但报告大缺口可能表明分析不完整',
          '高价值市场通常会有更多的现有解决方案或尝试',
          '缺乏全面的市场研究可能导致错过重要竞争对手'
        ],
        severity: 3,
        suggestions: [
          '进行更广泛的市场研究，寻找额外的解决方案',
          '考虑非直接竞争的替代解决方案',
          '研究相邻行业的解决方案和创新'
        ],
        metadata: {
          problemsWithIncompleteAnalysis: problemsWithIncompleteAnalysis.slice(0, 3).map((p: any) => p.title)
        }
      };
    }
    
    return null;
  }

  /**
   * 质疑证据收集
   * @param data 证据收集数据
   * @returns 质疑内容
   */
  private async critiqueEvidenceCollection(data: any): Promise<AgentCritique | null> {
    if (!data.problems || !Array.isArray(data.problems)) {
      return null;
    }
    
    // 检查是否存在证据来源单一的问题
    const problemsWithLimitedEvidenceSources = data.problems.filter((problem: any) => {
      if (!problem.evidence || !Array.isArray(problem.evidence)) {
        return false;
      }
      
      // 检查证据来源是否多样
      const sources = new Set(problem.evidence.map((e: any) => e.type));
      return sources.size <= 1 && problem.evidence.length >= 3;
    });
    
    if (problemsWithLimitedEvidenceSources.length > 0) {
      return {
        content: `一些问题的证据来源可能过于单一`,
        reasons: [
          '单一来源的证据可能存在偏见或不全面',
          '多样化的证据来源有助于验证问题的真实性',
          '不同类型的证据可以提供更全面的问题视角'
        ],
        severity: 2,
        suggestions: [
          '从多种来源收集证据，如社区讨论、专家意见和市场报告',
          '尝试寻找不同观点的证据，包括支持和反对的观点',
          '评估证据的质量而非仅关注数量'
        ],
        metadata: {
          problemsWithLimitedSources: problemsWithLimitedEvidenceSources.slice(0, 3).map((p: any) => p.title)
        }
      };
    }
    
    return null;
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