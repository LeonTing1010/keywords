#!/usr/bin/env node
/**
 * KeywordIntent 配置检测工具
 * 用于验证和显示当前API相关的环境变量配置
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { table } from 'console';
import * as dns from 'dns';
import { logger } from '../core/logger';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * 检测并显示配置状态
 */
async function checkConfig() {
  console.log('KeywordIntent 配置检测工具\n');
  
  // 检查环境变量文件
  const envLocalExists = fs.existsSync(path.resolve(process.cwd(), '.env.local'));
  const envExists = fs.existsSync(path.resolve(process.cwd(), '.env'));
  
  console.log('环境变量文件状态:');
  console.log(`.env.local: ${envLocalExists ? '存在 ✅' : '不存在 ❌'}`);
  console.log(`.env: ${envExists ? '存在 ✅' : '不存在 ❌'}`);
  console.log('');
  
  // 检查关键环境变量
  const relevantVars = [
    'LLM_MODEL',
    'LLM_BASE_URL',
    'OPENAI_API_KEY',
    'OPENAI_API_BASE',
    'ANTHROPIC_API_KEY',
    'DASHSCOPE_API_KEY'
  ];
  
  const configValues: Record<string, string | null> = {};
  let hasApiKey = false;
  
  // 收集环境变量值
  relevantVars.forEach(varName => {
    const value = process.env[varName] || null;
    configValues[varName] = value;
    
    // 检查API密钥是否存在
    if ((varName.includes('API_KEY') || varName.includes('API_TOKEN')) && value) {
      hasApiKey = true;
    }
  });
  
  // 解析当前配置
  const currentModel = configValues['LLM_MODEL'] || 'gpt-4';
  let expectedApiKey = '';
  let expectedApiBase = '';
  
  if (currentModel.startsWith('qwen')) {
    expectedApiKey = 'DASHSCOPE_API_KEY';
    expectedApiBase = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  } else if (currentModel.startsWith('claude') || currentModel.startsWith('anthropic/')) {
    expectedApiKey = 'ANTHROPIC_API_KEY';
    expectedApiBase = 'https://api.anthropic.com/v1';
  } else {
    expectedApiKey = 'OPENAI_API_KEY';
    expectedApiBase = 'https://api.openai.com/v1';
  }
  
  // 显示当前配置
  console.log('当前配置:');
  const configData = [
    ['变量', '值', '状态'],
    ...relevantVars.map(varName => {
      const value = configValues[varName];
      const masked = value ? 
        (varName.includes('KEY') || varName.includes('TOKEN') ? 
          value.substring(0, 4) + '...' + value.substring(value.length - 4) : 
          value) : 
        '未设置';
      
      let status = value ? '✅' : '❌';
      
      // 如果是当前模型需要的API密钥，但没有设置
      if (varName === expectedApiKey && !value) {
        status = '❌ (需要)';
      }
      
      // 如果是BASE_URL且显式设置，检查格式
      if (varName.includes('BASE_URL') && value) {
        status = value.startsWith('http') ? '✅' : '❌ (无效URL)';
      }
      
      return [varName, masked, status];
    })
  ];
  
  table(configData);
  console.log('');
  
  // 模型分析
  console.log(`模型配置分析:`);
  console.log(`当前模型: ${currentModel}`);
  console.log(`所需API密钥: ${expectedApiKey}`);
  console.log(`所需API基础URL: ${expectedApiBase}`);
  console.log(`API密钥状态: ${configValues[expectedApiKey] ? '已设置 ✅' : '未设置 ❌'}`);
  console.log(`Base URL状态: ${(configValues['LLM_BASE_URL'] || '').includes(expectedApiBase) ? '正确 ✅' : '可能不匹配 ⚠️'}`);
  console.log('');
  
  // 尝试进行DNS解析
  console.log('DNS解析测试:');
  
  const urlsToCheck = [
    'api.openai.com',
    'dashscope.aliyuncs.com',
    'api.anthropic.com'
  ];
  
  for (const url of urlsToCheck) {
    try {
      const addresses = await dnsResolve(url);
      console.log(`${url}: 解析成功 ✅`);
      console.log(`  - IP地址: ${addresses.join(', ')}`);
    } catch (error) {
      console.log(`${url}: 解析失败 ❌ - ${(error as Error).message}`);
    }
  }
  
  console.log('');
  
  // 配置建议
  console.log('配置建议:');
  
  if (!envLocalExists && !envExists) {
    console.log('- 请创建.env.local文件设置必要的环境变量');
  }
  
  if (!hasApiKey) {
    console.log(`- 缺少必要的API密钥，请设置 ${expectedApiKey} 环境变量`);
  }
  
  if (currentModel.startsWith('qwen') && configValues['LLM_BASE_URL'] !== expectedApiBase) {
    console.log('- 使用qwen模型时，LLM_BASE_URL应设置为: https://dashscope.aliyuncs.com/compatible-mode/v1');
  }
  
  if (!configValues['LLM_MODEL']) {
    console.log('- 未设置LLM_MODEL，将使用默认值gpt-4');
  }
  
  console.log('');
  console.log('配置示例:');
  console.log('.env.local 文件内容示例:');
  console.log('```');
  console.log('# LLM配置');
  console.log(`LLM_MODEL=${currentModel}`);
  console.log(`LLM_BASE_URL=${expectedApiBase}`);
  console.log(`${expectedApiKey}=your_api_key_here`);
  console.log('```');
}

/**
 * 进行DNS解析
 */
function dnsResolve(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        reject(err);
      } else {
        resolve(addresses);
      }
    });
  });
}

// 运行检测
checkConfig().catch(error => {
  console.error('检测过程出错:', error);
}); 