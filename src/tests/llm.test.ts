import { LLMServiceHub } from '../llm/LLMServiceHub';
import { config } from '../config';

describe('LLMServiceHub', () => {
  let llmService: LLMServiceHub;

  beforeEach(() => {
    // 确保环境变量已设置
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'your-api-key'; // 仅用于测试
    }
    
    // 创建LLM服务实例
    llmService = new LLMServiceHub({
      model: config.llm.defaultModel,
      verbose: true
    });
  });

  it('应该能成功分析内容并获取回复', async () => {
    // 准备测试数据
    const testData = {
      query: '如何学习编程',
      task: 'Analyze the search intent for this query'
    };
    
    try {
      // 使用analyze方法替代旧的sendPrompt
      const response = await llmService.analyze('intent_analysis', testData, {
        temperature: 0.5,
        format: 'text'
      });
      
      // 验证响应
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      
      console.log('LLM响应:', response);
    } catch (error) {
      fail(`LLM调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  it('应该能分析内容并获取JSON格式的响应', async () => {
    // 准备测试数据
    const testData = {
      keyword: '编程学习',
      suggestions: ['Python编程入门', 'JavaScript基础教程']
    };

    try {
      // 使用analyze方法获取JSON格式的响应
      const response = await llmService.analyze('category_identification', testData, {
        temperature: 0.3,
        format: 'json',
        systemPrompt: 'You are an expert at categorizing search queries. Respond with valid JSON.'
      });
      
      // 验证JSON响应
      expect(response).toBeDefined();
      expect(typeof response).toBe('object');
      
      console.log('LLM JSON响应:', response);
    } catch (error) {
      fail(`LLM JSON调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
});