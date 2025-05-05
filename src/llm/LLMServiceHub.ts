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
  sessionId?: string;
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
    
    // 针对Qwen模型的特殊处理
    // 模型名称映射 - Qwen API要求特定的模型名称格式
    let mappedModel = model;
    if (model === 'qwen-plus') {
      mappedModel = 'qwen-max';
    } else if (model === 'qwen-turbo') {
      mappedModel = 'qwen-turbo';
    } else if (!model.startsWith('qwen-')) {
      mappedModel = 'qwen-max'; // 默认使用qwen-max
    }
    
    // 对JSON响应请求的特殊处理
    let systemMessage = messages.find(m => m.role === 'system');
    if (requireJson && systemMessage) {
      // 确保系统消息包含返回JSON的明确指令
      if (!systemMessage.content.includes('JSON') && !systemMessage.content.includes('json')) {
        systemMessage.content += '\n\nYour response must be a valid JSON object. Do not include any markdown formatting like ```json or ``` in your response.';
      }
    }
    
    // 构建请求数据
    const data = {
      model: mappedModel,
      messages,
      temperature,
      response_format: requireJson ? { type: 'json_object' } : undefined,
      max_tokens: 1500
    };
    
    // 打印debug信息
    if (this.verbose) {
      console.log(`[LLMServiceHub] 发送请求到Qwen API: ${url}`);
      console.log(`[LLMServiceHub] 使用模型: ${mappedModel}`);
      console.log(`[LLMServiceHub] 消息数量: ${messages.length}`);
      if (requireJson) {
        console.log(`[LLMServiceHub] 请求JSON响应格式`);
      }
    }
    
    try {
      const response = await axios.post(url, data, {
        headers,
        timeout: this.timeout
      });
      
      if (this.verbose) {
        console.log(`[LLMServiceHub] Qwen API响应状态: ${response.status}`);
        console.log(`[LLMServiceHub] Qwen API响应数据预览: ${JSON.stringify(response.data).substring(0, 150)}...`);
      }
      
      // 如果响应中有直接message内容，则提取，否则回退到choices
      if (response.data.message && response.data.message.content) {
        return response.data.message.content;
      } else if (response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('Qwen API响应格式异常');
      }
    } catch (error: any) {
      // 详细记录错误信息以便调试
      console.error('[LLMServiceHub] Qwen API错误:');
      
      if (error.response) {
        // 服务器响应错误
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应头: ${JSON.stringify(error.response.headers)}`);
        console.error(`响应体: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // 请求发送成功但没有收到响应
        console.error('没有收到响应');
        console.error(`请求: ${JSON.stringify(error.request)}`);
      } else {
        // 设置请求时发生的错误
        console.error(`错误消息: ${error.message}`);
      }
      
      // 如果使用了requireJson但失败，尝试不使用JSON格式重试一次
      if (requireJson) {
        console.warn('[LLMServiceHub] 使用JSON格式请求失败，尝试以普通格式重试');
        return this.callQwenAPI(messages, model, temperature, false);
      }
      
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
      task: 'Simulate a complete user search journey starting with this query',
      format_requirements: {
        expected_structure: {
          initialQuery: "string - the initial search query",
          steps: [
            {
              query: "string - the search query",
              intentType: "string - categorized intent like informational, commercial, navigational, etc.",
              expectedResults: ["array of expected search results"],
              userAction: "string - what the user does with the results",
              reasoning: "string - why the user moved to this query"
            }
          ],
          mainIntent: "string - the primary intent across the journey"
        },
        example: {
          "initialQuery": "智能手机",
          "steps": [
            {
              "query": "智能手机",
              "intentType": "informational",
              "expectedResults": ["智能手机基本信息", "各品牌智能手机介绍"],
              "userAction": "浏览搜索结果",
              "reasoning": "初始搜索，了解基本信息"
            },
            {
              "query": "智能手机推荐2023",
              "intentType": "commercial",
              "expectedResults": ["2023年热门智能手机排行", "各价位手机推荐"],
              "userAction": "查看产品排行榜",
              "reasoning": "想了解最新的手机推荐"
            },
            {
              "query": "iPhone和华为手机对比",
              "intentType": "comparison",
              "expectedResults": ["iPhone与华为手机性能对比", "价格对比"],
              "userAction": "阅读对比文章",
              "reasoning": "缩小选择范围，比较两个主要品牌"
            }
          ],
          "mainIntent": "purchase_decision"
        },
        instructions: [
          "Always include at least 3-5 steps in the journey",
          "Make sure to properly reflect how users refine their searches",
          "Include different intent types as the user's needs evolve",
          "Ensure each step logically follows from the previous one",
          "All fields must be included and properly formatted"
        ]
      }
    }, {
      ...options,
      systemPrompt: 'You are a user behavior expert who understands how people navigate search engines to find information. You MUST return a journey with all the specified fields and follow the exact format provided in the example.',
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
        // 尝试提取JSON部分 - 查找最外层的大括号对
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonContent = jsonMatch[0];
          return JSON.parse(jsonContent) as T;
        }
        
        // 尝试通过替换常见错误格式来修复JSON
        const cleanedJson = this.cleanJsonString(response);
        if (cleanedJson) {
          return JSON.parse(cleanedJson) as T;
        }
        
        throw new Error('无法解析JSON响应');
      } catch (jsonError) {
        console.error('[LLMServiceHub] JSON解析错误, 原始响应:', response);
        
        // 尝试构建一个基本的对象作为后备
        try {
          // 从文本中提取可能的键值对
          const fallbackObject = this.createFallbackObject(response);
          if (Object.keys(fallbackObject).length > 0) {
            console.warn('[LLMServiceHub] 使用后备对象作为解析结果');
            return fallbackObject as unknown as T;
          }
        } catch (e) {
          // 忽略后备解析错误
        }
        
        throw new Error(`JSON解析失败: ${jsonError}`);
      }
    }
  }
  
  /**
   * 清理JSON字符串，修复常见格式问题
   */
  private cleanJsonString(input: string): string | null {
    try {
      // 移除可能的markdown代码块标记
      let cleaned = input.replace(/```json|```/g, '').trim();
      
      // 确保只保留一个完整的JSON对象
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      } else {
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
      JSON.parse(cleaned);
      return cleaned;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * 从文本中创建后备对象
   */
  private createFallbackObject(text: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    // 尝试提取键值对
    const pairs = text.match(/"([^"]+)"\s*:\s*("[^"]*"|[0-9]+|true|false|\[[^\]]*\]|\{[^}]*\})/g);
    
    if (pairs) {
      pairs.forEach(pair => {
        try {
          // 将单个键值对包装在对象中解析
          const wrappedPair = `{${pair}}`;
          const parsed = JSON.parse(wrappedPair);
          const key = Object.keys(parsed)[0];
          result[key] = parsed[key];
        } catch (e) {
          // 忽略无法解析的键值对
        }
      });
    }
    
    // 如果没有找到键值对，尝试提取分类或列表
    if (Object.keys(result).length === 0) {
      // 检查是否有分类列表
      const categories = text.match(/[Cc]ategor(y|ies):\s*(.*?)$/m);
      if (categories && categories[2]) {
        result.categories = categories[2].split(/[,;]/).map(c => c.trim());
      }
      
      // 检查是否有关键词列表
      const keywords = text.match(/[Kk]eywords?:\s*(.*?)$/m);
      if (keywords && keywords[1]) {
        result.keywords = keywords[1].split(/[,;]/).map(k => k.trim());
      }
      
      // 检查是否有分析结果
      const analysis = text.match(/[Aa]nalysis:\s*(.*?)$/m);
      if (analysis && analysis[1]) {
        result.analysis = analysis[1].trim();
      }
    }
    
    return result;
  }
  
  /**
   * 特定的意图分析方法
   * 针对系统中最常用的意图分析场景优化
   */
  async analyzeIntent(keyword: string, suggestions: string[], options: AnalysisOptions = {}): Promise<any> {
    const systemPrompt = options.systemPrompt || 
      'You are an intent analysis expert who can identify the underlying user intent behind search queries.';
    
    // 制作更具体的任务描述，明确要求JSON格式
    const prompt = JSON.stringify({
      task: 'keyword_intent_analysis',
      data: {
        keyword,
        suggestions
      },
      requirements: {
        outputFormat: 'strictJson',
        returnFormat: {
          intents: [
            {
              type: "string",
              confidence: "number",
              patterns: ["string"]
            }
          ],
          categories: {
            "categoryName": ["keywords"]
          },
          recommendations: ["string"]
        }
      }
    }, null, 2);
    
    // 发送带有额外JSON格式信息的提示
    try {
      const response = await this.sendPrompt(prompt, {
        systemPrompt: systemPrompt + '\n\nYou must respond with strictly valid JSON format without any explanations, prefixes, or suffixes. Do not use markdown formatting.',
        temperature: options.temperature || 0.3, // 使用较低温度以提高一致性
        requireJson: true,
        language: options.language || 'en'
      });
      
      try {
        // 尝试解析响应
        return this.parseJsonResponse(response);
      } catch (parseError) {
        // 如果解析失败，返回一个基本结构，避免完全失败
        console.warn('[LLMServiceHub] 意图分析JSON解析失败，使用后备结构');
        
        // 提取可能的意图信息
        const intents = [];
        const intentMatch = response.match(/intent|type|category/i);
        if (intentMatch) {
          intents.push({
            type: "informational",
            confidence: 0.7,
            patterns: [keyword]
          });
        }
        
        return {
          intents: intents,
          categories: {
            "general": [keyword]
          },
          recommendations: ["创建相关内容"]
        };
      }
    } catch (error) {
      console.error('[LLMServiceHub] 意图分析失败:', error);
      throw error;
    }
  }
} 