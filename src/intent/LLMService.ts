/**
 * KeywordNova LLM服务
 * 提供与语言模型的交互能力
 */
import axios from 'axios';
import { LLMServiceOptions } from '../types';
import { config } from '../config';
import { ErrorType, AppError } from '../core/errorHandler';

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
 * LLM服务
 * 封装与大型语言模型的交互
 */
export class LLMService {
  private apiKey: string;
  private model: string;
  private timeout: number;
  private maxRetries: number;
  private coreValueDescription: string;
  
  /**
   * 创建LLM服务实例
   * @param options LLM服务配置选项
   */
  constructor(options?: LLMServiceOptions) {
    this.apiKey = options?.apiKey || config.llm.apiKey;
    this.model = options?.model || config.llm.defaultModel;
    this.timeout = options?.timeout || config.llm.timeout;
    this.maxRetries = options?.maxRetries || config.llm.maxRetries;
    
    // KeywordNova core values and functionality description for enhancing LLM context
    this.coreValueDescription = `
KeywordNova is an advanced user intent mining and long-tail keyword discovery system designed to help marketers, content creators, and SEO experts by:

1. Precise traffic acquisition - Uncovering numerous low-competition but high cumulative traffic long-tail search terms
2. User intent analysis - Deep analysis of real needs and behavior patterns behind searches
3. Intelligent content planning - Providing data-driven content gap and opportunity identification
4. Commercial value assessment - Automatically identifying commercial intent keywords with high conversion potential
5. Competitive differentiation - Discovering keyword gaps that competitors may overlook

The system's core functionalities include:
- Iterative keyword discovery through multi-round searches
- AI-powered intent analysis to understand user motivation
- Intelligent keyword categorization (informational, commercial, problem-solving)
- High-value keyword identification
- Comprehensive pattern analysis and recommendations

When analyzing keywords, consider these dimensions:
- Search intent (informational, navigational, commercial, transactional)
- Commercial value and conversion potential
- Content creation opportunities
- Long-tail characteristics (specificity, niche relevance)
- Search volume potential vs. competition
`;
    
    // 检查API密钥
    if (!this.apiKey) {
      console.warn('LLM API key not set. Please ensure the OPENAI_API_KEY environment variable is set or provide apiKey in configuration');
    }
  }
  
  /**
   * 发送提示到语言模型并获取回复
   * @param prompt 提示文本
   * @param systemPrompt 系统提示
   * @returns LLM生成的回复
   */
  async sendPrompt(
    prompt: string, 
    systemPrompt = 'You are a professional SEO and search intent analysis expert, skilled at extracting patterns and discovering insights from keywords.'
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
    
    // Enhance the system prompt with core values information
    const enhancedSystemPrompt = `${systemPrompt}\n\n${this.coreValueDescription}`;
    
    // 尝试发送请求
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.maxRetries) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: this.model,
            messages: [
              {
                role: 'system',
                content: enhancedSystemPrompt
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: this.timeout
          }
        );
        
        const data = response.data as LLMResponse;
        
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          return data.choices[0].message.content;
        } else {
          throw new AppError('Incorrect LLM response format', ErrorType.API);
        }
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        // 如果失败且有重试次数，等待一段时间后重试
        if (retries <= this.maxRetries) {
          const delay = 1000 * retries; // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试失败，抛出错误
    throw new AppError(
      `LLM request failed (attempted ${this.maxRetries + 1} times): ${lastError?.message}`,
      ErrorType.API,
      lastError || undefined
    );
  }
  
  /**
   * 解析LLM响应中的JSON数据
   * @param response LLM返回的响应
   * @returns 解析后的JSON对象
   */
  parseJsonResponse<T>(response: string): T {
    try {
      // 尝试提取JSON部分
      let jsonString = response;
      
      // 如果响应包含代码块，提取其中的JSON
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }
      
      // 解析JSON
      return JSON.parse(jsonString.trim()) as T;
    } catch (error) {
      console.error('JSON parsing failed, original response:', response);
      throw new AppError(
        `Cannot parse JSON returned by LLM: ${(error as Error).message}`,
        ErrorType.VALIDATION,
        error as Error
      );
    }
  }
  
  /**
   * 格式化带有占位符的提示模板
   * @param template 模板字符串
   * @param values 替换值
   * @returns 格式化后的提示
   */
  formatPrompt(template: string, values: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return values[trimmedKey] !== undefined ? String(values[trimmedKey]) : match;
    });
  }
} 