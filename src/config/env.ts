import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载.env.local文件
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 确定基础URL
function getBaseURL(model: string): string {
  // 如果明确提供了基础URL，则使用环境变量中的
  if (process.env.LLM_BASE_URL) {
    return process.env.LLM_BASE_URL;
  }
  
  // 根据模型类型自动选择适当的基础URL
  if (model.startsWith('anthropic/') || model.startsWith('claude')) {
    return 'https://api.anthropic.com/v1';
  } else {
    // 默认使用OpenAI
    return 'https://api.openai.com/v1';
  }
}

// 获取模型名称
const modelName = process.env.LLM_MODEL || 'gpt-4';

// 环境变量配置
export const envConfig = {
  // LLM服务配置
  llm: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: getBaseURL(modelName),
    model: modelName,
  },
  
  // 调试模式
  debug: process.env.DEBUG === 'true',
};

// 验证必需的环境变量
export function validateEnvConfig() {
  const requiredVars = ['OPENAI_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missingVars.join(', ')}`);
  }
  
  // 打印当前配置信息
  console.info(`[ENV_CONFIG] LLM Model: ${envConfig.llm.model}`);
  console.info(`[ENV_CONFIG] LLM BaseURL: ${envConfig.llm.baseURL}`);
}