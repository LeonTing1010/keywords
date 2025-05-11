/**
 * SolutionAnalyzer.ts - 解决方案分析Agent
 * 分析问题的现有解决方案，评估其充分性和缺口
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../base/EnhancedAgent';
import { AgentInput, AgentOutput, AgentCritique, ProblemInfo } from '../../types';
import { LLMService, ChatMessage } from '../../core/llm/LLMService';

/**
 * SolutionAnalyzer配置选项
 */
export interface SolutionAnalyzerOptions {
  // 每个问题分析的最大解决方案数量
  maxSolutionsPerProblem?: number;
  // 最低分析信心阈值(0-1)
  confidenceThreshold?: number;
  // 是否执行竞品分析
  performCompetitorAnalysis?: boolean;
  // 是否分析用户评论
  analyzeUserReviews?: boolean;
  // 其他选项
  [key: string]: any;
}

/**
 * 解决方案分析Agent类
 * 负责分析问题的现有解决方案并评估其充分性
 */
export class SolutionAnalyzer extends EnhancedAgent {
  // LLM服务
  private llmService: LLMService;
  // 配置选项
  private analyzerOptions: SolutionAnalyzerOptions;

  /**
   * 构造函数
   * @param llmService LLM服务实例
   * @param options 配置选项
   */
  constructor(llmService: LLMService, options: SolutionAnalyzerOptions = {}) {
    super(
      'SolutionAnalyzer',
      '解决方案分析专家，负责分析现有解决方案的充分性和缺口',
      '解决方案评估师',
      [
        '市场分析',
        '竞品评估',
        '方案对比',
        '用户反馈分析',
        '解决方案缺口识别'
      ]
    );

    this.llmService = llmService;
    this.analyzerOptions = {
      maxSolutionsPerProblem: 5,
      confidenceThreshold: 0.7,
      performCompetitorAnalysis: true,
      analyzeUserReviews: true,
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

      // 获取EvidenceCollector的输出
      const evidenceOutput = previousOutputs?.EvidenceCollector;
      if (!evidenceOutput || !evidenceOutput.problems || !Array.isArray(evidenceOutput.problems)) {
        return {
          status: 'failed',
          error: '缺少EvidenceCollector的有效输出',
          data: null
        };
      }

      const problems = evidenceOutput.problems as ProblemInfo[];
      this.log(`开始分析关键词"${keyword}"的问题解决方案，问题数量: ${problems.length}`);

      // 分析每个问题的现有解决方案
      const problemsWithSolutions = await this.analyzeSolutionsForProblems(keyword, problems);

      // 识别解决方案缺口
      const problemsWithGaps = await this.identifySolutionGaps(problemsWithSolutions);

      // 最终处理结果
      const result = {
        keyword,
        problems: problemsWithGaps,
        metadata: {
          totalProblemsAnalyzed: problems.length,
          processingTimeMs: Date.now() - input.context.state.executionMetadata.currentTime
        }
      };

      this.log(`完成解决方案分析: ${keyword}, 分析问题数量: ${problemsWithGaps.length}`);

      return {
        status: 'success',
        data: result,
        metadata: {
          analyzedProblemCount: problemsWithGaps.length
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`处理错误: ${errorMessage}`, 'error');
      
      return {
        status: 'failed',
        error: `解决方案分析失败: ${errorMessage}`,
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
    // 对ValueEvaluator的输出进行质疑
    if (agentName === 'ValueEvaluator' && output.status === 'success') {
      const data = output.data;
      
      // 检查是否存在竞争评估明显不正确的问题
      if (data.problems && Array.isArray(data.problems)) {
        const problemsWithIncorrectCompetition = data.problems.filter((problem: any) => {
          // 如果解决方案分析显示有很多竞品,但竞争评分却很低
          return (
            problem.existingSolutions && 
            problem.existingSolutions.length > 3 && 
            problem.valueAssessment && 
            problem.valueAssessment.competition < 3
          );
        });
        
        if (problemsWithIncorrectCompetition.length > 0) {
          return {
            content: `一些问题的竞争强度评估可能不准确`,
            reasons: [
              '存在多个现有解决方案的市场通常具有较高的竞争强度',
              '竞争评分过低与市场上解决方案的数量不符',
              '需要考虑现有解决方案的市场份额和用户满意度'
            ],
            severity: 3,
            suggestions: [
              '建议根据现有解决方案的数量重新评估竞争强度',
              '考虑主要参与者的市场份额作为竞争评估的因素',
              '分析主要解决方案的用户满意度和市场接受度'
            ],
            metadata: {
              problemsWithIncorrectEvaluation: problemsWithIncorrectCompetition.map((p: any) => p.title)
            }
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 为问题列表分析现有解决方案
   * @param keyword 关键词
   * @param problems 问题列表
   * @returns 带有解决方案分析的问题列表
   */
  private async analyzeSolutionsForProblems(keyword: string, problems: ProblemInfo[]): Promise<ProblemInfo[]> {
    const enhancedProblems: ProblemInfo[] = [];
    
    for (const problem of problems) {
      this.log(`分析问题"${problem.title}"的现有解决方案`);
      
      // 1. 搜索现有解决方案
      const solutions = await this.searchExistingSolutions(keyword, problem);
      
      // 2. 如果启用，执行竞品分析
      let enhancedSolutions = solutions;
      if (this.analyzerOptions.performCompetitorAnalysis && solutions.length > 0) {
        enhancedSolutions = await this.performCompetitorAnalysis(solutions);
      }
      
      // 3. 如果启用，分析用户评论
      if (this.analyzerOptions.analyzeUserReviews && enhancedSolutions.length > 0) {
        enhancedSolutions = await this.analyzeUserReviews(enhancedSolutions);
      }
      
      // 添加增强后的问题
      enhancedProblems.push({
        ...problem,
        existingSolutions: enhancedSolutions
      });
    }
    
    return enhancedProblems;
  }

  /**
   * 搜索问题的现有解决方案
   * @param keyword 关键词
   * @param problem 问题
   * @returns 解决方案列表
   */
  private async searchExistingSolutions(keyword: string, problem: ProblemInfo): Promise<any[]> {
    try {
      // 构建搜索查询
      const searchQuery = `${keyword} ${problem.title} 解决方案 工具 产品`;
      
      // 如果有搜索工具，使用搜索工具
      if (this.hasToolRegistered('searchSolutions')) {
        const result = await this.useTool('searchSolutions', {
          query: searchQuery,
          maxResults: this.analyzerOptions.maxSolutionsPerProblem
        });
        
        if (result.success && result.data && Array.isArray(result.data)) {
          return this.processSolutionSearchResults(result.data, problem);
        }
      }
      
      // 如果没有工具或工具执行失败，使用LLM生成可能的解决方案
      return this.generatePotentialSolutions(keyword, problem);
    } catch (error) {
      this.log(`搜索解决方案失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 处理解决方案搜索结果
   * @param searchResults 搜索结果
   * @param problem 问题
   * @returns 处理后的解决方案列表
   */
  private async processSolutionSearchResults(searchResults: any[], problem: ProblemInfo): Promise<any[]> {
    // 如果搜索结果为空，返回空数组
    if (searchResults.length === 0) {
      return [];
    }
    
    // 使用LLM分析搜索结果，提取有效的解决方案
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个解决方案分析专家。请从给定的搜索结果中提取出针对特定问题的现有解决方案。对于每个解决方案，提供其名称、描述、主要优势和劣势，以及对用户需求的满足程度评分。只分析真正的解决方案，忽略不相关的结果。`
      },
      {
        role: 'user',
        content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n以下是搜索结果，请从中提取有效的解决方案并进行分析:\n\n${JSON.stringify(searchResults, null, 2)}`
      }
    ];

    try {
      // 调用LLM分析
      const solutions = await this.llmService.chatToJSON<Array<{
        name: string;
        description: string;
        strengths: string[];
        weaknesses: string[];
        satisfactionScore: number;
        confidence: number;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              satisfactionScore: { type: 'number' },
              confidence: { type: 'number' }
            },
            required: ['name', 'description', 'strengths', 'weaknesses', 'satisfactionScore', 'confidence']
          }
        },
        { temperature: 0.3 }
      );
      
      // 过滤掉低信心的解决方案
      return solutions
        .filter(solution => solution.confidence >= this.analyzerOptions.confidenceThreshold!)
        .map(({ confidence, ...solution }) => solution); // 移除confidence字段
    } catch (error) {
      this.log(`处理解决方案搜索结果失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 使用LLM生成潜在解决方案
   * @param keyword 关键词
   * @param problem 问题
   * @returns 解决方案列表
   */
  private async generatePotentialSolutions(keyword: string, problem: ProblemInfo): Promise<any[]> {
    // 创建提示消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个市场研究专家，精通各类问题的现有解决方案。请根据给定的问题，生成市场上可能存在的解决方案列表。对于每个解决方案，提供名称、描述、主要优势、主要劣势以及其满足用户需求的程度评分(1-10)。只包括真实存在的或很可能存在的解决方案，不要创造虚构的产品。`
      },
      {
        role: 'user',
        content: `关键词: ${keyword}\n问题: ${problem.title}\n问题描述: ${problem.description}\n\n请列出解决该问题的现有市场解决方案(如产品、服务、工具等)。`
      }
    ];

    try {
      // 调用LLM生成解决方案
      const solutions = await this.llmService.chatToJSON<Array<{
        name: string;
        description: string;
        strengths: string[];
        weaknesses: string[];
        satisfactionScore: number;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              satisfactionScore: { type: 'number' }
            },
            required: ['name', 'description', 'strengths', 'weaknesses', 'satisfactionScore']
          }
        },
        { temperature: 0.7 }
      );
      
      return solutions;
    } catch (error) {
      this.log(`生成潜在解决方案失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 执行竞品分析，增强解决方案信息
   * @param solutions 解决方案列表
   * @returns 增强后的解决方案列表
   */
  private async performCompetitorAnalysis(solutions: any[]): Promise<any[]> {
    // 如果解决方案少于2个，无需竞品分析
    if (solutions.length < 2) {
      return solutions;
    }
    
    try {
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个竞品分析专家。请分析给定的一组解决方案，进行深入的竞争对比分析。识别每个解决方案相对于其他解决方案的独特优势和劣势，并评估它们的市场定位和差异化策略。考虑价格、功能、用户体验、目标用户群等维度。`
        },
        {
          role: 'user',
          content: `请对以下解决方案进行竞品分析，增强它们的优势和劣势列表，并调整满足度评分:\n\n${JSON.stringify(solutions, null, 2)}`
        }
      ];

      // 调用LLM进行竞品分析
      const enhancedSolutions = await this.llmService.chatToJSON<Array<{
        name: string;
        description: string;
        strengths: string[];
        weaknesses: string[];
        satisfactionScore: number;
        marketPosition?: string;
        targetAudience?: string;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              satisfactionScore: { type: 'number' },
              marketPosition: { type: 'string' },
              targetAudience: { type: 'string' }
            },
            required: ['name', 'description', 'strengths', 'weaknesses', 'satisfactionScore']
          }
        },
        { temperature: 0.4 }
      );
      
      return enhancedSolutions;
    } catch (error) {
      this.log(`竞品分析失败: ${error}`, 'error');
      return solutions; // 出错时返回原始解决方案
    }
  }

  /**
   * 分析用户评论，增强解决方案信息
   * @param solutions 解决方案列表
   * @returns 增强后的解决方案列表
   */
  private async analyzeUserReviews(solutions: any[]): Promise<any[]> {
    const enhancedSolutions = [...solutions];
    
    // 如果有用户评论分析工具，使用工具
    if (this.hasToolRegistered('analyzeReviews')) {
      try {
        for (let i = 0; i < enhancedSolutions.length; i++) {
          const solution = enhancedSolutions[i];
          
          const result = await this.useTool('analyzeReviews', {
            productName: solution.name,
            maxReviews: 20
          });
          
          if (result.success && result.data) {
            // 使用LLM分析用户评论
            const reviewAnalysis = await this.analyzeReviewsWithLLM(solution, result.data);
            
            // 更新解决方案信息
            if (reviewAnalysis) {
              enhancedSolutions[i] = {
                ...solution,
                strengths: [...new Set([...solution.strengths, ...reviewAnalysis.additionalStrengths])],
                weaknesses: [...new Set([...solution.weaknesses, ...reviewAnalysis.additionalWeaknesses])],
                satisfactionScore: 
                  (solution.satisfactionScore * 0.7) + (reviewAnalysis.userSatisfactionScore * 0.3),
                userFeedback: reviewAnalysis.summary
              };
            }
          }
        }
      } catch (error) {
        this.log(`用户评论分析失败: ${error}`, 'error');
      }
    }
    
    return enhancedSolutions;
  }

  /**
   * 使用LLM分析用户评论
   * @param solution 解决方案
   * @param reviews 用户评论
   * @returns 分析结果
   */
  private async analyzeReviewsWithLLM(solution: any, reviews: any[]): Promise<any | null> {
    try {
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个用户体验研究专家。请分析给定产品的用户评论，提取用户反馈中提到的额外优势和劣势，生成总体满意度评分，并撰写简短的用户反馈总结。`
        },
        {
          role: 'user',
          content: `产品名称: ${solution.name}\n产品描述: ${solution.description}\n\n请分析以下用户评论:\n\n${JSON.stringify(reviews, null, 2)}`
        }
      ];

      // 调用LLM分析评论
      return await this.llmService.chatToJSON<{
        additionalStrengths: string[];
        additionalWeaknesses: string[];
        userSatisfactionScore: number;
        summary: string;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            additionalStrengths: { type: 'array', items: { type: 'string' } },
            additionalWeaknesses: { type: 'array', items: { type: 'string' } },
            userSatisfactionScore: { type: 'number' },
            summary: { type: 'string' }
          },
          required: ['additionalStrengths', 'additionalWeaknesses', 'userSatisfactionScore', 'summary']
        },
        { temperature: 0.3 }
      );
    } catch (error) {
      this.log(`用户评论LLM分析失败: ${error}`, 'error');
      return null;
    }
  }

  /**
   * 识别解决方案缺口
   * @param problems 带有解决方案的问题列表
   * @returns 带有缺口分析的问题列表
   */
  private async identifySolutionGaps(problems: ProblemInfo[]): Promise<ProblemInfo[]> {
    const problemsWithGaps: ProblemInfo[] = [];
    
    for (const problem of problems) {
      const solutions = problem.existingSolutions || [];
      
      // 如果没有找到解决方案，标记为完全缺口
      if (solutions.length === 0) {
        problemsWithGaps.push({
          ...problem,
          solutionGap: {
            description: '市场上未发现有效解决方案',
            unmetNeeds: ['完整解决方案缺失'],
            gapSize: 10 // 最大缺口
          }
        });
        continue;
      }
      
      // 使用LLM分析解决方案缺口
      const gap = await this.analyzeSolutionGap(problem, solutions);
      
      problemsWithGaps.push({
        ...problem,
        solutionGap: gap
      });
    }
    
    return problemsWithGaps;
  }

  /**
   * 分析单个问题的解决方案缺口
   * @param problem 问题
   * @param solutions 解决方案列表
   * @returns 缺口分析
   */
  private async analyzeSolutionGap(problem: ProblemInfo, solutions: any[]): Promise<any> {
    try {
      // 计算平均满足度
      const avgSatisfaction = solutions.reduce(
        (sum, solution) => sum + (solution.satisfactionScore || 0), 
        0
      ) / solutions.length;
      
      // 如果平均满足度高于8.5，可能没有显著缺口
      if (avgSatisfaction > 8.5) {
        return {
          description: '现有解决方案基本满足需求，缺口较小',
          unmetNeeds: ['可能存在边缘场景未覆盖'],
          gapSize: 2 // 小缺口
        };
      }
      
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个解决方案缺口分析专家。请分析特定问题的现有解决方案，识别未满足的用户需求和市场机会。评估缺口大小，并清晰描述缺口的本质。考虑价格、可访问性、易用性、功能完整性、集成能力等多个维度。`
        },
        {
          role: 'user',
          content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n请分析以下现有解决方案，识别未被满足的需求和市场缺口:\n\n${JSON.stringify(solutions, null, 2)}`
        }
      ];

      // 调用LLM分析缺口
      return await this.llmService.chatToJSON<{
        description: string;
        unmetNeeds: string[];
        gapSize: number;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            description: { type: 'string' },
            unmetNeeds: { type: 'array', items: { type: 'string' } },
            gapSize: { type: 'number' }
          },
          required: ['description', 'unmetNeeds', 'gapSize']
        },
        { temperature: 0.4 }
      );
    } catch (error) {
      this.log(`解决方案缺口分析失败: ${error}`, 'error');
      
      // 提供默认缺口分析
      return {
        description: '无法详细分析解决方案缺口',
        unmetNeeds: ['数据不足，无法确定具体未满足需求'],
        gapSize: 5 // 中等缺口
      };
    }
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