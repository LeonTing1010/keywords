/**
 * debug-report.js - 专门调试报告生成功能的脚本
 */
const fs = require('fs').promises;
const path = require('path');

// 简单的日志工具
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || '')
};

// 报告模拟数据
const mockData = {
  input: {
    keyword: "AI Agent"
  },
  keywordDiscovery: {
    discoveredKeywords: Array(15).fill(null).map((_, i) => ({ keyword: `keyword${i}`, score: Math.random() })),
    potentialUnmetNeeds: [
      { keyword: "AI Agent开发", confidence: 0.8, reason: "用户对如何开发AI Agent有强烈需求" },
      { keyword: "AI Agent框架", confidence: 0.9, reason: "用户希望找到合适的AI Agent开发框架" }
    ],
    insights: [
      { description: "AI Agent技术正在迅速发展", type: "trend", confidence: 0.9 },
      { description: "市场上缺乏针对初学者的AI Agent教程", type: "gap", confidence: 0.8 }
    ],
    statistics: { averageConfidence: 0.85 }
  },
  journeySimulation: {
    painPoints: [
      { description: "难以找到高质量的AI Agent开发教程", severity: 4 },
      { description: "现有框架文档不够清晰", severity: 3 }
    ],
    opportunities: [
      { description: "创建针对初学者的AI Agent开发指南", potentialValue: 4 },
      { description: "开发更易用的AI Agent框架", potentialValue: 5 }
    ],
    insights: [
      { title: "搜索行为分析", description: "用户倾向于先搜索概念，再查找具体实现方法" }
    ],
    metrics: { satisfactionScore: 3.5 }
  },
  contentAnalysis: {
    unmetNeeds: [
      { keyword: "AI Agent开发教程", isUnmetNeed: true, contentQuality: 0.4, marketGapSeverity: 0.7 },
      { keyword: "AI Agent框架比较", isUnmetNeed: true, contentQuality: 0.5, marketGapSeverity: 0.8 }
    ],
    concreteUnmetNeeds: [
      { keyword: "AI Agent入门指南", description: "针对初学者的AI Agent开发全流程指南", potentialValue: 5 }
    ],
    marketInsights: [
      { title: "教育机会", description: "AI Agent开发教育内容存在巨大市场空白" }
    ],
    statistics: { 
      unmetNeedsCount: 2, 
      averageContentQuality: 0.45, 
      averageMarketGapSeverity: 0.75 
    }
  },
  executionMetadata: {
    startTime: Date.now() - 60000,
    elapsedTimeMs: 60000
  }
};

class ReportGenerator {
  constructor(options = {}) {
    this.format = options.format || 'markdown';
    this.language = options.language || 'zh';
    this.outputDir = options.outputDir || './output';
    this.includeDetails = options.includeDetails || false;
  }

  // 生成Markdown格式报告
  async generateMarkdownReport(data) {
    try {
      logger.debug('Generating markdown report - start');
      
      // 创建Markdown内容
      const markdown = `# AI Agent市场分析报告

## 摘要

本报告分析了关键词"${data.input.keyword}"的市场状况，发现了${data.contentAnalysis.unmetNeeds.length}个未满足需求和${data.contentAnalysis.marketInsights.length}个市场洞察。

## 关键发现

- 发现了${data.keywordDiscovery.discoveredKeywords.length}个相关关键词
- 平均内容质量评分: ${data.contentAnalysis.statistics.averageContentQuality.toFixed(2)}
- 平均市场空白严重程度: ${data.contentAnalysis.statistics.averageMarketGapSeverity.toFixed(2)}

## 未满足需求分析

${data.contentAnalysis.unmetNeeds.map(need => `- **${need.keyword}**: 内容质量评分 ${need.contentQuality.toFixed(2)}, 市场空白评分 ${need.marketGapSeverity.toFixed(2)}`).join('\n')}

## 市场机会

${data.contentAnalysis.concreteUnmetNeeds.map(need => `- **${need.keyword}**: ${need.description} (潜在价值: ${need.potentialValue})`).join('\n')}

## 用户痛点

${data.journeySimulation.painPoints.map(point => `- ${point.description} (严重度: ${point.severity})`).join('\n')}

## 建议

1. 创建高质量的AI Agent开发教程，特别是针对初学者
2. 提供更清晰的框架比较和选择指南
3. 开发针对特定场景的AI Agent模板和案例

## 技术生成信息

- 报告生成时间: ${new Date().toISOString()}
- 分析关键词: ${data.input.keyword}
- 分析数据来源: 关键词探索、用户旅程分析、内容质量评估`;

      return markdown;
    } catch (error) {
      logger.error('Failed to generate markdown report', error);
      return `# 分析报告\n\n生成报告时出现错误：${error.message}\n\n请联系技术支持获取更多信息。`;
    }
  }

