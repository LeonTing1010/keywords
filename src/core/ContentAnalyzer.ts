/**
 * ContentAnalyzer - 内容需求分析器
 * 分析搜索结果内容是否满足用户需求
 */
import { SearchEngine } from '../providers/SearchEngine';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { logger } from './logger';

export interface UnmetNeed {
  keyword: string;            // 关键词
  isUnmetNeed: boolean;       // 是否未满足
  contentQuality: number;     // 内容质量评分 (0-1)
  reason: string;             // 未满足原因
}

export interface ContentAnalyzerConfig {
  searchEngine: SearchEngine;
  llmService: LLMServiceHub;
  maxResultsToAnalyze?: number;
  verbose?: boolean;
}

/**
 * 内容分析器 - 分析关键词对应的搜索结果是否满足用户需求
 */
export class ContentAnalyzer {
  private searchEngine: SearchEngine;
  private llmService: LLMServiceHub;
  private maxResultsToAnalyze: number;
  private verbose: boolean;
  
  constructor(config: ContentAnalyzerConfig) {
    this.searchEngine = config.searchEngine;
    this.llmService = config.llmService;
    this.maxResultsToAnalyze = config.maxResultsToAnalyze || 3;
    this.verbose = config.verbose || false;
  }
  
  /**
   * 分析单个关键词是否是未满足需求
   * @param keyword 要分析的关键词
   * @returns 分析结果
   */
  async analyzeKeyword(keyword: string): Promise<UnmetNeed> {
    if (this.verbose) {
      logger.debug(`分析关键词需求满足度: ${keyword}`);
    }
    
    try {
      // 1. 获取搜索结果（通过获取自动补全建议来模拟搜索结果）
      const suggestions = await this.searchEngine.getSuggestions(keyword);
      
      // 从自动补全建议中提取相关信息，以模拟搜索结果
      const mockSearchResults = suggestions.map((suggestion, index) => ({
        title: suggestion.query,
        snippet: suggestion.query,
        url: `https://example.com/result${index + 1}`
      })).slice(0, this.maxResultsToAnalyze);
      
      // 2. 准备分析数据
      const promptData = {
        keyword,
        searchResults: mockSearchResults
      };
      
      // 3. 调用LLM分析内容质量与需求满足度
      const analysis = await this.llmService.analyze('unmet_needs_verification', promptData, {
        format: 'json',
        systemPrompt: `分析以下关键词的搜索结果，判断这个需求是否是互联网上尚未被充分满足的高价值需求。
评估标准:
1. 需求真实性 - 这是否是用户真实存在的需求？
2. 内容缺口 - 搜索结果是否有明显缺失或不满足用户搜索意图？
3. 市场价值 - 这个未满足需求是否具有商业价值或长尾价值？
4. 需求紧迫性 - 用户是否迫切需要解决方案？
5. 实现难度 - 满足这个需求的解决方案实现难度如何？

以JSON格式返回精简结果: {
  "isUnmetNeed": true/false,    // 是否未被满足的高价值需求
  "contentQuality": 0.7,        // 现有内容满足度评分 (0-1，越低表示缺口越大)
  "reason": "简明扼要解释为什么这是高价值未满足需求或为什么不是"
}`
      });
      
      // 4. 返回规范化的结果
      return {
        keyword,
        isUnmetNeed: analysis.isUnmetNeed === true,
        contentQuality: typeof analysis.contentQuality === 'number' ? analysis.contentQuality : 0.5,
        reason: analysis.reason || "未提供详细原因"
      };
    } catch (error) {
      logger.warn(`分析关键词"${keyword}"失败`, { error: (error as Error).message });
      
      // 发生错误时返回默认结果
      return {
        keyword,
        isUnmetNeed: false,
        contentQuality: 0.5,
        reason: "分析过程发生错误"
      };
    }
  }
  
  /**
   * 批量分析多个关键词
   * @param keywords 要分析的关键词列表
   * @param maxKeywords 最多分析多少个关键词（默认10个）
   * @returns 未满足需求的列表
   */
  async batchAnalyzeUnmetNeeds(keywords: string[], maxKeywords: number = 10): Promise<UnmetNeed[]> {
    // 去重并限制数量
    const uniqueKeywords = [...new Set(keywords)].slice(0, maxKeywords);
    
    logger.info('开始批量分析未满足需求', { keywordCount: uniqueKeywords.length });
    
    const results: UnmetNeed[] = [];
    
    // 每次处理一个关键词，避免并发请求过多
    for (const keyword of uniqueKeywords) {
      try {
        const result = await this.analyzeKeyword(keyword);
        
        // 只保留未满足的需求
        if (result.isUnmetNeed) {
          results.push(result);
        }
      } catch (error) {
        logger.error(`批量分析关键词"${keyword}"失败`, { error: (error as Error).message });
        // 出错时继续分析下一个关键词
        continue;
      }
    }
    
    // 按内容质量从低到高排序（质量越低越值得关注）
    results.sort((a, b) => a.contentQuality - b.contentQuality);
    
    logger.info('批量分析未满足需求完成', { 
      analyzed: uniqueKeywords.length,
      unmetFound: results.length 
    });
    
    return results;
  }
} 