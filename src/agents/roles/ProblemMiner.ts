/**
 * ProblemMiner.ts - 关键词洞察分析器
 * KeywordAlchemist的核心Agent，负责将关键词转化为有价值的问题洞察
 */

import { v4 as uuidv4 } from 'uuid';
import { EnhancedAgent } from '../base/EnhancedAgent';
import { AgentInput, AgentOutput, AgentCritique } from '../../types';
import { LLMService } from '../../core/llm/LLMService';
import { 
  ProblemInfo,
  ToolParams,
  ToolResult,
  ChatMessage
} from '../../types/schemas';

/**
 * ProblemMiner配置选项
 */
export interface ProblemMinerOptions {
  // 最大挖掘问题数量
  maxProblems?: number;
  // 问题过滤阈值(0-1)，越高过滤越严格
  filterThreshold?: number;
  // 是否使用搜索引擎自动补全
  useAutocomplete?: boolean;
  // 最大搜索深度
  maxSearchDepth?: number;
  // 最大返回问题数量
  maxProblemsToReturn?: number;
  // 最小置信度阈值(0-1)
  minConfidenceScore?: number;
  // 是否启用自主工具选择
  enableAutonomousToolSelection?: boolean;
  // 其他选项
  [key: string]: any;
}

/**
 * 问题挖掘Agent类
 * 负责从关键词出发，发现潜在问题
 */
export class ProblemMiner extends EnhancedAgent {
  // 配置选项
  private minerOptions: ProblemMinerOptions;

  /**
   * 构造函数
   * @param llmService LLM服务实例
   * @param options 配置选项
   */
  constructor(llmService: LLMService, options: ProblemMinerOptions = {}) {
    super(
      'ProblemMiner',
      '问题挖掘专家，负责从关键词发现潜在问题',
      '问题发现专家',
      llmService,
      {},
      [
        '关键词分析',
        '搜索建议挖掘',
        '社区数据分析',
        '潜在问题识别',
        '初步价值判断'
      ]
    );

    this.minerOptions = {
      maxProblems: 20,
      filterThreshold: 0.6,
      useAutocomplete: true,
      maxSearchDepth: 3,
      maxProblemsToReturn: 5,
      minConfidenceScore: 0.6,
      enableAutonomousToolSelection: false,
      ...options
    };
  }

  /**
   * 检查工具是否已注册
   * @param toolName 工具名称
   * @returns 是否已注册
   */
  hasToolRegistered(toolName: string): boolean {
    return this.getRegisteredTools().includes(toolName);
  }

  /**
   * 实现EnhancedAgent所需的executeInternal方法
   * @param input 输入
   * @returns 输出
   */
  protected async executeInternal(input: AgentInput): Promise<AgentOutput> {
    return this.process(input);
  }

