/**
 * LLMServiceHub - 统一LLM服务中心
 * 集中管理所有AI模型交互，提供缓存和优化
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from '../config';

// LLM提供者接口
export interface LLMProvider {
  name: string;
  sendPrompt(prompt: string, options?: any): Promise<string>;
}

// 分析选项接口
export interface AnalysisOptions {
  systemPrompt?: string;
  temperature?: number;
  format?: 'text' | 'json';
  language?: string;
}

// 会话元数据接口
interface SessionMetadata {
  createdAt: Date;
  lastUsedAt: Date;
  purpose: string;
  messageCount: number;
  originalKeyword?: string;
}

// LLM消息接口
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// LLM响应接口
interface LLMResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 缓存项接口
interface CacheItem {
  response: string;
  timestamp: number;
  model: string;
}

/**
 * LLMServiceHub是一个集中的AI模型交互服务
 * 管理所有与LLM的通信，提供缓存和会话管理
 */
export class LLMServiceHub {
  private models: Record<string, LLMProvider> = {};
  private defaultModel: string;
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';
  private timeout = 120000; // 默认超时时间2分钟
  private maxRetries = 3;
  private cacheDir: string;
  private cacheExpiry: number; // 缓存过期时间（秒）
  private sessionContexts: Map<string, LLMMessage[]> = new Map();
  private sessionMetadata: Map<string, SessionMetadata> = new Map();
  private maxContextLength = 15; // 会话历史的最大消息数
  private verbose: boolean;
  
  private initializeBaseUrl() {
    // 从环境变量中获取基础URL
    const envBaseUrl = process.env.LLM_BASE_URL;
    if (envBaseUrl) {
      this.baseURL = envBaseUrl;
      return;
    }
    
    // 根据模型自动设置基础URL
    if (this.defaultModel.includes('gpt')) {
      this.baseURL = 'https://api.openai.com/v1';
    } else if (this.defaultModel.includes('claude')) {
      this.baseURL = 'https://api.anthropic.com/v1';
    } else if (this.defaultModel.includes('qwen')) {
      this.baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    }
    
    if (this.verbose) {
      console.info(`[LLMServiceHub] 使用模型 ${this.defaultModel}，基础URL: ${this.baseURL}`);
    }
  }
  
  constructor(options: {
    model?: string;
    apiKey?: string;
    cacheExpiry?: number; // 秒
    verbose?: boolean;
  } = {}) {
    this.defaultModel = options.model || config.llm.defaultModel;
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.cacheExpiry = options.cacheExpiry || 24 * 60 * 60; // 默认24小时
    this.verbose = options.verbose || false;
    
    // 初始化基础URL
    this.initializeBaseUrl();
    
    // 确保缓存目录存在
    this.cacheDir = path.join(process.cwd(), 'output', 'cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    if (!this.apiKey) {
      console.warn('[LLMServiceHub] 警告: 未设置API密钥，请设置OPENAI_API_KEY环境变量');
    }
    
    if (this.verbose) {
      console.info(`[LLMServiceHub] 初始化完成，默认模型: ${this.defaultModel}, 缓存过期: ${this.cacheExpiry}秒`);
    }
  }
  
