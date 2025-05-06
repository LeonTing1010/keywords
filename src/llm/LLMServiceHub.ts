/**
 * LLMServiceHub - 大语言模型服务中心
 * 统一管理与大语言模型的交互，提供标准化的接口
 */
import * as crypto from 'crypto';
import { logger } from '../core/logger';

// LLM消息接口
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

// LLM选项接口
export interface LLMOptions {
  temperature?: number; // 温度参数 0-1
  topP?: number; // 取样温度
  maxTokens?: number; // 最大生成token数
  presencePenalty?: number; // 重复惩罚系数
  frequencyPenalty?: number; // 频率惩罚系数
  stop?: string[]; // 停止词
  systemPrompt?: string; // 系统提示词
  format?: 'json' | 'text'; // 期望的输出格式
  language?: 'zh' | 'en'; // 期望的输出语言
}

// LLM提供者接口
export interface LLMProvider {
  call(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  getName(): string;
}

/**
 * LLM服务中心，提供统一的大语言模型访问接口
 */
export class LLMServiceHub {
  private defaultModel: string;
  private apiKey: string;
  private baseUrl: string;
  private verbose: boolean;
  
  /**
   * 创建LLM服务中心实例
   * @param options 配置选项
   */
  constructor(options: {
    model?: string;
    apiKey?: string;
    verbose?: boolean;
  } = {}) {
    this.defaultModel = options.model || process.env.LLM_MODEL || 'gpt-4';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    
    // 根据模型类型自动选择适当的基础URL
    if (process.env.LLM_BASE_URL) {
      this.baseUrl = process.env.LLM_BASE_URL;
    } else if (this.defaultModel.startsWith('anthropic/') || this.defaultModel.startsWith('claude')) {
      this.baseUrl = 'https://api.anthropic.com/v1';
    } else if (this.defaultModel.startsWith('qwen')) {
      this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    } else {
      // 默认使用OpenAI
      this.baseUrl = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    }
    
    this.verbose = options.verbose || false;
    
    if (!this.apiKey) {
      logger.warn('未设置API密钥，请设置OPENAI_API_KEY环境变量');
    }
    
    logger.info('LLM服务中心初始化完成', { model: this.defaultModel, baseUrl: this.baseUrl });
  }
  
  /**
   * 分析内容
   * @param type 分析类型
   * @param data 要分析的数据
   * @param options 分析选项
   * @returns 分析结果
   */
  async analyze(type: string, data: any, options: LLMOptions = {}): Promise<any> {
    try {
      // 根据分析类型决定是否需要JSON输出
      const requireJson = options.format === 'json' || 
                         (options.format === undefined && (
                           type.includes('evaluation') ||
                           type.includes('categorize') ||
                           type.includes('plan') ||
                           type.includes('recommendations')
                         ));
      
      // 根据分析类型调整温度
      const defaultTemp = type.includes('creative') ? 0.8 : 
                         type.includes('generation') ? 0.7 :
                         type.includes('evaluation') ? 0.3 : 0.5;
      
      const temperature = options.temperature !== undefined ? options.temperature : defaultTemp;
      
      // 构建消息
      const messages: LLMMessage[] = [];
      
      // 添加系统消息
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      } else {
        messages.push({ 
          role: 'system', 
          content: `You are an AI assistant specializing in ${type} analysis. Provide accurate and helpful insights.` 
        });
      }
      
      // 添加用户消息
      const userContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      messages.push({ role: 'user', content: userContent });
      
      // 调用模型
      logger.debug('开始LLM分析', { type, messageCount: messages.length });
      
      // 打印大模型输入prompt，增加source字段
      logger.info('LLM调用输入', { model: this.defaultModel, source: type, messages });
      // 执行API调用
      const response = await this.callModel(
        type,
        messages,
        this.defaultModel,
        temperature,
        requireJson
      );
      
      // 处理JSON响应
      if (requireJson) {
        try {
          const jsonResponse = JSON.parse(response);
          logger.debug('LLM分析完成', { type, format: 'json' });
          return jsonResponse;
        } catch (e) {
          // 尝试清理JSON字符串
          const cleanedJson = this.cleanJsonString(response);
          if (cleanedJson) {
            logger.debug('LLM分析完成 (修复JSON)', { type, format: 'json' });
            return JSON.parse(cleanedJson);
          }
          
          logger.warn('LLM返回的JSON格式无效', { 
            error: (e as Error).message,
            response: response.substring(0, 100) + '...' 
          });
          
          // 如果无法解析为JSON，直接返回原文本
          return response;
        }
      }
      
      logger.debug('LLM分析完成', { type, format: 'text' });
      return response;
    } catch (error) {
      logger.error('LLM分析失败', { type, error });
      throw error;
    }
  }
  