  // 生成JSON格式报告
  generateJsonReport(data) {
    try {
      logger.debug('Generating JSON report - start');
      
      const report = {
        keyword: data.input.keyword,
        timestamp: new Date().toISOString(),
        summary: {
          discoveredKeywordsCount: data.keywordDiscovery.discoveredKeywords.length,
          unmetNeedsCount: data.contentAnalysis.unmetNeeds.filter(n => n.isUnmetNeed).length,
          painPointsCount: data.journeySimulation.painPoints.length,
          opportunitiesCount: data.contentAnalysis.concreteUnmetNeeds.length
        },
        details: {
          keywordDiscovery: this.includeDetails ? data.keywordDiscovery : {
            insights: data.keywordDiscovery.insights
          },
          contentAnalysis: this.includeDetails ? data.contentAnalysis : {
            unmetNeeds: data.contentAnalysis.unmetNeeds.filter(n => n.isUnmetNeed),
            marketInsights: data.contentAnalysis.marketInsights
          }
        },
        metadata: {
          format: this.format,
          language: this.language,
          includesDetails: this.includeDetails
        }
      };
      
      return JSON.stringify(report, null, 2);
    } catch (error) {
      logger.error('Failed to generate JSON report', error);
      return JSON.stringify({ error: error.message });
    }
  }

  // 保存报告到文件
  async saveReport(content, keyword) {
    try {
      logger.debug(`Saving report to file - start (content length: ${content.length})`);
      
      // 确保输出目录存在
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
      const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const extension = this.format === 'markdown' ? 'md' : 'json';
      const fileName = `TEST_${safeKeyword}_${timestamp}.${extension}`;
      
      // 完整文件路径
      const filePath = path.join(this.outputDir, fileName);
      
      // 同时创建一个固定名称的文件，便于查看最新报告
      const latestReportPath = path.join(this.outputDir, `latest_report.${extension}`);
      
      logger.debug(`Will save report to: ${filePath}`);
      logger.debug(`Will also save to latest report: ${latestReportPath}`);
      
      // 写入文件
      await fs.writeFile(filePath, content, 'utf8');
      await fs.writeFile(latestReportPath, content, 'utf8');
      
      logger.info(`Report saved successfully to ${filePath}`);
      logger.info(`Latest report saved to ${latestReportPath}`);
      
      return filePath;
    } catch (error) {
      logger.error('Failed to save report', error);
      throw error;
    }
  }

  // 执行报告生成
  async execute(data) {
    try {
      logger.info('Starting report generation');
      const startTime = Date.now();
      
      // 生成报告内容
      let reportContent;
      if (this.format === 'markdown') {
        reportContent = await this.generateMarkdownReport(data);
      } else {
        reportContent = this.generateJsonReport(data);
      }
      
      // 保存报告
      const reportPath = await this.saveReport(reportContent, data.input.keyword);
      
      // 计算统计信息
      const generationTimeMs = Date.now() - startTime;
      
      logger.info(`Report generation completed in ${generationTimeMs}ms`);
      return {
        reportPath,
        reportContent,
        format: this.format,
        generationTimeMs
      };
    } catch (error) {
      logger.error('Report generation failed', error);
      return {
        error: error.message,
        errorStack: error.stack
      };
    }
  }
}

// 主函数
async function main() {
  try {
    logger.info('Starting debug script for report generation');
    
    // 创建报告生成器实例（可以尝试不同配置）
    const generator = new ReportGenerator({
      format: process.env.FORMAT || 'markdown',
      language: process.env.LANGUAGE || 'zh',
      outputDir: './output',
      includeDetails: true
    });
    
    // 运行报告生成
    const result = await generator.execute(mockData);
    
    // 输出结果
    if (result.error) {
      logger.error('Report generation failed', result);
    } else {
      logger.info('Report generation succeeded', {
        format: result.format,
        reportPath: result.reportPath,
        generationTimeMs: result.generationTimeMs,
        contentLength: result.reportContent.length
      });
    }
  } catch (error) {
    logger.error('Unexpected error in main function', error);
  }
}

// 运行主函数
main(); 