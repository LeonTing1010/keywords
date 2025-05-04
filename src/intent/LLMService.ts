/**
 * KeywordIntent LLM服务
 * 提供与语言模型的交互能力
 */
import axios from 'axios';
import { LLMServiceOptions } from '../types';
import { config } from '../config';
import { ErrorType, AppError } from '../core/errorHandler';
import { coreValueDescription } from '../config/promptLibrary';

/**
 * LLM响应接口
 */
interface LLMResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * LLM消息接口
 */
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 会话元数据接口
 */
interface SessionMetadata {
  createdAt: Date;            // 会话创建时间
  lastUsedAt: Date;           // 最后使用时间
  messageCount: number;       // 消息总数
  language: string;           // 会话使用的语言 ('en' | 'zh' | 'mixed')
  originalKeyword?: string;   // 原始关键词
  iterationCount?: number;    // 迭代次数
  purpose?: string;           // 会话目的
}

/**
 * LLM服务
 * 封装与大型语言模型的交互
 */
export class LLMService {
  private apiKey: string;
  private model: string;
  private timeout: number;
  private maxRetries: number;
  private baseURL: string;
  private coreValueDescription: string = coreValueDescription;
  // 会话上下文映射
  private sessionContexts: Map<string, LLMMessage[]> = new Map();
  // 会话元数据 - 存储每个会话的额外信息
  private sessionMetadata: Map<string, SessionMetadata> = new Map();
  // 会话上下文最大长度
  private maxContextLength: number = 20;
  
  /**
   * 创建LLM服务实例
   * @param options LLM服务配置选项
   */
  constructor(options?: LLMServiceOptions) {
    // 严格使用 config 中的配置，不使用任何默认值或硬编码
    this.apiKey = config.llm.apiKey;
    this.model = config.llm.defaultModel;
    this.timeout = config.llm.timeout;
    this.maxRetries = config.llm.maxRetries;
    this.baseURL = config.llm.baseURL;
    
    // 如果提供了 options，则覆盖配置
    if (options) {
      if (options.apiKey) this.apiKey = options.apiKey;
      if (options.model) this.model = options.model;
      if (options.timeout) this.timeout = options.timeout;
      if (options.maxRetries) this.maxRetries = options.maxRetries;
      if (options.baseURL) this.baseURL = options.baseURL;
    }
    
    // 检查API密钥
    if (!this.apiKey) {
      console.warn('LLM API key not set. Please ensure the OPENAI_API_KEY environment variable is set or provide apiKey in configuration');
    }

    console.info(`[LLM_INFO] LLMService initialized with model: ${this.model}, baseURL: ${this.baseURL}`);
    console.info(`[LLM_INFO] API key configured: ${this.apiKey ? 'Yes' : 'No'}`);
  }
  
  /**
   * 创建或更新会话元数据
   * @param sessionId 会话ID
   * @param metadata 元数据对象
   */
  public setSessionMetadata(sessionId: string, metadata: Partial<SessionMetadata>): void {
    const existingMetadata = this.sessionMetadata.get(sessionId) || {
      createdAt: new Date(),
      lastUsedAt: new Date(),
      messageCount: 0,
      language: 'en'
    };
    
    this.sessionMetadata.set(sessionId, {
      ...existingMetadata,
      ...metadata,
      lastUsedAt: new Date() // 总是更新最后使用时间
    });
  }
  
  /**
   * 获取会话元数据
   * @param sessionId 会话ID
   * @returns 会话元数据或undefined如果不存在
   */
  public getSessionMetadata(sessionId: string): SessionMetadata | undefined {
    return this.sessionMetadata.get(sessionId);
  }
  
