/**
 * SearchSuggestionTool - 搜索建议工具
 * 获取搜索引擎的自动补全建议
 */
import { Tool, ToolConfig, ToolInput, ToolResult } from '../Tool';
import { SearchEngine } from '../../search/engines/SearchEngine';
import { logger } from '../../core/logger';

interface SearchSuggestionConfig extends ToolConfig {
  searchEngine: SearchEngine;
}

export class SearchSuggestionTool extends Tool {
  private searchEngine: SearchEngine;
  
  constructor(config: SearchSuggestionConfig) {
    super({
      id: config.id,
      name: config.name || '搜索建议工具',
      description: config.description || '获取搜索引擎的自动补全建议',
      category: config.category || 'search',
      parameters: config.parameters || [
        {
          name: 'keyword',
          type: 'string',
          required: true,
          description: '关键词'
        }
      ]
    });
    
    this.searchEngine = config.searchEngine;
  }
  
  /**
   * 执行工具
   */
  public async execute(input: ToolInput): Promise<ToolResult> {
    try {
      // 验证输入
      this.validateInput(input);
      
      const keyword = input.keyword;
      logger.info(`获取关键词搜索建议: ${keyword}`);
      
      // 获取建议
      const suggestions = await this.searchEngine.getSuggestions(keyword);
      
      logger.info(`获取到 ${suggestions.length} 个搜索建议`);
      
      return {
        success: true,
        data: {
          keyword,
          suggestions
        }
      };
      
    } catch (error) {
      logger.error('搜索建议获取失败', { error });
      
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 