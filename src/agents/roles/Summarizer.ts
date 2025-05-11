/**
 * Summarizer.ts - 总结Agent
 * 汇总关键发现并生成最终报告
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../base/EnhancedAgent';
import { AgentInput, AgentOutput, AgentCritique, ProblemInfo } from '../../types';
import { LLMService, ChatMessage } from '../../core/llm/LLMService';

/**
 * Summarizer配置选项
 */
export interface SummarizerOptions {
  // 最终报告中包含的最大问题数量
  maxProblemsInReport?: number;
  // 是否包含执行建议
  includeActionableInsights?: boolean;
  // 报告格式化选项
  reportFormat?: 'concise' | 'detailed' | 'structured';
  // 其他选项
  [key: string]: any;
}

/**
 * 总结Agent类
 * 负责汇总关键发现并生成最终报告
 */
export class Summarizer extends EnhancedAgent {
  // LLM服务
  private llmService: LLMService;
  // 配置选项
  private summarizerOptions: SummarizerOptions;

  /**
   * 构造函数
   * @param llmService LLM服务实例
   * @param options 配置选项
   */
  constructor(llmService: LLMService, options: SummarizerOptions = {}) {
    super(
      'Summarizer',
      '总结专家，负责汇总关键发现并生成最终报告',
      '研究主管',
      [
        '数据综合',
        '趋势识别',
        '洞察提炼',
        '报告生成',
        '结论提取'
      ]
    );

    this.llmService = llmService;
    this.summarizerOptions = {
      maxProblemsInReport: 5,
      includeActionableInsights: true,
      reportFormat: 'structured',
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

      // 获取CriticalThinker的输出
      const criticalOutput = previousOutputs?.CriticalThinker;
      if (!criticalOutput || !criticalOutput.problems || !Array.isArray(criticalOutput.problems)) {
        return {
          status: 'failed',
          error: '缺少CriticalThinker的有效输出',
          data: null
        };
      }

      // 收集工作流中所有代理的输出
      const allAgentOutputs = previousOutputs || {};
      
      const problems = criticalOutput.problems as ProblemInfo[];
      this.log(`开始为关键词"${keyword}"生成总结报告，问题数量: ${problems.length}`);

      // 选择最高价值问题
      const topProblems = this.selectTopProblems(problems);
      
      // 生成执行摘要
      const executiveSummary = await this.generateExecutiveSummary(keyword, topProblems, allAgentOutputs);
      
      // 生成详细报告
      const detailedReport = await this.generateDetailedReport(keyword, topProblems, allAgentOutputs);
      
      // 生成可执行洞察(如果启用)
      let actionableInsights = null;
      if (this.summarizerOptions.includeActionableInsights) {
        actionableInsights = await this.generateActionableInsights(keyword, topProblems);
      }
      
      // 最终报告结果
      const result = {
        keyword,
        executiveSummary,
        detailedReport,
        actionableInsights,
        topProblems,
        metadata: {
          totalProblemsAnalyzed: problems.length,
          includedProblemsCount: topProblems.length,
          processingTimeMs: Date.now() - input.context.state.executionMetadata.currentTime
        }
      };

      this.log(`完成总结报告: ${keyword}, 包含高价值问题数量: ${topProblems.length}`);

      return {
        status: 'success',
        data: result,
        metadata: {
          reportFormat: this.summarizerOptions.reportFormat,
          topProblemCount: topProblems.length
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`处理错误: ${errorMessage}`, 'error');
      
      return {
        status: 'failed',
        error: `总结报告生成失败: ${errorMessage}`,
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
    // 总结Agent通常不会质疑其他Agent的输出
    return null;
  }

  /**
   * 选择最高价值的问题
   * @param problems 问题列表
   * @returns 选择的高价值问题
   */
  private selectTopProblems(problems: ProblemInfo[]): ProblemInfo[] {
    // 根据价值评估排序问题
    const sortedProblems = [...problems].sort((a, b) => {
      const valueA = a.valueAssessment?.overallValue || 0;
      const valueB = b.valueAssessment?.overallValue || 0;
      return valueB - valueA; // 降序排列
    });
    
    // 选取前N个高价值问题
    return sortedProblems.slice(0, this.summarizerOptions.maxProblemsInReport);
  }

  /**
   * 生成执行摘要
   * @param keyword 关键词
   * @param problems 问题列表
   * @param allAgentOutputs 所有Agent输出
   * @returns 执行摘要
   */
  private async generateExecutiveSummary(keyword: string, problems: ProblemInfo[], allAgentOutputs: any): Promise<any> {
    try {
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个研究总监，负责生成清晰、简洁的执行摘要。你的目标是为高管们提供关键问题和机会的简明概述，突出最重要的发现和潜在价值，而无需深入技术细节。摘要应当专业、简洁且重点突出。`
        },
        {
          role: 'user',
          content: `关键词: ${keyword}
发现的高价值问题: ${JSON.stringify(problems.map(p => ({
  title: p.title,
  description: p.description,
  value: p.valueAssessment?.overallValue,
  marketSize: p.valueAssessment?.marketSize,
  growthPotential: p.valueAssessment?.growthPotential,
  solutionGap: p.solutionGap?.gapSize
})), null, 2)}

请生成一个简明扼要的执行摘要，概述这些关键问题和市场机会。包括价值最高的问题、主要市场见解和总体建议。`
        }
      ];

      // 调用LLM生成摘要
      return await this.llmService.chatToJSON<{
        summary: string;
        keyFindings: string[];
        marketOpportunity: string;
        valueProposition: string;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            keyFindings: { type: 'array', items: { type: 'string' } },
            marketOpportunity: { type: 'string' },
            valueProposition: { type: 'string' }
          },
          required: ['summary', 'keyFindings', 'marketOpportunity']
        },
        { temperature: 0.4 }
      );
    } catch (error) {
      this.log(`执行摘要生成失败: ${error}`, 'error');
      
      return {
        summary: `无法为关键词"${keyword}"生成完整的执行摘要`,
        keyFindings: ['数据处理出错'],
        marketOpportunity: '无法评估市场机会',
        valueProposition: '无法评估价值主张'
      };
    }
  }

  /**
   * 生成详细报告
   * @param keyword 关键词
   * @param problems 问题列表
   * @param allAgentOutputs 所有Agent输出
   * @returns 详细报告
   */
  private async generateDetailedReport(keyword: string, problems: ProblemInfo[], allAgentOutputs: any): Promise<any> {
    try {
      // 收集所有问题的分析结果
      const problemAnalyses = problems.map(problem => {
        const valueReport = problem.valueAssessment 
          ? this.formatValueAssessment(problem.valueAssessment)
          : '无价值评估数据';
          
        const solutionReport = problem.existingSolutions && problem.solutionGap
          ? this.formatSolutionAnalysis(problem.existingSolutions, problem.solutionGap)
          : '无解决方案分析数据';
          
        const evidenceReport = problem.evidence && problem.evidence.length > 0
          ? this.formatEvidenceSummary(problem.evidence)
          : '无证据数据';
          
        const criticalReport = problem.criticalAnalysis
          ? this.formatCriticalAnalysis(problem.criticalAnalysis)
          : '无批判性思考分析';
          
        return {
          id: problem.id,
          title: problem.title,
          description: problem.description,
          value: valueReport,
          solutions: solutionReport,
          evidence: evidenceReport,
          criticalAnalysis: criticalReport
        };
      });
      
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个研究部门负责人，负责生成全面、详细的研究报告。你的报告应当包含深入分析，结构清晰，突出关键见解，并支持每个结论的证据和推理。格式应专业、有条理，适合内部决策使用。`
        },
        {
          role: 'user',
          content: `关键词: ${keyword}
问题分析列表: ${JSON.stringify(problemAnalyses, null, 2)}

请生成一份结构化的详细报告，深入分析这些问题和市场机会。报告应包括问题概述、市场分析、解决方案分析、证据总结和批判思考见解。为每个部分提供标题和内容。`
        }
      ];

      // 调用LLM生成详细报告
      return await this.llmService.chatToJSON<{
        title: string;
        introduction: string;
        marketContext: string;
        sections: Array<{
          title: string;
          content: string;
          subsections?: Array<{
            title: string;
            content: string;
          }>;
        }>;
        conclusion: string;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            title: { type: 'string' },
            introduction: { type: 'string' },
            marketContext: { type: 'string' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  subsections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        content: { type: 'string' }
                      },
                      required: ['title', 'content']
                    }
                  }
                },
                required: ['title', 'content']
              }
            },
            conclusion: { type: 'string' }
          },
          required: ['title', 'introduction', 'sections', 'conclusion']
        },
        { temperature: 0.5 }
      );
    } catch (error) {
      this.log(`详细报告生成失败: ${error}`, 'error');
      
      return {
        title: `${keyword}问题分析报告`,
        introduction: `无法为关键词"${keyword}"生成完整的详细报告`,
        marketContext: '无法提供市场上下文',
        sections: [
          {
            title: '处理错误',
            content: '在生成详细报告时发生了错误'
          }
        ],
        conclusion: '由于处理错误，无法提供结论'
      };
    }
  }

  /**
   * 生成可执行洞察
   * @param keyword 关键词
   * @param problems 问题列表
   * @returns 可执行洞察
   */
  private async generateActionableInsights(keyword: string, problems: ProblemInfo[]): Promise<any> {
    try {
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个战略顾问，负责转化研究发现为可行的战略方向。你的目标是提供明确、实用的建议，突出关键机会并提出具体行动步骤。建议应该基于数据和分析，关注价值最高的机会，并提供明确的下一步行动。`
        },
        {
          role: 'user',
          content: `关键词: ${keyword}
问题列表: ${JSON.stringify(problems.map(p => ({
  title: p.title,
  description: p.description,
  value: p.valueAssessment?.overallValue,
  marketSize: p.valueAssessment?.marketSize,
  growthPotential: p.valueAssessment?.growthPotential,
  solutionGap: p.solutionGap?.description,
  gapSize: p.solutionGap?.gapSize,
  unmetNeeds: p.solutionGap?.unmetNeeds
})), null, 2)}

请根据这些问题和市场机会，生成详细的可执行洞察。包括战略建议、下一步行动和潜在的研究方向。为每个主要问题提供具体的建议和执行步骤。`
        }
      ];

      // 调用LLM生成可执行洞察
      return await this.llmService.chatToJSON<{
        strategicRecommendations: Array<{
          title: string;
          description: string;
          rationale: string;
          priority: string;
        }>;
        nextSteps: Array<{
          action: string;
          description: string;
          timeframe: string;
        }>;
        researchOpportunities: string[];
        keyConsiderations: string[];
      }>(
        messages,
        {
          type: 'object',
          properties: {
            strategicRecommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  rationale: { type: 'string' },
                  priority: { type: 'string' }
                },
                required: ['title', 'description', 'priority']
              }
            },
            nextSteps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  description: { type: 'string' },
                  timeframe: { type: 'string' }
                },
                required: ['action', 'description']
              }
            },
            researchOpportunities: {
              type: 'array',
              items: { type: 'string' }
            },
            keyConsiderations: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['strategicRecommendations', 'nextSteps']
        },
        { temperature: 0.6 }
      );
    } catch (error) {
      this.log(`可执行洞察生成失败: ${error}`, 'error');
      
      return {
        strategicRecommendations: [
          {
            title: '无法生成战略建议',
            description: '处理数据时发生错误',
            rationale: '技术错误',
            priority: '未知'
          }
        ],
        nextSteps: [
          {
            action: '重新运行分析',
            description: '尝试重新运行工作流以获取可执行洞察',
            timeframe: '立即'
          }
        ],
        researchOpportunities: ['无法确定研究机会'],
        keyConsiderations: ['数据处理出错']
      };
    }
  }

  /**
   * 格式化价值评估
   * @param assessment 价值评估
   * @returns 格式化后的价值评估
   */
  private formatValueAssessment(assessment: any): string {
    const parts = [];
    
    if (assessment.overallValue !== undefined) {
      parts.push(`整体价值评分: ${assessment.overallValue}/100`);
    }
    
    if (assessment.marketSize !== undefined) {
      parts.push(`市场规模评分: ${assessment.marketSize}/10`);
    }
    
    if (assessment.urgency !== undefined) {
      parts.push(`紧迫性评分: ${assessment.urgency}/10`);
    }
    
    if (assessment.competition !== undefined) {
      parts.push(`竞争强度评分: ${assessment.competition}/10`);
    }
    
    if (assessment.growthPotential !== undefined) {
      parts.push(`增长潜力评分: ${assessment.growthPotential}/10`);
    }
    
    if (assessment.reasoning) {
      parts.push('评估理由:');
      
      for (const [key, value] of Object.entries(assessment.reasoning)) {
        if (value) {
          parts.push(`- ${key}: ${value}`);
        }
      }
    }
    
    if (assessment.roi) {
      parts.push(`ROI评分: ${assessment.roi.score}/10`);
      parts.push(`ROI分析: ${assessment.roi.analysis}`);
    }
    
    return parts.join('\n');
  }

  /**
   * 格式化解决方案分析
   * @param solutions 解决方案列表
   * @param gap 解决方案缺口
   * @returns 格式化后的解决方案分析
   */
  private formatSolutionAnalysis(solutions: any[], gap: any): string {
    const parts = [];
    
    parts.push(`发现的解决方案数量: ${solutions.length}`);
    
    if (solutions.length > 0) {
      parts.push('主要解决方案:');
      
      for (const solution of solutions.slice(0, 3)) {
        parts.push(`- ${solution.name}: 满足度评分 ${solution.satisfactionScore}/10`);
        
        if (solution.strengths && solution.strengths.length > 0) {
          parts.push(`  优势: ${solution.strengths.join(', ')}`);
        }
        
        if (solution.weaknesses && solution.weaknesses.length > 0) {
          parts.push(`  劣势: ${solution.weaknesses.join(', ')}`);
        }
      }
    }
    
    parts.push(`解决方案缺口大小: ${gap.gapSize}/10`);
    parts.push(`缺口描述: ${gap.description}`);
    
    if (gap.unmetNeeds && gap.unmetNeeds.length > 0) {
      parts.push('未满足需求:');
      
      for (const need of gap.unmetNeeds) {
        parts.push(`- ${need}`);
      }
    }
    
    return parts.join('\n');
  }

  /**
   * 格式化证据摘要
   * @param evidence 证据列表
   * @returns 格式化后的证据摘要
   */
  private formatEvidenceSummary(evidence: any[]): string {
    const parts = [];
    
    parts.push(`证据数量: ${evidence.length}`);
    
    // 按信心排序
    const sortedEvidence = [...evidence].sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );
    
    // 取前3个高信心证据
    for (const e of sortedEvidence.slice(0, 3)) {
      parts.push(`- ${e.text}`);
      parts.push(`  来源: ${e.source}, 信心: ${e.confidence}`);
    }
    
    // 按类型统计证据
    const typeCount: Record<string, number> = {};
    for (const e of evidence) {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    }
    
    parts.push('证据类型分布:');
    for (const [type, count] of Object.entries(typeCount)) {
      parts.push(`- ${type}: ${count}个证据`);
    }
    
    return parts.join('\n');
  }

  /**
   * 格式化批判性分析
   * @param analysis 批判性分析
   * @returns 格式化后的批判性分析
   */
  private formatCriticalAnalysis(analysis: any): string {
    const parts = [];
    
    parts.push(`最终判断: ${analysis.finalVerdict}`);
    parts.push(`信心调整: ${analysis.confidenceAdjustment > 0 ? '+' : ''}${analysis.confidenceAdjustment}%`);
    
    if (analysis.challenges && analysis.challenges.length > 0) {
      parts.push('主要挑战:');
      for (const challenge of analysis.challenges) {
        parts.push(`- ${challenge}`);
      }
    }
    
    if (analysis.alternativeViewpoints && analysis.alternativeViewpoints.length > 0) {
      parts.push('替代视角:');
      for (const viewpoint of analysis.alternativeViewpoints) {
        parts.push(`- ${viewpoint}`);
      }
    }
    
    if (analysis.potentialBiases && analysis.potentialBiases.length > 0) {
      parts.push('潜在偏见:');
      for (const bias of analysis.potentialBiases) {
        parts.push(`- ${bias}`);
      }
    }
    
    if (analysis.riskFactors && analysis.riskFactors.length > 0) {
      parts.push('风险因素:');
      for (const risk of analysis.riskFactors) {
        parts.push(`- ${risk}`);
      }
    }
    
    return parts.join('\n');
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