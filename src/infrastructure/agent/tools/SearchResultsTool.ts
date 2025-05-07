/**
 * SearchResultsTool - 搜索结果工具
 * 获取搜索引擎的搜索结果
 */
import { Tool, ToolConfig, ToolInput, ToolResult } from '../Tool';
import { SearchEngine } from '../../search/engines/SearchEngine';
import { logger } from '../../core/logger';

interface SearchResultsConfig extends ToolConfig {
  searchEngine: SearchEngine;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class SearchResultsTool extends Tool {
  private searchEngine: SearchEngine;
  
  constructor(config: SearchResultsConfig) {
    super({
      id: config.id,
      name: config.name || '搜索结果工具',
      description: config.description || '获取搜索引擎的搜索结果',
      category: config.category || 'search',
      parameters: config.parameters || [
        {
          name: 'keyword',
          type: 'string',
          required: true,
          description: '关键词'
        },
        {
          name: 'maxResults',
          type: 'number',
          required: false,
          description: '最大结果数',
          defaultValue: 10
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
      const maxResults = input.maxResults || 10;
      
      logger.info(`获取关键词搜索结果: ${keyword}`, { maxResults });
      
      // 获取搜索结果
      const results = await this.searchEngine.getSearchResults(keyword, { maxResults });
      
      logger.info(`获取到 ${results.length} 个搜索结果`);
      
      return {
        success: true,
        data: {
          keyword,
          results
        }
      };
      
    } catch (error) {
      logger.error('搜索结果获取失败', { error });
      
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 