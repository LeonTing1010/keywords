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
    
    // 确保缓存目录存在
    this.cacheDir = path.join(process.cwd(), 'output', 'cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    if (!this.apiKey) {
      console.warn('[LLMServiceHub] 警告: 未设置OpenAI API密钥，请设置OPENAI_API_KEY环境变量');
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
    
    // 尝试发送请求
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.maxRetries) {
      try {
        if (retries > 0) {
          console.info(`[LLMServiceHub] 重试 ${retries}/${this.maxRetries}...`);
        }
        
        const startTime = Date.now();
        const requestURL = `${this.baseURL}/chat/completions`;
        
        // 准备请求载荷
        const requestPayload: any = {
          model: model,
          messages: messages,
          temperature: temperature
        };
        
        // 使用OpenAI原生响应格式设置
        if (requireJson) {
          requestPayload.response_format = { type: "json_object" };
        }
        
        const response = await axios.post(
          requestURL,
          requestPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: this.timeout
          }
        );
        
        const requestTime = Date.now() - startTime;
        
        if (this.verbose) {
          console.info(`[LLMServiceHub] 请求成功，耗时 ${requestTime}ms`);
        }
        
        const data = response.data as LLMResponse;
        
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          const responseContent = data.choices[0].message.content;
          
          // 如果使用会话ID，保存回复到会话历史
          if (sessionId) {
            const sessionMessages = this.sessionContexts.get(sessionId) || [];
            // 避免重复添加相同的用户消息
            if (sessionMessages.length === 0 || 
                sessionMessages[sessionMessages.length - 1].role !== 'user' || 
                sessionMessages[sessionMessages.length - 1].content !== prompt) {
              sessionMessages.push({ role: 'user', content: prompt });
            }
            
            sessionMessages.push({ role: 'assistant', content: responseContent });
            
            // 限制会话历史长度，防止超出上下文窗口
            // 保留系统消息（第一条）和最新的消息
            if (sessionMessages.length > this.maxContextLength) {
              const systemMessage = sessionMessages[0]; // 保存系统消息
              // 保留系统消息和最近的消息
              const recentMessages = sessionMessages.slice(-(this.maxContextLength - 1));
              this.sessionContexts.set(sessionId, [systemMessage, ...recentMessages]);
              
              if (this.verbose) {
                console.info(`[LLMServiceHub] 会话 ${sessionId} 已达到最大长度，截断历史消息以保持 ${this.maxContextLength} 条消息`);
              }
            } else {
              this.sessionContexts.set(sessionId, sessionMessages);
            }
            
            // 更新会话的最后使用时间
            const metadata = this.sessionMetadata.get(sessionId);
            if (metadata) {
              metadata.lastUsedAt = new Date();
              metadata.messageCount = sessionMessages.length;
              this.sessionMetadata.set(sessionId, metadata);
            }
          } else {
            // 单次交互则缓存响应
            this.cacheResponse(cacheKey, responseContent, model);
          }
          
          return responseContent;
        } else {
          throw new Error('LLM响应格式错误');
        }
      } catch (error: any) {
        lastError = error;
        console.error(`[LLMServiceHub] 错误: ${error.message}`);
        
        // 检查是否是可重试的错误
        if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
          retries++;
          // 指数退避
          const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
          console.info(`[LLMServiceHub] 将在 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // 不可重试的错误直接抛出
          break;
        }
      }
    }
    
    // 如果所有重试都失败，抛出最后一个错误
    throw lastError || new Error('未知的LLM请求错误');
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