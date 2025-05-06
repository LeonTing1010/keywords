/**
 * LLMServiceHub - 大语言模型服务中心
 * 统一管理与大语言模型的交互，提供标准化的接口
 */
import * as crypto from 'crypto';
import { logger } from '../error/logger';
import { AppError, ErrorType } from '../../core/errorHandler';
import { envConfig } from '../config/env';

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
  model?: string;
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
  systemPrompt?: string;
  format?: 'json' | 'text' | 'markdown';
  temperature?: number;
  maxTokens?: number;
}

export interface LLMServiceConfig {
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  mockMode?: boolean;
  apiEndpoint?: string;
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
    maxTokens: 2000,
    model: 'gpt-4'
  };
  private temperature: number = 0.7;
  private maxTokens: number = 4000;
  private mockMode: boolean = false;
  
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
  public async analyze(prompt: string, analysisType: string, options: AnalyzeOptions): Promise<any> {
    try {
      // In mock mode, return mock data for testing
      if (this.mockMode) {
        logger.info('Using mock mode for LLM');
        return this.getMockResponse(prompt);
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

      try {
        // 根据模型类型选择合适的API调用方法
        if (model.includes('claude')) {
          // 使用Anthropic Claude API
          logger.debug(`使用Claude API调用 [${this.apiEndpoint}]`, { model });
          response = await this.callClaudeAPI(prompt, temperature, options);
        } else if (model.includes('qwen') || model === 'qwen-plus' || model.includes('dashscope')) {
          // 使用通义千问API
          logger.debug(`使用通义千问API调用 [${this.apiEndpoint}]`, { model });
          response = await this.callQwenAPI(prompt, temperature, options);
        } else {
          // 默认使用OpenAI API
          logger.debug(`使用OpenAI API调用 [${this.apiEndpoint}]`, { model });
          response = await this.callOpenAIAPI(prompt, temperature, options);
        }

        logger.info('LLM调用输出', { 
          model, 
          source: analysisType, 
          output: JSON.stringify(response).substring(0, 200) + (JSON.stringify(response).length > 200 ? '...' : '') 
        });
        
        logger.debug(`LLM API调用成功 [${requestId}]`, {});
        
        return this.parseResponse(response, options.format || 'json');
      } catch (error: any) {
        logger.error('API调用失败', { error, model, endpoint: this.apiEndpoint });
        
        // 返回一个基本的响应，避免完全失败
        return { 
          error: '模型API调用失败', 
          message: error.message,
          modelType: model,
          endpoint: this.apiEndpoint
        };
      }
    } catch (error) {
      logger.error('LLM分析失败', { error, task: analysisType });
      throw error;
    }
  }

  /**
   * 调用通义千问API
   */
  private async callQwenAPI(prompt: string, temperature: number, options: AnalyzeOptions): Promise<any> {
    // 构建通义千问API请求
    const systemPrompt = options.systemPrompt || 
                        `你是一个专业的市场分析助手，请根据用户的提示进行分析。${
                          options.format === 'json' ? '请以JSON格式返回结果。' : ''
                        }`;
    
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
                        `你是一个专业的市场分析助手，请根据用户的提示进行分析。${
                          options.format === 'json' ? '请以JSON格式返回结果。' : ''
                        }`;
    
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
                        `你是一个专业的市场分析助手，请根据用户的提示进行分析。${
                          options.format === 'json' ? '请以JSON格式返回结果。' : ''
                        }`;
    
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
    // Simple mock responses for different prompt types
    if (prompt.includes('关键词') || prompt.includes('分类')) {
      return {
        relevantKeywords: ['智能家居控制系统设计', '智能家居控制系统方案', '智能家居控制系统哪个好'],
        categories: {
          '规划设计': ['智能家居控制系统设计', '智能家居控制系统方案'],
          '产品选择': ['智能家居控制系统哪个好', '智能家居控制系统品牌']
        }
      };
    }
    
    if (prompt.includes('未满足需求') || prompt.includes('unmet')) {
      return {
        unmetNeeds: [
          {
            keyword: '智能家居控制系统DIY方案',
            isUnmetNeed: true,
            contentQuality: 0.4,
            reason: '搜索结果中缺乏详细的DIY实施指南和组件选择信息'
          }
        ]
      };
    }
    
    if (prompt.includes('模式') || prompt.includes('pattern')) {
      return {
        patterns: ['控制系统 + 品牌', '控制系统 + 设计', '控制系统 + 方案'],
        insights: ['用户更关注实用性而非技术细节', '品牌认可度是重要决策因素']
      };
    }
    
    if (prompt.includes('搜索查询') || prompt.includes('search_step')) {
      return {
        intent: '寻找可靠的智能家居控制系统解决方案',
        satisfaction: 0.7,
        nextQueries: ['智能家居控制系统品牌对比', '智能家居控制系统安装指南']
      };
    }
    
    if (prompt.includes('决策') || prompt.includes('decision')) {
      return {
        chosenOption: '智能家居控制系统品牌对比',
        reason: '用户需要了解不同品牌的优缺点以做出购买决策'
      };
    }
    
    if (prompt.includes('洞察') || prompt.includes('insight')) {
      return {
        insights: [
          {
            type: '用户行为',
            description: '用户从基础了解逐步深入到具体产品比较'
          },
          {
            type: '决策点',
            description: '品牌选择是关键决策点'
          }
        ]
      };
    }
    
    // Default mock response
    return {
      result: 'Mock response',
      query: prompt
    };
  }

  /**
   * 返回当前使用的模型名称
   */
  public getModelName(): string {
    return this.model;
  }
} 