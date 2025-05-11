/**
 * SearchResultsTool.ts - 搜索结果工具
 * 
 * 获取关键词的搜索结果，提供标题、摘要和URL
 */

import { BaseTool } from '../Tool';
import { ToolParams, ToolResult } from '../../types/schemas';
import { z } from 'zod';

// 搜索引擎接口（最小化依赖，只需提供搜索方法）
export interface SearchResultsEngine {
  getSearchResults(keyword: string, options?: { maxResults?: number }): Promise<Array<{
    title: string;
    snippet: string;
    url: string;
    [key: string]: any;
  }>>;
}

// 参数验证模式
const SearchResultsParamsSchema = z.object({
  keyword: z.string().max(38, '关键词必须限制在38个汉字以内').describe('要搜索的关键词'),
  maxResults: z.number().optional().default(10).describe('最大返回结果数量，默认为10')
});

type SearchResultsParams = z.infer<typeof SearchResultsParamsSchema>;

/**
 * 搜索结果工具
 * 
 * 获取关键词的搜索结果，包括标题、摘要和URL
 */
export class SearchResultsTool extends BaseTool {
  private engine: SearchResultsEngine;

  /**
   * 构造函数
   * 
   * @param engine 搜索引擎实例
   */
  constructor(engine: SearchResultsEngine) {
    super(
      'searchResults',
      '获取关键词的搜索结果，包括标题、摘要和URL',
      '使用方法: searchResults({ keyword: "关键词", maxResults: 10 })',
      {
        keyword: '要搜索的关键词，最多38个汉字',
        maxResults: '最大返回结果数量，默认为10'
      }
    );
    
    this.engine = engine;
  }

  /**
   * 执行工具逻辑
   * 
   * @param params 工具参数
   * @returns 工具执行结果
   */
  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    try {
      // 验证参数
      const validatedParams = SearchResultsParamsSchema.parse(params);
      const { keyword, maxResults } = validatedParams;

      // 获取搜索结果
      const results = await this.engine.getSearchResults(keyword, { maxResults });
      
      // 验证结果
      if (!Array.isArray(results)) {
        return this.createErrorResult('获取搜索结果失败：搜索引擎返回非数组结果');
      }
      
      // 处理结果数据，确保结构一致
      const processedResults = results.map(result => ({
        title: result.title || '',
        snippet: result.snippet || '',
        url: result.url || '',
        // 附加其他元数据
        metadata: Object.entries(result)
          .filter(([key]) => !['title', 'snippet', 'url'].includes(key))
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      }));

      return this.createSuccessResult(processedResults, {
        keyword,
        resultCount: processedResults.length,
        timestamp: Date.now()
      });
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error 
          ? `获取搜索结果失败: ${error.message}` 
          : '获取搜索结果失败: 未知错误'
      );
    }
  }
} 