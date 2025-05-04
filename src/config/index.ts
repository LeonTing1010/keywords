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

      nextIterationWithHistory: `基于当前关键词数据和历史迭代信息，为下一轮查询制定最佳策略。

原始关键词: {{originalKeyword}}
已收集关键词数量: {{keywordCount}}
当前迭代轮次: {{currentIteration}}

{{#if hasHistory}}
历史迭代摘要:
{{iterationHistory}}
{{/if}}

关键词样本:
{{keywordSamples}}

请分析当前数据和历史迭代结果，设计下一轮最优查询策略。考虑:

1. 历史迭代中效果最好的查询模式和关键词类型
2. 当前关键词覆盖中的空缺和弱点
3. 尚未探索但可能有价值的意图领域
4. 如何避免与历史查询重复或产生相似结果
5. 基于历史评估中表现较弱的维度进行针对性改进

请返回JSON格式的策略，包含以下字段:
- gaps: 发现的关键词空缺(字符串数组)
- patterns: 从历史和当前数据中识别的有效模式(字符串数组)
- targetGoals: 下一轮明确目标(字符串数组)
- recommendedQueries: 10个具体的推荐查询(字符串数组)，每个查询应能针对特定空缺

确保推荐的查询多样化，并利用历史迭代数据中最有效的模式。`,

      finalReport: `为以下长尾关键词挖掘项目生成最终分析报告。

原始关键词: {{originalKeyword}}
总关键词数: {{totalKeywords}}
迭代次数: {{iterationCount}}

{{#if hasHistory}}
迭代历史摘要:
{{iterationHistory}}
{{/if}}

关键词样本:
{{keywordSamples}}

请分析这些关键词并生成综合报告，包括:
1. 主要关键词类别和分布
2. 高价值长尾关键词推荐(10-15个)
3. 主要用户搜索意图分析
4. 内容机会和建议
5. 最具商业价值的关键词组

{{#if hasHistory}}
6. 基于迭代历史的关键见解和模式
7. 最有效的查询模式和最高质量的查询来源
{{/if}}

请以JSON格式返回完整分析，包含以下字段:
- categories: 按类别分组的关键词
- topKeywords: 推荐的高价值关键词列表
- intentAnalysis: 用户意图分析
- contentOpportunities: 内容创作机会
- commercialKeywords: 商业价值关键词
- summary: 总体分析摘要
{{#if hasHistory}}
- iterationInsights: 迭代过程中发现的关键见解
- bestPatterns: 最有效的查询模式
{{/if}}`
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