  /**
   * 发送提示到语言模型并获取回复
   * @param prompt 提示文本
   * @param sessionId 会话ID，用于维护上下文
   * @param systemPrompt 系统提示
   * @param requireJson 是否需要JSON响应
   * @param options 附加选项
   * @returns LLM生成的回复
   */
  async sendPrompt(
    prompt: string,
    sessionId?: string,
    systemPrompt = 'You are a professional SEO and search intent analysis expert, skilled at extracting patterns and discovering insights from keywords.',
    requireJson = false,
    options?: {
      temperature?: number;  // 控制输出随机性 (0.0-2.0)
      language?: string;     // 预期的响应语言
      purpose?: string;      // 会话目的
      originalKeyword?: string; // 关联的原始关键词
      iterationNumber?: number; // 迭代序号
    }
  ): Promise<string> {
    // 验证输入
    if (!prompt) {
      throw new AppError('Prompt text cannot be empty', ErrorType.VALIDATION);
    }
    
    // 如果没有API密钥，抛出错误
    if (!this.apiKey) {
      throw new AppError(
        'LLM API key not set. Please set the OPENAI_API_KEY environment variable or provide apiKey in configuration',
        ErrorType.VALIDATION
      );
    }
    
    // 处理选项参数
    const temperature = options?.temperature ?? 0.7;
    const language = options?.language ?? 'en';
    
    // 更新会话元数据
    if (sessionId) {
      this.setSessionMetadata(sessionId, {
        language,
        purpose: options?.purpose,
        originalKeyword: options?.originalKeyword,
        iterationCount: options?.iterationNumber
      });
    }
    
    // 打印精简配置信息
    console.info(`[LLM] 发送请求到 ${this.model}，内容长度: ${prompt.length} 字符，${requireJson ? '要求JSON响应' : '不要求JSON响应'}${sessionId ? '，使用会话ID: ' + sessionId : ''}`);
    
    // Enhance the system prompt with core values information - 优化系统提示增强逻辑
    let enhancedSystemPrompt = systemPrompt;
    
    // 只有当系统提示不包含核心价值信息时才添加 - 避免重复
    if (!systemPrompt.includes('KeywordIntent') && !systemPrompt.includes('long-tail keyword')) {
      enhancedSystemPrompt = `${systemPrompt}\n\n${this.coreValueDescription}`;
    }
    
    // 根据语言添加适当的说明
    if (language === 'en') {
      enhancedSystemPrompt += '\n\nPlease respond in English only.';
    } else if (language === 'zh') {
      enhancedSystemPrompt += '\n\n请只使用中文回复。';
    }
    
    // 优化JSON格式指令 - 仅添加到系统提示中，不重复添加到用户提示
    if (requireJson) {
      enhancedSystemPrompt += '\n\nVERY IMPORTANT: You MUST respond with valid JSON only. No explanatory text, markdown formatting, or non-JSON content.';
    }
    
    // 准备消息数组
    let messages: LLMMessage[] = [];
    
    // 如果提供会话ID，获取或创建会话历史
    if (sessionId) {
      // 检查会话是否已存在
      if (!this.sessionContexts.has(sessionId)) {
        // 新会话，初始化系统消息
        this.sessionContexts.set(sessionId, [
          { role: 'system', content: enhancedSystemPrompt }
        ]);
        
        console.info(`[LLM] 创建新会话: ${sessionId}`);
      } else {
        // 已存在的会话，可能需要更新系统消息
        const sessionMessages = this.sessionContexts.get(sessionId) || [];
        
        // 如果系统提示有变化，更新第一条系统消息
        if (sessionMessages.length > 0 && sessionMessages[0].role === 'system' && 
            sessionMessages[0].content !== enhancedSystemPrompt) {
          sessionMessages[0].content = enhancedSystemPrompt;
          this.sessionContexts.set(sessionId, sessionMessages);
          console.info(`[LLM] 更新会话 ${sessionId} 的系统提示`);
        }
      }
      
      // 获取会话历史消息
      const sessionMessages = this.sessionContexts.get(sessionId) || [];
      
      // 更新会话元数据中的消息计数
      const metadata = this.sessionMetadata.get(sessionId);
      if (metadata) {
        metadata.messageCount = sessionMessages.length + 1; // +1 为即将添加的消息
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
    
    // 尝试发送请求
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.maxRetries) {
      try {
        if (retries > 0) {
          console.info(`[LLM] 重试 ${retries}/${this.maxRetries}...`);
        }
        
        const startTime = Date.now();
        const requestURL = `${this.baseURL}/chat/completions`;
        
        // Prepare request payload
        const requestPayload: any = {
          model: this.model,
          messages: messages,
          temperature: temperature
        };
        
        // 使用OpenAI原生响应格式设置，而不是在提示中重复请求
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
        console.info(`[LLM] 请求成功，耗时 ${requestTime}ms`);
        
        const data = response.data as LLMResponse;
        
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          const responseContent = data.choices[0].message.content;
          const responseLength = responseContent.length;
          
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
              
              console.info(`[LLM] 会话 ${sessionId} 已达到最大长度，截断历史消息以保持 ${this.maxContextLength} 条消息`);
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
          }
          
          // For JSON responses, validate that the response is actually JSON
          if (requireJson) {
            try {
              // Check if it looks like JSON (basic validation)
              if (!(responseContent.trim().startsWith('{') || responseContent.trim().startsWith('['))) {
                console.warn(`[LLM] 警告：期望JSON响应但收到非JSON内容，将尝试解析`);
              }
              // Try parsing to validate (we don't use the result, just checking)
              JSON.parse(responseContent);
            } catch (e) {
              console.error(`[LLM] 错误：收到的JSON无效: ${(e as Error).message}`);
              // Still return the response, as our parseJsonResponse will try harder to extract valid JSON
            }
          }
          
          return responseContent;
        } else {
          console.error(`[LLM] 错误：从API接收到的响应格式不正确`);
          throw new AppError('Incorrect LLM response format', ErrorType.API);
        }
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        // 更简洁地记录错误信息
        console.error(`[LLM] 请求失败 (${retries}/${this.maxRetries + 1}): ${lastError.message}`);
        
        if (axios.isAxiosError(error) && error.response) {
          console.error(`[LLM] 状态码: ${error.response.status}, 错误: ${JSON.stringify(error.response.data)}`);
        } else if (axios.isAxiosError(error) && error.request) {
          console.error(`[LLM] 网络错误: ${error.message}`);
        }
        
        // 如果失败且有重试次数，等待一段时间后重试
        if (retries <= this.maxRetries) {
          const delay = 1000 * retries; // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试失败，抛出错误
    console.error(`[LLM] 全部 ${this.maxRetries + 1} 次尝试均失败`);
    throw new AppError(
      `LLM request failed (attempted ${this.maxRetries + 1} times): ${lastError?.message}`,
      ErrorType.API,
      lastError || undefined
    );
  }
  
  /**
   * 清除会话上下文
   * @param sessionId 要清除的会话ID
   * @returns 是否成功清除
   */
  clearSessionContext(sessionId: string): boolean {
    // 清除会话上下文
    const result = this.sessionContexts.delete(sessionId);
    // 同时清除会话元数据
    this.sessionMetadata.delete(sessionId);
    return result;
  }
  
  /**
   * 导出会话上下文，用于保存和恢复
   * @param sessionId 会话ID
   * @returns 包含会话消息和元数据的对象
   */
  exportSessionContext(sessionId: string): { messages: LLMMessage[], metadata: SessionMetadata | undefined } | null {
    if (!this.sessionContexts.has(sessionId)) {
      return null;
    }
    
    return {
      messages: [...(this.sessionContexts.get(sessionId) || [])],
      metadata: this.sessionMetadata.get(sessionId)
    };
  }
  
  /**
   * 导入会话上下文，用于恢复保存的会话
   * @param sessionId 会话ID
   * @param context 包含会话消息和元数据的对象
   * @returns 是否成功导入
   */
  importSessionContext(sessionId: string, context: { messages: LLMMessage[], metadata?: SessionMetadata }): boolean {
    if (!context.messages || !Array.isArray(context.messages)) {
      return false;
    }
    
    // 导入会话消息
    this.sessionContexts.set(sessionId, [...context.messages]);
    
    // 导入会话元数据，如果有的话
    if (context.metadata) {
      this.sessionMetadata.set(sessionId, {
        ...context.metadata,
        lastUsedAt: new Date() // 更新最后使用时间为当前时间
      });
    }
    
    return true;
  }
  
  /**
   * 获取当前活跃会话列表
   * @returns 会话ID列表
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionContexts.keys());
  }
  
  /**
   * 获取会话详情
   * @param sessionId 会话ID
   * @returns 会话信息，包括消息数量和最后使用时间
   */
  getSessionInfo(sessionId: string): { 
    exists: boolean, 
    messageCount: number, 
    lastUsedAt: Date | null,
    language: string | null,
    metadata: SessionMetadata | null
  } {
    if (!this.sessionContexts.has(sessionId)) {
      return { exists: false, messageCount: 0, lastUsedAt: null, language: null, metadata: null };
    }
    
    const messages = this.sessionContexts.get(sessionId) || [];
    const metadata = this.sessionMetadata.get(sessionId) || null;
    
    return {
      exists: true,
      messageCount: messages.length,
      lastUsedAt: metadata?.lastUsedAt || null,
      language: metadata?.language || null,
      metadata
    };
  }
  
  /**
   * 清理超过指定时间未使用的会话
   * @param maxAgeInMinutes 最大闲置时间（分钟）
   * @returns 清理的会话数量
   */
  cleanupInactiveSessions(maxAgeInMinutes: number = 60): number {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      if (metadata.lastUsedAt) {
        const minutesSinceLastUse = (now.getTime() - metadata.lastUsedAt.getTime()) / (1000 * 60);
        
        if (minutesSinceLastUse > maxAgeInMinutes) {
          this.clearSessionContext(sessionId);
          cleanedCount++;
        }
      }
    }
    
    return cleanedCount;
  }
  
  /**
   * 解析LLM响应中的JSON数据
   * @param response LLM返回的响应
   * @returns 解析后的JSON对象
   */
  parseJsonResponse<T>(response: string): T {
    try {
      // 尝试提取JSON部分
      let jsonString = response.trim();
      
      // 如果响应包含代码块，提取其中的JSON
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        console.info(`[LLM] 从代码块中提取JSON内容`);
        jsonString = jsonMatch[1].trim();
      }
      
      // 如果JSON字符串没有以 { 开始或 } 结束，尝试找到有效的JSON部分
      if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
        const jsonStartPos = jsonString.indexOf('{');
        const arrayStartPos = jsonString.indexOf('[');
        
        if (jsonStartPos >= 0 || arrayStartPos >= 0) {
          const startPos = (jsonStartPos >= 0 && arrayStartPos >= 0) 
            ? Math.min(jsonStartPos, arrayStartPos) 
            : Math.max(jsonStartPos, arrayStartPos);
          
          jsonString = jsonString.substring(startPos);
        }
      }
      
      // 尝试找到最后一个闭合括号
      if (jsonString.includes('{')) {
        let lastClosingBrace = jsonString.lastIndexOf('}');
        if (lastClosingBrace !== -1) {
          // 确保我们不截断有效JSON
          jsonString = jsonString.substring(0, lastClosingBrace + 1);
        }
      } else if (jsonString.includes('[')) {
        let lastClosingBracket = jsonString.lastIndexOf(']');
        if (lastClosingBracket !== -1) {
          jsonString = jsonString.substring(0, lastClosingBracket + 1);
        }
      }
      
      // Check for balanced braces/brackets
      const openBraces = (jsonString.match(/{/g) || []).length;
      const closeBraces = (jsonString.match(/}/g) || []).length;
      const openBrackets = (jsonString.match(/\[/g) || []).length;
      const closeBrackets = (jsonString.match(/\]/g) || []).length;
      
      if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
        console.warn(`[LLM] 警告：JSON括号不平衡 (${openBraces}:{, ${closeBraces}:}, ${openBrackets}:[, ${closeBrackets}:])，尝试修复`);
        // 尝试寻找最后一个完整的JSON对象
        const completeJson = this.findCompleteJsonObject(jsonString);
        if (completeJson) {
          jsonString = completeJson;
        }
      }
      