  /**
   * 处理输入并返回结果
   * @param input Agent输入
   * @returns Agent输出
   */
  async process(input: AgentInput): Promise<AgentOutput> {
    try {
      // 提取关键词
      const { keyword } = input.data;
      
      if (!keyword || typeof keyword !== 'string') {
        return {
          status: 'failed',
          error: '无效的关键词输入',
          data: null
        };
      }

      this.log(`开始处理关键词: ${keyword}`);

      // 1. 挖掘潜在问题
      const potentialProblems = await this.mineProblems(keyword);

      // 2. 过滤和排序问题
      const filteredProblems = await this.filterAndRankProblems(potentialProblems);

      // 3. 最终处理结果
      const result = {
        keyword,
        problems: filteredProblems.slice(0, this.minerOptions.maxProblems),
        totalPotentialProblems: potentialProblems.length,
        totalFilteredProblems: filteredProblems.length,
        metadata: {
          processingTimeMs: Date.now() - input.context.state.executionMetadata.currentTime,
          useAutocomplete: this.minerOptions.useAutocomplete
        }
      };

      this.log(`完成关键词处理: ${keyword}, 发现 ${result.problems.length} 个问题`);

      return {
        status: 'success',
        data: result,
        metadata: {
          problemCount: result.problems.length
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`处理错误: ${errorMessage}`, 'error');
      
      return {
        status: 'failed',
        error: `问题挖掘失败: ${errorMessage}`,
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
    // 只对特定的Agent输出进行质疑
    if (agentName === 'ValueEvaluator' && output.status === 'success') {
      const data = output.data;
      
      // 检查是否有价值评估不合理的问题
      const unreasonableEvaluations = [];
      
      if (data.problems && Array.isArray(data.problems)) {
        for (const problem of data.problems) {
          // 如果问题来源是我们，但价值被评为很低，考虑质疑
          if (
            problem.source === 'ProblemMiner' && 
            problem.valueAssessment &&
            problem.valueAssessment.overallValue < 30
          ) {
            unreasonableEvaluations.push(problem);
          }
        }
      }
      
      if (unreasonableEvaluations.length > 0) {
        return {
          content: `我发现你对一些问题的价值评估可能过低`,
          reasons: [
            '这些问题是从大量搜索数据中筛选出的高频问题',
            '用户搜索行为表明这些问题有真实需求',
            '问题的搜索量和讨论度表明市场存在明显需求'
          ],
          severity: 3,
          suggestions: [
            '建议重新评估这些问题的市场规模和紧迫性',
            '考虑搜索量数据作为市场规模的参考指标',
            '评估时应考虑问题的搜索趋势增长情况'
          ],
          metadata: {
            unreasonableProblems: unreasonableEvaluations.map(p => p.title)
          }
        };
      }
    }
    
    return null;
  }

  // 私有方法

  /**
   * 挖掘关键词中的潜在问题
   * @param keyword 关键词
   * @returns 潜在问题列表
   */
  private async mineProblems(keyword: string): Promise<any[]> {
    this.log(`开始挖掘潜在问题: ${keyword}`);
    
    // 整合多种来源的问题
    const problems: any[] = [];
    
    // 1. 使用搜索建议挖掘问题
    if (this.minerOptions.useAutocomplete) {
      const autocompleteProblems = await this.mineFromSearchAutocomplete(keyword);
      problems.push(...autocompleteProblems);
    }
    
    // 2. 使用LLM进行问题发散
    const llmProblems = await this.mineFromLLM(keyword);
    problems.push(...llmProblems);
    
    // 3. 使用社区数据分析(如果工具可用)
    if (this.hasToolRegistered('searchCommunity')) {
      const communityProblems = await this.mineFromCommunity(keyword);
      problems.push(...communityProblems);
    }
    
    this.log(`挖掘完成: 发现 ${problems.length} 个潜在问题`);
    
    return problems;
  }

  /**
   * 从搜索自动补全挖掘问题
   * @param keyword 关键词
   * @returns 潜在问题列表
   */
  private async mineFromSearchAutocomplete(keyword: string): Promise<any[]> {
    try {
      // 使用自主工具选择
      if (this.minerOptions.enableAutonomousToolSelection) {
        const taskDescription = `获取关键词"${keyword}"的搜索自动补全建议`;
        const result = await this.executeWithAutonomousToolSelection(taskDescription, { keyword });
        
        if (result.success && result.data && Array.isArray(result.data)) {
          // 将自动补全结果转换为问题
          return this.convertAutocompletesToProblems(result.data, keyword);
        }
      }
      
      // 传统方法 - 如果有搜索工具，使用搜索工具获取自动补全
      else if (this.hasToolRegistered('searchAutocomplete')) {
        const result = await this.useTool('searchAutocomplete', { 
          keyword,
          depth: this.minerOptions.maxSearchDepth
        });
        
        if (result.success && result.data && Array.isArray(result.data)) {
          // 将自动补全结果转换为问题
          return this.convertAutocompletesToProblems(result.data, keyword);
        }
      }
      
      // 如果没有工具或工具执行失败，使用LLM模拟自动补全
      return this.simulateSearchAutocomplete(keyword);
    } catch (error) {
      this.log(`搜索自动补全失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 使用LLM模拟搜索自动补全
   * @param keyword 关键词
   * @returns 模拟的自动补全结果转换的问题列表
   */
  private async simulateSearchAutocomplete(keyword: string): Promise<any[]> {
    // 创建提示消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个搜索引擎自动补全模拟器。请为给定的关键词提供最可能的搜索自动补全结果，就像用户在搜索引擎中输入这个关键词时会看到的那样。这些应该是真实用户最常搜索的相关词组。结果应该多样化，覆盖不同方面的查询，包括问题、比较、教程和常见问题。每个自动补全结果应该是完整的搜索查询。输出格式应该是一个数组。`
      },
      {
        role: 'user',
        content: `为关键词"${keyword}"生成30个可能的搜索引擎自动补全结果。`
      }
    ];

    try {
      // 调用LLM生成自动补全结果
      const autocompletes = await this.llmService.chatToJSON<string[]>(
        messages,
        { type: 'array', items: { type: 'string' } },
        { temperature: 0.7 }
      );
      
      // 将自动补全结果转换为问题
      return this.convertAutocompletesToProblems(autocompletes, keyword);
    } catch (error) {
      this.log(`LLM自动补全模拟失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 将自动补全结果转换为问题
   * @param autocompletes 自动补全结果
   * @param keyword 原始关键词
   * @returns 问题列表
   */
  private async convertAutocompletesToProblems(autocompletes: string[], keyword: string): Promise<any[]> {
    // 创建提示消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个问题识别专家。请分析给定的搜索查询列表，从中识别出表明用户正在寻找解决方案或面临问题的查询。将这些搜索查询转化为明确的问题陈述。忽略那些纯粹是信息性的、不表示问题的查询。每个问题都应该：1. 描述用户正试图解决的具体问题 2. 推断用户查询背后的可能意图和需求 3. 用明确的问题形式表达出来。`
      },
      {
        role: 'user',
        content: `以下是用户搜索"${keyword}"相关的搜索查询列表。请从中识别出表明用户正在寻找解决方案或面临问题的查询，并将其转化为明确的问题陈述：\n\n${autocompletes.join('\n')}`
      }
    ];

    try {
      // 调用LLM识别问题
      const problems = await this.llmService.chatToJSON<Array<{
        title: string;
        description: string;
        originalQuery: string;
        confidence: number;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              originalQuery: { type: 'string' },
              confidence: { type: 'number' }
            },
            required: ['title', 'description', 'originalQuery', 'confidence']
          }
        },
        { temperature: 0.3 }
      );
      
      // 为每个问题添加ID和元数据
      return problems.map(problem => ({
        id: uuidv4(),
        title: problem.title,
        description: problem.description,
        category: this.categorizeQuery(problem.originalQuery),
        source: 'search_autocomplete',
        evidence: [{
          text: problem.originalQuery,
          source: 'search_suggestion',
          type: 'search',
          confidence: problem.confidence
        }],
        metadata: {
          originalQuery: problem.originalQuery,
          keyword,
          created: new Date().toISOString()
        }
      }));
    } catch (error) {
      this.log(`问题转换失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 使用LLM挖掘潜在问题
   * @param keyword 关键词
   * @returns 潜在问题列表
   */
  private async mineFromLLM(keyword: string): Promise<any[]> {
    // 创建提示消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的问题发掘专家，擅长从关键词出发，深入分析其涉及的领域，并发现该领域中用户可能面临的真实问题。

你需要全面考虑以下几个方面：
1. 实际使用场景中的痛点和困难
2. 用户可能面临的挑战和障碍
3. 现有解决方案的不足和缺陷
4. 特定人群的特殊需求
5. 市场变化带来的新问题
6. 技术发展产生的新可能性

请注意：
- 每个问题必须具体、明确且有足够的上下文
- 问题应该是真实存在的，不是假设性的
- 问题应该有一定的普遍性，影响一定规模的用户
- 问题应该是有价值的，解决它能带来明显收益`
      },
      {
        role: 'user',
        content: `对于关键词"${keyword}"，请深入分析并发现该领域中用户可能面临的20个具体问题。

对于每个问题：
1. 提供简洁明确的问题标题
2. 写一段详细描述，解释问题的背景、影响和重要性
3. 给出可能的问题类别
4. 估计问题影响的用户规模(1-10分)
5. 评估问题的严重程度(1-10分)`
      }
    ];

    try {
      // 调用LLM生成问题
      const problems = await this.llmService.chatToJSON<Array<{
        title: string;
        description: string;
        category: string[];
        userScale: number;
        severity: number;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'array', items: { type: 'string' } },
              userScale: { type: 'number' },
              severity: { type: 'number' }
            },
            required: ['title', 'description', 'category', 'userScale', 'severity']
          }
        },
        { temperature: 0.7 }
      );
      
      // 为每个问题添加ID和元数据
      return problems.map(problem => ({
        id: uuidv4(),
        title: problem.title,
        description: problem.description,
        category: problem.category,
        source: 'llm_analysis',
        evidence: [{
          text: `LLM分析的问题，用户规模评分: ${problem.userScale}，严重程度评分: ${problem.severity}`,
          source: 'llm_inference',
          type: 'expert',
          confidence: Math.min(problem.userScale, problem.severity) / 10
        }],
        metadata: {
          userScale: problem.userScale,
          severity: problem.severity,
          keyword,
          created: new Date().toISOString()
        }
      }));
    } catch (error) {
      this.log(`LLM问题挖掘失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 从社区数据挖掘问题
   * @param keyword 关键词
   * @returns 潜在问题列表
   */
  private async mineFromCommunity(keyword: string): Promise<any[]> {
    try {
      // 使用社区搜索工具
      const result = await this.useTool('searchCommunity', { 
        keyword,
        sources: ['reddit', 'quora', 'stackoverflow', 'twitter'],
        limit: 30
      });
      
      if (!result.success || !result.data || !Array.isArray(result.data)) {
        return [];
      }
      
      // 分析社区数据中的问题
      // 这里简化处理，实际应用中需要更复杂的分析
      const communityPosts = result.data;
      
      // 创建提示消息
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一个社区数据分析专家，能够从社交媒体和问答平台的帖子中识别出真实用户面临的问题。请分析给定的帖子列表，提取用户表达的具体问题和痛点。只关注表明用户正在面临困难或寻求解决方案的内容。`
        },
        {
          role: 'user',
          content: `以下是与"${keyword}"相关的社区帖子列表。请分析这些帖子，识别用户正在面临的具体问题和痛点：\n\n${JSON.stringify(communityPosts, null, 2)}`
        }
      ];

      // 调用LLM分析社区帖子
      const problems = await this.llmService.chatToJSON<Array<{
        title: string;
        description: string;
        source: string;
        sourceUrl: string;
        confidence: number;
      }>>(
        messages,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              source: { type: 'string' },
              sourceUrl: { type: 'string' },
              confidence: { type: 'number' }
            },
            required: ['title', 'description', 'source', 'confidence']
          }
        },
        { temperature: 0.3 }
      );
      
      // 为每个问题添加ID和元数据
      return problems.map(problem => ({
        id: uuidv4(),
        title: problem.title,
        description: problem.description,
        category: this.categorizeQuery(problem.title),
        source: 'community_data',
        evidence: [{
          text: `来自 ${problem.source} 的讨论`,
          source: problem.source,
          type: 'social',
          confidence: problem.confidence,
          url: problem.sourceUrl
        }],
        metadata: {
          platform: problem.source,
          sourceUrl: problem.sourceUrl,
          keyword,
          created: new Date().toISOString()
        }
      }));
    } catch (error) {
      this.log(`社区数据挖掘失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 过滤和排序问题
   * @param problems 问题列表
   * @returns 过滤和排序后的问题列表
   */
  private async filterAndRankProblems(problems: any[]): Promise<any[]> {
    // 如果没有问题，直接返回空数组
    if (!problems.length) {
      return [];
    }
    
    this.log(`开始过滤和排序 ${problems.length} 个问题`);
    
    // 1. 过滤低质量问题
    const qualityThreshold = this.minerOptions.filterThreshold || 0.6;
    let filteredProblems = problems.filter(problem => {
      // 如果有confidence字段，使用它
      if (problem.evidence && problem.evidence.length > 0) {
        const avgConfidence = problem.evidence.reduce(
          (sum: number, e: any) => sum + (e.confidence || 0), 
          0
        ) / problem.evidence.length;
        
        return avgConfidence >= qualityThreshold;
      }
      
      // 没有confidence信息，保留
      return true;
    });
    
    // 2. 去重
    filteredProblems = this.deduplicateProblems(filteredProblems);
    
    // 3. 使用LLM给问题评分并排序
    filteredProblems = await this.rankProblemsWithLLM(filteredProblems);
    
    this.log(`过滤和排序完成, 剩余 ${filteredProblems.length} 个问题`);
    
    return filteredProblems;
  }

  /**
   * 去重问题
   * @param problems 问题列表
   * @returns 去重后的问题列表
   */
  private deduplicateProblems(problems: any[]): any[] {
    const uniqueProblems: any[] = [];
    const titleMap = new Map<string, boolean>();
    
    for (const problem of problems) {
      // 将标题转换为小写并移除特殊字符用于比较
      const normalizedTitle = problem.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
      
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, true);
        uniqueProblems.push(problem);
      } else {
        // 如果是重复问题，考虑合并证据
        const existingProblem = uniqueProblems.find(
          p => p.title.toLowerCase().replace(/[^\w\s]/g, '').trim() === normalizedTitle
        );
        
        if (existingProblem && problem.evidence && existingProblem.evidence) {
          existingProblem.evidence = [...existingProblem.evidence, ...problem.evidence];
        }
      }
    }
    
    return uniqueProblems;
  }

  /**
   * 使用LLM对问题进行评分和排序
   * @param problems 问题列表
   * @returns 排序后的问题列表
   */
  private async rankProblemsWithLLM(problems: any[]): Promise<any[]> {
    if (problems.length <= 1) {
      return problems;
    }
    
    try {
      // 为了效率，如果问题过多，分批处理
      const batchSize = 20;
      let rankedProblems: any[] = [];
      
      for (let i = 0; i < problems.length; i += batchSize) {
        const batch = problems.slice(i, i + batchSize);
        
        // 创建提示消息
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: `你是一个问题评估专家，能够分析潜在问题的价值和重要性。请评估每个问题的价值，考虑以下因素：
1. 问题的普遍性 - 多少人面临这个问题
2. 问题的严重程度 - 问题对用户的影响有多大
3. 问题解决的紧迫性 - 用户多急于解决这个问题
4. 问题的可解决性 - 这个问题是否有可行的解决方案
5. 市场机会 - 解决这个问题是否有商业价值

请为每个问题提供一个总体评分(1-100)，以及各维度的详细评分(1-10)。`
          },
          {
            role: 'user',
            content: `请评估以下问题的价值和重要性：\n\n${JSON.stringify(batch, null, 2)}`
          }
        ];

        // 调用LLM评估问题
        const rankings = await this.llmService.chatToJSON<Array<{
          id: string;
          overallValue: number;
          universality: number;
          severity: number;
          urgency: number;
          solvability: number;
          marketOpportunity: number;
        }>>(
          messages,
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                overallValue: { type: 'number' },
                universality: { type: 'number' },
                severity: { type: 'number' },
                urgency: { type: 'number' },
                solvability: { type: 'number' },
                marketOpportunity: { type: 'number' }
              },
              required: ['id', 'overallValue']
            }
          },
          { temperature: 0.3 }
        );
        
        // 合并评分到问题中
        const rankedBatch = batch.map(problem => {
          const ranking = rankings.find(r => r.id === problem.id);
          
          if (ranking) {
            return {
              ...problem,
              value: {
                overall: ranking.overallValue,
                universality: ranking.universality,
                severity: ranking.severity,
                urgency: ranking.urgency,
                solvability: ranking.solvability,
                marketOpportunity: ranking.marketOpportunity
              }
            };
          }
          
          return problem;
        });
        
        rankedProblems = [...rankedProblems, ...rankedBatch];
      }
      
      // 按总体价值降序排序
      return rankedProblems.sort((a, b) => {
        const aValue = a.value?.overall || 0;
        const bValue = b.value?.overall || 0;
        return bValue - aValue;
      });
    } catch (error) {
      this.log(`问题排序失败: ${error}`, 'error');
      return problems;
    }
  }

  /**
   * 对查询进行分类
   * @param query 搜索查询
   * @returns 分类数组
   */
  private categorizeQuery(query: string): string[] {
    const categories: string[] = [];
    
    // 简单规则匹配分类
    const lowerQuery = query.toLowerCase();
    
    // 教程类
    if (lowerQuery.includes('如何') || 
        lowerQuery.includes('怎么') || 
        lowerQuery.includes('教程') || 
        lowerQuery.includes('指南')) {
      categories.push('教程');
    }
    
    // 比较类
    if (lowerQuery.includes('vs') || 
        lowerQuery.includes('对比') || 
        lowerQuery.includes('比较') || 
        lowerQuery.includes('哪个好')) {
      categories.push('比较');
    }
    
    // 问题类
    if (lowerQuery.includes('问题') || 
        lowerQuery.includes('故障') || 
        lowerQuery.includes('错误') || 
        lowerQuery.includes('不能') ||
        lowerQuery.includes('失败')) {
      categories.push('故障');
    }
    
    // 服务类
    if (lowerQuery.includes('服务') || 
        lowerQuery.includes('平台') || 
        lowerQuery.includes('工具') || 
        lowerQuery.includes('软件')) {
      categories.push('服务');
    }
    
    // 如果没有匹配任何类别，标记为"其他"
    if (categories.length === 0) {
      categories.push('其他');
    }
    
    return categories;
  }

  /**
   * 记录日志信息
   * @param message 消息内容
   * @param level 日志级别
   */
  protected log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    const prefix = `[ProblemMiner]`;
    
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`);
        break;
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

  /**
   * 检查社区问答平台上的问题
   * @param keyword 关键词
   * @returns 问题列表
   */
  private async checkCommunityQuestions(keyword: string): Promise<any[]> {
    try {
      // 使用自主工具选择
      if (this.minerOptions.enableAutonomousToolSelection) {
        const taskDescription = `在社区平台搜索与"${keyword}"相关的问题`;
        const result = await this.executeWithAutonomousToolSelection(taskDescription, { keyword });
        
        if (result.success && result.data) {
          return this.processCommunityQuestions(result.data, keyword);
        }
      } 
      // 传统方法 - 用注册的工具
      else if (this.hasToolRegistered('searchCommunity')) {
        const result = await this.useTool('searchCommunity', { 
          keyword,
          platforms: ['quora', 'reddit', 'stackoverflow'],
          maxResults: 20
        });
        
        if (result.success && result.data) {
          return this.processCommunityQuestions(result.data, keyword);
        }
      }
      
      // 如果没有工具或工具执行失败，使用LLM模拟社区问题
      return this.simulateCommunityQuestions(keyword);
    } catch (error) {
      this.log(`检查社区问题失败: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 处理社区问题数据
   * @param data 社区数据
   * @param keyword 关键词
   * @returns 处理后的问题列表
   */
  private processCommunityQuestions(data: any, keyword: string): any[] {
    if (!data || !Array.isArray(data.questions)) {
      return [];
    }

    const questions = data.questions;
    
    // 转换社区问题为标准格式
    return questions.map((question: any) => ({
      title: question.title || question.text || '',
      body: question.body || question.details || '',
      source: question.platform || 'community',
      url: question.url || '',
      votes: question.votes || question.score || 0,
      views: question.views || 0,
      timestamp: question.timestamp || Date.now(),
      originalKeyword: keyword,
      isExpanded: false,
      overallScore: (question.votes || 0) > 5 ? 8 : 6, // 简单评分
      reasoning: `从${question.platform || '社区平台'}上发现的问题，获得了${question.votes || 0}个投票和${question.views || 0}次查看`
    }));
  }

  /**
   * 模拟社区问题（当无法使用工具时）
   * @param keyword 关键词
   * @returns 模拟的问题列表
   */
  private async simulateCommunityQuestions(keyword: string): Promise<any[]> {
    try {
      // 使用LLM生成可能的社区问题
      const prompt = `作为一个研究专家，请生成5个用户可能在社区问题答平台(如Quora、Reddit、StackOverflow)上关于"${keyword}"的问题。
每个问题应该包括:
1. 问题标题
2. 问题详情
3. 估计的投票数(1-100)
4. 估计的浏览量(10-1000)
5. 适当的平台名称(Quora/Reddit/StackOverflow)

以JSON格式返回，格式如下:
[
  {
    "title": "问题标题",
    "body": "问题详情",
    "votes": 数字,
    "views": 数字,
    "platform": "平台名称"
  }
]`;

      // 请求LLM
      const response = await this.llmService.chat([
        { role: 'user', content: prompt }
      ]);

      if (!response || !response.content) {
        return [];
      }

      // 尝试提取JSON
      try {
        const jsonMatch = response.content.match(/\[\s*\{[\s\S]*\}\s*\]/) || [response.content];
        const jsonContent = jsonMatch[0];
        const questions = JSON.parse(jsonContent);
        
        // 确保是数组
        if (!Array.isArray(questions)) {
          return [];
        }
        
        // 转换为标准格式
        return this.processCommunityQuestions({ questions }, keyword);
      } catch (error) {
        this.log(`解析模拟社区问题失败: ${error}`, 'error');
        return [];
      }
    } catch (error) {
      this.log(`生成模拟社区问题失败: ${error}`, 'error');
      return [];
    }
  }
} 