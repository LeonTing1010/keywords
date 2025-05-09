/**
 * 市场需求探索Agent (需求发现专家)
 * 
 * 核心职责:
 * - 发现关键词背后的真实用户问题和痛点
 * - 从搜索建议和自动补全中识别用户真实疑问
 */
import { BaseAgent, BaseAgentConfig } from './base/BaseAgent';
import { GraphStateType } from '../types/schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../infra/logger';
import { SearchEngine } from '../infra/search/SearchEngine';
import { AutocompleteSuggestion } from '../infra/search/types';
import { SearchTools } from '../tools/search/SearchTools';

// 市场需求探索Agent配置
export interface MarketNeedExplorerAgentConfig extends BaseAgentConfig {
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  maxProblems?: number; // 最大问题数量
  minProblemScore?: number; // 问题价值阈值
}

/**
 * 市场需求探索Agent（需求发现专家）
 * 负责发现关键词背后的真实用户问题
 */
export class MarketNeedExplorerAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private maxProblems: number;
  private minProblemScore: number;
  
  constructor(config: MarketNeedExplorerAgentConfig = {}) {
    super(config);
    
    this.maxProblems = config.maxProblems || 20;
    this.minProblemScore = config.minProblemScore || 7; // 默认7分以上的问题
    
    logger.debug('MarketNeedExplorerAgent initialized', {
      maxProblems: this.maxProblems,
      minProblemScore: this.minProblemScore
    });
    
    // 初始化搜索工具
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具
   */
  private initializeSearchTools(config: MarketNeedExplorerAgentConfig): void {
    // 优先使用提供的SearchTools，其次创建默认工具
    if (config.searchTools) {
      this.searchTools = config.searchTools;
      logger.debug('Using provided SearchTools instance');
    } else if (config.searchEngine) {
      logger.debug('Creating SearchTools with provided searchEngine');
      this.searchTools = new SearchTools({ searchEngine: config.searchEngine });
    } else {
      logger.debug('Creating default SearchTools instance');
      this.searchTools = new SearchTools();
      logger.warn('No search engine/tools provided to MarketNeedExplorerAgent, using default web search');
    }
    
    // 注册工具
    this.registerSearchTools();
  }
  
  /**
   * 注册搜索工具
   */
  private registerSearchTools(): void {
    try {
      if (this.searchTools) {
        const tools = this.searchTools.getAllTools();
        this.registerTools(tools);
        logger.debug('SearchTools registered', { count: tools.length });
      }
      
      logger.debug('MarketNeedExplorerAgent tools registered', { count: this.tools.length });
    } catch (error) {
      logger.error('Failed to register search tools', { error });
    }
  }
  
  /**
   * 设置Agent所需的工具
   * 实现BaseAgent抽象方法
   */
  protected setupTools(): void {
    // 工具注册将在初始化时完成
    logger.debug('setupTools called');
  }
  
  /**
   * 获取关键词的自动补全建议
   */
  private async getAutocompleteSuggestions(keyword: string): Promise<AutocompleteSuggestion[]> {
    try {
      logger.debug('Getting autocomplete suggestions', { keyword });
      
      // 查找并调用建议工具
      const suggestionsTool = this.tools.find(t => t.name === 'get_search_suggestions');
      if (!suggestionsTool) {
        logger.error('get_search_suggestions tool not found');
        return [];
      }
      
      const result = await suggestionsTool.invoke({ keyword, maxResults: 20 });
      
      try {
        // 解析工具返回的JSON
        const suggestions = JSON.parse(result);
        
        // 将结果转换为AutocompleteSuggestion格式
        const autocompleteSuggestions = suggestions.map((s: any) => ({
          query: typeof s === 'string' ? s : s.query || '',
          displayText: typeof s === 'string' ? s : s.displayText || s.query || '',
          type: s.type || 'suggestion'
        }));
        
        logger.debug('Got autocomplete suggestions', {
          keyword,
          count: autocompleteSuggestions.length
        });
        
        return autocompleteSuggestions;
      } catch (error) {
        logger.error('Failed to parse autocomplete suggestions', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get autocomplete suggestions', { keyword, error });
      return [];
    }
  }
  
  /**
   * 从搜索建议和自动补全数据中提取和扩展问题
   * 使用LLM直接分析和提炼问题
   */
  private async extractAndExpandQuestions(
    keyword: string,
    suggestions: AutocompleteSuggestion[]
  ): Promise<any[]> {
    try {
      if (!suggestions || suggestions.length === 0) {
        return [];
      }
      
      logger.debug('Extracting and expanding questions from suggestions', { 
        keyword, 
        suggestionsCount: suggestions.length 
      });
      
      // 准备所有查询供LLM分析
      const queryList = suggestions.map(s => s.query || '').filter(q => q.trim().length > 0);
      
      // 使用LLM评估、提取和扩展这些查询中的问题
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的问题分析专家，擅长从搜索查询中挖掘出真实的用户问题和潜在需求。

        关键词: "${keyword}"

        以下是与该关键词相关的搜索查询和自动补全建议:
        ${queryList.map((q, i) => `${i+1}. ${q}`).join('\n')}

        请执行以下任务:
        
        1. 识别: 从这些查询中识别出可能的真实用户问题和需求
        2. 理解: 理解每个查询背后的用户意图和潜在问题
        3. 提炼: 将模糊的查询提炼为清晰的问题
        4. 扩展: 基于这些查询，创造出相关的高价值问题
        5. 评估: 为每个问题评分(1-10)，基于:
           - 清晰度: 问题表述是否清晰
           - 价值: 解决此问题对用户的价值
           - 真实性: 是否反映真实用户需求
           - 深度: 问题是否触及根本痛点
           - 相关性: 与原始关键词的相关程度

        只返回评分至少${this.minProblemScore}分(满分10分)的问题。

        以JSON数组返回:
        [
          {
            "question": "清晰、完整的问题表述",
            "originalQuery": "问题来源的原始查询，如果是扩展问题则留空",
            "isExpanded": true/false,  // 是否为扩展创造的问题
            "overallScore": 8.5,
            "reasoning": "简要说明为何这是个有价值的问题，以及为何给出此评分"
          }
        ]

        注意：
        - 确保问题清晰、具体且有价值
        - 扩展问题要有深度，不要只是表面变化
        - 每个问题必须为用户提供真正的价值
        - 问题数量质量优先于数量
      `);
      
      // 执行LLM分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const evaluatedQuestions = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const parsedQuestions = JSON.parse(evaluatedQuestions);
        
        // 记录结果
        logger.debug('Extracted and expanded questions', {
          keyword,
          extractedCount: parsedQuestions.length,
          originalCount: queryList.length
        });
        
        return parsedQuestions;
      } catch (error) {
        logger.error('Failed to parse evaluated questions', { error, evaluatedQuestions });
        return [];
      }
    } catch (error) {
      logger.error('Failed to extract and expand questions', { keyword, error });
      return [];
    }
  }
  
  /**
   * 使用LLM检查问题相似性并合并
   */
  private async checkSimilarityAndMergeQuestions(questions: any[]): Promise<any[]> {
    if (!questions || questions.length <= 1) {
      return questions;
    }
    
    try {
      logger.debug('Checking similarity and merging questions', { 
        questionsCount: questions.length 
      });
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的问题分析专家，擅长识别相似问题并进行合并。
        
        下面是一系列用户问题:
        ${questions.map((q, i) => `
        ${i+1}. ${q.question || ''}
           原始查询: ${q.originalQuery || '扩展问题'}
           评分: ${q.overallScore || 0}/10
           是否扩展: ${q.isExpanded ? '是' : '否'}
        `).join('\n')}
        
        请执行以下任务:
        1. 识别相似或相关的问题组
        2. 对于每组相似问题，创建一个新的合并问题，该问题应更全面地涵盖该组所有问题的要点
        3. 为合并问题提供一个新的综合评分，考虑原始问题的分数和问题的全面性
        
        以JSON数组格式返回，包括合并后的问题和未合并的独立问题:
        [
          {
            "question": "合并后的问题表述",
            "overallScore": 9.0,
            "isMerged": true,
            "originalQuestions": [0, 2, 5],  // 原始问题在输入列表中的索引
            "reasoning": "解释为什么这些问题应该合并以及如何合并的"
          },
          {
            "question": "独立问题表述",
            "overallScore": 8.5,
            "isMerged": false,
            "originalQuestions": [1],  // 单个索引表示未合并
            "reasoning": "这个问题与其他问题差异较大，应保持独立"
          }
        ]
        
        只返回JSON数组，不要包含其他解释。
      `);
      
      // 执行LLM评估
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const result = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const processedQuestions = JSON.parse(result);
        
        // 构建最终问题列表
        const finalQuestions = processedQuestions.map((pq: any) => {
          // 对于合并问题，组合原始问题的信息
          if (pq.isMerged && pq.originalQuestions && pq.originalQuestions.length > 1) {
            const originalIndices = pq.originalQuestions;
            
            return {
              question: pq.question,
              overallScore: pq.overallScore,
              isMerged: true,
              mergeReasoning: pq.reasoning,
              originalCount: originalIndices.length
            };
          } 
          // 对于未合并的问题，保留原始信息
          else if (pq.originalQuestions && pq.originalQuestions.length === 1) {
            const originalIndex = pq.originalQuestions[0];
            if (originalIndex >= 0 && originalIndex < questions.length) {
              const originalQuestion = questions[originalIndex];
              return {
                ...originalQuestion,
                question: pq.question || originalQuestion.question,
                overallScore: pq.overallScore || originalQuestion.overallScore,
                isMerged: false
              };
            }
          }
          
          // 如果无法匹配原始问题，返回处理结果
          return {
            question: pq.question,
            overallScore: pq.overallScore,
            isMerged: pq.isMerged,
            reasoning: pq.reasoning
          };
        });
        
        logger.debug('Questions similarity checked and merged', {
          originalCount: questions.length,
          mergedCount: finalQuestions.filter((q: any) => q.isMerged).length,
          finalCount: finalQuestions.length
        });
        
        return finalQuestions;
      } catch (error) {
        logger.error('Failed to parse similarity results', { error, result });
        return questions; // 返回原始问题
      }
    } catch (error) {
      logger.error('Failed to check similarity and merge questions', { error });
      return questions; // 返回原始问题
    }
  }
  
  /**
   * 发现高价值问题的主要流程
   */
  private async discoverHighValueProblems(keyword: string): Promise<any[]> {
    try {
      logger.debug('Starting high value problem discovery process', { keyword });
      
      // 1. 获取自动补全建议
      const autocompleteSuggestions = await this.getAutocompleteSuggestions(keyword);
      
      // 2. 使用LLM直接从建议中提取和扩展问题
      const extractedQuestions = await this.extractAndExpandQuestions(
        keyword, 
        autocompleteSuggestions
      );
      
      // 3. 使用LLM检查相似性并合并相似问题
      const mergedQuestions = await this.checkSimilarityAndMergeQuestions(extractedQuestions);
      
      // 4. 按评分排序并限制数量
      const finalQuestions = mergedQuestions
        .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
        .slice(0, this.maxProblems)
        .map((q, i) => ({...q, id: i + 1}));
      
      logger.debug('High value problem discovery completed', {
        keyword,
        extractedQuestionsCount: extractedQuestions.length,
        mergedQuestionsCount: mergedQuestions.length,
        finalQuestionsCount: finalQuestions.length
      });
      
      return finalQuestions;
    } catch (error) {
      logger.error('Failed to discover high value problems', { keyword, error });
      return [];
    }
  }
  
  /**
   * 执行需求探索
   * 实现主要的Agent执行逻辑
   */
  protected async executeImpl(state: any, config?: RunnableConfig): Promise<any> {
    try {
      // 从状态中获取关键词
      const keyword = state.input?.keyword;
      if (!keyword) {
        throw new Error('No keyword provided in state');
      }
      
      logger.info(`Starting MarketNeedExplorerAgent for keyword: ${keyword}`);
      
      // 执行问题发现
      const highValueProblems = await this.discoverHighValueProblems(keyword);
      
      // 构建结果对象
      const result = {
        timestamp: new Date().toISOString(),
        keyword,
        highValueProblems,
        statistics: {
          totalProblems: highValueProblems.length,
          mergedProblems: highValueProblems.filter(p => p.isMerged).length,
          topProblemScore: highValueProblems.length > 0 ? highValueProblems[0].overallScore : 0
        }
      };
      
      logger.info(`MarketNeedExplorerAgent completed for ${keyword}`, {
        problemsCount: highValueProblems.length,
      });
      
      // 返回状态更新
      return {
        keywordDiscovery: result
      };
    } catch (error: any) {
      logger.error('Error in MarketNeedExplorerAgent', { error: error.message, stack: error.stack });
      throw error;
    }
  }
} 