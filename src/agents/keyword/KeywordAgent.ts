/**
 * KeywordAgent.ts - 关键词分析Agent
 * 
 * 关键词Agent (需求发现专家)
 * 
 * 核心职责:
 * 1. 实现高级关键词挖掘策略，超越简单自动补全功能
 * 2. 挖掘多个搜索引擎和平台的搜索模式
 * 3. 识别特定领域的热门问题和新兴需求
 * 4. 量化每个潜在需求的搜索量和竞争指标
 * 5. 将需求分类为清晰的分类体系，方便组织和分析
 * 
 * 主要功能:
 * - 通过多种方法发现相关关键词和长尾关键词
 * - 分析关键词中隐含的未满足需求
 * - 评估每个潜在需求的价值和可信度
 * - 提供关键词领域的整体市场洞察
 */
import { BaseAgent, BaseAgentConfig } from '../base/BaseAgent';
import { GraphStateType } from '../../types/schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../../infra/logger';
import { SearchEngine } from '../../infra/search/SearchEngine';
import { SearchOptions } from '../../infra/search/types';
import { AutocompleteSuggestion } from '../../infra/search/types';
import { MockSearchEngine } from '../../infra/search/engines/MockSearchEngine';
import { SearchTools } from '../../tools/search/SearchTools';

// 关键词Agent的配置
export interface KeywordAgentConfig extends BaseAgentConfig {
  maxKeywords?: number;
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  useAutocomplete?: boolean;
  maxRelatedKeywords?: number;
  maxPotentialNeeds?: number;
}

/**
 * 关键词发现与需求挖掘Agent
 * 负责发现相关关键词和潜在的未满足需求
 */
