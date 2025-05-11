/**
 * EvidenceCollector.ts - 证据收集Agent
 * 为潜在问题收集支持证据，验证问题的真实存在性
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../base/EnhancedAgent';
import { AgentInput, AgentOutput, AgentCritique, ProblemInfo } from '../../types';
import { LLMService, ChatMessage } from '../../core/llm/LLMService';

/**
 * EvidenceCollector配置选项
 */
export interface EvidenceCollectorOptions {
  // 每个问题的最大证据数量
  maxEvidencePerProblem?: number;
  // 证据信心阈值(0-1)，低于此值的证据将被丢弃
  confidenceThreshold?: number;
  // 搜索深度
  searchDepth?: number;
  // 是否使用多来源验证
  useMultipleSources?: boolean;
  // 其他选项
  [key: string]: any;
}

/**
 * 证据收集Agent类
 * 负责验证问题并收集支持证据
 */
export class EvidenceCollector extends EnhancedAgent {
  // LLM服务
  private llmService: LLMService;
  // 配置选项
  private collectorOptions: EvidenceCollectorOptions;

  /**
   * 构造函数
   * @param llmService LLM服务实例
   * @param options 配置选项
   */
  constructor(llmService: LLMService, options: EvidenceCollectorOptions = {}) {
    super(
      'EvidenceCollector',
      '证据收集专家，负责验证问题存在性并收集支持证据',
      '证据分析师',
      [
        '深度搜索',
        '社区数据分析',
        '证据质量评估',
        '数据提取',
        '趋势分析'
      ]
    );

    this.llmService = llmService;
    this.collectorOptions = {
      maxEvidencePerProblem: 5,
      confidenceThreshold: 0.6,
      searchDepth: 2,
      useMultipleSources: true,
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

      // 获取ProblemMiner的输出
      const minerOutput = previousOutputs?.ProblemMiner;
      if (!minerOutput || !minerOutput.problems || !Array.isArray(minerOutput.problems)) {
        return {
          status: 'failed',
          error: '缺少ProblemMiner的有效输出',
          data: null
        };
      }

      const problems = minerOutput.problems as ProblemInfo[];
      this.log(`开始为关键词"${keyword}"收集问题证据，问题数量: ${problems.length}`);

      // 为每个问题收集证据
      const problemsWithEvidence = await this.collectEvidenceForProblems(keyword, problems);

      // 评估证据质量和整体可信度
      const verifiedProblems = await this.evaluateEvidence(problemsWithEvidence);

      // 最终处理结果
      const result = {
        keyword,
        problems: verifiedProblems,
        metadata: {
          totalProblemsProcessed: problems.length,
          totalVerifiedProblems: verifiedProblems.length,
          processingTimeMs: Date.now() - input.context.state.executionMetadata.currentTime
        }
      };

      this.log(`完成证据收集: ${keyword}, 验证问题数量: ${verifiedProblems.length}`);

      return {
        status: 'success',
        data: result,
        metadata: {
          verifiedProblemCount: verifiedProblems.length
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`处理错误: ${errorMessage}`, 'error');
      
      return {
        status: 'failed',
        error: `证据收集失败: ${errorMessage}`,
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
    // 主要针对ProblemMiner的输出进行质疑
    if (agentName === 'ProblemMiner' && output.status === 'success') {
      const data = output.data;
      
      // 检查是否有缺少证据支持的高价值问题
      if (data.problems && Array.isArray(data.problems)) {
        const highValueProblemsWithoutEvidence = data.problems.filter((problem: any) => {
          return (
            problem.value?.overall > 80 && // 高价值问题
            (!problem.evidence || problem.evidence.length === 0) // 没有证据
          );
        });
        
        if (highValueProblemsWithoutEvidence.length > 0) {
          return {
            content: `发现一些高价值问题缺乏充分的支持证据`,
            reasons: [
              '高价值问题应当有足够的证据支持',
              '缺乏证据的问题可能是假设性的，不代表真实需求',
              '证据的多样性和质量对问题价值评估至关重要'
            ],
            severity: 3,
            suggestions: [
              '建议为这些问题添加更多支持证据',
              '可以从多个来源收集证据以增加可信度',
              '考虑降低缺乏证据支持的问题的价值评分'
            ],
            metadata: {
              problemsWithoutEvidence: highValueProblemsWithoutEvidence.map((p: any) => p.title)
            }
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 为问题列表收集证据
   * @param keyword 关键词
   * @param problems 问题列表
   * @returns 带有证据的问题列表
   */
  private async collectEvidenceForProblems(keyword: string, problems: ProblemInfo[]): Promise<ProblemInfo[]> {
    const enhancedProblems: ProblemInfo[] = [];
    
    for (const problem of problems) {
      this.log(`收集问题"${problem.title}"的证据`);
      
      // 已有证据
      let evidences = problem.evidence || [];
      
      // 1. 收集搜索引擎证据
      if (this.hasToolRegistered('searchEvidence')) {
        const searchEvidences = await this.collectSearchEvidence(keyword, problem);
        evidences = [...evidences, ...searchEvidences];
      }
      
      // 2. 收集社区数据证据
      if (this.hasToolRegistered('searchCommunity') && this.collectorOptions.useMultipleSources) {
        const communityEvidences = await this.collectCommunityEvidence(keyword, problem);
        evidences = [...evidences, ...communityEvidences];
      }
      
      // 3. 收集趋势数据证据
      if (this.hasToolRegistered('analyzeTrends') && this.collectorOptions.useMultipleSources) {
        const trendEvidences = await this.collectTrendEvidence(keyword, problem);
        evidences = [...evidences, ...trendEvidences];
      }
      
      // 4. 使用LLM综合已有证据生成额外见解
      if (evidences.length > 0) {
        const insightEvidence = await this.generateEvidenceInsights(problem, evidences);
        if (insightEvidence) {
          evidences.push(insightEvidence);
        }
      }
      
      // 限制每个问题的证据数量
      evidences = evidences
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, this.collectorOptions.maxEvidencePerProblem);
      
      // 添加增强后的问题
      enhancedProblems.push({
        ...problem,
        evidence: evidences
      });
    }
    
    return enhancedProblems;
  }

  /**
   * 评估证据质量并确定问题可信度
   * @param problems 问题列表
   * @returns 评估后的问题列表
   */
  private async evaluateEvidence(problems: ProblemInfo[]): Promise<ProblemInfo[]> {
    const verifiedProblems: ProblemInfo[] = [];
    
    for (const problem of problems) {
      // 计算问题的整体可信度
      let overallConfidence = 0;
      let totalWeight = 0;
      
      const evidences = problem.evidence || [];
      
      if (evidences.length === 0) {
        // 没有证据的问题直接跳过
        continue;
      }
      
      // 按证据类型分配权重
      for (const evidence of evidences) {
        let weight = 1;
        
        // 根据证据类型调整权重
        switch (evidence.type) {
          case 'search':
            weight = 1;
            break;
          case 'forum':
            weight = 1.2;
            break;
          case 'social':
            weight = 0.8;
            break;
          case 'expert':
            weight = 1.5;
            break;
          default:
            weight = 1;
        }
        
        overallConfidence += (evidence.confidence || 0) * weight;
        totalWeight += weight;
      }
      
      // 计算加权平均可信度
      const avgConfidence = totalWeight > 0 ? overallConfidence / totalWeight : 0;
      
      // 如果可信度超过阈值，添加到验证问题列表
      if (avgConfidence >= this.collectorOptions.confidenceThreshold!) {
        verifiedProblems.push({
          ...problem,
          metadata: {
            ...problem.metadata,
            overallConfidence: avgConfidence,
            verifiedByEvidenceCollector: true
          }
        });
      }
    }
    
    return verifiedProblems;
  }

  /**
   * 从搜索引擎收集证据
   * @param keyword 关键词
   * @param problem 问题
   * @returns 证据列表
   */
  private async collectSearchEvidence(keyword: string, problem: ProblemInfo): Promise<any[]> {
    try {
      // 构建搜索查询
      const searchQuery = `${keyword} ${problem.title}`;
      
      // 使用搜索工具
      const result = await this.useTool('searchEvidence', {
        query: searchQuery,
        depth: this.collectorOptions.searchDepth,
        maxResults: this.collectorOptions.maxEvidencePerProblem
      });
      
      if (!result.success || !result.data || !Array.isArray(result.data)) {
        return [];
      }
      
      const searchResults = result.data;
      
      // 使用LLM分析搜索结果
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个专业的证据分析师。请分析给定的搜索结果，确定它们是否支持特定问题的存在。评估每个搜索结果作为证据的质量和相关性，并提供信心评分。只保留真正支持问题存在的证据。`
        },
        {
          role: 'user',
          content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n以下是搜索结果，请分析它们是否支持这个问题的存在，并评估每个结果的证据质量:\n\n${JSON.stringify(searchResults, null, 2)}`
        }
      ];

      // 调用LLM分析
      const evidences = await this.llmService.chatToJSON<Array<{
        text: string;
        source: string;
        relevance: number;
        confidence: number;
        url?: string;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              source: { type: 'string' },
              relevance: { type: 'number' },
              confidence: { type: 'number' },
              url: { type: 'string' }
            },
            required: ['text', 'source', 'confidence']
          }
        },
        { temperature: 0.3 }
      );
      
      // 转换为标准证据格式并过滤低质量证据
      return evidences
        .filter(ev => ev.confidence >= this.collectorOptions.confidenceThreshold!)
        .map(ev => ({
          text: ev.text,
          source: ev.source,
          type: 'search',
          confidence: ev.confidence,
          url: ev.url
        }));
    } catch (error) {
      this.log(`搜索证据收集失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 从社区数据收集证据
   * @param keyword 关键词
   * @param problem 问题
   * @returns 证据列表
   */
  private async collectCommunityEvidence(keyword: string, problem: ProblemInfo): Promise<any[]> {
    try {
      // 使用社区搜索工具
      const result = await this.useTool('searchCommunity', {
        keyword: `${keyword} ${problem.title}`,
        sources: ['reddit', 'quora', 'stackoverflow', 'twitter'],
        limit: this.collectorOptions.maxEvidencePerProblem
      });
      
      if (!result.success || !result.data || !Array.isArray(result.data)) {
        return [];
      }
      
      const communityPosts = result.data;
      
      // 使用LLM分析社区帖子
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个社区数据分析专家。请分析给定的社区帖子，确定它们是否能作为特定问题存在的有力证据。评估每个帖子的相关性、真实性和代表性，并给出信心评分。`
        },
        {
          role: 'user',
          content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n以下是社区帖子，请分析它们是否支持这个问题的存在:\n\n${JSON.stringify(communityPosts, null, 2)}`
        }
      ];

      // 调用LLM分析
      const evidences = await this.llmService.chatToJSON<Array<{
        text: string;
        source: string;
        evidenceType: string;
        confidence: number;
        url?: string;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              source: { type: 'string' },
              evidenceType: { type: 'string' },
              confidence: { type: 'number' },
              url: { type: 'string' }
            },
            required: ['text', 'source', 'evidenceType', 'confidence']
          }
        },
        { temperature: 0.3 }
      );
      
      // 转换为标准证据格式
      return evidences
        .filter(ev => ev.confidence >= this.collectorOptions.confidenceThreshold!)
        .map(ev => ({
          text: ev.text,
          source: ev.source,
          type: ev.evidenceType === 'forum' ? 'forum' : 'social',
          confidence: ev.confidence,
          url: ev.url
        }));
    } catch (error) {
      this.log(`社区证据收集失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 收集趋势数据证据
   * @param keyword 关键词
   * @param problem 问题
   * @returns 证据列表
   */
  private async collectTrendEvidence(keyword: string, problem: ProblemInfo): Promise<any[]> {
    try {
      // 使用趋势分析工具
      const result = await this.useTool('analyzeTrends', {
        keyword: `${keyword} ${problem.title}`,
        timeRange: 'last_5_years'
      });
      
      if (!result.success || !result.data) {
        return [];
      }
      
      const trendData = result.data;
      
      // 分析趋势数据作为证据
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个趋势数据分析专家。请分析给定的趋势数据，判断它是否支持特定问题的存在和重要性。评估趋势数据的质量和说服力，并给出信心评分。`
        },
        {
          role: 'user',
          content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n以下是趋势数据，请分析它是否支持这个问题的存在和重要性:\n\n${JSON.stringify(trendData, null, 2)}`
        }
      ];

      // 调用LLM分析
      const evidence = await this.llmService.chatToJSON<{
        text: string;
        confidence: number;
        trendSummary: string;
      }>(
        messages,
        {
          type: 'object',
          properties: {
            text: { type: 'string' },
            confidence: { type: 'number' },
            trendSummary: { type: 'string' }
          },
          required: ['text', 'confidence', 'trendSummary']
        },
        { temperature: 0.3 }
      );
      
      // 如果置信度足够高，添加为证据
      if (evidence.confidence >= this.collectorOptions.confidenceThreshold!) {
        return [{
          text: evidence.text,
          source: '趋势分析',
          type: 'expert',
          confidence: evidence.confidence,
          metadata: {
            trendSummary: evidence.trendSummary
          }
        }];
      }
      
      return [];
    } catch (error) {
      this.log(`趋势证据收集失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 从现有证据生成综合见解
   * @param problem 问题
   * @param evidences 已有证据
   * @returns 见解证据
   */
  private async generateEvidenceInsights(problem: ProblemInfo, evidences: any[]): Promise<any | null> {
    try {
      // 如果证据太少，不生成见解
      if (evidences.length < 2) {
        return null;
      }
      
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个证据综合分析专家。请分析给定的多个证据，提取共同主题和模式，并生成一个高质量的综合见解。这个见解应该总结所有证据的核心发现，并提供对问题本质和严重性的更深入理解。`
        },
        {
          role: 'user',
          content: `问题: ${problem.title}\n问题描述: ${problem.description}\n\n以下是收集到的证据，请分析它们并生成一个综合见解:\n\n${JSON.stringify(evidences, null, 2)}`
        }
      ];

      // 调用LLM生成见解
      const insight = await this.llmService.chatToJSON<{
        text: string;
        confidence: number;
        keyThemes: string[];
      }>(
        messages,
        {
          type: 'object',
          properties: {
            text: { type: 'string' },
            confidence: { type: 'number' },
            keyThemes: { type: 'array', items: { type: 'string' } }
          },
          required: ['text', 'confidence', 'keyThemes']
        },
        { temperature: 0.4 }
      );
      
      // 创建见解证据
      return {
        text: insight.text,
        source: 'evidence_synthesis',
        type: 'expert',
        confidence: insight.confidence,
        metadata: {
          keyThemes: insight.keyThemes,
          basedOnEvidenceCount: evidences.length
        }
      };
    } catch (error) {
      this.log(`证据见解生成失败: ${error}`, 'error');
      return null;
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