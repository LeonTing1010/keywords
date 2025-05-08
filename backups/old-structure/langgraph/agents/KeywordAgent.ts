/**
 * KeywordAgent.ts - 关键词发现与需求挖掘Agent
 */
import { BaseAgent, BaseAgentConfig } from './BaseAgent';
import { GraphStateType } from '../state/schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
import { BaiduSearchEngine } from '../../infrastructure/search/engines/BaiduSearchEngine';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '../../infrastructure/core/logger';

// 关键词Agent的配置
export interface KeywordAgentConfig extends BaseAgentConfig {
  maxKeywords?: number;
  searchEngine?: any;
  useAutocomplete?: boolean;
}

/**
 * 关键词发现与需求挖掘Agent
 * 负责发现相关关键词和潜在的未满足需求
 */
export class KeywordAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchEngine: any;
  private maxKeywords: number;
  private useAutocomplete: boolean;
  
  constructor(config: KeywordAgentConfig = {}) {
    super(config);
    
    this.maxKeywords = config.maxKeywords || 30;
    this.useAutocomplete = config.useAutocomplete !== false; // 默认开启
    this.searchEngine = config.searchEngine || new BaiduSearchEngine();
    
    logger.debug('KeywordAgent initialized', { 
      maxKeywords: this.maxKeywords,
      useAutocomplete: this.useAutocomplete
    });
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // 可以注册特定工具，例如搜索工具
    // TODO: 这里可以添加搜索自动补全工具等
  }
  
  /**
   * 通过搜索引擎自动补全发现关键词
   */
  private async discoverKeywordsViaAutocomplete(keyword: string): Promise<string[]> {
    try {
      logger.debug('Discovering keywords via autocomplete', { keyword });
      
      // 使用字母前缀策略发现更多相关关键词
      const letters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
      const queries = letters.map(letter => `${keyword} ${letter}`);
      
      // 并行获取自动补全结果
      const allSuggestions: string[] = [];
      for (const query of queries) {
        try {
          const suggestions = await this.searchEngine.getAutocompleteSuggestions(query);
          allSuggestions.push(...suggestions);
        } catch (error) {
          logger.warn('Error getting autocomplete suggestions', { query, error });
        }
        
        // 添加一些延迟，避免API限制
        await new Promise(r => setTimeout(r, 500));
      }
      
      // 去重和过滤
      const uniqueSuggestions = [...new Set(allSuggestions)]
        .filter(s => s.toLowerCase().includes(keyword.toLowerCase()))
        .slice(0, this.maxKeywords);
      
      logger.debug('Discovered keywords', { 
        count: uniqueSuggestions.length,
        sample: uniqueSuggestions.slice(0, 5)
      });
      
      return uniqueSuggestions;
    } catch (error) {
      logger.error('Failed to discover keywords via autocomplete', { error });
      return [];
    }
  }
  
  /**
   * 分析关键词，识别潜在的未满足需求
   */
  private async analyzePotentialUnmetNeeds(keywords: string[]): Promise<any[]> {
    try {
      logger.debug('Analyzing potential unmet needs');
      
      // 将关键词列表转换为文本
      const keywordsText = keywords.join('\n');
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的市场研究专家，擅长识别关键词中隐含的未被满足的用户需求。
        
        请分析以下关键词列表，识别其中可能暗示着未满足需求的关键词。
        未满足需求是指:
        1. 用户真实存在但尚未被很好解决的问题或需求
        2. 现有解决方案质量不佳或不完整
        3. 用户搜索但找不到满意答案的问题
        
        关键词列表:
        {keywordsText}
        
        对于每个可能暗示未满足需求的关键词，请提供:
        1. 关键词本身
        2. 置信度评分(0-1)
        3. 简短理由说明为什么这表明未满足需求
        
        以JSON格式返回结果，格式如下:
        [
          {
            "keyword": "关键词",
            "confidence": 0.8,
            "reason": "这是未满足需求的理由"
          }
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ keywordsText });
      
      // 解析LLM返回的JSON
      const content = response.content.toString();
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for unmet needs', { content });
        return [];
      }
      
      const potentialNeeds = JSON.parse(jsonMatch[0]);
      logger.debug('Identified potential unmet needs', { 
        count: potentialNeeds.length, 
        sample: potentialNeeds.slice(0, 2)
      });
      
      return potentialNeeds;
    } catch (error) {
      logger.error('Failed to analyze potential unmet needs', { error });
      return [];
    }
  }
  
  /**
   * 生成关键词相关的市场洞察
   */
  private async generateKeywordInsights(keywords: string[], potentialNeeds: any[]): Promise<any[]> {
    try {
      logger.debug('Generating keyword insights');
      
      // 将数据转换为文本
      const mainKeyword = keywords[0];
      const relatedKeywordsText = keywords.slice(1, 11).join(', ');
      const potentialNeedsText = potentialNeeds.slice(0, 5)
        .map(n => `- ${n.keyword}: ${n.reason}`)
        .join('\n');
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的市场研究专家，擅长从用户搜索行为中提取市场洞察。
        
        请基于以下信息，总结3-5个关键市场洞察:
        1. 主要关键词: {mainKeyword}
        2. 相关关键词列表 (部分): {relatedKeywordsText}
        3. 潜在未满足需求 (部分): 
        {potentialNeedsText}
        
        对于每个洞察，提供:
        1. 洞察标题 (简短精炼)
        2. 洞察描述 (2-3句话详细说明)
        
        以JSON格式返回，格式如下:
        [
          {
            "title": "洞察标题",
            "description": "详细说明"
          }
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ 
        mainKeyword,
        relatedKeywordsText,
        potentialNeedsText
      });
      
      // 解析LLM返回的JSON
      const content = response.content.toString();
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for insights', { content });
        return [];
      }
      
      const insights = JSON.parse(jsonMatch[0]);
      logger.debug('Generated keyword insights', { count: insights.length });
      
      return insights;
    } catch (error) {
      logger.error('Failed to generate keyword insights', { error });
      return [];
    }
  }
  
  /**
   * 执行关键词Agent的主要逻辑
   * @param state - 当前GraphStateType
   * @returns Partial<GraphStateType>，其中keywordDiscovery字段严格对齐KeywordDiscoveryResult类型
   */
  public async execute(state: GraphStateType): Promise<Partial<GraphStateType>> {
    try {
      logger.info('KeywordAgent execution started');
      const startTime = Date.now();
      
      // 从状态中获取关键词
      const keyword = state.input.keyword;
      if (!keyword) {
        throw new Error('Missing keyword in input state');
      }
      
      // 1. 通过搜索引擎自动补全发现关键词
      const discoveredKeywords = this.useAutocomplete 
        ? await this.discoverKeywordsViaAutocomplete(keyword)
        : [keyword]; // 如果禁用自动补全，则只使用原始关键词
      
      // 2. 分析潜在的未满足需求
      const potentialUnmetNeeds = await this.analyzePotentialUnmetNeeds(discoveredKeywords);
      
      // 3. 生成市场洞察
      const insights = await this.generateKeywordInsights(discoveredKeywords, potentialUnmetNeeds);
      
      // 计算统计信息
      const processingTimeMs = Date.now() - startTime;
      const statistics = {
        totalDiscovered: discoveredKeywords.length,
        unmetNeedsCount: potentialUnmetNeeds.length,
        insightsCount: insights.length,
        processingTimeMs
      };
      
      // 更新状态
      return {
        keywordDiscovery: {
          keyword,
          discoveredKeywords,
          potentialUnmetNeeds,
          insights,
          statistics
        },
        executionMetadata: {
          ...state.executionMetadata,
          completedNodes: [
            ...(state.executionMetadata?.completedNodes || []),
            'keywordDiscovery'
          ]
        }
      };
    } catch (error) {
      logger.error('KeywordAgent execution failed', { error });
      throw error;
    }
  }
} 