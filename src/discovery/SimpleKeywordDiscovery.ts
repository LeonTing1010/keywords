/**
 * SimpleKeywordDiscovery - 简单关键词挖掘器
 * 通过关键词+26个字母获取所有自动补全词，简化挖掘流程
 */
import { SearchEngine } from '../providers/SearchEngine';
import { AutocompleteSuggestion } from '../types';

// 发现结果接口
export interface DiscoveryResult {
  keyword: string;
  iterations: {
    query: string;
    discoveries: string[];
  }[];
  allKeywords: string[];
  summary: {
    totalKeywords: number;
    uniqueKeywords: number;
  };
}

/**
 * SimpleKeywordDiscovery是一个简化版的关键词挖掘器
 * 通过关键词+字母/数字组合获取搜索引擎自动补全词
 */
export class SimpleKeywordDiscovery {
  private searchEngine: SearchEngine;
  private verbose: boolean;
  private discoveredKeywords: Set<string> = new Set();
  
  constructor({
    searchEngine,
    verbose = false
  }: {
    searchEngine: SearchEngine;
    verbose?: boolean;
  }) {
    this.searchEngine = searchEngine;
    this.verbose = verbose;
    
    if (this.verbose) {
      console.info(`[SimpleKeywordDiscovery] 初始化完成`);
    }
  }
  
  /**
   * 发现关键词
   * 通过关键词+字母组合获取所有自动补全词
   */
  async discover(keyword: string): Promise<DiscoveryResult> {
    // 重置状态
    this.discoveredKeywords = new Set();
    const iterations: {query: string; discoveries: string[]}[] = [];
    
    if (this.verbose) {
      console.info(`[SimpleKeywordDiscovery] 开始发现过程，基础关键词: "${keyword}"`);
    }
    
    // 执行初始查询
    const initialSuggestions = await this.performQuery(keyword);
    iterations.push({
      query: keyword,
      discoveries: initialSuggestions
    });
    
    // 生成包含字母后缀的查询
    const alphabetSuffixes = 'abcdefghijklmnopqrstuvwxyz'.split('');
    
    // 为每个字母执行查询
    for (const suffix of alphabetSuffixes) {
      const query = `${keyword} ${suffix}`;
      const suggestions = await this.performQuery(query);
      
      if (suggestions.length > 0) {
        iterations.push({
          query,
          discoveries: suggestions
        });
      }
    }
    
    // 构建结果
    const result: DiscoveryResult = {
      keyword,
      iterations: iterations,
      allKeywords: Array.from(this.discoveredKeywords),
      summary: {
        totalKeywords: this.discoveredKeywords.size,
        uniqueKeywords: this.discoveredKeywords.size
      }
    };
    
    if (this.verbose) {
      console.info(`[SimpleKeywordDiscovery] 发现过程完成，共 ${result.allKeywords.length} 个关键词`);
    }
    
    return result;
  }
  
  /**
   * 执行查询
   */
  private async performQuery(query: string): Promise<string[]> {
    if (this.verbose) {
      console.info(`[SimpleKeywordDiscovery] 执行查询: "${query}"`);
    }
    
    try {
      // 获取搜索建议
      const suggestionsResponse = await this.searchEngine.getSuggestions(query);
      
      // 将响应转换为字符串数组
      const suggestions = this.extractSuggestionsAsStrings(suggestionsResponse);
      
      // 添加到已发现关键词集合
      suggestions.forEach(kw => this.discoveredKeywords.add(kw));
      
      if (this.verbose) {
        console.info(`[SimpleKeywordDiscovery] 查询 "${query}" 发现 ${suggestions.length} 个关键词`);
      }
      
      return suggestions;
    } catch (error) {
      console.error(`[SimpleKeywordDiscovery] 查询失败: ${error}`);
      return [];
    }
  }
  
  /**
   * 从搜索引擎响应中提取字符串格式的建议
   */
  private extractSuggestionsAsStrings(suggestionsResponse: AutocompleteSuggestion[]): string[] {
    if (Array.isArray(suggestionsResponse)) {
      return suggestionsResponse.map(s => s.query);
    }
    return [];
  }
} 