  /**
   * 发送提示到LLM
   */
  async sendPrompt(
    prompt: string,
    options: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      requireJson?: boolean;
      sessionId?: string;
      language?: string;
    } = {}
  ): Promise<string> {
    const model = options.model || this.defaultModel;
    const systemPrompt = options.systemPrompt || 'You are a helpful assistant.';
    const temperature = options.temperature || 0.7;
    const requireJson = options.requireJson || false;
    const sessionId = options.sessionId;
    const language = options.language || 'en';
    
    // 增强系统提示
    const enhancedSystemPrompt = this.enhanceSystemPrompt(systemPrompt, language);
    
    // 准备消息
    let messages: LLMMessage[] = [];
    
    // 如果提供会话ID，获取或创建会话历史
    if (sessionId) {
      // 检查会话是否已存在
      if (!this.sessionContexts.has(sessionId)) {
        // 新会话，初始化系统消息
        this.sessionContexts.set(sessionId, [
          { role: 'system', content: enhancedSystemPrompt }
        ]);
        
        // 初始化会话元数据
        this.sessionMetadata.set(sessionId, {
          createdAt: new Date(),
          lastUsedAt: new Date(),
          purpose: 'general',
          messageCount: 1
        });
        
        if (this.verbose) {
          console.info(`[LLMServiceHub] 创建新会话: ${sessionId}`);
        }
      } else {
        // 已存在的会话，可能需要更新系统消息
        const sessionMessages = this.sessionContexts.get(sessionId) || [];
        
        // 如果系统提示有变化，更新第一条系统消息
        if (sessionMessages.length > 0 && sessionMessages[0].role === 'system' && 
            sessionMessages[0].content !== enhancedSystemPrompt) {
          sessionMessages[0].content = enhancedSystemPrompt;
          this.sessionContexts.set(sessionId, sessionMessages);
        }
      }
      
      // 获取会话历史消息
      const sessionMessages = this.sessionContexts.get(sessionId) || [];
      
      // 更新会话元数据中的消息计数
      const metadata = this.sessionMetadata.get(sessionId);
      if (metadata) {
        metadata.messageCount = sessionMessages.length + 1; // +1 为即将添加的消息
        metadata.lastUsedAt = new Date();
        this.sessionMetadata.set(sessionId, metadata);
      }
      
      // 添加用户消息
      messages = [
        ...sessionMessages,
        { role: 'user', content: prompt }
      ];
    } else {
      // 无会话ID时的单次交互
      messages = [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: prompt }
      ];
    }
    
    // 计算缓存键
    const cacheKey = this.generateCacheKey(messages, model, temperature, requireJson);
    
    // 检查缓存
    const cachedResponse = this.getCachedResponse(cacheKey, model);
    if (cachedResponse && !sessionId) { // 对于会话，我们不使用缓存
      if (this.verbose) {
        console.info(`[LLMServiceHub] 使用缓存响应，提示: "${prompt.substring(0, 50)}..."`);
      }
      return cachedResponse;
    }
    
    // API请求
    try {
      let response = '';
      
      // 根据不同模型选择不同的API格式
      if (model.includes('qwen')) {
        response = await this.callQwenAPI(messages, model, temperature, requireJson);
      } else if (model.includes('claude')) {
        response = await this.callClaudeAPI(messages, model, temperature, requireJson);
      } else {
        response = await this.callOpenAIAPI(messages, model, temperature, requireJson);
      }
      
      // 如果有会话ID，保存助手的回复到会话历史
      if (sessionId) {
        const sessionMessages = this.sessionContexts.get(sessionId) || [];
        sessionMessages.push({ role: 'assistant', content: response });
        
        // 保持会话历史在最大长度以内
        if (sessionMessages.length > this.maxContextLength + 1) { // +1 为系统提示
          sessionMessages.splice(1, sessionMessages.length - this.maxContextLength - 1);
        }
        
        this.sessionContexts.set(sessionId, sessionMessages);
      }
      
      // 缓存响应（非会话）
      if (!sessionId) {
        this.cacheResponse(cacheKey, response, model);
      }
      
      return response;
    } catch (error: any) {
      console.error('[LLMServiceHub] 错误: ', error);
      throw error;
    }
  }
  
  /**
   * 调用OpenAI API
   */
  private async callOpenAIAPI(
    messages: LLMMessage[],
    model: string,
    temperature: number,
    requireJson: boolean
  ): Promise<string> {
    const url = `${this.baseURL}/chat/completions`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
    
    const data = {
      model,
      messages,
      temperature,
      response_format: requireJson ? { type: 'json_object' } : undefined,
      max_tokens: 2048
    };
    
    const response = await axios.post(url, data, {
      headers,
      timeout: this.timeout
    });
    
    return response.data.choices[0].message.content;
  }
  
  /**
   * 调用Qwen API
   */
  private async callQwenAPI(
    messages: LLMMessage[],
    model: string,
    temperature: number,
    requireJson: boolean
  ): Promise<string> {
    const url = `${this.baseURL}/chat/completions`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
    
    // 不同的模型格式
    const mappedModel = model === 'qwen-plus' ? 'qwen-max' : model;
    
    const data = {
      model: mappedModel,
      messages,
      temperature,
      response_format: requireJson ? { type: 'json_object' } : undefined,
      max_tokens: 1500
    };
    
    try {
      const response = await axios.post(url, data, {
        headers,
        timeout: this.timeout
      });
      
      if (this.verbose) {
        console.log(`[LLMServiceHub] Qwen API响应: ${JSON.stringify(response.data).substring(0, 150)}...`);
      }
      
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('[LLMServiceHub] Qwen API错误:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * 调用Claude API
   */
  private async callClaudeAPI(
    messages: LLMMessage[],
    model: string,
    temperature: number,
    requireJson: boolean
  ): Promise<string> {
    const url = `${this.baseURL}/messages`;
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };
    
    // 将OpenAI格式消息转换为Claude格式
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const data = {
      model: model.replace('anthropic/', ''),
      messages: userMessages,
      system: systemPrompt,
      temperature,
      max_tokens: 2048
    };
    
    const response = await axios.post(url, data, {
      headers,
      timeout: this.timeout
    });
    
    return response.data.content[0].text;
  }
  
  /**
   * 执行通用分析
   */
  async analyze(analysisType: string, data: any, options: AnalysisOptions = {}): Promise<any> {
    const systemPrompt = options.systemPrompt || 'You are an analytics expert who specializes in analyzing data and providing insights.';
    const temperature = options.temperature || 0.7;
    const format = options.format || 'json';
    const language = options.language || 'en';
    
    // 构建提示
    const prompt = JSON.stringify({
      analysisType,
      data,
      requirements: {
        format: format,
        language: language
      }
    });
    
    // 生成会话ID
    const sessionId = `ki_${analysisType}_${Date.now()}`;
    
    // 发送提示
    const response = await this.sendPrompt(prompt, {
      systemPrompt,
      temperature,
      requireJson: format === 'json',
      sessionId,
      language
    });
    
    // 清理会话
    this.clearSessionContext(sessionId);
    
    // 解析响应
    if (format === 'json') {
      return this.parseJsonResponse(response);
    }
    
    return response;
  }
  
  /**
   * 识别关键词所属领域
   */
  async identifyDomain(keywords: string[], options: AnalysisOptions = {}): Promise<any> {
    return this.analyze('identify_domain', {
      keywords,
      task: 'Identify the domains these keywords belong to'
    }, {
      ...options,
      systemPrompt: 'You are a domain classification expert who identifies the industries and subject areas keywords belong to.',
      format: 'json'
    });
  }
  
  /**
   * 模拟用户搜索旅程
   */
  async simulateUserJourney(initialQuery: string, options: AnalysisOptions = {}): Promise<any> {
    return this.analyze('user_journey_simulation', {
      initialQuery,
      task: 'Simulate a complete user search journey starting with this query'
    }, {
      ...options,
      systemPrompt: 'You are a user behavior expert who understands how people navigate search engines to find information.',
      format: 'json'
    });
  }
  
  /**
   * 分析跨领域关系
   */
  async analyzeCrossDomain(keywords: string[], domains: string[], options: AnalysisOptions = {}): Promise<any> {
    return this.analyze('cross_domain_analysis', {
      keywords,
      domains,
      task: 'Analyze relationships between different domains represented in these keywords'
    }, {
      ...options,
      systemPrompt: 'You are a cross-domain analysis expert who identifies connections between different fields and industries.',
      format: 'json'
    });
  }
  
  /**
   * 预测关键词价值
   */
  async predictKeywordValue(keywords: string[], options: AnalysisOptions = {}): Promise<any> {
    return this.analyze('keyword_value_prediction', {
      keywords,
      task: 'Predict the commercial value and competition level for these keywords'
    }, {
      ...options,
      systemPrompt: 'You are a keyword value assessment expert who analyzes the commercial potential and competition level of search terms.',
      format: 'json'
    });
  }
  
  /**
   * 增强系统提示
   */
  private enhanceSystemPrompt(basePrompt: string, language: string): string {
    // 根据语言调整特定指令
    const languageInstruction = language === 'zh' 
      ? '请用中文回复。'
      : 'Please respond in English.';
    
    return `${basePrompt}\n\nYour responses should be thorough, accurate, and directly relevant to the query. ${languageInstruction}`;
  }
  
  /**
   * 生成缓存键
   */
  private generateCacheKey(messages: LLMMessage[], model: string, temperature: number, requireJson: boolean): string {
    // 创建包含所有相关参数的缓存键
    const dataToHash = JSON.stringify({
      messages,
      model,
      temperature,
      requireJson
    });
    
    return crypto.createHash('md5').update(dataToHash).digest('hex');
  }
  
  /**
   * 从缓存获取响应
   */
  private getCachedResponse(cacheKey: string, model: string): string | null {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheItem;
        const now = Date.now();
        
        // 检查缓存是否过期
        if (now - cacheData.timestamp < this.cacheExpiry * 1000) {
          // 检查模型是否匹配
          if (cacheData.model === model) {
            return cacheData.response;
          }
        }
      } catch (error) {
        console.error(`[LLMServiceHub] 读取缓存错误: ${error}`);
      }
    }
    
    return null;
  }
  
  /**
   * 缓存响应
   */
  private cacheResponse(cacheKey: string, response: string, model: string): void {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      const cacheData: CacheItem = {
        response,
        timestamp: Date.now(),
        model
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData));
    } catch (error) {
      console.error(`[LLMServiceHub] 写入缓存错误: ${error}`);
    }
  }
  
  /**
   * 清理会话上下文
   */
  clearSessionContext(sessionId: string): void {
    if (this.sessionContexts.has(sessionId)) {
      this.sessionContexts.delete(sessionId);
      
      if (this.verbose) {
        console.info(`[LLMServiceHub] 已清理会话: ${sessionId}`);
      }
    }
    
    if (this.sessionMetadata.has(sessionId)) {
      this.sessionMetadata.delete(sessionId);
    }
  }
  
  /**
   * 获取会话信息
   */
  getSessionInfo(sessionId: string): SessionMetadata | null {
    return this.sessionMetadata.get(sessionId) || null;
  }
  
  /**
   * 解析JSON响应
   */
  parseJsonResponse<T>(response: string): T {
    try {
      // 尝试直接解析
      return JSON.parse(response) as T;
    } catch (error) {
      try {
        // 尝试提取JSON部分
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as T;
        }
        
        throw new Error('无法解析JSON响应');
      } catch (jsonError) {
        console.error('[LLMServiceHub] JSON解析错误:', response);
        throw new Error(`JSON解析失败: ${jsonError}`);
      }
    }
  }
} 