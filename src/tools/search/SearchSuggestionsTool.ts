/**
 * SearchSuggestionsTool.ts - 搜索自动补全工具
 * 
 * 通过搜索引擎自动补全获取关键词建议，支持多种搜索引擎
 */

import { BaseTool } from '../Tool';
import { ToolParams, ToolResult } from '../../types/schemas';
import { z } from 'zod';

// 搜索引擎接口（最小化依赖，只需提供搜索方法）
export interface SearchSuggestionEngine {
  getSuggestions(keyword: string, options?: any): Promise<Array<{
    query: string;
    [key: string]: any;
  }>>;
}

// 参数验证模式
const SearchSuggestionsParamsSchema = z.object({
  keyword: z.string().max(38, '关键词必须限制在38个汉字以内').describe('要查询的关键词'),
  maxResults: z.number().optional().default(30).describe('最大返回结果数量，默认为30')
});

type SearchSuggestionsParams = z.infer<typeof SearchSuggestionsParamsSchema>;

/**
 * 搜索自动补全工具
 * 
 * 获取关键词的自动补全建议，帮助扩展关键词范围
 */
export class SearchSuggestionsTool extends BaseTool {
  private engine: SearchSuggestionEngine;

  /**
   * 构造函数
   * 
   * @param engine 搜索引擎实例
   */
  constructor(engine: SearchSuggestionEngine) {
    super(
      'searchSuggestions',
      '通过搜索引擎自动补全发现更多相关关键词',
      '使用方法: searchSuggestions({ keyword: "关键词", maxResults: 30 })',
      {
        keyword: '要查询的关键词，最多38个汉字',
        maxResults: '最大返回结果数量，默认为30'
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
      const validatedParams = SearchSuggestionsParamsSchema.parse(params);
      const { keyword, maxResults } = validatedParams;

      // 获取自动补全建议
      const suggestions = await this.engine.getSuggestions(keyword);
      
      // 处理建议结果
      if (!Array.isArray(suggestions)) {
        return this.createErrorResult('获取自动补全建议失败：搜索引擎返回非数组结果');
      }
      
      // 提取并处理查询字符串
      const allSuggestions = suggestions
        .map(s => (s && typeof s.query === 'string' ? s.query : undefined))
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
      
      // 去重和过滤
      const uniqueSuggestions = [...new Set(allSuggestions)]
        .filter(s => s.toLowerCase().includes(keyword.toLowerCase()))
        .slice(0, maxResults);

      return this.createSuccessResult(uniqueSuggestions, {
        originalKeyword: keyword,
        suggestionCount: uniqueSuggestions.length,
        timestamp: Date.now()
      });
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error 
          ? `获取自动补全建议失败: ${error.message}` 
          : '获取自动补全建议失败: 未知错误'
      );
    }
  }
} 