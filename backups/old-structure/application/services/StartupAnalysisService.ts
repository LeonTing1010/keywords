import { EnhancedWorkflowResult, StartupAnalysis } from '../../domain/analysis/types/AnalysisTypes';
import { StartupAnalyzer } from '../../domain/analysis/StartupAnalyzer';
import { ReportGenerator } from '../../domain/report/ReportGenerator';

interface AnalysisOptions {
  format: 'json' | 'markdown';
  language: 'zh' | 'en';
  engine: 'baidu' | 'google';
  model: string;
  temperature: number;
  verbose: boolean;
  preserveKeywords?: string[];
}

export class StartupAnalysisService {
  private analyzer: StartupAnalyzer;
  private reportGenerator: ReportGenerator;

  constructor() {
    this.analyzer = new StartupAnalyzer();
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Analyze startup opportunity and generate report
   */
  public async analyzeAndGenerateReport(
    workflowResult: EnhancedWorkflowResult,
    options: AnalysisOptions
  ): Promise<{
    analysis: StartupAnalysis;
    report: string;
  }> {
    try {
      // Configure analyzer with options
      this.analyzer.configure({
        model: options.model,
        temperature: options.temperature,
        engine: options.engine,
        verbose: options.verbose
      });

      // Configure report generator
      this.reportGenerator.configure({
        language: options.language,
        format: options.format
      });

      // Perform analysis
      const analysis = await this.analyzer.analyzeOpportunity(workflowResult);

      // Generate report
      const report = this.reportGenerator.generateReport(analysis);

      return { analysis, report };
    } catch (error) {
      console.error('Error in startup analysis:', error);
      throw new Error('Failed to analyze startup opportunity and generate report');
    }
  }

  /**
   * Get raw analysis results without report generation
   */
  public async getAnalysis(workflowResult: EnhancedWorkflowResult, options: AnalysisOptions): Promise<StartupAnalysis> {
    try {
      // Configure analyzer with options
      this.analyzer.configure({
        model: options.model,
        temperature: options.temperature,
        engine: options.engine,
        verbose: options.verbose
      });

      return await this.analyzer.analyzeOpportunity(workflowResult);
    } catch (error) {
      console.error('Error in startup analysis:', error);
      throw new Error('Failed to analyze startup opportunity');
    }
  }

  /**
   * Generate report from existing analysis
   */
  public generateReport(analysis: StartupAnalysis, options: AnalysisOptions): string {
    try {
      // Configure report generator
      this.reportGenerator.configure({
        language: options.language,
        format: options.format
      });

      return this.reportGenerator.generateReport(analysis);
    } catch (error) {
      console.error('Error in report generation:', error);
      throw new Error('Failed to generate startup analysis report');
    }
  }
} 