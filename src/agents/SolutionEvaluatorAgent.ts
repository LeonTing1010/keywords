/**
 * 内容Agent (解决方案评估专家)
 * 
 * 核心职责:
 * 1. 对搜索结果进行深度内容缺口分析
 * 2. 评估解决方案的全面性、权威性和可访问性
 * 3. 识别信息质量问题(过时、不完整、矛盾)
 * 4. 根据用户需求维度评估竞争对手解决方案
 * 5. 计算客观需求满足度分数并提供可信度指标
 * 6. 确认已验证问题的解决方案缺口
 * 7. 评估现有解决方案的市场空白和缺陷
 * 
 * 主要功能:
 * - 分析搜索结果内容质量及其满足用户需求的程度
 * - 识别具体的内容缺口和市场空白
 * - 评估现有解决方案的权威性和可靠性
 * - 生成未满足需求的机会分析
 * - 提供内容差距严重度和市场机会评分
 * - 确认高价值问题的解决方案缺口大小
 * - 评估竞争格局和市场空白
 */
import { BaseAgent, BaseAgentConfig } from './base/BaseAgent';
import { GraphStateType } from '../types/schema';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '../infra/logger';
import { SearchEngine } from '../infra/search/SearchEngine';
import { SearchOptions } from '../infra/search/types';
import { AutocompleteSuggestion } from '../infra/search/types';
import { MockSearchEngine } from '../infra/search/engines/MockSearchEngine';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { SearchTools } from '../tools/search/SearchTools';
import { MultiSearchTools } from '../tools/search/MultiSearchTools';
import { RunnableConfig } from '@langchain/core/runnables';

// 解决方案评估Agent配置
export interface SolutionEvaluatorAgentConfig extends BaseAgentConfig {
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  multiSearchTools?: MultiSearchTools;
  maxContentSamples?: number;
  detailedAnalysis?: boolean;
  enableCompetitorAnalysis?: boolean; // 启用竞争对手分析
  qualityDimensionsCount?: number; // 质量评估维度数量
  contentGapThreshold?: number; // 内容缺口识别阈值
  enableProblemSolutionGapAnalysis?: boolean; // 启用问题-解决方案缺口分析
  minGapSeverityScore?: number; // 市场缺口严重性阈值
  maxProblemsToEvaluate?: number; // 要评估的最大问题数量
}

/**
 * 解决方案评估Agent (解决方案评估专家)
 * 负责深度内容分析、解决方案评估和内容缺口识别
 */
