/**
 * MockLLMService.ts - Mock LLM service
 * Used for testing, returns preset mock data
 */

import { BaseLLMService } from '../../core/llm/LLMService';
import { LLMServiceConfig, ChatMessage, LLMRequestOptions } from '../../types/schemas';
import { v4 as uuidv4 } from 'uuid';
import { ValidationService } from '../../utils/ValidationService';

/**
 * Mock LLM service class
 * Implements the LLMService interface for testing
 */
export class MockLLMService extends BaseLLMService {
  // 预设响应
  private mockResponses: Record<string, any> = {
    // 搜索自动补全
    'searchAutocompletes': [
      '远程办公 工具',
      '远程办公 如何提高效率',
      '远程办公 团队协作软件',
      '远程办公 视频会议哪个好',
      '远程办公 安全问题',
      '远程办公 最佳实践',
      '远程办公 如何避免孤独感',
      '远程办公 时间管理',
      '远程办公 设备推荐'
    ],
    // 问题挖掘
    'mineProblems': [
      {
        "title": "远程办公导致的工作与生活界限模糊",
        "description": "远程工作使得工作和个人生活的界限变得模糊，许多人发现自己难以\"下班\"，导致工作时间延长、休息不足和潜在的职业倦怠。",
        "category": ["工作生活平衡", "心理健康"],
        "userScale": 8,
        "severity": 7
      },
      {
        "title": "远程团队沟通效率低下",
        "description": "远程工作环境下，团队成员之间的沟通往往依赖于文字或视频会议，缺乏面对面交流的即时性和丰富性，导致信息传递效率降低、误解增加。",
        "category": ["团队协作", "沟通"],
        "userScale": 9,
        "severity": 8
      },
      {
        "title": "远程办公网络安全隐患",
        "description": "员工在家中网络环境工作可能导致企业数据安全风险增加，包括不安全的Wi-Fi网络、个人设备的使用和物理安全管控缺失等问题。",
        "category": ["网络安全", "数据保护"],
        "userScale": 7,
        "severity": 9
      }
    ],
    // 人工智能相关问题
    'aiProblems': [
      {
        "title": "AI隐私和数据安全问题",
        "description": "人工智能系统需要大量数据进行训练，这引发了用户隐私保护和数据安全的重大担忧，尤其是在健康、金融等敏感领域。",
        "category": ["隐私保护", "数据安全"],
        "userScale": 9,
        "severity": 9
      },
      {
        "title": "AI决策过程缺乏透明度和可解释性",
        "description": "现代AI系统尤其是深度学习模型往往是黑盒操作，其决策过程难以解释，这在医疗诊断、司法判决等关键应用中造成信任和责任归属问题。",
        "category": ["可解释AI", "伦理"],
        "userScale": 8,
        "severity": 8
      },
      {
        "title": "AI技能使用门槛高",
        "description": "尽管AI技术发展迅速，但普通开发者和企业用户使用高级AI能力的门槛仍然很高，包括专业知识需求、算力成本和集成复杂性等方面。",
        "category": ["技术普及", "工具易用性"],
        "userScale": 7,
        "severity": 6
      }
    ],
    // 问题排序
    'rankProblems': [
      {
        "id": "test-id-1",
        "overallValue": 85,
        "universality": 9,
        "severity": 8,
        "urgency": 8,
        "solvability": 7,
        "marketOpportunity": 9
      },
      {
        "id": "test-id-2",
        "overallValue": 75,
        "universality": 8,
        "severity": 7,
        "urgency": 7,
        "solvability": 8,
        "marketOpportunity": 8
      }
    ]
  };

  /**
   * Constructor
   */
  constructor() {
    super({
      model: 'mock-model',
      temperature: 0.7,
      maxTokens: 1000,
      apiKey: 'mock-api-key',
    });
  }

