/**
 * WebpageContentTool.ts - 网页内容获取工具
 * 
 * 通过URL获取网页的完整内容，支持内容处理和提取
 */

import { BaseTool } from '../Tool';
import { ToolParams, ToolResult } from '../../types/schemas';
import { z } from 'zod';

// 网页内容获取引擎接口
export interface WebpageContentEngine {
  getWebpageContent(url: string, options?: any): Promise<string>;
}

// 参数验证模式
const WebpageContentParamsSchema = z.object({
  url: z.string().url('必须提供有效的URL').describe('要获取内容的网页URL'),
  maxLength: z.number().optional().describe('返回内容的最大长度限制'),
  options: z.object({
    proxyServer: z.string().optional().describe('代理服务器地址'),
    timeout: z.number().optional().describe('请求超时时间（毫秒）'),
    userAgent: z.string().optional().describe('自定义User-Agent'),
    extractText: z.boolean().optional().describe('是否仅提取文本内容')
  }).optional().describe('额外选项')
});

type WebpageContentParams = z.infer<typeof WebpageContentParamsSchema>;

/**
 * 网页内容获取工具
 * 
 * 通过URL获取网页的完整内容
 */
export class WebpageContentTool extends BaseTool {
  private engine: WebpageContentEngine;

  /**
   * 构造函数
   * 
   * @param engine 网页内容获取引擎实例
   */
  constructor(engine: WebpageContentEngine) {
    super(
      'webpageContent',
      '获取指定URL的网页完整内容',
      '使用方法: webpageContent({ url: "https://example.com", maxLength: 10000, options: { ... } })',
      {
        url: '要获取内容的网页URL',
        maxLength: '返回内容的最大长度限制（可选）',
        options: '额外选项（可选）：proxyServer, timeout, userAgent, extractText'
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
      const validatedParams = WebpageContentParamsSchema.parse(params);
      const { url, maxLength, options } = validatedParams;

      // 获取网页内容
      const content = await this.engine.getWebpageContent(url, options);
      
      // 处理内容长度
      const contentLength = content.length;
      let processedContent = content;
      let isTruncated = false;
      
      if (maxLength && contentLength > maxLength) {
        processedContent = content.substring(0, maxLength);
        isTruncated = true;
      }
      
      // 构建结果
      const result = {
        url,
        contentLength,
        content: processedContent,
        isTruncated,
        truncatedAt: isTruncated ? maxLength : undefined
      };

      return this.createSuccessResult(result, {
        url,
        contentLength,
        isTruncated,
        timestamp: Date.now()
      });
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error 
          ? `获取网页内容失败: ${error.message}` 
          : '获取网页内容失败: 未知错误'
      );
    }
  }
} 