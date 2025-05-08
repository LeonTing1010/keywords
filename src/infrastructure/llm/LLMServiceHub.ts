/**
 * LLMServiceHub - 大语言模型服务中心
 * 统一管理与大语言模型的交互，提供标准化的接口
 */
import * as crypto from 'crypto';
import { logger } from '../core/logger';
import { JsonEnforcedLLMProvider } from './JsonEnforcedLLMProvider';

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
  format?: 'json' | 'text' | 'markdown'; // 期望的输出格式
  language?: 'zh' | 'en'; // 期望的输出语言
  model?: string;
  strictFormat?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  [key: string]: any; // 允许其他属性
}

// LLM提供者接口
export interface LLMProvider {
  call(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  getName(): string;
}

interface LLMConfig {
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
}

export interface AnalyzeOptions {
  maxRetries?: number;
  retryDelay?: number;
  systemPrompt?: string;
  format?: 'json' | 'text' | 'markdown';
  temperature?: number;
  maxTokens?: number;
  strictFormat?: boolean; // 添加严格格式选项
}

export interface LLMServiceConfig {
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  mockMode?: boolean;
  apiEndpoint?: string;
  mockResponses?: Record<string, any>; // Add mock responses property
}

/**
 * LLM服务中心，提供统一的大语言模型访问接口
 */
export class LLMServiceHub {
  private model: string;
  private apiKey: string = '';
  private apiEndpoint: string = 'https://api.openai.com/v1';
  private verbose: boolean = false;
  private defaultOptions: LLMOptions = {
    temperature: 0.7,
    maxTokens: 4000
  };
  private temperature: number = 0.7;
  private maxTokens: number = 4000;
  private mockMode: boolean = false;
  private mockResponses: Record<string, any> = {}; // Add mockResponses property
  
