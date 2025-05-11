/**
 * 解决方案评估Agent (评估者)
 * 
 * 问题发现框架中的"评估者"角色
 * 分析现有解决方案的缺口，评估问题重要性
 */
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryAgentBase, DiscoveryAgentBaseConfig } from '../base/DiscoveryAgentBase';
import { 
  Problem, 
  AgentFeedback,
  Evidence 
} from '../../types/discovery';
import { logger } from '../../infra/logger';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentLLMService } from '../../core/llm/AgentLLMService';
import { SearchTools } from '../../tools/search/SearchTools';
import { SearchEngine } from '../../infra/search/SearchEngine';
import { z } from 'zod';
import { AgentLLMServiceExtensions } from '../../core/llm/extensions';

// 解决方案评估Agent配置
export interface SolutionEvaluatorAgentConfig extends DiscoveryAgentBaseConfig {
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  includeCompetitorAnalysis?: boolean;
  includeTrendAnalysis?: boolean;
  maxContentSamples?: number;
}

// Define schemas for validation
const searchQuerySchema = z.object({
  query: z.string()
});

const solutionGapSchema = z.object({
  existingSolutions: z.array(z.object({
    type: z.string(),
    description: z.string(),
    effectiveness: z.number().min(1).max(10),
    limitations: z.array(z.string())
  })),
  gapScore: z.number().min(1).max(10),
  gapAnalysis: z.string(),
  marketMaturity: z.string(),
  unmetNeeds: z.array(z.string()),
  improvementOpportunities: z.array(z.string())
});

const feedbackSchema = z.object({
  validationResults: z.object({
    isValid: z.boolean(),
    validationReasoning: z.string(),
    suggestions: z.array(z.string())
  }),
  suggestedChanges: z.array(z.object({
    fieldName: z.string(),
    suggestedValue: z.string().or(z.number()),
    changeReasoning: z.string()
  })),
  alternativeBranches: z.array(z.object({
    alternativeFormulation: z.string(),
    branchReasoning: z.string(),
    estimatedQualityScore: z.number()
  })).optional(),
  confidenceScore: z.number().min(0).max(1),
  feedbackType: z.string()
});

/**
 * 解决方案评估Agent
 * 在问题发现框架中担任"评估者"角色，分析现有解决方案的缺口
 */
export class SolutionEvaluatorAgent extends DiscoveryAgentBase {
  // 实现DiscoveryAgent接口
  public readonly type: 'evaluator' = 'evaluator';
  
  // 特定于此Agent的属性  
  private searchTools: SearchTools | null = null;
  private llmService: AgentLLMService;
  