  /**
   * Internal chat implementation
   * @param messages List of chat messages
   * @param options Options
   * @returns Completion message
   */
  protected async chatInternal(messages: ChatMessage[], options?: LLMRequestOptions): Promise<ChatMessage> {
    // Simply return a mock response based on the last message
    const lastMessage = messages[messages.length - 1];
    const isCritique = lastMessage.content.toLowerCase().includes('critique') || 
                       lastMessage.content.toLowerCase().includes('评价') ||
                       lastMessage.content.toLowerCase().includes('批评');
    const isEvidence = lastMessage.content.toLowerCase().includes('evidence') || 
                       lastMessage.content.toLowerCase().includes('证据');
    const isSolution = lastMessage.content.toLowerCase().includes('solution') || 
                       lastMessage.content.toLowerCase().includes('解决方案');
    const isValue = lastMessage.content.toLowerCase().includes('value') || 
                    lastMessage.content.toLowerCase().includes('价值');
    const isSummary = lastMessage.content.toLowerCase().includes('summary') || 
                      lastMessage.content.toLowerCase().includes('总结');
    const isProblem = lastMessage.content.toLowerCase().includes('problem') || 
                      lastMessage.content.toLowerCase().includes('问题');

    let content = '';

    if (isProblem) {
      content = `我发现以下潜在问题:
1. 这个关键词可能面临性能优化挑战
2. 在移动设备上的适配问题
3. 缺乏易用的API接口
4. 与现有系统的集成困难
5. 学习曲线较陡峭`;
    } else if (isEvidence) {
      content = `收集到的证据:
1. 根据StackOverflow的讨论，有42%的开发者报告了这个问题
2. GitHub上有超过300个相关issue
3. 在Reddit的r/programming社区中，这是过去6个月中讨论最多的话题之一
4. 多个技术博客提到了这个挑战，但没有全面的解决方案`;
    } else if (isSolution) {
      content = `现有解决方案分析:
1. 方案A: 商业解决方案，成本高但完整
2. 方案B: 开源替代品，社区支持良好但功能有限
3. 方案C: 混合方案，灵活但需要更多定制`;
    } else if (isValue) {
      content = `价值评估:
- 市场规模: 7/10
- 紧迫性: 8/10
- 解决成本: 6/10
- 竞争强度: 4/10
- 增长潜力: 9/10
总体价值评分: 78/100`;
    } else if (isCritique) {
      content = `批判性分析:
- 这个问题可能被夸大了，实际影响范围有限
- 有些用户群体可能不受此问题影响
- 市场调研数据可能有采样偏差
- 在某些情况下，现有解决方案可能已经足够`;
    } else if (isSummary) {
      content = `总结:
这是一个价值评分为78/100的高价值问题，主要集中在性能优化和移动适配方面。现有解决方案存在明显不足，具有很好的市场潜力。建议进一步探索解决方案C，并考虑潜在的合作伙伴关系。`;
    } else {
      content = `对于您的询问"${lastMessage.content}"，我提供以下回复:

这是一个模拟回复，用于测试目的。实际部署时，这里将是真实LLM的回复内容。模拟服务不会进行实际的推理或处理，仅返回预设的回复内容。`;
    }

    return {
      role: 'assistant',
      content,
      metadata: {
        modelName: this.getModelName(),
        timestamp: Date.now(),
        requestId: uuidv4()
      }
    };
  }

  /**
   * Generate text embeddings
   * @param text Input text
   * @returns Mock embedding vector
   */
  async embedText(text: string): Promise<number[]> {
    // Generate a deterministic but seemingly random embedding based on the text
    const mockEmbedding: number[] = [];
    let seed = text.length;
    
    // Generate 1536 dimensions (similar to OpenAI embeddings)
    for (let i = 0; i < 1536; i++) {
      // Simple deterministic "random" number generator
      seed = (seed * 9301 + 49297) % 233280;
      const value = seed / 233280.0;
      
      // Normalize to small values typical for embeddings
      mockEmbedding.push((value - 0.5) * 0.1);
    }
    
    return mockEmbedding;
  }

  /**
   * Get the context window size (token count)
   * @returns The context window size
   */
  getContextWindowSize(): number {
    return 8192; // Mock a large context window
  }

  /**
   * 执行聊天完成
   * @param messages 消息列表
   * @param options 可选参数
   * @returns 完成的消息
   */
  async chat(messages: ChatMessage[], options?: any): Promise<ChatMessage> {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    let response = '这是一个模拟回复，用于测试目的。实际部署时，这里将是真实LLM的回复内容。模拟服务不会进行实际的推理或处理，仅返回预设的回复内容。';
    
    // 如果是挖掘问题的请求，返回相应的模拟数据
    if (userMessage.includes('挖掘潜在问题') || userMessage.includes('发现该领域中用户可能面临的')) {
      response = JSON.stringify(this.mockResponses['mineProblems']);
    } else if (userMessage.includes('生成30个可能的搜索引擎自动补全结果')) {
      response = JSON.stringify(this.mockResponses['searchAutocompletes']);
    }
    
    return {
      role: 'assistant',
      content: response,
      metadata: {
        timestamp: Date.now()
      }
    };
  }

  /**
   * 将聊天结果解析为JSON
   * @param messages 消息列表
   * @param jsonSchema 预期的JSON Schema
   * @param options 可选参数
   * @returns 解析后的JSON对象
   */
  async chatToJSON<T>(messages: ChatMessage[], jsonSchema: any, options?: any): Promise<T> {
    try {
      // 检查用户消息，返回相应的预设数据
      const userMessage = messages.find(m => m.role === 'user')?.content || '';
      let result: any;
      
      if (userMessage.includes('远程办公')) {
        if (userMessage.includes('生成30个可能的搜索引擎自动补全结果')) {
          return this.mockResponses['searchAutocompletes'] as unknown as T;
        } else if (userMessage.includes('挖掘潜在问题') || userMessage.includes('分析并发现该领域中用户可能面临的')) {
          return this.mockResponses['mineProblems'] as unknown as T;
        }
      } else if (userMessage.includes('人工智能')) {
        if (userMessage.includes('生成30个可能的搜索引擎自动补全结果')) {
          return this.mockResponses['searchAutocompletes'] as unknown as T;
        } else if (userMessage.includes('挖掘潜在问题') || userMessage.includes('分析并发现该领域中用户可能面临的')) {
          return this.mockResponses['aiProblems'] as unknown as T;
        }
      }
      
      if (userMessage.includes('评估以下问题的价值和重要性')) {
        return this.mockResponses['rankProblems'] as unknown as T;
      }
      
      // 默认返回空数组
      return [] as unknown as T;
    } catch (error) {
      console.error('MockLLMService chatToJSON模拟错误:', error);
      throw new Error(`chatToJSON调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新LLM配置
   * @param newConfig 新配置
   */
  updateConfig(newConfig: Partial<any>): void {
    this.config = { ...this.config, ...newConfig };
  }
}