/**
 * 自适应问题发现脚本
 * 
 * 使用自适应方法运行问题发现流程，
 * 通过学习优化策略和阈值来提高发现高价值问题的效率。
 */
import { logger } from '../src/infra/logger';
import { runProblemDiscovery } from '../src/graphs/problem-discovery/ProblemDiscoveryGraph';
import * as fs from 'fs';
import * as path from 'path';

// 默认配置
const DEFAULT_CONFIG = {
  maxIterations: 3,
  maxProblems: 15,
  outputDir: './output/adaptive-discovery',
  format: 'markdown' as 'markdown' | 'json',
  language: 'zh' as 'zh' | 'en',
  trackAgents: true,
  adaptiveMode: true,
  learningRate: 0.05
};

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const keyword = args[0] || '';
  const configPath = args[1] || '';

  if (!keyword) {
    console.error('请提供关键词参数');
    console.log('使用方法: node run-adaptive-discovery.js <关键词> [配置文件路径]');
    process.exit(1);
  }

  // 加载配置
  let config = { ...DEFAULT_CONFIG };
  
  if (configPath && fs.existsSync(configPath)) {
    try {
      const configFileContent = fs.readFileSync(configPath, 'utf-8');
      const customConfig = JSON.parse(configFileContent);
      config = { ...config, ...customConfig };
    } catch (error) {
      console.error(`配置文件解析错误: ${error.message}`);
      process.exit(1);
    }
  }

  // 确保输出目录存在
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  // 运行自适应问题发现
  logger.info({ keyword, config }, `开始自适应问题发现流程，关键词: "${keyword}"`);
  
  try {
    const startTime = Date.now();
    
    // 运行问题发现
    const result = await runProblemDiscovery({
      ...config,
      keyword
    });
    
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    
    // 记录结果
    const resultsFilePath = path.join(
      config.outputDir, 
      `${keyword.replace(/\s+/g, '-')}-results.${config.format === 'json' ? 'json' : 'md'}`
    );
    
    if (config.format === 'json') {
      fs.writeFileSync(resultsFilePath, JSON.stringify(result, null, 2), 'utf-8');
    } else {
      // Markdown 格式输出
      const markdownContent = generateMarkdownReport(result, durationSeconds);
      fs.writeFileSync(resultsFilePath, markdownContent, 'utf-8');
    }
    
    logger.info({}, `自适应问题发现完成! 发现了 ${result.discoveredProblems.length} 个问题`);
    logger.info({}, `结果已保存到: ${resultsFilePath}`);
    console.log(`✅ 自适应问题发现完成! 发现了 ${result.discoveredProblems.length} 个问题`);
    console.log(`✅ 结果已保存到: ${resultsFilePath}`);
    
  } catch (error) {
    logger.error({ error }, `自适应问题发现失败: ${error.message}`);
    console.error(`❌ 自适应问题发现失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 生成Markdown格式的报告
 */
function generateMarkdownReport(result: any, durationSeconds: number): string {
  const problems = result.discoveredProblems || [];
  
  let markdown = `# 自适应问题发现报告\n\n`;
  markdown += `## 基本信息\n\n`;
  markdown += `- **关键词**: ${result.sourceKeyword}\n`;
  markdown += `- **发现问题数量**: ${problems.length}\n`;
  markdown += `- **迭代次数**: ${result.processingMetrics.totalIterations}\n`;
  markdown += `- **处理时间**: ${durationSeconds.toFixed(2)}秒\n`;
  markdown += `- **质量提升**: ${result.processingMetrics.qualityImprovement.toFixed(2)}点\n\n`;
  
  markdown += `## 发现的高价值问题\n\n`;
  
  // 按质量分数排序问题
  const sortedProblems = [...problems].sort(
    (a, b) => b.qualityScore.overall - a.qualityScore.overall
  );
  
  // 输出前10个问题的详细信息
  sortedProblems.slice(0, 10).forEach((problem, index) => {
    markdown += `### ${index + 1}. ${problem.currentFormulation}\n\n`;
    markdown += `- **质量分数**: ${problem.qualityScore.overall.toFixed(1)}/10\n`;
    markdown += `- **真实性**: ${problem.qualityScore.authenticity.toFixed(1)}\n`;
    markdown += `- **紧迫性**: ${problem.qualityScore.urgency.toFixed(1)}\n`;
    markdown += `- **规模**: ${problem.qualityScore.scale.toFixed(1)}\n`;
    markdown += `- **解决方案空缺**: ${problem.qualityScore.solutionGap.toFixed(1)}\n`;
    markdown += `- **可行性**: ${problem.qualityScore.feasibility.toFixed(1)}\n`;
    markdown += `- **领域**: ${problem.domain.join(', ')}\n`;
    
    if (problem.evidence.length > 0) {
      markdown += `\n#### 支持证据\n\n`;
      problem.evidence.slice(0, 3).forEach((evidence, i) => {
        markdown += `${i + 1}. **${evidence.type}**: ${evidence.content}\n`;
        markdown += `   相关性: ${evidence.relevanceScore.toFixed(2)}\n\n`;
      });
    }
    
    markdown += `\n`;
  });
  
  // 性能指标
  markdown += `## 性能指标\n\n`;
  markdown += `### 处理指标\n\n`;
  markdown += `- 初始问题数量: ${result.processingMetrics.initialProblemCount}\n`;
  markdown += `- 最终问题数量: ${result.processingMetrics.finalProblemCount}\n`;
  markdown += `- 合并执行次数: ${result.processingMetrics.mergesPerformed}\n`;
  markdown += `- 处理的反馈数: ${result.processingMetrics.feedbacksProcessed}\n`;
  
  // 迭代指标
  if (result.iterations && result.iterations.length > 0) {
    markdown += `\n### 迭代指标\n\n`;
    markdown += `| 迭代 | 时间戳 | 问题数量 | 平均质量 | 处理时间(ms) |\n`;
    markdown += `|------|--------|----------|----------|----------------|\n`;
    
    result.iterations.forEach(iteration => {
      markdown += `| ${iteration.iterationNumber} | ${iteration.timestamp} | ${iteration.problemCount} | ${iteration.averageQualityScore.toFixed(2)} | ${iteration.processingTimeMs} |\n`;
    });
  }
  
  return markdown;
}

// 执行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
}); 