export class KeywordAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private maxKeywords: number;
  private useAutocomplete: boolean;
  private maxRelatedKeywords: number;
  private maxPotentialNeeds: number;
  
  constructor(config: KeywordAgentConfig = {}) {
    super(config);
    
    this.maxKeywords = config.maxKeywords || 30;
    this.useAutocomplete = config.useAutocomplete !== false; // 默认开启
    this.maxRelatedKeywords = config.maxRelatedKeywords || 5;
    this.maxPotentialNeeds = config.maxPotentialNeeds || 3;
    
    logger.debug('KeywordAgent initialized', { 
      maxKeywords: this.maxKeywords,
      useAutocomplete: this.useAutocomplete,
      maxRelatedKeywords: this.maxRelatedKeywords,
      maxPotentialNeeds: this.maxPotentialNeeds
    });
    
    // 在constructor的最后初始化SearchTools，确保在setupTools后
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具 - 在constructor的最后调用，避免继承初始化顺序问题
   */
  private initializeSearchTools(config: KeywordAgentConfig): void {
    // 优先使用提供的SearchTools，其次使用SearchEngine创建SearchTools，最后创建默认的SearchTools
    if (config.searchTools) {
      this.searchTools = config.searchTools;
      logger.debug('Using provided SearchTools instance');
    } else if (config.searchEngine) {
      logger.debug('Creating SearchTools with provided searchEngine');
      this.searchTools = new SearchTools({ searchEngine: config.searchEngine });
    } else {
      logger.debug('Creating default SearchTools instance');
      this.searchTools = new SearchTools();
      logger.warn('No search engine/tools provided to KeywordAgent, using default web search');
    }
    
    // 如果工具还没有注册，现在注册它们
    if (this.tools.length === 0 && this.searchTools) {
      try {
        const tools = this.searchTools.getAllTools();
        this.registerTools(tools);
        logger.debug('KeywordAgent tools registered', { count: this.tools.length });
      } catch (error) {
        logger.error('Failed to register search tools', { error });
      }
    }
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // 在BaseAgent构造函数中调用时，searchTools可能还不存在
    // 我们将在构造函数完成后手动注册工具
    logger.debug('setupTools called, will register tools later');
  }
  
  /**
   * 通过搜索引擎自动补全发现关键词
   */
  private async discoverKeywordsViaAutocomplete(keyword: string): Promise<string[]> {
    try {
      logger.debug('Discovering keywords via autocomplete', { keyword });
      
      // 确保searchTools已初始化
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // 使用字母前缀策略发现更多相关关键词
      const discoveryTool = this.searchTools.getKeywordDiscoveryTool();
      const alphabet = 'ab';
      let allResults: string[] = [];
      
      // 为每个字母前缀获取关键词
      for (const letter of alphabet) {
        const prefixKeyword = `${keyword} ${letter}`;
        const result = await discoveryTool.invoke({ keyword: prefixKeyword, maxResults: Math.ceil(this.maxKeywords / 26) });
        try {
          const keywords = JSON.parse(result) as string[];
          allResults.push(...keywords);
        } catch (error) {
          logger.warn('Failed to parse keywords for prefix', { prefix: letter, error });
        }
      }
      
      // 去重并限制结果数量
      const uniqueResults = [...new Set(allResults)].slice(0, this.maxKeywords);
      const result = JSON.stringify(uniqueResults);
      
      try {
        // 解析工具返回的JSON
        const discoveredKeywords = JSON.parse(result) as string[];
        
        logger.debug('Discovered keywords', { 
          count: discoveredKeywords.length,
          sample: discoveredKeywords.slice(0, 5)
        });
        
        return discoveredKeywords;
      } catch (error) {
        logger.error('Failed to parse discovered keywords', { error });
        return [keyword]; // 默认至少返回原始关键词
      }
    } catch (error) {
      logger.error('Failed to discover keywords via autocomplete', { error });
      return [keyword]; // 返回原始关键词作为备选
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
          {{
            "keyword": "示例关键词",
            "confidence": 0.8,
            "reason": "这是未满足需求的理由"
          }}
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      logger.debug('Analyzing potential unmet needs with LLM', { modelName: this.model.getName() });
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({ keywordsText });
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for unmet needs', { content });
          return [];
        }
        
        const potentialNeeds = JSON.parse(jsonMatch[0]);
        logger.debug('Found potential unmet needs', { count: potentialNeeds.length });
        
        return potentialNeeds;
      } catch (parseError) {
        logger.error('Failed to parse unmet needs JSON', { parseError, response });
        return [];
      }
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
      const mainKeyword = keywords[0] || '';
      const relatedKeywordsText = keywords.length > 1 ? keywords.slice(1, 11).join(', ') : '';
      
      // 如果没有潜在需求，创建一个默认的文本
      let potentialNeedsText = '没有明显的未满足需求';
      
      if (potentialNeeds && potentialNeeds.length > 0) {
        potentialNeedsText = potentialNeeds.slice(0, 5)
          .map(n => `- ${n.keyword || '关键词'}: ${n.reason || '理由未提供'}`)
          .join('\n');
      }
      
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
          {{
            "title": "示例洞察标题",
            "description": "详细说明示例"
          }}
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({ 
        mainKeyword,
        relatedKeywordsText,
        potentialNeedsText
      });
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for insights', { content });
          return [];
        }
        
        const insights = JSON.parse(jsonMatch[0]);
        logger.debug('Generated keyword insights', { count: insights.length });
        
        return insights;
      } catch (parseError) {
        logger.error('Failed to parse insights JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to generate keyword insights', { error });
      return [];
    }
  }
  
  /**
   * 执行关键词Agent的主要逻辑
   * @param state - GraphStateType状态
   * @returns Partial<GraphStateType>，更新后的状态
   */
  public async execute(state: any): Promise<any> {
    try {
      logger.info('KeywordAgent execution started');
      const startTime = Date.now();
      
      // 从状态中获取关键词
      const keyword = state.input?.keyword || state.keyword;
      logger.info('Keyword from state:', keyword);
      
      if (!keyword) {
        throw new Error('Missing keyword in state');
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
        }
      };
    } catch (error: any) {
      logger.error('KeywordAgent execution failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}