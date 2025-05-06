/**
 * 测试脚本: 生成Markdown和HTML格式的关键词分析报告
 * 
 * 用法:
 * npm run ts-node test-scripts/generate-markdown-report.ts <keyword> [language]
 * 
 * 例如:
 * npm run ts-node test-scripts/generate-markdown-report.ts "人工智能" zh
 * npm run ts-node test-scripts/generate-markdown-report.ts "artificial intelligence" en
 */

import * as path from 'path';
import * as fs from 'fs';
import { WorkflowResult } from '../src/core/WorkflowController';
import { MarkdownReporter } from '../src/tools/markdownReporter';

// 命令行参数处理
const keyword = process.argv[2] || '数字营销';
const language = (process.argv[3] || 'zh') as 'zh' | 'en';
const outputDir = path.join(process.cwd(), 'output', 'reports');

console.log(`开始生成关键词 "${keyword}" 的分析报告 (${language})...`);

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 运行分析工作流
async function run() {
  try {
    // 如果有已保存的分析结果，则加载它，否则使用示例数据
    let result: WorkflowResult;
    const cacheFile = path.join(outputDir, `${keyword.replace(/\s+/g, '_')}_analysis.json`);
    
    if (fs.existsSync(cacheFile)) {
      console.log(`加载已有的分析结果: ${cacheFile}`);
      result = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } else {
      console.log(`没有找到现有分析结果，使用示例数据...`);
      // 创建一个简单的示例数据
      result = createSampleData(keyword);
      
      // 保存示例数据供将来使用
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`示例数据已保存到: ${cacheFile}`);
    }
    
    // 使用MarkdownReporter生成报告
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
    const outputFilename = `${keyword.replace(/\s+/g, '_')}_report_${timestamp}.md`;
    const outputPath = path.join(outputDir, outputFilename);
    
    const reporter = new MarkdownReporter({
      language: language,
      theme: 'light',
      outputHtml: true
    });
    
    // 生成报告
    const reportPath = await reporter.generateReport(result, outputPath);
    console.log(`报告生成成功!`);
    console.log(`- Markdown报告: ${reportPath}`);
    console.log(`- HTML报告: ${reportPath.replace(/\.md$/, '.html')}`);
    
  } catch (error) {
    console.error('报告生成过程中发生错误:', error);
    process.exit(1);
  }
}

/**
 * 创建示例分析数据
 * @param keyword 关键词
 * @returns 示例WorkflowResult对象
 */
function createSampleData(keyword: string): WorkflowResult {
  // 基于关键词生成一些相关的示例关键词
  const relatedKeywords = [
    `${keyword} 教程`,
    `${keyword} 入门`,
    `${keyword} 工具`,
    `${keyword} 平台`,
    `${keyword} 技巧`,
    `${keyword} 案例`,
    `${keyword} 趋势`,
    `${keyword} 最佳实践`,
    `${keyword} 优化`,
    `${keyword} 方法`,
    `如何学习 ${keyword}`,
    `${keyword} 对比`,
    `${keyword} 排名`,
    `${keyword} 费用`,
    `免费 ${keyword}`,
  ];
  
  // 创建示例旅程步骤
  const journeySteps = [
    {
      query: keyword,
      intentType: "informational",
      reasoning: "初始探索这个领域的基础知识",
    },
    {
      query: `${keyword} 入门`,
      intentType: "informational",
      reasoning: "寻找入门指南和基础教程",
    },
    {
      query: `${keyword} 工具`,
      intentType: "commercial",
      reasoning: "想了解有哪些可用的工具",
    },
    {
      query: `最佳 ${keyword} 工具对比`,
      intentType: "commercial investigation",
      reasoning: "比较不同工具的优缺点",
    },
    {
      query: `如何选择 ${keyword} 平台`,
      intentType: "commercial investigation",
      reasoning: "寻找选择平台的标准和建议",
    },
    {
      query: `${keyword} 案例分析`,
      intentType: "informational",
      reasoning: "查看成功案例以获取实践启示",
    }
  ];
  
  // 创建示例决策点
  const decisionPoints = [
    {
      step: 0,
      reasoning: "从基础知识向入门教程过渡，表明用户需要实操指导",
    },
    {
      step: 1,
      reasoning: "从入门向工具探索过渡，表明用户已理解基础，准备尝试工具",
    },
    {
      step: 2,
      reasoning: "从单一工具向比较多个工具过渡，表明用户正在进行购买决策",
    },
    {
      step: 3,
      reasoning: "从工具比较到选择标准，表明用户接近做出决策",
    },
    {
      step: 4,
      reasoning: "从选择到案例分析，表明用户希望了解实际应用场景",
    }
  ];
  
  // 创建示例迭代
  const iterations = [
    {
      iterationNumber: 0,
      query: keyword,
      queryType: "initial",
      discoveries: relatedKeywords.slice(0, 5),
      newDiscoveriesCount: 5,
      satisfactionScore: 0.6
    },
    {
      iterationNumber: 1,
      query: `${keyword} 入门`,
      queryType: "refined",
      discoveries: relatedKeywords.slice(5, 10),
      newDiscoveriesCount: 5,
      satisfactionScore: 0.8
    },
    {
      iterationNumber: 2,
      query: `${keyword} 工具`,
      queryType: "refined",
      discoveries: relatedKeywords.slice(10),
      newDiscoveriesCount: 5,
      satisfactionScore: 0.9
    }
  ];
  
  // 创建完整的示例数据
  return {
    keyword,
    iterations,
    discoveredKeywords: relatedKeywords,
    journeyAnalysis: {
      steps: journeySteps,
      decisionPoints
    },
    summary: {
      keywordCounts: {
        total: relatedKeywords.length,
        byIteration: iterations.map(it => it.discoveries.length)
      }
    },
    generatedAt: new Date().toISOString(),
    version: "3.0.0"
  };
}

// 运行主函数
run(); 