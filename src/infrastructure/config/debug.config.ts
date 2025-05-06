/**
 * 调试配置文件
 * 集中管理调试相关的配置
 */

/**
 * 调试配置接口
 */
export interface DebugConfig {
  /** 是否启用调试模式 */
  enabled: boolean;
  /** 是否显示浏览器 */
  showBrowser: boolean;
  /** 是否测量性能 */
  measurePerformance: boolean;
  /** 是否记录网络请求 */
  logNetworkRequests: boolean;
  /** 是否截图调试 */
  takeScreenshots: boolean;
  /** 截图保存路径 */
  screenshotPath: string;
  /** 是否保存HTML源码 */
  saveHtmlSource: boolean;
  /** HTML源码保存路径 */
  htmlSourcePath: string;
  /** 调试使用的关键词 */
  testKeywords: string[];
}

/**
 * 默认调试配置
 */
export const debugConfig: DebugConfig = {
  enabled: process.env.DEBUG === 'true',
  showBrowser: process.env.DEBUG_SHOW_BROWSER !== 'false',
  measurePerformance: true,
  logNetworkRequests: process.env.DEBUG_LOG_NETWORK === 'true',
  takeScreenshots: process.env.DEBUG_SCREENSHOTS === 'true',
  screenshotPath: './output/debug/screenshots',
  saveHtmlSource: process.env.DEBUG_SAVE_HTML === 'true',
  htmlSourcePath: './output/debug/html',
  testKeywords: [
    'machine learning',
    'artificial intelligence',
    'data science',
    'javascript',
    'react js',
    'node.js',
    'python programming'
  ]
};

/**
 * 用于在日志中记录性能信息的工具函数
 */
export async function measurePerformance<T>(name: string, callback: () => Promise<T>): Promise<T> {
  if (!debugConfig.enabled || !debugConfig.measurePerformance) {
    return callback();
  }
  
  const start = performance.now();
  try {
    const result = await callback();
    const end = performance.now();
    console.debug(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    console.debug(`[Performance Error] ${name}: ${(end - start).toFixed(2)}ms`);
    throw error;
  }
} 