  /**
   * 调用LLM模型
   * @param type 分析类型
   * @param messages 消息列表
   * @param model 模型名称
   * @param temperature 温度参数
   * @param requireJson 是否需要JSON输出
   * @returns 模型响应文本
   */
  private async callModel(
    type: string,
    messages: LLMMessage[],
    model: string = this.defaultModel,
    temperature: number = 0.5,
    requireJson: boolean = false
  ): Promise<string> {
    try {
      logger.debug('调用LLM模型', { model, temperature, messageCount: messages.length });
      
      // 为需要JSON输出的请求添加指导
      if (requireJson) {
        // 修改系统消息以指定JSON输出
        const systemMessageIndex = messages.findIndex(m => m.role === 'system');
        if (systemMessageIndex !== -1) {
          messages[systemMessageIndex].content += '\nYou should provide your response in valid JSON format.';
        } else {
          // 如果没有系统消息，添加一个
          messages.unshift({
            role: 'system',
            content: 'You should provide your response in valid JSON format.'
          });
        }
      }
      
      // 记录请求开始
      const requestId = crypto.randomUUID().slice(0, 8);
      const startTime = Date.now();
      
      // 根据模型类型选择不同的API请求格式和认证方式
      let requestOptions: RequestInit;
      let apiUrl: string;
      
      // 检查是否为Qwen/阿里云模型
      if (model.startsWith('qwen')) {
        // 使用DashScope API密钥和特定请求格式
        const dashscopeApiKey = process.env.DASHSCOPE_API_KEY || this.apiKey;
        
        if (!dashscopeApiKey) {
          throw new Error('未设置阿里云DashScope API密钥，请设置DASHSCOPE_API_KEY环境变量');
        }
        
        requestOptions = {
          method: 'POST',
          headers: {
      'Content-Type': 'application/json',
            'Authorization': `Bearer ${dashscopeApiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
      temperature,
            max_tokens: 4096,
            top_p: 1
          })
        };
        
        apiUrl = `${this.baseUrl}/chat/completions`;
        logger.debug(`API请求开始 [${requestId}]`, { 
          url: apiUrl,
          model,
          apiType: 'dashscope'
        });
      } else if (model.startsWith('claude') || model.startsWith('anthropic/')) {
        // Anthropic Claude模型处理
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY || this.apiKey;
        
        if (!anthropicApiKey) {
          throw new Error('未设置Anthropic API密钥，请设置ANTHROPIC_API_KEY环境变量');
        }
        
        // 转换消息格式为Anthropic要求的格式
        let systemPrompt = '';
        let userMessages: any[] = [];
        
        messages.forEach(msg => {
          if (msg.role === 'system') {
            systemPrompt += msg.content + '\n';
          } else {
            userMessages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
        
        // 如果有系统提示，将其添加到第一个用户消息
        if (systemPrompt && userMessages.length > 0 && userMessages[0].role === 'user') {
          userMessages[0].content = systemPrompt + '\n\n' + userMessages[0].content;
        }
        
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model.replace('anthropic/', ''),
            messages: userMessages,
            temperature,
            max_tokens: 4096
          })
        };
        
        apiUrl = `${this.baseUrl}/messages`;
        logger.debug(`API请求开始 [${requestId}]`, { 
          url: apiUrl,
          model,
          apiType: 'anthropic'
        });
      } else {
        // 默认使用OpenAI API格式
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: 4096,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
          })
        };
        
        apiUrl = `${this.baseUrl}/chat/completions`;
        logger.debug(`API请求开始 [${requestId}]`, { 
          url: apiUrl,
          model,
          apiType: 'openai'
        });
      }
      
      // 打印大模型输入prompt，增加source字段
      logger.info('LLM调用输入', { model, source: type, messages });
      // 执行请求
      const response = await fetch(apiUrl, requestOptions);
      
      // 计算请求时间
      const endTime = Date.now();
      const requestTime = endTime - startTime;
      
      // 详细记录API响应
      if (!response.ok) {
        // 获取完整的错误响应
        let errorDetail;
        try {
          errorDetail = await response.json();
        } catch (parseError) {
          // 如果无法解析为JSON，获取文本
          try {
            errorDetail = await response.text();
          } catch (textError) {
            errorDetail = '无法获取响应内容';
          }
        }
        
        // 详细记录API错误
        logger.error('LLM API调用失败', { 
          requestId,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()]),
          errorType: errorDetail.error?.type || '未知',
          errorCode: errorDetail.error?.code || '未知',
          errorMessage: errorDetail.error?.message || '未知错误',
          requestTime: `${requestTime}ms`,
          rawError: errorDetail
        });
        
        throw new Error(`API调用失败 [${requestId}]: HTTP ${response.status} - ${errorDetail.error?.message || response.statusText || '未知错误'}`);
      }
      
      // 处理成功响应
      const responseText = await response.text();
      let result: any;
      
      try {
        result = JSON.parse(responseText);
      } catch (e: any) {
        logger.warn('API响应不是有效的JSON格式', { responseText: responseText.substring(0, 100) + '...' });
        throw new Error(`API响应解析失败: ${e.message}`);
      }
      
      // 根据不同API提取内容
      let content = '';
      
      if (model.startsWith('qwen')) {
        // DashScope/Qwen响应格式
        content = result.output?.text || result.choices?.[0]?.message?.content || '';
      } else if (model.startsWith('claude') || model.startsWith('anthropic/')) {
        // Anthropic响应格式
        content = result.content?.[0]?.text || '';
      } else {
        // OpenAI响应格式
        content = result.choices?.[0]?.message?.content || '';
      }
      
      // 打印大模型输出内容，增加source字段
      logger.info('LLM调用输出', { model, source: type, output: content });
      
      logger.debug(`LLM API调用成功 [${requestId}]`, { 
        model,
        requestTime: `${requestTime}ms`,
        tokensUsed: result.usage?.total_tokens || 'unknown',
        promptTokens: result.usage?.prompt_tokens || 'unknown',
        completionTokens: result.usage?.completion_tokens || 'unknown'
      });
      
      return content;
    } catch (error: any) {
      // 捕获和记录网络错误
      if (error.name === 'TypeError' && error.message === 'fetch failed') {
        // 网络连接错误
        const cause = error.cause || {};
        logger.error('LLM API网络连接错误', {
          errorName: error.name,
          errorMessage: error.message,
          errorCode: cause.code || '未知',
          errorCause: cause.message || '未知',
          errorStack: error.stack
        });
      } else {
        // 其他错误
        logger.error('LLM调用出错', { 
          errorType: error.name || '未知类型',
          errorMessage: error.message || '未知错误',
          errorStack: error.stack
        });
      }
      throw error;
    }
  }
  
  /**
   * 清理JSON字符串，修复常见格式问题
   * @param input 输入的JSON字符串
   * @returns 清理后的JSON字符串，或null
   */
  private cleanJsonString(input: string): string | null {
    try {
      logger.debug('清理JSON字符串', {
        inputLength: input.length,
        inputPreview: input.substring(0, 100) + (input.length > 100 ? '...' : '')
      });
      
      // 移除可能的markdown代码块标记 - 先检测是否存在
      const hasJsonBlock = input.includes('```json') || input.includes('```');
      if (hasJsonBlock) {
        logger.debug('检测到Markdown代码块，尝试清理');
      }

      // 更彻底的代码块处理
      let cleaned = input;
      
      // 处理包含```json的情况
      if (cleaned.includes('```json')) {
        // 尝试提取代码块内容
        const blockStart = cleaned.indexOf('```json') + 7;
        const blockEnd = cleaned.lastIndexOf('```');
        
        if (blockEnd > blockStart) {
          cleaned = cleaned.substring(blockStart, blockEnd).trim();
          logger.debug('从```json代码块中提取内容');
        }
      } 
      // 处理普通```代码块
      else if (cleaned.includes('```')) {
        const blocks = cleaned.split('```');
        // 通常，代码块内容在奇数索引位置 (1, 3, 5...)
        for (let i = 1; i < blocks.length; i += 2) {
          if (blocks[i].trim().startsWith('{') && blocks[i].trim().endsWith('}')) {
            cleaned = blocks[i].trim();
            logger.debug('从```代码块中提取内容');
            break;
          }
        }
      }
      
      // 确保只保留一个完整的JSON对象
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        logger.debug('提取JSON对象边界', { 
          startPos: firstBrace,
          endPos: lastBrace,
          extractedLength: cleaned.length 
        });
      } else {
        logger.warn('无法在字符串中找到完整的JSON对象边界');
        return null;
      }
      
      // 修复常见的JSON格式错误
      cleaned = cleaned
        // 修复没有引号的键
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
        // 修复单引号
        .replace(/'/g, '"')
        // 修复尾随逗号
        .replace(/,(\s*[}\]])/g, '$1')
        // 移除注释
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      
      // 验证是否可以解析
      cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      const parsed = JSON.parse(cleaned);
      logger.debug('JSON清理成功', { 
        cleanedLength: cleaned.length,
        objectKeys: Object.keys(parsed).length
      });
      return cleaned;
    } catch (e: any) {
      logger.warn('JSON清理失败', { 
        error: e.message,
        stack: e.stack
      });
      return null;
    }
  }
} 