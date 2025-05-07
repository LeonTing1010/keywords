import { LLMServiceHub, LLMProvider, LLMMessage } from '../src/infrastructure/llm/LLMServiceHub';
import { JsonEnforcedLLMProvider } from '../src/infrastructure/llm/JsonEnforcedLLMProvider';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 示例：使用JSON强制LLM提供者
 * 
 * 本示例展示如何使用JsonEnforcedLLMProvider来确保LLM返回有效的JSON格式
 */
async function runExample() {
  console.log('🚀 JSON强制LLM提供者示例');
  
  // 创建基础LLM服务
  const llmService = new LLMServiceHub();
  
  // 方法1: 使用工厂方法创建JSON强制提供者
  // 这种方法符合OOP原则，通过工厂模式创建特定功能对象
  const provider = {
    call: async (messages: any, options: any) => {
      const prompt = messages.map((m: any) => m.content).join('\n');
      // 直接调用analyze方法
      return await llmService.analyze(prompt, 'example', options);
    },
    getName: () => 'ExampleProvider'
  } as LLMProvider;
  
  const jsonEnforcedProvider = llmService.createJsonEnforcedProvider(provider, 3);
  
  // 方法2: 直接使用JsonEnforcedLLMProvider
  // 更灵活的方式，可以包装任何LLM提供者
  const directJsonProvider = new JsonEnforcedLLMProvider(provider, 3);
  
  // 分析请求示例 - 需要JSON格式
  const jsonPrompt: LLMMessage[] = [
    { role: 'system', content: '你是一个JSON格式助手。你需要返回有效的JSON格式响应。' },
    { role: 'user', content: '请提供一个包含3个用户数据的JSON对象列表，每个用户有id、name和email字段。' }
  ];
  
  // 普通文本请求示例
  const textPrompt: LLMMessage[] = [
    { role: 'system', content: '你是一个有用的助手。' },
    { role: 'user', content: '简要解释什么是JSON？' }
  ];
  
  try {
    console.log('\n📋 测试JSON格式请求（强制JSON格式）:');
    const jsonResponse = await jsonEnforcedProvider.call(jsonPrompt, {
      format: 'json',
      strictFormat: true
    });
    
    console.log('✅ 响应 (已解析为有效JSON):', JSON.parse(jsonResponse));
    
    console.log('\n📋 测试文本格式请求（不强制JSON格式）:');
    const textResponse = await directJsonProvider.call(textPrompt, {
      format: 'text'
    });
    
    console.log('✅ 文本响应:', textResponse);
    
    // 测试格式错误重试
    console.log('\n📋 测试格式错误重试:');
    console.log('强制失败情况通常需要模拟，实际LLM可能会正确响应');
    
  } catch (error) {
    console.error('❌ 错误:', error);
  }
}

// 运行示例
runExample().catch(console.error);

/**
 * 使用说明:
 * 
 * 1. 在需要确保JSON格式的地方使用JsonEnforcedLLMProvider
 * 2. 对于关键业务流程中的JSON解析，强烈建议使用strictFormat=true
 * 3. 该提供者会自动重试，直到获得有效的JSON格式响应
 * 
 * 示例使用方法:
 * - 创建一个新的LLMServiceHub实例
 * - 使用createJsonEnforcedProvider创建一个JSON强制提供者
 * - 调用时设置format='json'和strictFormat=true
 */ 