  /**
   * 创建LLM服务中心实例
   * @param config 配置选项
   */
  constructor(config: LLMServiceConfig = {}) {
    // Configure the model and settings
    this.model = config.model || process.env.LLM_MODEL || 'gpt-4';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4000;
    this.mockMode = config.mockMode || (process.env.MOCK_LLM === 'true');
    this.mockResponses = config.mockResponses || {}; // Initialize mockResponses
    
    // 根据模型类型选择API密钥
    let apiKey = config.apiKey;
    
    if (!apiKey) {
        apiKey = process.env.OPENAI_API_KEY;
    }
    
    // Don't require API key in mock mode
    if (!apiKey && !this.mockMode) {
      throw new Error(`LLM API key is required for model ${this.model}`);
    }
    
    // Set up API client if not in mock mode
    if (!this.mockMode) {
      this.apiKey = apiKey || '';
      
      // 根据模型类型选择API端点
      if (config.apiEndpoint) {
        this.apiEndpoint = config.apiEndpoint;
      } else if (this.model === 'qwen-plus' || this.model.includes('qwen') || this.model.includes('dashscope')) {
        // 通义千问API
        this.apiEndpoint = process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/v1';
      } else if (this.model.includes('claude')) {
        // Claude API
        this.apiEndpoint = process.env.LLM_BASE_URL || process.env.LLM_API_ENDPOINT || 'https://api.anthropic.com/v1';
      } else {
        // OpenAI API
        this.apiEndpoint = process.env.LLM_BASE_URL || process.env.LLM_API_ENDPOINT || 'https://api.openai.com/v1';
      }
      
      // 确保API端点包含正确的路径
      if (this.model.includes('claude')) {
        // Claude API使用/messages端点
        if (!this.apiEndpoint.endsWith('/messages')) {
          this.apiEndpoint = this.apiEndpoint + (this.apiEndpoint.endsWith('/v1') ? '/messages' : '/v1/messages');
        }
      } else {
        // OpenAI和Qwen使用/chat/completions端点
        if (!this.apiEndpoint.includes('/chat/completions')) {
          this.apiEndpoint = this.apiEndpoint + (this.apiEndpoint.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions');
        }
      }
      
      logger.info('LLM服务中心初始化完成', { 
        model: this.model,
        endpoint: this.apiEndpoint
      });
    }
  }
  
  /**
   * 分析文本内容
   */
  public async analyze(prompt: string, analysisType: string, options: AnalyzeOptions = {}): Promise<any> {
    try {
      // In mock mode, return mock data for testing
      if (this.mockMode) {
        logger.info('Using mock mode for LLM');
        return this.getMockResponse(prompt);
      }
      
      // 如果请求的是JSON格式，默认启用严格模式
      if (options.format === 'json' && options.strictFormat === undefined) {
        options.strictFormat = true;
      }
      
      logger.info('开始LLM分析', { task: analysisType, model: this.model });
      logger.debug('分析提示词', { prompt });
      
      // 生成请求ID便于跟踪
      const requestId = crypto.randomBytes(8).toString('hex');
      
      logger.debug(`准备调用LLM API [${requestId}]`);
      
      // 准备请求配置
      const temperature = options.temperature || this.temperature;
      const model = this.model;
      let response;

      // 重试配置
      const maxRetries = options.maxRetries || 3;
      const retryDelay = options.retryDelay || 1000; // 默认1秒
      let retryCount = 0;
      let lastError: any;

      while (retryCount < maxRetries) {
        try {
          // 根据模型类型选择合适的API调用方法
          if (model.includes('claude')) {
            // 使用Anthropic Claude API
            logger.debug(`使用Claude API调用 [${this.apiEndpoint}]`, { model, attempt: retryCount + 1 });
            response = await this.callClaudeAPI(prompt, temperature, options);
          } else if (model.includes('qwen') || model === 'qwen-plus' || model.includes('dashscope')) {
            // 使用通义千问API
            logger.debug(`使用通义千问API调用 [${this.apiEndpoint}]`, { model, attempt: retryCount + 1 });
            response = await this.callQwenAPI(prompt, temperature, options);
          } else {
            // 默认使用OpenAI API
            logger.debug(`使用OpenAI API调用 [${this.apiEndpoint}]`, { model, attempt: retryCount + 1 });
            response = await this.callOpenAIAPI(prompt, temperature, options);
          }

          logger.info('LLM调用输出', { 
            model, 
            source: analysisType, 
            output: JSON.stringify(response).substring(0, 200) + (JSON.stringify(response).length > 200 ? '...' : '') 
          });
          
          logger.debug(`LLM API调用成功 [${requestId}]`, {});

          try {
            // 解析响应格式
            const parsedResponse = this.parseResponse(response, options.format || 'json');
            
            // 检查JSON解析结果
            if (options.format === 'json' && options.strictFormat === true) {
              // 检查是否返回了raw字段，这意味着JSON解析失败
              if (parsedResponse.raw && typeof parsedResponse.raw === 'string') {
                throw new Error('JSON格式验证失败');
              }
            }
            
            return parsedResponse;
          } catch (formatError: any) {
            // 如果是格式错误且需要严格格式，我们应该重试
            if (options.format === 'json' && (options.strictFormat === true || formatError.message === 'JSON格式验证失败')) {
              logger.warn('LLM返回格式错误，将进行重试', { 
                error: formatError.message,
                format: options.format,
                modelType: model
              });
              throw formatError; // 抛出错误，触发重试逻辑
            } else {
              // 其他情况正常返回解析结果
              return this.parseResponse(response, options.format || 'json');
            }
          }
        } catch (error: any) {
          lastError = error;
          retryCount++;
          
          // 检查是否应该重试
          const shouldRetry = this.shouldRetry(error) || 
            // 添加对格式错误的重试支持
            (options.format === 'json' && options.strictFormat === true && 
            (error.message === 'JSON格式验证失败' || (typeof error.message === 'string' && error.message.includes('JSON'))));
          
          if (retryCount < maxRetries && shouldRetry) {
            const delay = retryDelay * Math.pow(2, retryCount - 1); // 指数退避
            logger.warn(`API调用失败，准备第${retryCount}次重试`, { 
              error: error.message,
              delay,
              model,
              endpoint: this.apiEndpoint
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // 如果不需要重试或已达到最大重试次数
          logger.error('API调用失败', { 
            error, 
            model, 
            endpoint: this.apiEndpoint,
            retryCount,
            shouldRetry
          });
          
          // 返回一个基本的响应，避免完全失败
          return { 
            error: '模型API调用失败', 
            message: error.message,
            modelType: model,
            endpoint: this.apiEndpoint,
            retryCount
          };
        }
      }
      
      // 如果所有重试都失败了
      throw lastError;
    } catch (error) {
      logger.error('LLM分析失败', { error, task: analysisType });
      throw error;
    }
  }

  /**
   * 判断是否应该重试请求
   * @param error API调用错误
   * @returns 是否应该重试
   */
  private shouldRetry(error: any): boolean {
    // 网络错误
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return true;
    }
    
    // API限流错误
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }
    
    // 服务器错误
    if (error.status >= 500 || error.statusCode >= 500) {
      return true;
    }
    
    // OpenAI API特定错误
    if (error.response?.status === 429 || error.response?.status >= 500) {
      return true;
    }
    
    // Anthropic API特定错误
    if (error.type === 'rate_limit_error' || error.type === 'server_error') {
      return true;
    }
    
    // 格式错误
    if (error.message === 'JSON格式验证失败' || 
       (typeof error.message === 'string' && error.message.includes('JSON'))) {
      return true;
    }
    
    return false;
  }

  /**
   * 调用通义千问API
   */
  private async callQwenAPI(prompt: string, temperature: number, options: AnalyzeOptions): Promise<any> {
    // 构建通义千问API请求
    const systemPrompt = options.systemPrompt || 
                        `你是一位精通市场分析和用户研究的专家级助手。请你以系统化、客观的视角分析用户提供的数据，挖掘深层的洞察和趋势。
                        在分析时：
                        1. 关注数据背后的用户行为模式和潜在需求
                        2. 识别市场缺口和增长机会
                        3. 剖析关键趋势并提供有深度的见解
                        4. 确保每项分析都有清晰的事实支持和合理推理
                        ${options.format === 'json' ? '请严格按照要求的JSON格式返回结果，确保结构完整且易于解析。每个字段都需符合指定的数据类型与范围。' : ''}`;
    
    // 使用OpenAI格式构建请求体 (通义千问完全兼容此格式)
    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: options.maxTokens || this.maxTokens
    };

    const fetch = require('node-fetch');
    
    logger.debug('通义千问API请求', { 
      endpoint: this.apiEndpoint,
      model: this.model,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.substring(0, 5)}...`
      }
    });
    
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    // 检查HTTP响应状态
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('通义千问API返回错误', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText.substring(0, 200) 
      });
      throw new Error(`API responded with status ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    logger.debug('通义千问API响应', { responseKeys: Object.keys(data) });
    
    // 处理OpenAI格式的响应
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content;
      
      if (options.format === 'json') {
        try {
          return JSON.parse(content);
        } catch (e) {
          // 尝试清理可能包含markdown代码块的响应
          try {
            // 移除markdown代码块标记
            const cleanedContent = content
              .replace(/^```json\s*\n/m, '') // 移除开头的```json
              .replace(/\n```\s*$/m, '');    // 移除结尾的```
            return JSON.parse(cleanedContent);
          } catch (cleanError) {
            logger.warn('无法解析JSON响应', { content: content.substring(0, 100) });
            return { raw: content };
          }
        }
      }
      
      return { content };
    }
    
    // 处理错误情况
    logger.warn('通义千问返回了异常格式的响应', { data: JSON.stringify(data).substring(0, 200) });
    return data;
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAIAPI(prompt: string, temperature: number, options: AnalyzeOptions): Promise<any> {
    // 构建OpenAI API请求
    const systemPrompt = options.systemPrompt || 
                        `你是一位精通市场分析和用户研究的专家级助手。请你以系统化、客观的视角分析用户提供的数据，挖掘深层的洞察和趋势。
                        在分析时：
                        1. 关注数据背后的用户行为模式和潜在需求
                        2. 识别市场缺口和增长机会
                        3. 剖析关键趋势并提供有深度的见解
                        4. 确保每项分析都有清晰的事实支持和合理推理
                        ${options.format === 'json' ? '请严格按照要求的JSON格式返回结果，确保结构完整且易于解析。每个字段都需符合指定的数据类型与范围。' : ''}`;
    
    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: options.maxTokens || this.maxTokens
    };

    const fetch = require('node-fetch');
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content;
      
      if (options.format === 'json') {
        try {
          return JSON.parse(content);
        } catch (e) {
          // 尝试清理可能包含markdown代码块的响应
          try {
            // 移除markdown代码块标记
            const cleanedContent = content
              .replace(/^```json\s*\n/m, '') // 移除开头的```json
              .replace(/\n```\s*$/m, '');    // 移除结尾的```
            return JSON.parse(cleanedContent);
          } catch (cleanError) {
            logger.warn('无法解析JSON响应', { content: content.substring(0, 100) });
            return { raw: content };
          }
        }
      }
      
      return { content };
    }
    
    logger.warn('OpenAI返回了异常格式的响应', { data });
    return data;
  }

  /**
   * 调用Claude API
   */
  private async callClaudeAPI(prompt: string, temperature: number, options: AnalyzeOptions): Promise<any> {
    // 构建Claude API请求
    const systemPrompt = options.systemPrompt || 
                        `你是一位精通市场分析和用户研究的专家级助手。请你以系统化、客观的视角分析用户提供的数据，挖掘深层的洞察和趋势。
                        在分析时：
                        1. 关注数据背后的用户行为模式和潜在需求
                        2. 识别市场缺口和增长机会
                        3. 剖析关键趋势并提供有深度的见解
                        4. 确保每项分析都有清晰的事实支持和合理推理
                        ${options.format === 'json' ? '请严格按照要求的JSON格式返回结果，确保结构完整且易于解析。每个字段都需符合指定的数据类型与范围。' : ''}`;
    
    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: options.maxTokens || this.maxTokens
    };

    const fetch = require('node-fetch');
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.content && data.content.length > 0) {
      const content = data.content[0].text;
      
      if (options.format === 'json') {
        try {
          return JSON.parse(content);
        } catch (e) {
          // 尝试清理可能包含markdown代码块的响应
          try {
            // 移除markdown代码块标记
            const cleanedContent = content
              .replace(/^```json\s*\n/m, '') // 移除开头的```json
              .replace(/\n```\s*$/m, '');    // 移除结尾的```
            return JSON.parse(cleanedContent);
          } catch (cleanError) {
            logger.warn('无法解析JSON响应', { content: content.substring(0, 100) });
            return { raw: content };
          }
        }
      }
      
      return { content };
    }
    
    logger.warn('Claude返回了异常格式的响应', { data });
    return data;
  }
  
  /**
   * 解析LLM模型返回的响应
   */
  private parseResponse(response: any, format: 'json' | 'text' | 'markdown' = 'json'): any {
    // 如果响应已经是解析过的JSON对象，直接返回
    if (typeof response === 'object' && !Array.isArray(response)) {
      return response;
    }
    
    // 处理字符串响应
    if (typeof response === 'string') {
      if (format === 'json') {
        // 尝试多种方式解析JSON
        // 1. 直接解析
        try {
          return JSON.parse(response);
        } catch (e) {
          logger.debug('直接JSON解析失败，尝试清理格式');
        }
        
        // 2. 尝试清理Markdown代码块
        try {
          // 移除各种格式的Markdown代码块
          const cleanedResponse = response
            .replace(/^```(?:json|javascript|js)?\s*\n/m, '') // 匹配开头的```json, ```javascript 等
            .replace(/\n```\s*$/m, '')                        // 匹配结尾的```
            .trim();
            
          if (cleanedResponse !== response) {
            logger.debug('检测到并清理了Markdown代码块');
            return JSON.parse(cleanedResponse);
          }
        } catch (e) {
          logger.debug('Markdown代码块清理后仍无法解析');
        }
        
        // 3. 尝试更宽松的方式处理格式问题
        try {
          // 寻找第一个{和最后一个}之间的内容
          const match = response.match(/(\{[\s\S]*\})/m);
          if (match && match[1]) {
            logger.debug('尝试提取JSON对象');
            return JSON.parse(match[1]);
          }
        } catch (e) {
          logger.debug('尝试提取JSON对象失败');
        }
        
        // 所有尝试都失败，记录警告并返回原始内容
        logger.warn('所有JSON解析方法均失败', { response: response.substring(0, 150) });
        return { raw: response };
      }
      
      // 非JSON格式，直接返回
      return { content: response };
    }
    
    // 其他情况，直接返回原始响应
    return response;
  }
  
  /**
   * 批量分析文本
   */
  public async analyzeBatch(prompts: string[], analysisType: string, options: AnalyzeOptions): Promise<any[]> {
    return Promise.all(prompts.map(prompt => this.analyze(prompt, analysisType, options)));
  }
 
  // Helper method to generate mock responses for testing
  private getMockResponse(prompt: string): any {
    // 如果提供了模拟响应，使用预设的模拟响应
    if (prompt.includes('keyword_analysis') && this.mockResponses?.keyword_analysis) {
      return this.mockResponses.keyword_analysis;
    }
    
    if (prompt.includes('unmet_needs_analysis') && this.mockResponses?.unmet_needs_analysis) {
      return this.mockResponses.unmet_needs_analysis;
    }
    
    if (prompt.includes('market_insights') && this.mockResponses?.market_insights) {
      return this.mockResponses.market_insights;
    }
    
    if (prompt.includes('concrete_unmet_needs') && this.mockResponses?.concrete_unmet_needs) {
      return this.mockResponses.concrete_unmet_needs;
    }
    
    // 默认通用模拟响应
    if (prompt.toLowerCase().includes('keyword')) {
      return {
        potentialUnmetNeeds: [
          {
            keyword: 'example need 1',
            confidence: 0.9,
            reason: 'Mock reason 1'
          },
          {
            keyword: 'example need 2',
            confidence: 0.8,
            reason: 'Mock reason 2'
          }
        ],
        insights: [
          {
            title: 'Insight 1',
            description: 'Mock insight description 1'
          },
          {
            title: 'Insight 2',
            description: 'Mock insight description 2'
          }
        ]
      };
    } 
    
    // ... 其他mock响应
    
    // 默认响应
    return {
      results: [
        { title: 'Mock Result 1', description: 'Mock description 1' },
        { title: 'Mock Result 2', description: 'Mock description 2' }
      ],
      analysis: 'This is a mock analysis for testing purposes.'
    };
  }

  /**
   * 返回当前使用的模型名称
   */
  public getModelName(): string {
    return this.model;
  }

  /**
   * 创建一个JSON强制的LLM提供者
   * 这个方法符合OOP工厂模式，用于创建专门处理JSON响应的提供者
   * @param provider 原始LLM提供者
   * @param maxJsonRetries 最大JSON格式重试次数
   */
  public createJsonEnforcedProvider(provider: LLMProvider, maxJsonRetries: number = 3): LLMProvider {
    return new JsonEnforcedLLMProvider(provider, maxJsonRetries);
  }
} 