  /**
   * 构造函数
   */
  constructor(config: SolutionEvaluatorAgentConfig = {}) {
    super(config);
    
    this.llmService = this.model as AgentLLMService;
    
    logger.debug('SolutionEvaluatorAgent initialized');
    
    // 初始化搜索工具
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具
   */
  private initializeSearchTools(config: SolutionEvaluatorAgentConfig): void {
    if (config.searchTools) {
      this.searchTools = config.searchTools;
    } else if (config.searchEngine) {
      this.searchTools = new SearchTools({ searchEngine: config.searchEngine });
    } else {
      this.searchTools = new SearchTools();
    }
    
    // 注册工具
    const tools = this.searchTools.getAllTools();
    this.registerTools(tools);
    logger.debug('SearchTools registered', { count: tools.length });
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // 工具注册在构造函数中完成
  }
  /**
   * 实现DiscoveryAgent.process方法
   * 处理输入并评估解决方案缺口
   */
  public async process(input: any): Promise<any> {
    logger.info(`SolutionEvaluatorAgent processing input`);
    
    if (!input.problems || !Array.isArray(input.problems) || input.problems.length === 0) {
      throw new Error('Valid problems array is required for SolutionEvaluatorAgent');
    }
    
    try {
      // 分析问题的解决方案缺口
      const solutionGapAnalyses = await this.analyzeSolutionGaps(input.problems);
      
      logger.info(`SolutionEvaluatorAgent completed analyses for ${solutionGapAnalyses.length} problems`);
      
      return {
        solutionGapAnalyses,
        sourceKeyword: input.sourceKeyword || '',
        metadata: {
          completedAnalyses: solutionGapAnalyses.length,
          averageGapScore: solutionGapAnalyses.reduce(
            (sum, p) => sum + (p.gapScore || 0), 0) / solutionGapAnalyses.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      logger.error(`Error in SolutionEvaluatorAgent.process: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * 分析问题的解决方案缺口
   */
  private async analyzeSolutionGaps(problems: Problem[]): Promise<any[]> {
    logger.debug(`Analyzing solution gaps for ${problems.length} problems`);
    
    // 创建分析结果数组
    const analyses = [];
    
    // 为每个问题分析解决方案缺口
    for (const problem of problems) {
      logger.debug(`Analyzing solution gap for problem: ${problem.id}`);
      
      try {
        // 搜索现有解决方案
        const solutions = await this.searchExistingSolutions(problem);
        
        // 分析解决方案缺口
        const gapAnalysis = await this.evaluateSolutionGap(problem, solutions);
        
        if (gapAnalysis) {
          // 添加到结果数组
          analyses.push({
            ...gapAnalysis,
            id: problem.id,
            originalFormulation: problem.originalFormulation || problem.currentFormulation,
            currentFormulation: problem.currentFormulation
          });
        }
      } catch (error: any) {
        logger.error({ error, problemId: problem.id }, `Error analyzing solution gap for problem ${problem.id}: ${error.message}`);
      }
    }
    
    return analyses;
  }
  
  /**
   * 搜索现有解决方案
   */
  private async searchExistingSolutions(problem: Problem): Promise<any[]> {
    try {
      // 生成搜索查询
      const searchQuery = await this.generateSolutionSearchQuery(problem);
      logger.debug(`Searching for existing solutions with query: ${searchQuery}`);
      
      // 查找搜索工具
      const searchTool = this.tools.find(t => t.name === 'get_search_results');
      
      if (!searchTool) {
        logger.error('No get_search_results tool found');
        throw new Error('Search tool not available');
      }
      
      // 执行搜索
      try {
        const searchResponse = await searchTool.invoke({ keyword: searchQuery, numResults: 5 });
        try {
          const results = JSON.parse(searchResponse);
          if (results && Array.isArray(results) && results.length > 0) {
            return results;
          } else {
            logger.warn('Search returned empty or invalid results');
            throw new Error('Search returned empty or invalid results');
          }
        } catch (error) {
          logger.error('Failed to parse search results', { error });
          throw new Error('Failed to parse search results');
        }
      } catch (error) {
        logger.error('Search tool failed', { error });
        throw new Error(`Search tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error: any) {
      logger.error(`Error searching existing solutions: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * 生成解决方案搜索查询
   */
  private async generateSolutionSearchQuery(problem: Problem): Promise<string> {
    try {
      logger.debug(`Generating solution search query for problem: ${problem.currentFormulation}`);
      
      if (!problem.currentFormulation) {
        throw new Error('Problem formulation is empty, cannot generate search query');
      }
      
      // 创建提示
      const prompt = `
        作为搜索专家，你的任务是为以下问题创建一个有效的搜索查询，用于查找现有解决方案。
        
        问题:
        "${problem.currentFormulation}"
        
        创建一个简短、明确的搜索查询，以找到解决此问题的现有解决方案、工具、服务或方法。
        查询应该:
        1. 聚焦于解决方案而非问题本身
        2. 包含相关关键词
        3. 使用适当的搜索操作符（如引号）提高精确度
        4. 简洁（通常不超过5-7个词）
        
        以JSON格式返回查询文本，格式如下:
        {
          "query": "你的搜索查询"
        }
        
        不要添加额外的解释或说明，只返回JSON对象。
      `;
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const response = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '3-generate-search-query',
        searchQuerySchema,
        { temperature: 0.7 }
      );
      
      if (!response || !response.query) {
        throw new Error('Failed to generate search query');
      }
      
      return response.query.trim();
    } catch (error: any) {
      logger.error(`Error generating solution search query: ${error.message}`, { error });
      throw new Error(`Failed to generate search query: ${error.message}`);
    }
  }
  
  /**
   * 评估解决方案缺口
   */
  private async evaluateSolutionGap(problem: Problem, solutions: any[]): Promise<any> {
    try {
      logger.debug(`Evaluating solution gap for problem: ${problem.currentFormulation}`);
      
      // 准备解决方案数据
      const solutionsData = solutions.map((solution, index) => {
        return `解决方案 ${index + 1}:\n标题: ${solution.title || '未知标题'}\n摘要: ${solution.snippet || '无摘要'}\n链接: ${solution.url || '无链接'}`;
      }).join('\n\n');
      
      // 创建提示
      const prompt = `
        作为解决方案评估专家，请分析以下问题和现有解决方案，评估解决方案缺口。
        
        问题:
        "${problem.currentFormulation || ''}"
        
        现有解决方案:
        ${solutionsData}
        
        请执行以下分析:
        1. 识别现有解决方案的类型、效能和局限性
        2. 评估解决方案缺口大小(1-10分，分数越高缺口越大)
        3. 确定市场成熟度(早期/成长期/成熟期/饱和期)
        4. 识别未满足的用户需求
        5. 提出改进机会
        
        以JSON格式返回分析结果:
        {
          "existingSolutions": [
            {
              "type": "解决方案类型(如软件工具/在线服务/开源项目等)",
              "description": "简要描述",
              "effectiveness": 7,
              "limitations": ["局限性1", "局限性2"]
            }
          ],
          "gapScore": 8,
          "gapAnalysis": "解决方案缺口的详细分析",
          "marketMaturity": "市场成熟度阶段",
          "unmetNeeds": ["未满足需求1", "未满足需求2"],
          "improvementOpportunities": ["改进机会1", "改进机会2"]
        }
        
        确保你的分析客观、基于事实，不要过度乐观或悲观。
      `;
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const response = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '3-evaluate-solution-gap',
        solutionGapSchema,
        { temperature: 0.7 }
      );
      
      if (!response) {
        throw new Error('Failed to evaluate solution gap');
      }
      
      return response;
    } catch (error: any) {
      logger.error(`Error evaluating solution gap: ${error.message}`, { error });
      throw new Error(`Failed to evaluate solution gap: ${error.message}`);
    }
  }
  
  /**
   * 为问题生成反馈
   * 实现DiscoveryAgentBase的抽象方法
   */
  protected async generateFeedback(problem: Problem): Promise<AgentFeedback> {
    logger.debug(`Generating feedback for problem: ${problem.id}`);
    
    try {
      // 首先分析解决方案缺口
      const solutions = await this.searchExistingSolutions(problem);
      const gapAnalysis = await this.evaluateSolutionGap(problem, solutions);
      
      // 创建提示
      const prompt = `
        作为解决方案评估专家，请对以下问题提供专业反馈:
        
        问题ID: ${problem.id}
        问题描述: ${problem.currentFormulation || ''}
        问题领域: ${problem.domain ? problem.domain.join(', ') : ''}
        
        解决方案缺口分析:
        - 缺口分数: ${gapAnalysis?.gapScore}/10
        - 市场成熟度: ${gapAnalysis?.marketMaturity}
        - 现有解决方案: ${gapAnalysis?.existingSolutions.map((s: any) => s.type).join(', ')}
        - 未满足需求: ${gapAnalysis?.unmetNeeds.join(', ')}
        
        当前质量评分:
        - 解决方案缺口: ${problem.qualityScore?.solutionGap || 5}/10
        - 可行性: ${problem.qualityScore?.feasibility || 5}/10
        - 整体评分: ${problem.qualityScore?.overall || 5}/10
        
        基于解决方案缺口分析，请提供以下反馈:
        1. 质疑解决方案缺口的大小，并验证问题是否存在真正的解决方案空白
        2. 评估问题是否有实际价值和商业潜力
        3. 提出质疑性问题，挑战问题假设
        4. 建议如何更好定义问题以确保针对真实的解决方案缺口
        
        以JSON格式返回你的反馈:
        {
          "validationResults": {
            "isValid": true,
            "validationReasoning": "你的验证理由，重点质疑解决方案缺口",
            "suggestions": ["改进建议1", "改进建议2"]
          },
          "suggestedChanges": [
            {
              "fieldName": "currentFormulation|qualityScore.solutionGap|qualityScore.feasibility",
              "suggestedValue": "新的值",
              "changeReasoning": "建议此改变的理由"
            }
          ],
          "alternativeBranches": [
            {
              "alternativeFormulation": "重新表述的问题",
              "branchReasoning": "为何这是一个有价值的分支",
              "estimatedQualityScore": 8.5
            }
          ],
          "confidenceScore": 0.9,
          "feedbackType": "refinement"
        }
      `;
      
      // 使用AgentLLMServiceExtensions的analyzeWithObjectSchema方法
      const feedbackResponse = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '3-generate-solution-feedback',
        feedbackSchema,
        { temperature: 0.7 }
      );
      
      if (!feedbackResponse) {
        throw new Error('Failed to generate feedback');
      }
      
      // 确保feedbackType是有效的枚举值
      const feedbackType = feedbackResponse.feedbackType === 'validation' || 
                          feedbackResponse.feedbackType === 'refinement' || 
                          feedbackResponse.feedbackType === 'branch_suggestion' || 
                          feedbackResponse.feedbackType === 'rejection' ? 
                          feedbackResponse.feedbackType : 'refinement';
      
      // 构建反馈
      return {
        id: uuidv4(),
        agentId: this.id,
        agentType: this.type,
        problemId: problem.id,
        timestamp: new Date().toISOString(),
        feedbackType: feedbackType,
        confidenceScore: feedbackResponse.confidenceScore || this.feedbackConfidence,
        validationResults: feedbackResponse.validationResults,
        suggestedChanges: feedbackResponse.suggestedChanges,
        alternativeBranches: feedbackResponse.alternativeBranches
      };
    } catch (error: any) {
      logger.error(`Error generating feedback: ${error.message}`, { error });
      throw new Error(`Failed to generate feedback: ${error.message}`);
    }
  }
} 