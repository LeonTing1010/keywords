/**
 * 市场需求探索Agent (需求发现专家)
 * 
 * 核心职责:
 * 1. 实现高级关键词挖掘策略，超越简单自动补全功能
 * 2. 挖掘多个搜索引擎和平台的搜索模式
 * 3. 识别特定领域的热门问题和新兴需求
 * 4. 量化每个潜在需求的搜索量和竞争指标
 * 5. 将需求分类为清晰的分类体系，方便组织和分析
 * 6. 发现关键词背后的真实用户问题和痛点
 * 7. 从搜索建议和自动补全中识别用户真实疑问
 * 8. 分析论坛和社区中的真实用户问题
 * 
 * 主要功能:
 * - 通过多种方法发现相关关键词和长尾关键词
 * - 分析关键词中隐含的未满足需求
 * - 评估每个潜在需求的价值和可信度
 * - 提供关键词领域的整体市场洞察
 * - 提炼出高价值问题用于后续分析
 * - 从各类数据源发现真实用户问题
 */
import { BaseAgent, BaseAgentConfig } from './base/BaseAgent';
import { GraphStateType } from '../types/schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../infra/logger';
import { SearchEngine } from '../infra/search/SearchEngine';
import { SearchOptions } from '../infra/search/types';
import { AutocompleteSuggestion } from '../infra/search/types';
import { MockSearchEngine } from '../infra/search/engines/MockSearchEngine';
import { SearchTools } from '../tools/search/SearchTools';
import { MultiSearchTools } from '../tools/search/MultiSearchTools';

// 市场需求探索Agent配置
export interface MarketNeedExplorerAgentConfig extends BaseAgentConfig {
  maxKeywords?: number;
  minSearchVolume?: number;
  requireSearchVolume?: boolean;
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  multiSearchTools?: MultiSearchTools;
  minConfidenceScore?: number; // 需求可信度阈值
  enableQuantification?: boolean; // 启用需求量化
  enableCategorization?: boolean; // 启用需求分类
  useAutocomplete?: boolean; // 使用自动补全功能
  enableForumSearch?: boolean; // 启用论坛搜索
  enableProblemDiscovery?: boolean; // 启用问题挖掘
  targetForums?: string[]; // 目标论坛和社区
  maxProblems?: number; // 最大问题数量
  minProblemScore?: number; // 问题价值阈值
}

/**
 * 市场需求探索Agent（需求发现专家）
 * 负责高级关键词挖掘、需求量化和分类
 */
