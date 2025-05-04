import { SearchOptions } from '../types';
import * as path from 'path';
import * as os from 'os';

// 导出全局配置对象
export const config = {
  // LLM相关配置
  llm: {
    apiKey: process.env.OPENAI_API_KEY || '',
    defaultModel: 'gpt-4',
    timeout: 60000, // 毫秒
    maxRetries: 3,
    promptTemplates: {
      identifyCategories: `分析以下关键词列表，识别主要的意图类别和搜索模式。
原始关键词: {{originalKeyword}}
建议列表:
{{suggestions}}

请将这些关键词分类为以下几类，并提供每类的示例:
1. 信息查询类 (用户想了解信息)
2. 问题解决类 (用户有特定问题需要解决)
3. 商业交易类 (用户有购买或比较意图)
4. 教程指南类 (用户想学习如何做某事)
5. 定义解释类 (用户想了解概念含义)

请以JSON格式返回，每个类别包含关键词数组。`,

      generateQueries: `基于以下初始关键词和搜索建议，生成10个最有可能发现有价值长尾关键词的新查询。
原始关键词: {{originalKeyword}}
搜索建议:
{{suggestions}}

设计能够发现更多长尾关键词的战略性查询。
请考虑:
1. 不同的用户意图角度
2. 问题和解决方案模式
3. 特定子主题深度挖掘
4. 商业和转化意图

返回JSON格式的查询列表，并为每个查询提供选择理由。`,

      evaluateIteration: `评估以下关键词迭代结果的质量和价值。

原始关键词: {{originalKeyword}}
本次迭代目标: {{iterationGoals}}
本次迭代发现的新关键词数量: {{newKeywordsCount}}

请从以下7个维度评分(1-10分)，并提供分析:

1. 相关性(20%): 新发现的关键词与原始主题的相关程度
2. 长尾价值(25%): 关键词的具体性和长尾特征
3. 商业价值(15%): 关键词包含购买意向或转化潜力
4. 多样性(15%): 覆盖不同角度、意图和子主题
5. 新颖性(10%): 与之前发现的关键词相比的独特性
6. 搜索量潜力(10%): 预估的搜索量和用户需求
7. 迭代目标达成率(5%): 本次迭代目标的完成程度

新发现的关键词(示例):
{{keywordSamples}}

请提供整体评分(基于加权平均)和是否应继续迭代的建议。
以JSON格式返回评分和分析。`,

      finalReport: `为以下长尾关键词挖掘项目生成最终分析报告。

原始关键词: {{originalKeyword}}
总关键词数: {{totalKeywords}}
迭代次数: {{iterationCount}}

请分析这些关键词并生成综合报告，包括:
1. 主要关键词类别和分布
2. 高价值长尾关键词推荐(10-15个)
3. 主要用户搜索意图分析
4. 内容机会和建议
5. 最具商业价值的关键词组

请以JSON格式返回完整分析。`
    }
  },
  
  // 迭代引擎配置
  iterativeEngine: {
    maxIterations: 5,
    defaultSatisfactionThreshold: 0.85,
    minNewKeywordsPerIteration: 10,
    evaluationWeights: {
      relevance: 0.20,
      longTailValue: 0.25,
      commercialValue: 0.15,
      diversity: 0.15, 
      novelty: 0.10,
      searchVolumePotential: 0.10,
      goalAchievement: 0.05
    }
  },
  
  // 搜索选项默认值
  searchDefaults: {
    batchSize: 26,
    retryCount: 2,
    maxSecondaryKeywords: 10,
    maxResults: 300,
    delayBetweenQueries: { min: 1000, max: 3000 }
  } as Partial<SearchOptions>,
  
  // 输出目录配置
  output: {
    dir: process.env.OUTPUT_DIR || path.join(process.cwd(), 'output'),
    formats: ['json', 'csv', 'md']
  },
  
  // 调试配置
  debug: {
    enabled: process.env.DEBUG === 'true',
    verbose: process.env.VERBOSE === 'true',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};

// 导出默认配置
export default config; 