/**
 * LLMServiceHub - 大语言模型服务中心
 * 统一管理与大语言模型的交互，提供标准化的接口
 */
import * as crypto from 'crypto';
import { logger } from '../../infra/logger';
import { JsonEnforcedLLMProvider } from './JsonEnforcedLLMProvider';
import { 
  LLMMessage, 
  LLMOptions, 
  LLMProvider, 
  LLMServiceConfig, 
  AnalyzeOptions 
} from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

// 添加用于保存调试日志的函数
const saveDebugLog = async (prefix: string, content: string): Promise<string> => {
  try {
    const debugDir = path.join(process.cwd(), 'logs', 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
    const filename = `${prefix}_${timestamp}_${Math.random().toString(36).substring(2, 6)}.log`;
    const filePath = path.join(debugDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  } catch (error) {
    logger.error('Failed to save debug log', { error });
    return '';
  }
};

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
      
      // 保存提示词用于调试
      if (prompt.length > 200) {
        const logPath = await saveDebugLog('llm_prompt', prompt);
        if (logPath) {
          logger.debug('分析提示词已保存到文件', { logPath });
        }
        logger.debug('分析提示词（摘要）', { promptPreview: prompt.substring(0, 200) + '...' });
      } else {
        logger.debug('分析提示词', { prompt });
      }
      
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
          // 根据模型选择API
          if (model.includes('qwen') || model.includes('Qwen')) {
            response = await this.callQwenAPI(prompt, temperature, options);
          } else if (model.includes('claude') || model.includes('Claude')) {
            response = await this.callClaudeAPI(prompt, temperature, options);
          } else {
            response = await this.callOpenAIAPI(prompt, temperature, options);
          }
          
          // 如果响应包含错误信息，抛出异常
          if (response && response.error) {
            throw new Error(`API Error: ${response.error.message || JSON.stringify(response.error)}`);
          }

          logger.info('LLM调用输出', { 
            model, 
            source: analysisType, 
            output: JSON.stringify(response).substring(0, 200) + (JSON.stringify(response).length > 200 ? '...' : '') 
          });
          
          logger.debug(`LLM API调用成功 [${requestId}]`, {});

          try {
            // 解析响应格式
            const parsedResponse = await this.parseResponse(response, options.format || 'json');
            
            // 检查JSON解析结果
            if (options.format === 'json' && options.strictFormat === true) {
              // 检查是否返回了raw字段，这意味着JSON解析失败
              if (parsedResponse.raw && typeof parsedResponse.raw === 'string') {
                logger.warn('LLM返回的JSON格式无效', { 
                  parseError: true,
                  rawPreview: parsedResponse.raw.substring(0, 100) + '...',
                  analysisType
                });
                throw new Error('JSON格式验证失败');
              }
              
              // 检查返回的内容是否符合基本结构
              if (parsedResponse && 
                  (typeof parsedResponse !== 'object' || 
                   Array.isArray(parsedResponse) || 
                   Object.keys(parsedResponse).length === 0)) {
                logger.warn('LLM返回的JSON格式不符合预期结构', {
                  responseType: typeof parsedResponse,
                  isArray: Array.isArray(parsedResponse),
                  keyCount: typeof parsedResponse === 'object' ? Object.keys(parsedResponse).length : 0
                });
                throw new Error('JSON结构验证失败');
              }
            }
            
            return parsedResponse;
          } catch (formatError: any) {
            // 如果是格式错误且需要严格格式，我们应该重试
            if (options.format === 'json' && (options.strictFormat === true || 
                formatError.message === 'JSON格式验证失败' || 
                formatError.message === 'JSON结构验证失败')) {
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
            (error.message === 'JSON格式验证失败' || 
             error.message === 'JSON结构验证失败' || 
             (typeof error.message === 'string' && error.message.includes('JSON'))));
          
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
       error.message === 'JSON结构验证失败' ||
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
  private async parseResponse(response: any, format: 'json' | 'text' | 'markdown' = 'json'): Promise<any> {
    // 记录原始响应用于调试
    const responseStr = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
    logger.debug('解析LLM原始响应', { 
      format,
      responseType: typeof response,
      responseLength: responseStr.length,
      previewContent: responseStr.substring(0, 100) + (responseStr.length > 100 ? '...' : '')
    });
    
    // 如果响应过长，保存到调试日志文件
    if (responseStr.length > 500) {
      const logPath = await saveDebugLog('llm_response', responseStr);
      if (logPath) {
        logger.debug('完整LLM响应已保存到文件', { logPath });
      }
    }
    
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
          logger.debug('直接JSON解析失败，尝试清理格式', { error: e instanceof Error ? e.message : String(e) });
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
            const result = JSON.parse(cleanedResponse);
            logger.debug('Markdown代码块清理后解析成功', { 
              originalLength: response.length,
              cleanedLength: cleanedResponse.length,
              resultKeys: Object.keys(result)
            });
            return result;
          }
        } catch (e) {
          logger.debug('Markdown代码块清理后仍无法解析', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // 3. 尝试提取所有JSON对象
        try {
          const possibleJsonObjects = response.match(/(\{[\s\S]*?\})/g);
          if (possibleJsonObjects && possibleJsonObjects.length > 0) {
            // 尝试每个找到的JSON对象
            for (const jsonStr of possibleJsonObjects) {
              try {
                const parsed = JSON.parse(jsonStr);
                logger.debug('成功提取并解析JSON对象', { 
                  objectLength: jsonStr.length,
                  resultKeys: Object.keys(parsed)
                });
                return parsed;
              } catch {
                // 继续尝试下一个
                continue;
              }
            }
          }
        } catch (e) {
          logger.debug('尝试提取多个JSON对象失败', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // 4. 尝试修复常见的JSON格式问题
        try {
          // 修复单引号替换为双引号
          const fixedQuotes = response.replace(/(\w+)\'(\w+)/g, '$1\\"$2').replace(/'/g, '"');
          // 修复缺少引号的属性名
          const fixedProps = fixedQuotes.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          
          if (fixedProps !== response) {
            logger.debug('尝试修复JSON格式问题');
            const result = JSON.parse(fixedProps);
            logger.debug('JSON格式修复后解析成功', { 
              originalLength: response.length,
              fixedLength: fixedProps.length
            });
            return result;
          }
        } catch (e) {
          logger.debug('尝试修复JSON格式问题失败', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // 5. 尝试从Markdown内容中提取表格、列表等结构化内容
        try {
          // 检测是否包含Markdown标记
          if (response.includes('#') || response.includes('*') || response.includes('|')) {
            logger.debug('检测到可能是Markdown内容，尝试转换为结构化数据');
            
            // 简单提取标题结构
            const titles = response.match(/#+\s+(.+)/g);
            const sections: Record<string, string> = {};
            
            if (titles && titles.length > 0) {
              let currentTitle = '';
              response.split(/#+\s+(.+)/g).forEach((part, i) => {
                if (i % 2 === 1) { // 奇数项是标题
                  currentTitle = part.trim();
                  sections[currentTitle] = '';
                } else if (i > 0 && currentTitle) { // 偶数项是内容
                  sections[currentTitle] += part.trim();
                }
              });
              
              logger.debug('成功从Markdown提取结构化内容', { sectionCount: Object.keys(sections).length });
              return { 
                type: 'markdown',
                sections,
                raw: response 
              };
            }
          }
        } catch (e) {
          logger.debug('尝试提取Markdown结构失败', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // 所有尝试都失败，记录警告并保存原始响应以便调试
        const logPath = await saveDebugLog('json_parse_failed', response);
        logger.warn('所有JSON解析方法均失败，原始响应已保存', { 
          responsePreview: response.substring(0, 150) + (response.length > 150 ? '...' : ''),
          logPath
        });
        
        // 返回带原始内容的对象
        return { 
          raw: response,
          parseError: true,
          timestamp: new Date().toISOString()
        };
      }
      
      // 非JSON格式，直接返回
      return { content: response };
    }
    
    // 其他类型响应
    return { data: response };
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