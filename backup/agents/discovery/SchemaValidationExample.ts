/**
 * Schema验证示例文件
 * 演示如何使用SchemaValidator进行LLM响应验证
 */

import { z } from 'zod';
import { AgentLLMService } from '../../core/llm/AgentLLMService';
import { SchemaValidator,  } from '../../core/llm/SchemaValidator';

import { logger } from '../../infra/logger';
import { AgentLLMServiceExtensions } from '../../core/llm/extensions';

/**
 * 演示如何使用Schema验证的函数
 * 可以作为每个Agent中重构代码的参考
 */
export async function demoSchemaValidation(agentLLM: AgentLLMService): Promise<void> {
  // 1. 示例：使用Schema验证数组返回值
  const arrayResultExample = await demoArraySchemaValidation(agentLLM);
  logger.info({ result: arrayResultExample }, 'Schema validated array result');
  
  // 2. 示例：使用Schema验证对象返回值
  const objectResultExample = await demoObjectSchemaValidation(agentLLM);
  logger.info({ result: objectResultExample }, 'Schema validated object result');

  // 3. 新增：重构前后代码对比示例
  await demoBeforeAfterRefactoring(agentLLM);
}

/**
 * 演示数组Schema验证
 */
async function demoArraySchemaValidation(agentLLM: AgentLLMService): Promise<any[]> {
  // 定义响应的Schema
  const questionSchema = z.array(z.object({
    question: z.string(),
    originalQuery: z.string().optional(),
    isExpanded: z.boolean(),
    overallScore: z.number(),
    reasoning: z.string()
  }));
  
  // 创建提示词
  const prompt = `
    请生成3个关于人工智能的重要问题。
    每个问题需要包含问题本身、是否为扩展问题、整体重要性评分(1-10)，以及推理说明。
  `;
  
  try {
    // 使用SchemaValidator分析方法
    return await AgentLLMServiceExtensions.analyzeWithArraySchema(
      agentLLM,
      prompt,
      'demo-questions',
      questionSchema,
      {
        temperature: 0.7,
        defaultValue: [] // 解析失败时返回空数组
      }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to demonstrate array schema validation');
    return [];
  }
}

/**
 * 演示对象Schema验证
 */
async function demoObjectSchemaValidation(agentLLM: AgentLLMService): Promise<any> {
  // 定义响应的Schema
  const analysisSchema = z.object({
    topicName: z.string(),
    maturityLevel: z.number().min(1).max(10),
    keyPoints: z.array(z.string()),
    challenges: z.array(z.object({
      name: z.string(),
      severity: z.number().min(1).max(10)
    })),
    opportunities: z.array(z.string()),
    summary: z.string()
  });
  
  // 创建提示词
  const prompt = `
    请对人工智能技术进行分析，包含以下内容：
    - 主题名称
    - 成熟度级别(1-10)
    - 关键要点
    - 挑战(包含名称和严重程度1-10)
    - 机会
    - 总结
  `;
  
  const defaultValue = {
    topicName: "无法分析",
    maturityLevel: 5,
    keyPoints: ["无数据"],
    challenges: [{ name: "无数据", severity: 5 }],
    opportunities: ["无数据"],
    summary: "分析失败"
  };
  
  try {
    // 使用SchemaValidator分析方法
    return await AgentLLMServiceExtensions.analyzeWithObjectSchema(
      agentLLM,
      prompt,
      'demo-analysis',
      analysisSchema,
      {
        temperature: 0.7,
        defaultValue: defaultValue
      }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to demonstrate object schema validation');
    return defaultValue;
  }
}

/**
 * 演示重构前后的代码对比
 */
async function demoBeforeAfterRefactoring(agentLLM: AgentLLMService): Promise<void> {
  const keyword = "artificial intelligence";
  
  // 创建提示词
  const prompt = `
    Please analyze the keyword "${keyword}" and provide:
    1. Market opportunity score (1-10)
    2. Key insights (at least 3)
    3. Market trends
    4. Target audience
  `;
  
  logger.info({}, 'Refactoring Example: Before vs After');
  
  // ===== BEFORE: 典型的没有schema验证的代码 =====
  try {
    logger.info({}, 'BEFORE - Code without schema validation:');
    
    const result = await agentLLM.analyze(prompt, 'keyword-analysis', {
      format: 'json',
      temperature: 0.7
    });
    
    // 尝试解析响应
    let parsedResponse;
    
    if (typeof result === 'string') {
      parsedResponse = JSON.parse(result);
    } else if (result && result.content) {
      parsedResponse = typeof result.content === 'string' ? 
                     JSON.parse(result.content) : 
                     result.content;
    } else if (result && result.data) {
      parsedResponse = result.data;
    } else {
      parsedResponse = result;
    }
    
    // 验证字段存在性
    if (!parsedResponse || 
        typeof parsedResponse.opportunityScore !== 'number' || 
        !Array.isArray(parsedResponse.insights)) {
      logger.error({}, 'Invalid response format');
      parsedResponse = {
        opportunityScore: 0,
        insights: ['No valid insights found'],
        trends: [],
        targetAudience: []
      };
    }
    
    // 使用结果
    logger.info({
      score: parsedResponse.opportunityScore,
      insightsCount: parsedResponse.insights.length
    }, 'BEFORE - Analysis result'); 
  } catch (error) {
    logger.error({ error }, 'BEFORE - Error in analysis');
  }
  
  // ===== AFTER: 使用schema验证的重构代码 =====
  try {
    logger.info({}, 'AFTER - Code with schema validation:');
    
    // 1. 定义响应schema
    const analysisSchema = z.object({
      opportunityScore: z.number().min(1).max(10),
      insights: z.array(z.string()),
      trends: z.array(z.string()),
      targetAudience: z.array(z.string())
    });
    
    // 2. 定义默认值
    const defaultValue = {
      opportunityScore: 0,
      insights: ['No valid insights found'],
      trends: [],
      targetAudience: []
    };
    
    // 3. 使用SchemaValidator
    const result = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
      agentLLM,
      prompt,
      'keyword-analysis',
      analysisSchema,
      {
        temperature: 0.7,
        defaultValue: defaultValue
      }
    );
    
    // 4. 直接使用结果 - 完全类型安全
    logger.info({
      score: result.opportunityScore,
      insightsCount: result.insights.length,
      // 无需额外验证即可安全访问这些字段
      firstInsight: result.insights[0],
      audienceCount: result.targetAudience.length
    }, 'AFTER - Analysis result');
  } catch (error) {
    logger.error({ error }, 'AFTER - Error in analysis');
  }
}

/**
 * 展示如何处理常见的复杂场景
 */
export function commonRefactoringExamples(): string {
  return `
  // 场景1: 将Array.forEach重构为类型安全的循环
  
  // 重构前:
  const results = await agentLLM.analyze(prompt, 'analysis-type', { format: 'json' });
  let parsedResults;
  try {
    parsedResults = JSON.parse(results);
  } catch (e) {
    parsedResults = [];
  }
  
  if (Array.isArray(parsedResults)) {
    parsedResults.forEach(item => {
      if (item && item.name) {
        console.log(item.name);
      }
    });
  }
  
  // 重构后:
  const itemSchema = z.object({
    name: z.string(),
    value: z.number()
  });
  
  const items = await AgentLLMServiceExtensions.analyzeWithArraySchema(
    agentLLM,
    prompt,
    'analysis-type',
    z.array(itemSchema),
    {
      temperature: 0.7,
      defaultValue: []
    }
  );
  
  // 完全类型安全的循环，items[i].name 保证存在
  items.forEach(item => console.log(item.name, item.value));
  
  // 场景2: 重构现有 Agent 中的方法
  
  // 重构前:
  private async extractAndExpandQuestions(keyword: string, suggestions: any[]): Promise<any[]> {
    // 系统提示
    const systemPrompt = "你是一个专业的问题分析专家...";
    
    // 用户提示
    const userPrompt = \`分析关键词: "\${keyword}"\`;
    
    // 使用 agentLLM
    const agentLLM = this.model as AgentLLMService;
    
    // 调用LLM
    const result = await agentLLM.analyze(\`\${systemPrompt}\n\n\${userPrompt}\`, 'extract-questions', {
      format: 'json'
    });
    
    // 尝试解析响应
    try {
      let parsedResponse;
      if (typeof result === 'string') {
        parsedResponse = JSON.parse(result);
      } else if (result.content) {
        parsedResponse = typeof result.content === 'string' ? 
                       JSON.parse(result.content) : 
                       result.content;
      } else {
        parsedResponse = result;
      }
      
      if (Array.isArray(parsedResponse)) {
        return parsedResponse;
      }
      
      return [];
    } catch (error) {
      logger.error({ error }, 'Failed to extract questions');
      return [];
    }
  }
  
  // 重构后:
  private async extractAndExpandQuestions(keyword: string, suggestions: any[]): Promise<any[]> {
    // 1. 定义问题数组的schema
    const questionSchema = z.array(z.object({
      question: z.string(),
      originalQuery: z.string().optional(),
      isExpanded: z.boolean(),
      overallScore: z.number(),
      reasoning: z.string()
    }));
    
    // 系统提示和用户提示
    const systemPrompt = "你是一个专业的问题分析专家...";
    const userPrompt = \`分析关键词: "\${keyword}"\`;
    const finalPrompt = \`\${systemPrompt}\n\n\${userPrompt}\`;
    
    // 使用AgentLLMService
    const agentLLM = this.model as AgentLLMService;
    
    // 2. 使用SchemaValidator分析方法
    return await AgentLLMServiceExtensions.analyzeWithArraySchema(
      agentLLM,
      finalPrompt,
      'extract-questions',
      questionSchema,
      {
        temperature: 0.7,
        defaultValue: []
      }
    );
  }
  
  // 场景3: 使用直接集成到AgentLLMService的方法
  
  // 重构前:
  const result = await agentLLM.analyze(prompt, 'analysis-type', { format: 'json' });
  
  // 重构后，使用内置验证方法:
  const schema = z.object({
    title: z.string(),
    summary: z.string(),
    score: z.number()
  });
  
  const result = await agentLLM.analyzeWithSchema(
    prompt,
    'analysis-type',
    schema,
    {
      temperature: 0.7,
      defaultValue: { title: '', summary: '', score: 0 }
    }
  );
  `;
}

// 使用示例：
// import { demoSchemaValidation } from './SchemaValidationExample';
// 
// async function someAgentMethod() {
//   const agentLLM = this.model as AgentLLMService;
//   await demoSchemaValidation(agentLLM);
// } 