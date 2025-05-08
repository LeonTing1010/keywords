import * as path from 'path';
import { EnhancedWorkflowResult, StartupAnalysis } from '../../domain/analysis/types/AnalysisTypes';
import { logger } from '../../infrastructure/core/logger';
import { MarkdownReporter } from '../../infrastructure/reporting/MarkdownReporter';
import { StartupAnalyzer } from '../../domain/analysis/StartupAnalyzer';

interface KeywordReportOptions {
  format: 'json' | 'markdown';
  language: 'zh' | 'en';
  engine: 'baidu' | 'google';
  model: string;
  temperature: number;
  verbose: boolean;
  preserveKeywords?: string[];
  outputDir?: string;
}

/**
 * Enhanced report service with keyword preservation support
 */
export class KeywordReportService {
  private analyzer: StartupAnalyzer;

  constructor() {
    this.analyzer = new StartupAnalyzer();
  }

  /**
   * Generate a keyword-aware report
   */
  public async generateKeywordReport(
    workflowResult: EnhancedWorkflowResult,
    options: KeywordReportOptions
  ): Promise<{
    analysis: StartupAnalysis;
    reportPath: string;
  }> {
    try {
      // Configure analyzer with options
      this.analyzer.configure({
        model: options.model,
        temperature: options.temperature,
        engine: options.engine,
        verbose: options.verbose
      });

      // Perform analysis
      const analysis = await this.analyzer.analyzeOpportunity(workflowResult);

      // Configure the keyword-aware markdown reporter
      const reporter = new MarkdownReporter({
        language: options.language,
        preserveKeywords: options.preserveKeywords
      });

      // Generate output path
      const outputDir = options.outputDir || './output';
      const formattedDate = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
      const safeKeyword = workflowResult.keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const uniqueId = Math.random().toString(36).substring(2, 6);
      const reportFileName = `KR_${safeKeyword}_${formattedDate}_${uniqueId}.md`;
      const outputPath = path.join(outputDir, reportFileName);

      // Generate the report
      const reportPath = await reporter.generateReport(analysis, workflowResult, outputPath);

      logger.info('关键词报告生成完成', { 
        keyword: workflowResult.keyword,
        language: options.language,
        preservedKeywords: options.preserveKeywords,
        outputPath: reportPath
      });

      return { analysis, reportPath };
    } catch (error) {
      logger.error('生成关键词报告失败', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Failed to generate keyword analysis report');
    }
  }
} 