export class MarketNeedExplorerAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private multiSearchTools: MultiSearchTools | null = null;
  private maxKeywords: number;
  private minSearchVolume: number;
  private requireSearchVolume: boolean;
  private minConfidenceScore: number;
  private enableQuantification: boolean;
  private enableCategorization: boolean;
  private enableForumSearch: boolean;
  private enableProblemDiscovery: boolean;
  private targetForums: string[];
  private maxProblems: number;
  private minProblemScore: number;
  
  // 字符集合，用于扩展关键词
  private readonly characterSets = {
    basicChars: [
        '', 'a', 'b', 'c', 'h', 'w', // 基础字母
        '0', '1', '2', '3', '9', // 数字
        '+', '#', '@', '&', '*', '-', '_', '.', ':', '/', // 常用符号
    ],
    questions: [
        'what', 'how', 'why', 'when', 'which', 'who', 'where', 'can', 'is', 'are', 'will', 'do',
        '什么', '如何', '为什么', '何时', '哪个', '谁', '哪里', '能否', '是否', '会', '做'
    ],
    prefixes: [
        'best', 'top', 'cheap', 'free', 'online', 'easy', 'simple', 'quick', 'professional',
        '最佳', '顶级', '便宜', '免费', '在线', '简单', '快速', '专业'
    ],
    suffixes: [
        'vs', 'alternative', 'tutorial', 'guide', 'review', 'comparison', 'download', 'template',
        '对比', '替代', '教程', '指南', '评测', '比较', '下载', '模板'
    ],
    timeframes: [
        '2023', '2024', 'new', 'latest', 'updated', 'future', 'modern', 'trending',
        '最新', '更新', '未来', '现代', '趋势'
    ],
    questionWords: [
        'problem with', 'issue with', 'trouble with', 'help with', 'fix',
        'solution for', 'solve', 'workaround for', 'alternative to',
        '问题', '解决', '修复', '替代方案', '帮助', '如何解决'
    ],
    forumKeywords: [
        'reddit', 'stackoverflow', 'quora', 'forum', 'discussion', 'thread', 'github issue',
        '论坛', '讨论', '社区', '问答'
    ]
  };
  
  constructor(config: MarketNeedExplorerAgentConfig = {}) {
    super(config);
    
    this.maxKeywords = config.maxKeywords || 50;
    this.minSearchVolume = config.minSearchVolume || 10;
    this.requireSearchVolume = config.requireSearchVolume !== false;
    this.minConfidenceScore = config.minConfidenceScore || 0.6; // 默认0.6的可信度阈值
    this.enableQuantification = config.enableQuantification !== false; // 默认启用需求量化
    this.enableCategorization = config.enableCategorization !== false; // 默认启用需求分类
    this.enableForumSearch = config.enableForumSearch !== false; // 默认启用论坛搜索
    this.enableProblemDiscovery = config.enableProblemDiscovery !== false; // 默认启用问题挖掘
    this.targetForums = config.targetForums || [
      'reddit.com', 'stackoverflow.com', 'quora.com', 'github.com/issues',
      'twitter.com', 'linkedin.com', 'dev.to', 'medium.com'
    ];
    this.maxProblems = config.maxProblems || 20;
    this.minProblemScore = config.minProblemScore || 7; // 默认7分以上的问题
    
    logger.debug('MarketNeedExplorerAgent initialized', {
      maxKeywords: this.maxKeywords,
      minSearchVolume: this.minSearchVolume,
      requireSearchVolume: this.requireSearchVolume,
      minConfidenceScore: this.minConfidenceScore,
      enableQuantification: this.enableQuantification,
      enableCategorization: this.enableCategorization,
      enableForumSearch: this.enableForumSearch,
      enableProblemDiscovery: this.enableProblemDiscovery,
      targetForums: this.targetForums,
      maxProblems: this.maxProblems,
      minProblemScore: this.minProblemScore
    });
    
    // 在constructor最后初始化SearchTools，确保在setupTools之后
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具 - 在constructor的最后调用，避免继承初始化顺序问题
   */
  private initializeSearchTools(config: MarketNeedExplorerAgentConfig): void {
    // 优先使用提供的SearchTools/MultiSearchTools，其次创建默认工具
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
    
    // 初始化MultiSearchTools（如果提供）
    if (config.multiSearchTools) {
      this.multiSearchTools = config.multiSearchTools;
      logger.debug('Using provided MultiSearchTools instance');
    } else if (this.enableForumSearch) {
      logger.debug('Creating default MultiSearchTools instance for forum search');
      this.multiSearchTools = new MultiSearchTools({
        enabledEngines: ['google', 'web'],
        defaultEngine: 'google'
      });
    }
    
    // 如果工具还没有注册，现在注册它们
    if (this.tools.length === 0) {
      try {
        if (this.searchTools) {
          const tools = this.searchTools.getAllTools();
          this.registerTools(tools);
          logger.debug('SearchTools registered', { count: tools.length });
        }
        
        if (this.multiSearchTools) {
          const multiTools = this.multiSearchTools.getAllTools();
          this.registerTools(multiTools);
          logger.debug('MultiSearchTools registered', { count: multiTools.length });
        }
        
        logger.debug('MarketNeedExplorerAgent tools registered', { count: this.tools.length });
      } catch (error) {
        logger.error('Failed to register search tools', { error });
      }
    }
  }
  
  /**
   * 设置Agent所需的工具
   * 实现BaseAgent抽象方法
   */
  protected setupTools(): void {
    // 在BaseAgent构造函数中调用时，searchTools可能还不存在
    // 我们将在构造函数完成后手动注册工具
    logger.debug('setupTools called, will register tools later');
  }
  
  /**
   * 获取关键词的自动补全建议
   */
  private async getAutocompleteSuggestions(keyword: string): Promise<AutocompleteSuggestion[]> {
    try {
      logger.debug('Getting autocomplete suggestions', { keyword });
      
      // 直接通过工具名查找并调用
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
          query: typeof s === 'string' ? s : s.query || s.text || '',
          displayText: typeof s === 'string' ? s : s.displayText || s.text || s.query || '',
          type: s.type || 'suggestion'
        }));
        
        logger.debug('Got autocomplete suggestions via tool use', {
          keyword,
          count: autocompleteSuggestions.length,
          example: autocompleteSuggestions.length > 0 ? autocompleteSuggestions[0] : null
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
   * 获取关键词的搜索建议
   */
  private async getSearchSuggestions(keyword: string): Promise<string[]> {
    try {
      logger.debug('Getting search suggestions', { keyword });
      
      // 直接通过工具名查找并调用
      const suggestionsTool = this.tools.find(t => t.name === 'get_search_suggestions');
      if (!suggestionsTool) {
        logger.error('get_search_suggestions tool not found');
        return [];
      }
      
      const result = await suggestionsTool.invoke({ keyword, maxResults: 20 });
      
      try {
        // 解析工具返回的JSON
        const suggestions = JSON.parse(result);
        const queries = suggestions.map((s: any) => s.query || s);
        
        logger.debug('Got search suggestions via tool use', {
          keyword,
          count: queries.length,
          example: queries.length > 0 ? queries[0] : null
        });
        
        return queries;
      } catch (error) {
        logger.error('Failed to parse search suggestions', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get search suggestions', { keyword, error });
      return [];
    }
  }
  
  /**
   * 扩展关键词前缀
   * 通过组合预定义字符集创建潜在的搜索查询前缀
   */
  private async expandKeywordPrefixes(keyword: string): Promise<string[]> {
    try {
      logger.debug('Expanding keyword prefixes', { keyword });
      
      const expandedQueries: string[] = [];
      
      // 添加问题前缀
      for (const question of this.characterSets.questions) {
        expandedQueries.push(`${question} ${keyword}`);
      }
      
      // 添加修饰前缀
      for (const prefix of this.characterSets.prefixes) {
        expandedQueries.push(`${prefix} ${keyword}`);
      }
      
      // 添加时间框架
      for (const timeframe of this.characterSets.timeframes) {
        expandedQueries.push(`${keyword} ${timeframe}`);
        expandedQueries.push(`${timeframe} ${keyword}`);
      }
      
      // 添加常用后缀
      for (const suffix of this.characterSets.suffixes) {
        expandedQueries.push(`${keyword} ${suffix}`);
      }
      
      // 简单组合前缀和后缀
      for (const prefix of this.characterSets.prefixes.slice(0, 3)) {
        for (const suffix of this.characterSets.suffixes.slice(0, 3)) {
          expandedQueries.push(`${prefix} ${keyword} ${suffix}`);
        }
      }
      
      // 去重
      const uniqueQueries = [...new Set(expandedQueries)];
      
      logger.debug('Expanded keyword prefixes', {
        keyword,
        originalCount: expandedQueries.length,
        uniqueCount: uniqueQueries.length,
        examples: uniqueQueries.slice(0, 3)
      });
      
      return uniqueQueries;
    } catch (error) {
      logger.error('Failed to expand keyword prefixes', { keyword, error });
      return [];
    }
  }
  
  /**
   * 使用字符扩展方法扩展关键词
   */
  private async expandWithCharacters(keyword: string): Promise<string[]> {
    try {
      logger.debug('Expanding with characters', { keyword });
      
      const expandedQueries: string[] = [];
      
      // 使用基础字符扩展
      for (const char of this.characterSets.basicChars) {
        // 添加字符前缀
        expandedQueries.push(`${char}${keyword}`);
        // 添加字符后缀
        expandedQueries.push(`${keyword}${char}`);
        // 为每个词添加前缀和后缀（如果是多词关键词）
        if (keyword.includes(' ')) {
          const parts = keyword.split(' ');
          for (let i = 0; i < parts.length; i++) {
            const newParts = [...parts];
            newParts[i] = `${char}${newParts[i]}`;
            expandedQueries.push(newParts.join(' '));
            
            const newParts2 = [...parts];
            newParts2[i] = `${newParts2[i]}${char}`;
            expandedQueries.push(newParts2.join(' '));
          }
        }
      }
      
      // 去重
      const uniqueQueries = [...new Set(expandedQueries)];
      
      logger.debug('Expanded with characters', {
        keyword,
        uniqueCount: uniqueQueries.length,
        examples: uniqueQueries.slice(0, 3)
      });
      
      return uniqueQueries;
    } catch (error) {
      logger.error('Failed to expand with characters', { keyword, error });
      return [];
    }
  }
  
  /**
   * 分析关键词背后的潜在用户需求
   * 识别关键词所暗示的未满足需求和机会
   */
  private async analyzePotentialNeeds(keywords: string[]): Promise<any[]> {
    if (keywords.length === 0) {
      return [];
    }
    
    try {
      logger.debug('Analyzing potential needs behind keywords');
      
      // 准备关键词分析提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的市场需求分析师，擅长从搜索关键词中识别潜在的用户需求和机会。
        
        请分析以下搜索关键词，并识别其中暗示的未满足需求:
        
        ${keywords.map(k => `- ${k}`).join('\n')}
        
        请从这些关键词中提取出最有价值的5-8个潜在需求。对于每个潜在需求:
        
        1. 提供需求描述
        2. 列出与此需求相关的关键词
        3. 识别需求类型 (信息型/交易型/导航型)
        4. 评估需求的普遍性 (小众/中等/广泛)
        5. 评估竞争程度 (低/中/高)
        6. 提供满足此需求的可能解决方案
        7. 为每个需求提供机会评分 (1-10)，基于市场规模、竞争和满足难度
        8. 提供可信度评分 (0.1-1.0)，表示你对这个需求真实存在的确信程度
        
        以JSON数组返回:
        [
          {{
            "description": "详细的需求描述",
            "relatedKeywords": ["关键词1", "关键词2"],
            "type": "需求类型",
            "prevalence": "普遍性",
            "competition": "竞争程度",
            "possibleSolutions": ["解决方案1", "解决方案2"],
            "opportunityScore": 8.5,
            "confidenceScore": 0.85
          }}
        ]
        
        只返回JSON数组，不要其他解释。确保描述清晰具体，不要过于宽泛。重点关注最有价值、最明确的需求。
      `);
      
      // 使用LLM执行需求分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for potential needs', { content });
          return [];
        }
        
        const potentialNeeds = JSON.parse(jsonMatch[0]);
        
        // 过滤掉不符合最小可信度要求的需求
        const filteredNeeds = potentialNeeds.filter(
          (need: any) => need.confidenceScore >= this.minConfidenceScore
        );
        
        logger.debug('Analyzed potential needs', {
          total: potentialNeeds.length,
          filtered: filteredNeeds.length,
          example: filteredNeeds.length > 0 ? filteredNeeds[0].description : null
        });
        
        return filteredNeeds;
      } catch (error) {
        logger.error('Failed to parse potential needs', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to analyze potential needs', { error });
      return [];
    }
  }
  
  /**
   * 量化需求潜力
   * 估算每个需求的搜索量和市场潜力
   */
  private async quantifyNeedsPotential(potentialNeeds: any[]): Promise<any[]> {
    if (!this.enableQuantification || potentialNeeds.length === 0) {
      return potentialNeeds;
    }
    
    try {
      logger.debug('Quantifying needs potential');
      
      // 获取搜索量工具
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // SearchTools类中没有getSearchVolumeTool方法，我们将使用替代方案
      // 使用关键词发现工具作为替代
      const discoveryTool = this.tools.find(t => t.name === 'discover_keywords');
      if (!discoveryTool) {
        logger.warn('discover_keywords tool not found');
        return potentialNeeds;
      }
      
      // 对每个潜在需求进行量化
      const quantifiedNeeds = [];
      
      for (const need of potentialNeeds) {
        try {
          // 选择最主要的相关关键词进行搜索量查询
          const mainKeywords = (need.relatedKeywords || []).slice(0, 3);
          
          // 如果有关键词，尝试估算搜索量
          if (mainKeywords.length > 0) {
            // 由于没有实际的搜索量工具，使用关键词发现的数量作为搜索量的估计
            const searchVolumes = [];
            
            for (const keyword of mainKeywords) {
              try {
                // 直接使用discoveryTool变量，不再重复声明
                const discoveryResult = await discoveryTool.invoke({ keyword, maxResults: 50 });
                const discoveredKeywords = JSON.parse(discoveryResult);
                
                // 使用发现的关键词数量作为搜索量的估计
                const estimatedVolume = Math.min(1000, discoveredKeywords.length * 100);
                
                searchVolumes.push({
                  keyword,
                  volume: estimatedVolume,
                  trend: 'stable'
                });
              } catch (e) {
                logger.warn('Failed to estimate search volume for keyword', { 
                  keyword, 
                  error: e 
                });
              }
            }
            
            // 计算平均搜索量和搜索量增长趋势
            if (searchVolumes.length > 0) {
              const totalVolume = searchVolumes.reduce((sum, item) => sum + item.volume, 0);
              const avgVolume = Math.round(totalVolume / searchVolumes.length);
              
              // 确定趋势
              const trendCounts = searchVolumes.reduce((counts: Record<string, number>, item) => {
                counts[item.trend] = (counts[item.trend] || 0) + 1;
                return counts;
              }, {});
              
              const trends = Object.entries(trendCounts).sort((a, b) => b[1] - a[1]);
              const dominantTrend = trends.length > 0 ? trends[0][0] : 'stable';
              
              // 添加量化数据
              quantifiedNeeds.push({
                ...need,
                searchVolume: {
                  average: avgVolume,
                  byKeyword: searchVolumes.reduce((obj: Record<string, number>, item) => {
                    obj[item.keyword] = item.volume;
                    return obj;
                  }, {}),
                  trend: dominantTrend
                },
                // 调整机会评分，考虑搜索量
                opportunityScore: need.opportunityScore ? 
                  Math.min(10, need.opportunityScore * (1 + Math.log10(Math.max(avgVolume, 10)) / 10)) 
                  : need.opportunityScore
              });
              
              continue; // 跳过添加未量化的需求
            }
          }
          
          // 如果没有搜索量数据，添加原始需求
          quantifiedNeeds.push(need);
          
        } catch (needError) {
          logger.error('Error quantifying individual need', { 
            need: need.description, 
            error: needError 
          });
          
          // 保留原始需求
          quantifiedNeeds.push(need);
        }
      }
      
      logger.debug('Quantified needs potential', { 
        total: quantifiedNeeds.length,
        withVolume: quantifiedNeeds.filter(n => n.searchVolume).length
      });
      
      return quantifiedNeeds;
    } catch (error) {
      logger.error('Failed to quantify needs potential', { error });
      return potentialNeeds;
    }
  }
  
  /**
   * 对需求进行分类
   * 将需求分类为清晰的分类体系
   */
  private async categorizeNeeds(potentialNeeds: any[]): Promise<any> {
    if (!this.enableCategorization || potentialNeeds.length < 3) {
      return { 
        categories: [],
        needsByCategory: {},
        uncategorizedNeeds: potentialNeeds
      };
    }
    
    try {
      logger.debug('Categorizing needs');
      
      // 准备需求分类提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的市场研究专家，擅长将用户需求分类为有意义的结构。
        
        请为以下潜在用户需求创建一个合理的分类体系:
        
        ${potentialNeeds.map((need, i) => 
          `${i+1}. ${need.description} (类型: ${need.type}, 评分: ${need.opportunityScore}/10)`
        ).join('\n')}
        
        请完成以下任务:
        
        1. 创建3-5个逻辑合理的需求类别
        2. 为每个类别提供清晰的名称和描述
        3. 将每个需求分配到最合适的类别中(每个需求只分配给一个类别)
        4. 为每个类别计算平均机会评分
        
        以JSON格式返回，包含类别定义和分类后的需求:
        {{
          "categories": [
            {{
              "name": "类别名称",
              "description": "类别描述",
              "opportunityScore": 8.5
            }}
          ],
          "needsByCategory": {{
            "类别名称": [0, 2, 5]  // 需求在原始列表中的索引
          }}
        }}
        
        只返回JSON，不要其他解释。确保类别有意义，能够帮助理解和组织这些需求。
      `);
      
      // 使用LLM执行需求分类
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for needs categorization', { content });
          return { 
            categories: [],
            needsByCategory: {},
            uncategorizedNeeds: potentialNeeds
          };
        }
        
        const categorization = JSON.parse(jsonMatch[0]);
        
        // 计算被归类的需求总数
        const categorizedIndices = new Set<number>();
        Object.values(categorization.needsByCategory || {}).forEach((indices: any) => {
          indices.forEach((index: number) => categorizedIndices.add(index));
        });
        
        // 找出未分类的需求
        const uncategorizedNeeds = potentialNeeds.filter((_, i) => !categorizedIndices.has(i));
        
        // 添加到结果
        const result = {
          ...categorization,
          uncategorizedNeeds
        };
        
        logger.debug('Categorized needs', { 
          categoryCount: categorization.categories?.length || 0,
          categorizedCount: categorizedIndices.size,
          uncategorizedCount: uncategorizedNeeds.length
        });
        
        return result;
      } catch (parseError) {
        logger.error('Failed to parse needs categorization', { parseError, response });
        return { 
          categories: [],
          needsByCategory: {},
          uncategorizedNeeds: potentialNeeds
        };
      }
    } catch (error) {
      logger.error('Failed to categorize needs', { error });
      return { 
        categories: [],
        needsByCategory: {},
        uncategorizedNeeds: potentialNeeds
      };
    }
  }
  
  /**
   * 搜索特定论坛和社区中的相关问题
   * 针对目标论坛和社区进行限定域搜索
   */
  private async searchForumQuestions(keyword: string): Promise<any[]> {
    if (!this.enableForumSearch || !this.targetForums || this.targetForums.length === 0) {
      logger.debug('Forum search is disabled or no target forums specified');
      return [];
    }
    
    try {
      logger.debug('Searching for questions in forums', { keyword, forums: this.targetForums });
      
      // 创建论坛搜索查询
      const forumQueries = this.targetForums.map(forum => {
        // 添加问题相关关键词以更好地定位问题内容
        const questionTerms = this.characterSets.questionWords.slice(0, 3);
        const queries = questionTerms.map(term => `${keyword} ${term} site:${forum}`);
        return queries;
      }).flat();
      
      // 限制查询数量以避免过多API调用
      const limitedQueries = forumQueries.slice(0, 5);
      
      // 使用MultiSearchTools进行搜索
      const forumSearchResults = [];
      
      if (this.multiSearchTools) {
        const searchTool = this.tools.find(t => t.name === 'smart_search');
        
        if (searchTool) {
          for (const query of limitedQueries) {
            logger.debug('Executing forum search', { query });
            
            const result = await searchTool.invoke({
              query,
              engine: 'google',
              maxResults: 5
            });
            
            try {
              const parsedResults = JSON.parse(result);
              forumSearchResults.push(...parsedResults);
            } catch (error) {
              logger.error('Failed to parse forum search results', { error, result });
            }
          }
        } else {
          logger.warn('smart_search tool not found, using standard search');
          
          // 退化到使用标准SearchTools
          const standardSearchTool = this.tools.find(t => t.name === 'web_search');
          if (standardSearchTool) {
            for (const query of limitedQueries.slice(0, 2)) { // 进一步限制查询数
              const result = await standardSearchTool.invoke({ query });
              try {
                const parsedResults = JSON.parse(result);
                forumSearchResults.push(...parsedResults);
              } catch (error) {
                logger.error('Failed to parse standard search results', { error });
              }
            }
          }
        }
      } else {
        logger.warn('MultiSearchTools not available, skipping forum search');
      }
      
      logger.debug('Forum search completed', { 
        keyword, 
        resultCount: forumSearchResults.length 
      });
      
      return forumSearchResults;
    } catch (error) {
      logger.error('Failed to search forums', { keyword, error });
      return [];
    }
  }
  
  /**
   * 执行LLM链，统一处理LLM调用
   */
  private async llmChain(config: {
    prompt: ChatPromptTemplate;
    outputParser: StringOutputParser;
  }) {
    // 使用父类的llm实例
    return this.llm.pipe(config.prompt).pipe(config.outputParser);
  }
  
  /**
   * 从搜索建议和自动补全数据中提取问题
   */
  private async extractQuestionsFromSuggestions(
    keyword: string,
    suggestions: AutocompleteSuggestion[]
  ): Promise<any[]> {
    try {
      if (!suggestions || suggestions.length === 0) {
        return [];
      }
      
      logger.debug('Extracting questions from suggestions', { 
        keyword, 
        suggestionsCount: suggestions.length 
      });
      
      // 提取含问题特征的查询
      const potentialQuestions = suggestions
        .map(s => s.query || s.text || '') // 使用query或text属性
        .filter(query => {
          // 识别可能是问题的查询
          const hasQuestionWord = this.characterSets.questions.some(q => 
            query.toLowerCase().includes(q.toLowerCase())
          );
          
          const hasProblemWord = this.characterSets.questionWords.some(q => 
            query.toLowerCase().includes(q.toLowerCase())
          );
          
          const endsWithQuestionMark = query.trim().endsWith('?') || 
                                      query.trim().endsWith('？');
                                    
          return hasQuestionWord || hasProblemWord || endsWithQuestionMark;
        });
      
      if (potentialQuestions.length === 0) {
        logger.debug('No questions found in suggestions');
        return [];
      }
      
      // 使用LLM评估这些问题的价值和质量
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的问题分析专家，擅长识别有价值的用户问题。

        请分析以下与"${keyword}"相关的用户搜索查询，识别其中包含的真实用户问题:

        ${potentialQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

        对于每个有价值的问题，请评估:
        1. 问题清晰度 (1-10): 问题表述是否清晰明确
        2. 问题价值 (1-10): 解决此问题对用户的价值有多大
        3. 真实性 (1-10): 这是否像真实用户会问的问题
        4. 具体性 (1-10): 问题是否足够具体可回答
        5. 总体分数 (1-10): 综合评分

        只返回评分至少${this.minProblemScore}分(满分10分)的问题。为每个问题提供一个更清晰、更正式的重新表述。

        以JSON数组返回:
        [
          {
            "originalQuery": "原始查询文本",
            "refinedQuestion": "经过重新表述的清晰问题",
            "clarityScore": 8,
            "valueScore": 9,
            "authenticityScore": 7,
            "specificityScore": 8,
            "overallScore": 8,
            "reasoning": "简要说明为何这是个有价值的问题"
          }
        ]
      `);
      
      // 执行LLM评估
      const evaluatedQuestions = await this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      }).invoke({});
      
      try {
        // 解析LLM返回的JSON
        const parsedQuestions = JSON.parse(evaluatedQuestions);
        
        // 记录结果
        logger.debug('Extracted questions from suggestions', {
          keyword,
          extractedCount: parsedQuestions.length,
          originalCount: potentialQuestions.length
        });
        
        return parsedQuestions;
      } catch (error) {
        logger.error('Failed to parse evaluated questions', { error, evaluatedQuestions });
        return [];
      }
    } catch (error) {
      logger.error('Failed to extract questions from suggestions', { keyword, error });
      return [];
    }
  }
  
  /**
   * 从论坛搜索结果中提取问题
   */
  private async extractQuestionsFromForumResults(
    keyword: string,
    forumResults: any[]
  ): Promise<any[]> {
    try {
      if (!forumResults || forumResults.length === 0) {
        logger.debug('No forum results to extract questions from');
        return [];
      }
      
      logger.debug('Extracting questions from forum results', {
        keyword,
        forumResultsCount: forumResults.length
      });
      
      // 准备提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的问题分析专家，擅长从社区和论坛内容中识别有价值的问题。

        请分析以下与"${keyword}"相关的论坛搜索结果，提取和识别其中包含的真实用户问题:

        ${forumResults.map((r, i) => `
        结果 ${i+1}:
        标题: ${r.title || 'No title'}
        URL: ${r.url || 'No URL'}
        摘要: ${r.snippet || r.description || 'No snippet'}
        来源: ${r.source || r.domain || 'Unknown source'}
        `).join('\n')}

        对于每个搜索结果，请提取其中包含的主要问题，并评估:
        1. 问题清晰度 (1-10): 问题表述是否清晰明确
        2. 问题价值 (1-10): 解决此问题对用户的价值有多大
        3. 真实性 (1-10): 这是否来自真实用户的真实问题
        4. 具体性 (1-10): 问题是否足够具体可回答
        5. 社区认可度 (1-10): 从结果看，此问题在社区中的关注度如何
        6. 总体分数 (1-10): 综合评分

        只返回评分至少${this.minProblemScore}分(满分10分)的问题。为每个问题提供一个更清晰、更正式的重新表述。

        以JSON数组返回:
        [
          {
            "sourceTitle": "来源标题",
            "sourceUrl": "来源URL",
            "extractedQuestion": "提取的问题",
            "refinedQuestion": "经过重新表述的清晰问题",
            "clarityScore": 8,
            "valueScore": 9,
            "authenticityScore": 7,
            "specificityScore": 8,
            "communityInterestScore": 9,
            "overallScore": 8.2,
            "platform": "问题来源平台",
            "reasoning": "简要说明为何这是个有价值的问题"
          }
        ]
      `);
      
      // 执行LLM评估
      const evaluatedQuestions = await this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      }).invoke({});
      
      try {
        // 解析LLM返回的JSON
        const parsedQuestions = JSON.parse(evaluatedQuestions);
        
        // 记录结果
        logger.debug('Extracted questions from forum results', {
          keyword,
          extractedCount: parsedQuestions.length,
          originalCount: forumResults.length
        });
        
        return parsedQuestions;
      } catch (error) {
        logger.error('Failed to parse forum questions', { error, evaluatedQuestions });
        return [];
      }
    } catch (error) {
      logger.error('Failed to extract questions from forum results', { keyword, error });
      return [];
    }
  }
  
  /**
   * 问题过滤和整合
   * 合并所有来源的问题，过滤重复，排序并限制数量
   */
  private async filterAndIntegrateQuestions(
    suggestionsQuestions: any[],
    forumQuestions: any[]
  ): Promise<any[]> {
    try {
      // 合并两种来源的问题
      const allQuestions = [
        ...suggestionsQuestions,
        ...forumQuestions
      ];
      
      if (allQuestions.length === 0) {
        logger.debug('No questions to filter and integrate');
        return [];
      }
      
      logger.debug('Filtering and integrating questions', {
        totalQuestions: allQuestions.length,
        suggestionsQuestionsCount: suggestionsQuestions.length,
        forumQuestionsCount: forumQuestions.length
      });
      
      // 按总体分数排序
      const sortedQuestions = allQuestions.sort((a, b) => {
        const scoreA = a.overallScore || 0;
        const scoreB = b.overallScore || 0;
        return scoreB - scoreA; // 降序排序
      });
      
      // 去除重复问题
      const uniqueQuestions = [];
      const seenQuestions = new Set<string>();
      
      for (const question of sortedQuestions) {
        // 使用重写后的问题作为去重依据
        const refinedQuestion = question.refinedQuestion || 
                             question.extractedQuestion || 
                             '';
        
        // 简单的相似度检查，可以未来进一步改进
        let isDuplicate = false;
        for (const seen of seenQuestions) {
          if (this.isQuestionSimilar(refinedQuestion, seen)) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          uniqueQuestions.push(question);
          seenQuestions.add(refinedQuestion);
        }
      }
      
      // 限制问题数量
      const limitedQuestions = uniqueQuestions.slice(0, this.maxProblems);
      
      logger.debug('Questions filtered and integrated', {
        originalCount: allQuestions.length,
        uniqueCount: uniqueQuestions.length,
        limitedCount: limitedQuestions.length
      });
      
      // 添加问题序号和来源标识
      return limitedQuestions.map((q, i) => ({
        ...q,
        id: i + 1,
        source: q.platform || (q.originalQuery ? 'search_suggestion' : 'forum_search')
      }));
    } catch (error) {
      logger.error('Failed to filter and integrate questions', { error });
      return [];
    }
  }
  
  /**
   * 检查两个问题是否相似
   * 简单实现，可未来进一步改进
   */
  private isQuestionSimilar(questionA: string, questionB: string): boolean {
    // 简化为小写并去除标点符号
    const normalizeQuestion = (q: string) => {
      return q.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normA = normalizeQuestion(questionA);
    const normB = normalizeQuestion(questionB);
    
    // 简单比较：如果一个是另一个的子串，或相似度超过70%，则视为相似
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
    
    // 计算简单词汇重叠比例
    const wordsA = new Set(normA.split(' '));
    const wordsB = new Set(normB.split(' '));
    
    // 计算交集大小
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    
    // 计算相似度：交集大小除以较小集合的大小
    const similarity = intersection.size / Math.min(wordsA.size, wordsB.size);
    
    return similarity >= 0.7; // 70%相似度阈值
  }
  
  /**
   * 反思和提升问题质量
   */
  private async reflectAndRefineQuestions(
    questions: any[],
    keyword: string
  ): Promise<any[]> {
    if (!questions || questions.length === 0) {
      return [];
    }
    
    try {
      logger.debug('Reflecting on and refining questions', {
        keyword,
        questionsCount: questions.length
      });
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的问题分析专家，现在需要对已识别的问题进行反思和提升。
        
        关键词: "${keyword}"
        
        已识别的问题:
        ${questions.map((q, i) => `
        ${i+1}. ${q.refinedQuestion || q.extractedQuestion}
        当前评分: ${q.overallScore}/10
        来源: ${q.source}
        理由: ${q.reasoning || '未提供'}
        `).join('\n')}
        
        请对每个问题进行深入反思，评估其价值和改进空间。考虑:
        1. 这个问题是否足够深入? 是否触及根本问题?
        2. 这个问题对用户有多大价值? 是否解决真正痛点?
        3. 这个问题足够具体吗? 能否进一步明确?
        4. 解决这个问题是否代表市场机会?
        5. 该问题是否可能有现成的好解决方案?
        
        请为每个问题提供:
        1. 更深入、更有价值的重新表述
        2. 反思评分 (1-10)
        3. 为什么这是/不是一个值得深入分析的问题
        4. 该问题解决方案的市场潜力评估
        
        以JSON数组返回:
        [
          {
            "id": 1,
            "originalQuestion": "原问题",
            "refinedQuestion": "经过深度反思后的问题",
            "reflectionScore": 8,
            "marketPotential": 7,
            "isWorthPursuing": true,
            "reflection": "为什么这是个值得/不值得深入分析的问题",
            "marketInsight": "关于这个问题解决方案的市场潜力简要分析"
          }
        ]
      `);
      
      // 执行LLM评估
      const reflectedQuestionsStr = await this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      }).invoke({});
      
      try {
        // 解析LLM返回的JSON
        const reflectedQuestions = JSON.parse(reflectedQuestionsStr);
        
        // 合并原始信息与反思信息
        const enhancedQuestions = reflectedQuestions.map((rq: any) => {
          // 查找原始问题
          const originalQuestion = questions.find(q => q.id === rq.id) || {};
          
          return {
            ...originalQuestion,
            ...rq,
            // 确保保留原始信息
            source: originalQuestion.source || 'unknown',
            originalQuestion: originalQuestion.refinedQuestion || 
                          originalQuestion.extractedQuestion || 
                          rq.originalQuestion,
            // 更新评分为反思后的评分
            overallScore: rq.reflectionScore || originalQuestion.overallScore,
            // 添加反思信息
            enhancedBy: 'reflection'
          };
        });
        
        // 过滤掉不值得深入的问题
        const worthyQuestions = enhancedQuestions.filter((q: any) => 
          q.isWorthPursuing !== false && 
          q.reflectionScore >= this.minProblemScore
        );
        
        logger.debug('Questions reflected and refined', {
          keyword,
          originalCount: questions.length,
          refinedCount: worthyQuestions.length
        });
        
        return worthyQuestions;
      } catch (error) {
        logger.error('Failed to parse reflected questions', { error, reflectedQuestionsStr });
        return questions; // 返回原始问题
      }
    } catch (error) {
      logger.error('Failed to reflect on questions', { keyword, error });
      return questions; // 返回原始问题
    }
  }
  
  /**
   * 整合问题挖掘过程
   */
  private async discoverHighValueProblems(keyword: string): Promise<any[]> {
    try {
      logger.debug('Starting high value problem discovery process', { keyword });
      
      // 1. 获取自动补全建议
      const autocompleteSuggestions = await this.getAutocompleteSuggestions(keyword);
      
      // 2. 从建议中提取问题
      const suggestionsQuestions = await this.extractQuestionsFromSuggestions(
        keyword, 
        autocompleteSuggestions
      );
      
      // 3. 只在启用论坛搜索时执行
      let forumQuestions: any[] = [];
      if (this.enableForumSearch) {
        // 3.1 搜索论坛内容
        const forumResults = await this.searchForumQuestions(keyword);
        
        // 3.2 从论坛内容中提取问题
        forumQuestions = await this.extractQuestionsFromForumResults(
          keyword,
          forumResults
        );
      }
      
      // 4. 过滤和整合问题
      const integratedQuestions = await this.filterAndIntegrateQuestions(
        suggestionsQuestions,
        forumQuestions
      );
      
      // 5. 反思和提升问题质量
      const refinedQuestions = await this.reflectAndRefineQuestions(
        integratedQuestions,
        keyword
      );
      
      // 6. 最终排序
      const finalQuestions = refinedQuestions
        .sort((a, b) => (b.reflectionScore || b.overallScore || 0) - 
                      (a.reflectionScore || a.overallScore || 0))
        .slice(0, this.maxProblems);
      
      logger.debug('High value problem discovery completed', {
        keyword,
        suggestionsQuestionsCount: suggestionsQuestions.length,
        forumQuestionsCount: forumQuestions.length,
        integratedQuestionsCount: integratedQuestions.length,
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
      
      // 结果对象
      const result: any = {
        timestamp: new Date().toISOString(),
        keyword,
        potentialNeeds: [],
        statistics: {},
        categories: {},
      };
      
      // Step 1: 扩展关键词生成多个关键词变体
      const expandedKeywords = [];
      
      // 基本扩展:前缀扩展
      const prefixExpansions = await this.expandKeywordPrefixes(keyword);
      expandedKeywords.push(...prefixExpansions);
      
      // 字符扩展
      const charExpansions = await this.expandWithCharacters(keyword);
      expandedKeywords.push(...charExpansions);
      
      // 限制关键词数量
      const limitedKeywords = [
        keyword, // 始终包含原始关键词
        ...expandedKeywords
      ].slice(0, this.maxKeywords);
      
      logger.debug(`Generated ${limitedKeywords.length} keyword variations`, { 
        original: keyword, 
        sampleExpansions: limitedKeywords.slice(0, 5) 
      });
      
      // Step 2: 分析潜在需求
      result.potentialNeeds = await this.analyzePotentialNeeds(limitedKeywords);
      
      // Step 3: 需求量化 (如果启用)
      if (this.enableQuantification) {
        result.potentialNeeds = await this.quantifyNeedsPotential(result.potentialNeeds);
      }
      
      // Step 4: 需求分类 (如果启用)
      if (this.enableCategorization) {
        result.categories = await this.categorizeNeeds(result.potentialNeeds);
      }
      
      // Step 5: 问题发现 (如果启用)
      let highValueProblems = [];
      if (this.enableProblemDiscovery) {
        highValueProblems = await this.discoverHighValueProblems(keyword);
        result.highValueProblems = highValueProblems;
      }
      
      // 计算并添加统计数据
      result.statistics = {
        totalKeywords: limitedKeywords.length,
        totalNeeds: result.potentialNeeds.length,
        averageConfidence: result.potentialNeeds.length > 0 ? 
          result.potentialNeeds.reduce((acc: number, need: any) => acc + (need.confidenceScore || 0), 0) / 
          result.potentialNeeds.length : 
          0,
        categoryCount: Object.keys(result.categories || {}).length,
        highValueProblemsCount: highValueProblems.length,
        topProblemScore: highValueProblems.length > 0 ? 
          (highValueProblems[0].reflectionScore || highValueProblems[0].overallScore) : 
          0
      };
      
      logger.info(`MarketNeedExplorerAgent completed for ${keyword}`, {
        needsCount: result.potentialNeeds.length,
        problemsCount: highValueProblems.length,
        categoriesCount: Object.keys(result.categories || {}).length
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