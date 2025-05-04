/**
 * 类型定义索引文件
 * 导出所有类型定义，方便其他模块引用
 */

// 重新导出搜索引擎相关类型
export * from './searchEngineTypes';
export * from './llmTypes';

// 其他类型定义

/**
 * Google Trends结果
 */
export interface TrendsResult {
  keyword: string;
  csvPath: string;
}

/**
 * SEMrush关键词数据
 */
export interface SemrushData {
  keyword: string;
  volume: string;
}

/**
 * SimilarWeb流量数据
 */
export interface SimilarWebData {
  domain: string;
  monthlyTraffic: string;
}

/**
 * 需要认证的服务的凭证
 */
export interface Credentials {
  email: string;
  password: string;
}