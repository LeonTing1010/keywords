/**
 * 分析器接口
 */
export interface Analyzer {
  /**
   * 执行分析
   */
  analyze(keyword: string, options?: AnalyzerOptions): Promise<AnalysisResult>;
}

/**
 * 分析器选项
 */
export interface AnalyzerOptions {
  /** 搜索引擎类型 */
  searchEngine?: string;
  /** 代理服务器 */
  proxyServer?: string;
  /** 是否使用系统浏览器 */
  useSystemBrowser?: boolean;
  /** 最大结果数 */
  maxResults?: number;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 是否详细日志 */
  verbose?: boolean;
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  /** 关键词 */
  keyword: string;
  /** 发现的关键词 */
  discoveredKeywords: string[];
  /** 未满足需求 */
  unmetNeeds: UnmetNeed[];
  /** 分析结果 */
  analysis: {
    /** 关键词分类 */
    categories: Record<string, string[]>;
    /** 发现的模式 */
    patterns: string[];
    /** 洞察 */
    insights: string[];
  };
} 