export class SolutionEvaluatorAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private multiSearchTools: MultiSearchTools | null = null;
  private maxContentSamples: number;
  private detailedAnalysis: boolean;
  private enableCompetitorAnalysis: boolean;
  private qualityDimensionsCount: number;
  private contentGapThreshold: number;
  private enableProblemSolutionGapAnalysis: boolean;
  private minGapSeverityScore: number;
  private maxProblemsToEvaluate: number;
  
  constructor(config: SolutionEvaluatorAgentConfig = {}) {
    super(config);
    
    this.maxContentSamples = config.maxContentSamples || 7; // 增加默认样本量
    this.detailedAnalysis = config.detailedAnalysis !== false;
    this.enableCompetitorAnalysis = config.enableCompetitorAnalysis !== false; // 默认启用
    this.qualityDimensionsCount = config.qualityDimensionsCount || 5; // 默认5个维度
    this.contentGapThreshold = config.contentGapThreshold || 3; // 1-10的阈值
    this.enableProblemSolutionGapAnalysis = config.enableProblemSolutionGapAnalysis !== false; // 默认启用
    this.minGapSeverityScore = config.minGapSeverityScore || 7; // 默认7分以上的缺口
    this.maxProblemsToEvaluate = config.maxProblemsToEvaluate || 5; // 默认评估5个问题
    
    logger.debug('SolutionEvaluatorAgent initialized', { 
      maxContentSamples: this.maxContentSamples,
      detailedAnalysis: this.detailedAnalysis,
      enableCompetitorAnalysis: this.enableCompetitorAnalysis,
      qualityDimensionsCount: this.qualityDimensionsCount,
      contentGapThreshold: this.contentGapThreshold,
      enableProblemSolutionGapAnalysis: this.enableProblemSolutionGapAnalysis,
      minGapSeverityScore: this.minGapSeverityScore,
      maxProblemsToEvaluate: this.maxProblemsToEvaluate
    });
    
    // 在constructor最后初始化SearchTools，确保在setupTools之后
    this.initializeSearchTools(config);
  }
  
  /**
   * 初始化搜索工具 - 在constructor的最后调用，避免继承初始化顺序问题
   */
  private initializeSearchTools(config: SolutionEvaluatorAgentConfig): void {
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
      logger.warn('No search engine/tools provided to SolutionEvaluatorAgent, using default web search');
    }
    
    // 初始化MultiSearchTools（如果提供）
    if (config.multiSearchTools) {
      this.multiSearchTools = config.multiSearchTools;
      logger.debug('Using provided MultiSearchTools instance');
    } else if (this.enableProblemSolutionGapAnalysis) {
      logger.debug('Creating default MultiSearchTools instance for solution gap analysis');
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
        
        logger.debug('SolutionEvaluatorAgent tools registered', { count: this.tools.length });
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
    logger.debug('setupTools called in SolutionEvaluatorAgent, will register tools later');
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
   * 获取关键词的搜索结果并增强内容分析
   */
  private async getEnhancedSearchResults(keyword: string): Promise<any[]> {
    try {
      logger.debug('Getting enhanced search results', { keyword });
      
      // 确保searchTools已初始化
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // 通过tool use方式使用内容分析工具
      const contentTool = this.tools.find(t => t.name === 'analyze_search_content');
      if (!contentTool) {
        logger.error('analyze_search_content tool not found');
        return [];
      }
      
      const result = await contentTool.invoke({ 
        keyword, 
        maxResults: this.maxContentSamples 
      });
      
      try {
        // 解析工具返回的JSON
        const contentData = JSON.parse(result);
        const searchResults = contentData.searchResults || [];
        
        // 增强搜索结果分析
        return await this.enhanceSearchResults(searchResults, keyword);
      } catch (error) {
        logger.error('Failed to parse search results', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get enhanced search results', { keyword, error });
      return [];
    }
  }
  
  /**
   * 增强搜索结果分析
   * 为每个结果添加额外的元数据分析
   */
  private async enhanceSearchResults(searchResults: any[], keyword: string): Promise<any[]> {
    if (searchResults.length === 0) {
      return [];
    }
    
    try {
      // 如果不进行详细分析，直接返回原始结果
      if (!this.detailedAnalysis) {
        return searchResults;
      }
      
      logger.debug('Enhancing search results with metadata');
      
      // 创建搜索结果元数据分析提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的内容分析专家，擅长评估搜索结果的质量和相关性。
        
        请分析以下关于"${keyword}"的搜索结果，为每个结果提供更详细的元数据信息:
        
        ${searchResults.map((r, i) => `
        结果 ${i+1}:
        标题: ${r.title}
        网址: ${r.url}
        摘要: ${r.snippet}
        `).join('\n')}
        
        为每个结果提供以下元数据:
        1. 内容类型 (博客/新闻/指南/产品页/论坛/学术/评论)
        2. 内容权威性 (1-10分)
        3. 内容全面性 (1-10分)
        4. 内容时效性 (1-10分)
        5. 内容可访问性 (1-10分)
        6. 目标用户群体
        7. 主要价值主张
        8. 潜在内容缺口
        
        以JSON数组返回，保持原始搜索结果索引顺序:
        [
          {{
            "index": 0,
            "contentType": "博客",
            "authority": 7,
            "comprehensiveness": 6,
            "timeliness": 8,
            "accessibility": 9,
            "targetAudience": "目标用户群体",
            "valueProposition": "主要价值主张",
            "contentGaps": ["缺口1", "缺口2"]
          }}
        ]
        
        只返回JSON，不要有其他文字。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for result enhancement', { content });
          return searchResults;
        }
        
        const enhancedMetadata = JSON.parse(jsonMatch[0]);
        
        // 将元数据合并回原始搜索结果
        const enhancedResults = searchResults.map((result, index) => {
          const metadata = enhancedMetadata.find((m: any) => m.index === index);
          return metadata ? { ...result, metadata } : result;
        });
        
        logger.debug('Enhanced search results with metadata', { count: enhancedResults.length });
        return enhancedResults;
      } catch (parseError) {
        logger.error('Failed to parse enhanced metadata JSON', { parseError, response });
        return searchResults;
      }
    } catch (error) {
      logger.error('Failed to enhance search results', { error });
      return searchResults;
    }
  }
  
  /**
   * 全维度内容质量分析
   * 对搜索结果进行多维度深度内容质量评估
   */
  private async analyzeContentQualityByDimensions(
    keyword: string, 
    searchResults: any[], 
    userNeeds: any[] = []
  ): Promise<any> {
    try {
      logger.debug('Analyzing content quality by dimensions', { keyword });
      
      // 提取用户需求
      const needsText = userNeeds.length > 0
        ? `用户需求:\n${userNeeds.map((n, i) => `${i+1}. ${n.description || n.keyword}`).join('\n')}`
        : '没有明确的用户需求数据，请基于关键词推断可能的用户需求。';
      
      // 将搜索结果转换为文本
      const resultText = searchResults.map((r, i) => {
        const metadata = r.metadata 
          ? `\n内容类型: ${r.metadata.contentType || '未知'}\n权威性: ${r.metadata.authority || '未评估'}/10\n全面性: ${r.metadata.comprehensiveness || '未评估'}/10`
          : '';
        
        return `
          #${i+1} ${r.title}
          URL: ${r.url}
          摘要: ${r.snippet}${metadata}
        `;
      }).join('\n');
      
      // 创建增强版内容质量分析提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的内容质量与解决方案分析专家，擅长评估搜索结果对用户需求的满足程度。
        
        请对关键词"${keyword}"的搜索结果进行全面、多维度评估:
        
        ${needsText}
        
        搜索结果:
        ${resultText}
        
        请提供以下几个方面的详细评估:
        
        1. 全面性评估:
           - 现有内容是否覆盖了关键词相关的所有主要方面?
           - 是否有重要信息维度被忽略?
           - 全面性得分(1-10)及详细理由
        
        2. 权威性评估:
           - 内容来源的可信度和权威性如何?
           - 是否包含专家观点或可靠证据?
           - 权威性得分(1-10)及详细理由
        
        3. 时效性评估:
           - 内容是否最新?是否包含过时信息?
           - 是否反映当前趋势和发展?
           - 时效性得分(1-10)及详细理由
        
        4. 可访问性评估:
           - 内容对目标用户是否容易理解?
           - 是否存在专业术语障碍或复杂性问题?
           - 可访问性得分(1-10)及详细理由
        
        5. 实用性评估:
           - 内容是否提供实际可行的解决方案?
           - 用户能否基于这些信息采取行动?
           - 实用性得分(1-10)及详细理由
        
        6. 主要内容缺口分析:
           - 识别3-5个最显著的内容缺口
           - 对每个缺口的严重程度评分(1-10)
           - 解释为什么这些缺口对用户重要
        
        7. 竞争解决方案评估:
           - 对现有解决方案的优缺点分析
           - 不同解决方案的比较
           - 领先解决方案及其差距
        
        8. 客观需求满足度计算:
           - 总体需求满足度得分(1-10)
           - 计算依据及可信度(0-1)
           - 对不同用户类型的满足度差异
        
        以JSON格式返回详细分析:
        {{
          "dimensions": {{
            "comprehensiveness": {{
              "score": 7,
              "strengths": ["优势1", "优势2"],
              "weaknesses": ["弱点1", "弱点2"],
              "analysis": "详细分析"
            }},
            "authority": {{
              "score": 0,
              "strengths": [],
              "weaknesses": [],
              "analysis": ""
            }},
            "timeliness": {{
              "score": 0,
              "strengths": [],
              "weaknesses": [],
              "analysis": ""
            }},
            "accessibility": {{
              "score": 0,
              "strengths": [],
              "weaknesses": [],
              "analysis": ""
            }},
            "practicality": {{
              "score": 0,
              "strengths": [],
              "weaknesses": [],
              "analysis": ""
            }}
          }},
          "contentGaps": [
            {{
              "description": "缺口描述",
              "severity": 8,
              "importance": "为什么重要",
              "affectedUserNeeds": ["相关需求1", "相关需求2"]
            }}
          ],
          "competitorAnalysis": {{
            "leadingSolutions": ["解决方案1", "解决方案2"],
            "commonWeaknesses": ["共同弱点1", "共同弱点2"],
            "differentiators": ["差异点1", "差异点2"],
            "analysis": "竞争格局分析"
          }},
          "needSatisfactionScore": {{
            "overall": 6.5,
            "confidence": 0.8,
            "byUserType": [
              {{
                "userType": "用户类型1",
                "score": 7
              }}
            ],
            "justification": "评分依据"
          }},
          "isUnmetNeed": true,
          "marketGapSeverity": 7,
          "opportunityAssessment": "市场机会整体评估"
        }}
        
        只返回JSON，不要有其他文字。确保评估客观、全面、有深度。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for content quality analysis', { content });
          return {
            isUnmetNeed: false,
            needSatisfactionScore: { overall: 5 },
            contentGaps: [],
            marketGapSeverity: 5,
            dimensions: {}
          };
        }
        
        const result = JSON.parse(jsonMatch[0]);
        logger.debug('Analyzed content quality by dimensions', { 
          dimensionsCount: Object.keys(result.dimensions || {}).length,
          gapsCount: (result.contentGaps || []).length,
          needSatisfactionScore: result.needSatisfactionScore?.overall || 'N/A'
        });
        
        return result;
      } catch (parseError) {
        logger.error('Failed to parse content quality JSON', { parseError, response });
        return {
          isUnmetNeed: false,
          needSatisfactionScore: { overall: 5 },
          contentGaps: [],
          marketGapSeverity: 5,
          dimensions: {}
        };
      }
    } catch (error) {
      logger.error('Failed to analyze content quality by dimensions', { keyword, error });
      throw error;
    }
  }
  
  /**
   * 竞争对手解决方案评估
   * 详细分析主要竞争对手解决方案的优劣
   */
  private async evaluateCompetitorSolutions(
    keyword: string,
    searchResults: any[],
    contentAnalysis: any
  ): Promise<any[]> {
    if (!this.enableCompetitorAnalysis || searchResults.length < 3) {
      return [];
    }
    
    try {
      logger.debug('Evaluating competitor solutions');
      
      // 提取前几个可能是竞争解决方案的结果
      const competitorResults = searchResults.slice(0, 5);
      
      // 提取内容分析中的主要维度和缺口
      const dimensionsText = contentAnalysis.dimensions
        ? Object.entries(contentAnalysis.dimensions)
            .map(([name, data]: [string, any]) => 
              `${name}: ${data.score}/10 (${data.weaknesses?.[0] || '无主要弱点'})`
            ).join('\n')
        : '无维度分析数据';
        
      const gapsText = contentAnalysis.contentGaps?.length > 0
        ? contentAnalysis.contentGaps
            .map((gap: any) => `- ${gap.description} (严重度: ${gap.severity}/10)`)
            .join('\n')
        : '无内容缺口数据';
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的竞争情报分析师，擅长评估竞争对手解决方案。
        
        请详细分析以下关于"${keyword}"的竞争解决方案:
        
        ${competitorResults.map((r, i) => `
        解决方案 ${i+1}:
        提供者: ${r.title.split('-')[0] || r.title}
        网址: ${r.url}
        描述: ${r.snippet}
        `).join('\n')}
        
        内容维度评估:
        ${dimensionsText}
        
        主要内容缺口:
        ${gapsText}
        
        请针对每个可能的竞争解决方案，提供详细评估:
        
        1. 解决方案提供者
        2. 主要价值主张
        3. 主要优势 (3-5点)
        4. 主要劣势 (3-5点)
        5. 目标用户群体
        6. 解决方案成熟度 (1-10)
        7. 市场定位
        8. 差异化因素
        9. 未满足的用户需求
        
        以JSON数组返回分析:
        [
          {{
            "provider": "解决方案提供者",
            "valueProposition": "主要价值主张",
            "strengths": ["优势1", "优势2", "优势3"],
            "weaknesses": ["劣势1", "劣势2", "劣势3"],
            "targetAudience": "目标用户群体",
            "maturityScore": 7,
            "marketPosition": "市场定位",
            "differentiators": ["差异点1", "差异点2"],
            "unmetNeeds": ["未满足需求1", "未满足需求2"]
          }}
        ]
        
        只返回JSON，不要有其他文字。确保分析客观、深入且全面。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for competitor evaluation', { content });
          return [];
        }
        
        const competitors = JSON.parse(jsonMatch[0]);
        logger.debug('Evaluated competitor solutions', { count: competitors.length });
        
        return competitors;
      } catch (parseError) {
        logger.error('Failed to parse competitor solutions JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to evaluate competitor solutions', { error });
      return [];
    }
  }
  
  /**
   * 生成市场机会解决方案建议
   * 基于内容缺口和竞争对手分析提供解决方案建议
   */
  private async generateSolutionOpportunities(
    keyword: string,
    contentAnalysis: any,
    competitorAnalysis: any[] = [],
    userNeeds: any[] = []
  ): Promise<any[]> {
    try {
      logger.debug('Generating solution opportunities');
      
      // 提取用户需求
      const needsText = userNeeds.length > 0
        ? `用户需求:\n${userNeeds.map((n, i) => `${i+1}. ${n.description || n.keyword}`).join('\n')}`
        : '没有明确的用户需求数据。';
      
      // 提取内容缺口
      const gapsText = contentAnalysis.contentGaps?.length > 0
        ? `主要内容缺口:\n${contentAnalysis.contentGaps
            .map((gap: any) => `- ${gap.description} (严重度: ${gap.severity}/10)`)
            .join('\n')}`
        : '无内容缺口数据。';
      
      // 提取竞争解决方案分析
      const competitorText = competitorAnalysis.length > 0
        ? `主要竞争解决方案:\n${competitorAnalysis
            .map((comp: any) => `- ${comp.provider}: ${comp.valueProposition}\n  弱点: ${(comp.weaknesses || []).join(', ')}`)
            .join('\n')}`
        : '无竞争对手分析数据。';
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个产品战略与创新专家，擅长基于内容和竞争分析发现市场机会。
        
        请基于以下关于"${keyword}"的分析，设计创新解决方案机会:
        
        ${needsText}
        
        ${gapsText}
        
        ${competitorText}
        
        需求满足度得分: ${contentAnalysis.needSatisfactionScore?.overall || 'N/A'}/10
        市场缺口严重度: ${contentAnalysis.marketGapSeverity || 'N/A'}/10
        
        请提出3-5个具有市场潜力的解决方案机会，包括:
        
        1. 机会名称/标题
        2. 目标用户群体
        3. 核心价值主张
        4. 解决的关键问题
        5. 差异化因素
        6. 主要功能/内容组件 (3-5个)
        7. 市场潜力评分 (1-10)
        8. 执行难度评分 (1-10)
        9. 推荐的实施优先级 (1-10)
        10. 可能的实施挑战
        
        以JSON数组返回机会:
        [
          {{
            "title": "机会标题",
            "targetUsers": "目标用户群体",
            "valueProposition": "核心价值主张",
            "keyProblemSolved": "解决的关键问题",
            "differentiators": ["差异点1", "差异点2"],
            "keyComponents": ["组件1", "组件2", "组件3"],
            "marketPotential": 8,
            "implementationDifficulty": 6,
            "priority": 9,
            "challenges": ["挑战1", "挑战2"]
          }}
        ]
        
        只返回JSON，不要有其他文字。优先考虑具有高市场潜力、明确差异化、针对重要缺口的机会。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for solution opportunities', { content });
          return [];
        }
        
        const opportunities = JSON.parse(jsonMatch[0]);
        logger.debug('Generated solution opportunities', { count: opportunities.length });
        
        return opportunities;
      } catch (parseError) {
        logger.error('Failed to parse solution opportunities JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to generate solution opportunities', { error });
      return [];
    }
  }
  
  /**
   * 分析特定问题的现有解决方案缺口
   * 深入评估现有解决方案的质量和缺陷
   */
  private async analyzeProblemSolutionGap(problem: any): Promise<any> {
    try {
      const question = problem.refinedQuestion || problem.originalQuestion || '';
      logger.debug('Analyzing solution gap for problem', { question });
      
      // 执行特定问题的搜索
      const searchResults = await this.searchSpecificProblem(question);
      
      if (!searchResults || searchResults.length === 0) {
        logger.warn('No search results found for problem', { question });
        return {
          problem: question,
          gapSeverity: 10, // 没有搜索结果表示极大的市场缺口
          noSolutionsFound: true,
          reasoning: '未找到任何相关解决方案，表示存在显著的市场机会。'
        };
      }
      
      // 准备解决方案缺口分析提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的解决方案评估专家，现在需要评估一个特定问题的现有解决方案质量和缺口。
        
        问题: "${question}"
        
        搜索结果 (潜在解决方案):
        ${searchResults.map((r, i) => `
        解决方案 ${i+1}:
        标题: ${r.title || '无标题'}
        链接: ${r.url || r.link || '无链接'}
        摘要: ${r.snippet || r.description || '无摘要'}
        来源: ${r.source || r.domain || r.host || '未知来源'}
        `).join('\n')}
        
        请深入分析这些搜索结果并评估:
        
        1. 解决方案覆盖度 (1-10分): 现有解决方案对问题的覆盖程度如何？
        2. 解决方案质量 (1-10分): 现有解决方案的质量如何？
        3. 用户友好性 (1-10分): 现有解决方案对用户的友好程度如何？
        4. 最新性 (1-10分): 现有解决方案是否足够新/更新？
        5. 专业性 (1-10分): 现有解决方案的专业程度如何？
        6. 可访问性 (1-10分): 用户获取这些解决方案的难度如何？(分数越低越容易获取)
        7. 综合缺口严重度 (1-10分): 综合考虑，市场中解决此问题的方案缺口有多严重？(10分表示极大缺口)
        
        对每个解决方案进行评估，并给出整体的市场缺口分析。特别注意:
        - 现有解决方案的主要缺陷
        - 现有解决方案未满足的用户需求
        - 市场机会的大小和性质
        - 竞争格局分析
        
        以JSON格式返回结果:
        {
          "problem": "问题内容",
          "solutionsCount": 5,
          "solutionEvaluations": [
            {
              "title": "解决方案标题",
              "url": "解决方案URL",
              "coverageScore": 7,
              "qualityScore": 6,
              "userFriendlinessScore": 5,
              "freshnessScore": 8,
              "professionalismScore": 7,
              "accessibilityScore": 3,
              "overallScore": 6,
              "strengths": ["优势1", "优势2"],
              "weaknesses": ["缺点1", "缺点2"]
            }
          ],
          "marketGapAnalysis": {
            "gapSeverity": 8,
            "unmetNeeds": ["未满足需求1", "未满足需求2"],
            "opportunitySize": "大/中/小",
            "competitiveLandscape": "竞争格局描述",
            "mainDeficiencies": ["主要缺陷1", "主要缺陷2"]
          },
          "reasoning": "综合分析市场缺口的详细理由"
        }
      `);
      
      // 执行LLM分析
      const chain = this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      });
      
      const gapAnalysisResult = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const parsedGapAnalysis = JSON.parse(gapAnalysisResult);
        
        // 增强分析结果
        return {
          ...parsedGapAnalysis,
          originalProblem: problem
        };
      } catch (error) {
        logger.error('Failed to parse gap analysis result', { error });
        return {
          problem: question,
          gapSeverity: 5, // 默认中等缺口
          parsingFailed: true,
          originalProblem: problem
        };
      }
    } catch (error) {
      logger.error('Failed to analyze problem solution gap', { error });
      return {
        problem: problem.refinedQuestion || problem.originalQuestion,
        gapSeverity: 5, // 默认中等缺口
        analysisFailed: true,
        originalProblem: problem
      };
    }
  }
  
  /**
   * 针对特定问题执行搜索
   */
  private async searchSpecificProblem(question: string): Promise<any[]> {
    try {
      logger.debug('Searching for solutions to problem', { question });
      
      // 尝试使用smart_search工具（如果可用）
      if (this.multiSearchTools) {
        const smartSearchTool = this.tools.find(t => t.name === 'smart_search');
        
        if (smartSearchTool) {
          const result = await smartSearchTool.invoke({
            query: question,
            engine: 'google',
            maxResults: this.maxContentSamples
          });
          
          try {
            return JSON.parse(result);
          } catch (error) {
            logger.error('Failed to parse smart search results', { error });
          }
        }
      }
      
      // 退化使用标准web_search工具
      const webSearchTool = this.tools.find(t => t.name === 'web_search');
      if (webSearchTool) {
        const result = await webSearchTool.invoke({ query: question });
        try {
          return JSON.parse(result);
        } catch (error) {
          logger.error('Failed to parse web search results', { error });
        }
      }
      
      // 如果都不可用，使用analyze_search_content工具
      const contentTool = this.tools.find(t => t.name === 'analyze_search_content');
      if (contentTool) {
        const result = await contentTool.invoke({ 
          keyword: question, 
          maxResults: this.maxContentSamples 
        });
        
        try {
          const contentData = JSON.parse(result);
          return contentData.searchResults || [];
        } catch (error) {
          logger.error('Failed to parse content analysis results', { error });
        }
      }
      
      logger.warn('All search attempts failed, returning empty results');
      return [];
    } catch (error) {
      logger.error('Failed to search for specific problem', { error });
      return [];
    }
  }
  
  /**
   * 批量评估多个问题的解决方案缺口
   */
  private async evaluateMultipleProblemSolutionGaps(
    problems: any[]
  ): Promise<any[]> {
    if (!problems || problems.length === 0) {
      logger.debug('No problems to evaluate');
      return [];
    }
    
    try {
      logger.debug(`Starting solution gap evaluation for ${problems.length} problems`);
      
      // 限制要评估的问题数量
      const problemsToEvaluate = problems
        .sort((a, b) => (b.finalScore || b.validityScore || 0) - (a.finalScore || a.validityScore || 0))
        .slice(0, this.maxProblemsToEvaluate);
      
      // 对每个问题进行解决方案缺口分析
      const gapAnalysesPromises = problemsToEvaluate.map(problem => 
        this.analyzeProblemSolutionGap(problem)
      );
      
      const gapAnalyses = await Promise.all(gapAnalysesPromises);
      
      // 合并问题验证结果和解决方案缺口分析结果
      const evaluatedProblems = gapAnalyses.map(gapAnalysis => {
        const originalProblem = gapAnalysis.originalProblem;
        delete gapAnalysis.originalProblem; // 避免循环引用
        
        return {
          ...originalProblem,
          solutionGapAnalysis: gapAnalysis,
          gapSeverity: gapAnalysis.marketGapAnalysis?.gapSeverity || gapAnalysis.gapSeverity || 5,
          unmetNeeds: gapAnalysis.marketGapAnalysis?.unmetNeeds || [],
          opportunitySize: gapAnalysis.marketGapAnalysis?.opportunitySize || 'medium',
          valueScore: this.calculateValueScore(originalProblem, gapAnalysis)
        };
      });
      
      // 按价值分数排序
      const sortedProblems = evaluatedProblems.sort((a, b) => 
        (b.valueScore || 0) - (a.valueScore || 0)
      );
      
      logger.debug('Problem solution gap evaluation completed', {
        evaluated: sortedProblems.length,
        highValueGaps: sortedProblems.filter(p => (p.gapSeverity || 0) >= this.minGapSeverityScore).length
      });
      
      return sortedProblems;
    } catch (error) {
      logger.error('Problem solution gap evaluation process failed', { error });
      return problems; // 返回原始问题列表
    }
  }
  
  /**
   * 计算问题的最终价值分数
   * 综合考虑问题验证分数和解决方案缺口
   */
  private calculateValueScore(problem: any, gapAnalysis: any): number {
    try {
      // 基础问题分数
      const baseScore = problem.finalScore || problem.validityScore || 5; // 默认5分
      
      // 解决方案缺口严重度
      const gapSeverity = gapAnalysis.marketGapAnalysis?.gapSeverity || gapAnalysis.gapSeverity || 5;
      
      // 机会规模调整
      let opportunitySizeAdjustment = 0;
      const opportunitySize = gapAnalysis.marketGapAnalysis?.opportunitySize || '';
      if (opportunitySize.toLowerCase().includes('大')) opportunitySizeAdjustment = 1;
      else if (opportunitySize.toLowerCase().includes('小')) opportunitySizeAdjustment = -0.5;
      
      // 计算最终分数: 50%基础分数 + 40%缺口严重度 + 10%机会规模调整
      // 保证分数在1-10范围内
      const valueScore = 0.5 * baseScore + 0.4 * gapSeverity + opportunitySizeAdjustment;
      const finalScore = Math.max(1, Math.min(10, valueScore));
      
      logger.debug('Calculated problem value score', {
        baseScore,
        gapSeverity,
        opportunitySizeAdjustment,
        valueScore,
        finalScore
      });
      
      return Number(finalScore.toFixed(1));
    } catch (error) {
      logger.error('Error calculating problem value score', { error });
      return problem.finalScore || problem.validityScore || 5; // 默认返回原始分数
    }
  }
  
  /**
   * Agent执行入口
   */
  protected async executeImpl(state: any, config?: RunnableConfig): Promise<any> {
    try {
      // 从状态中获取关键词和验证过的问题
      const keyword = state.input?.keyword;
      if (!keyword) {
        throw new Error('No keyword provided in state');
      }
      
      // 获取前一阶段UserJourneySimulatorAgent验证的问题
      const validatedProblems = state.journeySimulation?.problemValidations || [];
      
      logger.info(`Starting SolutionEvaluatorAgent for keyword: ${keyword}`);
      
      // 结果对象
      const result: any = {
        timestamp: new Date().toISOString(),
        keyword,
        contentAnalysis: {},
        problemGapAnalyses: [],
        statistics: {}
      };
      
      // 1. 如果没有验证过的问题或问题解决方案缺口分析被禁用，执行标准内容分析
      if (!this.enableProblemSolutionGapAnalysis || validatedProblems.length === 0) {
        // 执行标准的内容分析
        // ... 原有代码逻辑 ...
        
        // 获取关键词搜索结果
        const searchResults = await this.getEnhancedSearchResults(keyword);
        
        // 根据多个维度分析内容质量
        const contentQualityAnalysis = await this.analyzeContentQualityByDimensions(
          keyword,
          searchResults
        );
        
        // 如果启用竞争对手分析
        let competitorAnalysis = [];
        if (this.enableCompetitorAnalysis) {
          competitorAnalysis = await this.evaluateCompetitorSolutions(
            keyword,
            searchResults,
            contentQualityAnalysis
          );
        }
        
        // 生成解决方案机会
        const opportunities = await this.generateSolutionOpportunities(
          keyword,
          contentQualityAnalysis,
          competitorAnalysis
        );
        
        // 保存分析结果
        result.contentAnalysis = {
          keyword,
          searchResults,
          qualityAnalysis: contentQualityAnalysis,
          competitorAnalysis,
          opportunities
        };
      }
      
      // 2. 如果启用了问题解决方案缺口分析且有验证过的问题，执行问题缺口分析
      if (this.enableProblemSolutionGapAnalysis && validatedProblems.length > 0) {
        result.problemGapAnalyses = await this.evaluateMultipleProblemSolutionGaps(validatedProblems);
      }
      
      // 3. 计算统计数据
      result.statistics = {
        analyzedContentCount: result.contentAnalysis.searchResults?.length || 0,
        analyzedProblemsCount: result.problemGapAnalyses.length || 0,
        averageContentQuality: result.contentAnalysis.qualityAnalysis?.averageScore || 0,
        averageGapSeverity: result.problemGapAnalyses.length > 0 
          ? result.problemGapAnalyses.reduce((sum: number, p: any) => sum + (p.gapSeverity || 0), 0) / 
            result.problemGapAnalyses.length
          : 0,
        highValueOpportunitiesCount: result.problemGapAnalyses.filter(
          (p: any) => (p.valueScore || 0) >= this.minGapSeverityScore
        ).length || 0
      };
      
      logger.info(`SolutionEvaluatorAgent completed for ${keyword}`);
      
      // 返回状态更新
      return {
        contentAnalysis: result
      };
    } catch (error: any) {
      logger.error('Error in SolutionEvaluatorAgent', { 
        error: error.message, 
        stack: error.stack
      });
      throw error;
    }
  }
} 