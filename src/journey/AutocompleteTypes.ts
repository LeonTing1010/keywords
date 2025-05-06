/**
 * AutocompleteTypes - 自动补全相关类型定义
 */

/**
 * 自动补全建议接口
 * 定义搜索引擎返回的自动补全建议结构
 */
export interface AutocompleteSuggestion {
  query: string;      // 补全查询词
  position: number;   // 在建议列表中的位置
  source: string;     // 来源搜索引擎
  timestamp: number;  // 获取时间
} 