      // 解析JSON
      const parsedJson = JSON.parse(jsonString);
      
      // 检查并处理常见的字段名称不匹配问题
      const result = this.normalizeJsonResponse<T>(parsedJson);
      
      return result;
    } catch (error) {
      console.error(`[LLM] JSON解析失败: ${(error as Error).message}`);
      throw new AppError(
        `Cannot parse JSON returned by LLM: ${(error as Error).message}`,
        ErrorType.VALIDATION,
        error as Error
      );
    }
  }
  
  /**
   * 规范化JSON响应中的字段名
   * 处理LLM可能返回的不一致字段名
   * @param parsedJson 已解析的JSON对象
   * @returns 规范化后的对象
   */
  private normalizeJsonResponse<T>(parsedJson: any): T {
    // 如果不是对象，或是数组，直接返回
    if (typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
      return parsedJson as T;
    }
    
    const normalizedJson: any = { ...parsedJson };
    
    // 处理常见字段名不一致的情况
    const fieldMappings: Record<string, string[]> = {
      // IntentAnalysisResult中的字段映射
      'highValueKeywords': ['topKeywords', 'highValueKeywords', 'top_keywords', 'high_value_keywords', 'valueKeywords'],
      'intentDistribution': ['intentAnalysis', 'intentDistribution', 'intent_distribution', 'intent_analysis', 'intents'],
      
      // AnalysisPlanResult中的字段映射
      'recommendedQueries': ['recommendedQueries', 'queries', 'recommended_queries', 'recommendations'],
      
      // EvaluationDimensions中的字段映射
      'longTailValue': ['longTailValue', 'long_tail_value', 'longTail', 'long_tail'],
      'commercialValue': ['commercialValue', 'commercial_value', 'commercial', 'monetizationValue'],
      'searchVolumePotential': ['searchVolumePotential', 'search_volume_potential', 'searchVolume', 'search_volume'],
      'goalAchievement': ['goalAchievement', 'goal_achievement', 'goalCompletion']
    };
    
    // 对每个预期字段，检查是否有同义字段
    for (const [targetField, alternativeFields] of Object.entries(fieldMappings)) {
      // 如果目标字段已存在，跳过
      if (normalizedJson[targetField] !== undefined) continue;
      
      // 检查是否存在任何同义字段
      for (const altField of alternativeFields) {
        if (normalizedJson[altField] !== undefined) {
          normalizedJson[targetField] = normalizedJson[altField];
          console.info(`[LLM_INFO] Mapped field "${altField}" to "${targetField}"`);
          break;
        }
      }
    }
    
    // 检查categories字段，可能有不同的格式或名称
    if (normalizedJson.categories === undefined) {
      if (normalizedJson.keywordCategories) {
        normalizedJson.categories = normalizedJson.keywordCategories;
      } else if (normalizedJson.category || normalizedJson.categoryMap) {
        normalizedJson.categories = normalizedJson.category || normalizedJson.categoryMap;
      }
    }
    
    // 检查dimensions字段，可能存在不同的拼写或格式
    if (normalizedJson.dimensions === undefined && normalizedJson.scores) {
      normalizedJson.dimensions = normalizedJson.scores;
    }
    
    return normalizedJson as T;
  }
  
  /**
   * 查找完整的JSON对象
   * @param text 包含可能不完整JSON的文本
   * @returns 找到的完整JSON字符串
   */
  private findCompleteJsonObject(text: string): string | null {
    // For object: Find the first { and matching } with proper nesting
    if (text.includes('{')) {
      return this.findBalancedStructure(text, '{', '}');
    }
    // For array: Find the first [ and matching ] with proper nesting
    else if (text.includes('[')) {
      return this.findBalancedStructure(text, '[', ']');
    }
    return null;
  }
  
  /**
   * 查找平衡的结构 (如对象或数组)
   * @param text 文本
   * @param openChar 开始字符
   * @param closeChar 结束字符
   * @returns 找到的平衡结构
   */
  private findBalancedStructure(text: string, openChar: string, closeChar: string): string | null {
    const startIndex = text.indexOf(openChar);
    if (startIndex === -1) return null;
    
    let balance = 1;
    let i = startIndex + 1;
    
    while (i < text.length && balance > 0) {
      if (text[i] === openChar) balance++;
      else if (text[i] === closeChar) balance--;
      i++;
    }
    
    // If we found a balanced structure
    if (balance === 0) {
      return text.substring(startIndex, i);
    }
    
    return null;
  }
  
  /**
   * 格式化带有占位符的提示模板
   * @param template 模板字符串
   * @param values 替换值
   * @returns 格式化后的提示
   */
  formatPrompt(template: string, values: Record<string, any>): string {
    console.info(`[LLM_INFO] Formatting prompt template with ${Object.keys(values).length} values`);
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return values[trimmedKey] !== undefined ? String(values[trimmedKey]) : match;
    });
  }
}