import { StartupAnalysisService } from '../../application/services/StartupAnalysisService';
import { EnhancedWorkflowResult } from '../../domain/analysis/types/AnalysisTypes';
import * as fs from 'fs/promises';
import * as path from 'path';

interface AnalysisOptions {
  format: 'json' | 'markdown';
  language: 'zh' | 'en';
  engine: 'baidu' | 'google';
  model: string;
  temperature: number;
  verbose: boolean;
}

export class AnalysisCLI {
  private analysisService: StartupAnalysisService;

  constructor() {
    this.analysisService = new StartupAnalysisService();
  }

  /**
   * Run analysis for a keyword and save report
   */
  public async run(keyword: string, outputDir: string, options: AnalysisOptions): Promise<void> {
    try {
      // Create workflow result from keyword
      const workflowResult: EnhancedWorkflowResult = {
        keyword,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // Perform analysis and generate report
      const { analysis, report } = await this.analysisService.analyzeAndGenerateReport(workflowResult, options);

      // Save results
      await this.saveResults(analysis, report, outputDir, keyword, options.format);

      console.log('Analysis completed successfully!');
      console.log(`Results saved in: ${outputDir}`);
    } catch (error) {
      console.error('Error running analysis:', error);
      process.exit(1);
    }
  }

  private async saveResults(
    analysis: any,
    report: string,
    outputDir: string,
    keyword: string,
    format: 'json' | 'markdown'
  ): Promise<void> {
    try {
      // Create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });

      // Generate filenames
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `${keyword}_${timestamp}`;
      const analysisFile = path.join(outputDir, `${baseFilename}_analysis.json`);
      const reportFile = path.join(outputDir, `${baseFilename}_report.${format === 'markdown' ? 'md' : 'json'}`);

      // Save files
      await Promise.all([
        fs.writeFile(analysisFile, JSON.stringify(analysis, null, 2)),
        fs.writeFile(reportFile, format === 'markdown' ? report : JSON.stringify(report, null, 2))
      ]);
    } catch (error) {
      console.error('Error saving results:', error);
      throw new Error('Failed to save analysis results');
    }
  }
} 