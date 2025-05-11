/**
 * search/index.ts - 搜索工具模块索引
 * 
 * 导出所有搜索相关工具和接口
 */

// 导出工具类
export { SearchSuggestionsTool } from './SearchSuggestionsTool';
export { SearchResultsTool } from './SearchResultsTool';
export { WebpageContentTool } from './WebpageContentTool';
export { SearchToolFactory, type UnifiedSearchEngine } from './SearchToolFactory';

// 导出引擎接口
export type { 
  SearchSuggestionEngine 
} from './SearchSuggestionsTool';
export type { 
  SearchResultsEngine 
} from './SearchResultsTool';
export type { 
  WebpageContentEngine 
} from './WebpageContentTool'; 