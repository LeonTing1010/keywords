import { LLMService } from '../intent/LLMService';
import { config } from '../config';

describe('LLMService', () => {
  let llmService: LLMService;

  beforeEach(() => {
    // 确保环境变量已设置
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'your-api-key'; // 仅用于测试
    }
    
    // 创建LLM服务实例，使用config中的配置
    llmService = new LLMService();
    
    // 输出配置信息用于调试
    console.log(`[TEST] Using LLM model: ${config.llm.defaultModel}`);
    console.log(`[TEST] Using BaseURL: ${config.llm.baseURL}`);
  });

  it('应该能成功发送提示并获取回复', async () => {
    // 准备一个简单的测试提示
    const testPrompt = '分析以下关键词的搜索意图："如何学习编程"';
    
    try {
      // 发送提示到LLM
      const response = await llmService.sendPrompt(testPrompt);
      
      // 验证响应
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      
      console.log('LLM响应:', response);
    } catch (error) {
      fail(`LLM调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('应该能正确格式化提示模板', () => {
    const template = config.llm.promptTemplates.identifyCategories;
    const values = {
      originalKeyword: '编程学习',
      suggestions: ['Python编程入门', 'JavaScript基础教程']
    };

    const formattedPrompt = llmService.formatPrompt(template, values);

    expect(formattedPrompt).toContain('编程学习');
    expect(formattedPrompt).toContain('Python编程入门');
    expect(formattedPrompt).toContain('JavaScript基础教程');
  });

  it('应该能解析JSON响应', () => {
    const jsonResponse = `{
      "categories": {
        "教程指南": ["Python编程入门", "JavaScript基础教程"],
        "信息查询": ["编程语言比较", "最流行的编程语言"]
      }
    }`;

    interface CategoryResponse {
      categories: {
        [key: string]: string[];
      };
    }

    const parsed = llmService.parseJsonResponse<CategoryResponse>(jsonResponse);
    
    expect(parsed).toHaveProperty('categories');
    expect(parsed.categories).toHaveProperty('教程指南');
    expect(Array.isArray(parsed.categories['教程指南'])).toBe(true);
  });
});