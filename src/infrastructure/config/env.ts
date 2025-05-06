import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载.env.local文件
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true // 确保.env.local中的变量覆盖系统环境变量
});

// 确定基础URL
function getBaseURL(model: string): string {
  // 如果明确提供了基础URL，则使用环境变量中的
  if (process.env.LLM_BASE_URL) {
    return process.env.LLM_BASE_URL;
  }
  
  // 根据模型类型自动选择适当的基础URL
  if (model.includes('anthropic') || model.includes('claude')) {
    return 'https://api.anthropic.com/v1';
  } else if (model.includes('qwen') || model === 'qwen-plus') {
    return 'https://dashscope.aliyuncs.com/v1/chat/completions';
  } else {
    // 默认使用OpenAI
    return process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  }
}

// 获取模型名称，确保使用环境变量中指定的模型
const modelName = process.env.LLM_MODEL || 'gpt-4';

// 记录模型选择
console.log(`[ENV] 加载模型配置: ${modelName} (from ${process.env.LLM_MODEL ? '.env.local' : 'default'})`);

// 环境变量配置
export const envConfig = {
  // LLM服务配置
  llm: {
    apiKey: process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY || '',
    baseURL: getBaseURL(modelName),
    model: modelName,
  },
  
  // 调试模式
  debug: process.env.DEBUG === 'true',
};

// 验证必需的环境变量
export function validateEnvConfig() {
  // 根据不同模型类型验证不同的API密钥
  let requiredVars: string[] = [];
  
  if (envConfig.llm.model.includes('qwen')) {
    requiredVars = ['DASHSCOPE_API_KEY', 'OPENAI_API_KEY']; // 至少一个需要存在
  } else {
    requiredVars = ['OPENAI_API_KEY'];
  }
  
  // 检查是否至少存在一个所需的API密钥
  const hasRequiredApiKey = requiredVars.some(varName => !!process.env[varName]);
  
  if (!hasRequiredApiKey) {
    const missingVars = requiredVars.join(' 或 ');
    throw new Error(`缺少必需的API密钥: ${missingVars}`);
  }
  
  // 打印当前配置信息
  console.info(`[ENV_CONFIG] LLM Model: ${envConfig.llm.model}`);
  console.info(`[ENV_CONFIG] LLM BaseURL: ${envConfig.llm.baseURL}`);
}