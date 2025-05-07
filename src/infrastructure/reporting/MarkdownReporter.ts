import * as fs from 'fs';
import * as path from 'path';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { logger } from '../core/logger';
import {
  EnhancedWorkflowResult,
} from '../../domain/analysis/types/AnalysisTypes';

// 添加StartupAnalysis类型定义
export interface StartupAnalysis {
  opportunity: any;
  strategy: any;
  resources: any;
  risks: any;
  validation: any;
}

/**
 * 报告配置接口
 */
export interface MarkdownReportConfig {
  language: 'zh' | 'en';
  preserveKeywords?: string[];
}

// 多语言文本
const TRANSLATIONS = {
  zh: {
    reportTitle: '创业机会分析报告',
    marketOpportunity: '市场机会',
    keyRisks: '主要风险',
    quickWins: '快速切入点',
    recommendations: '建议',
    generatedAt: '生成时间',
    keywords: '关键词',
    keywordInsights: '关键词洞察',
    preservedKeywords: '搜索关键词(保留原始形式)'
  },
  en: {
    reportTitle: 'Startup Opportunity Analysis Report',
    marketOpportunity: 'Market Opportunity',
    keyRisks: 'Key Risks',
    quickWins: 'Quick Wins',
    recommendations: 'Recommendations',
    generatedAt: 'Generated at',
    keywords: 'Keywords',
    keywordInsights: 'Keyword Insights',
    preservedKeywords: 'Search Keywords (Original Form)'
  }
};

/**
 * 创业机会分析报告生成器 - 专注于创业者最关心的核心问题
 */
export class MarkdownReporter {
  private llm: LLMServiceHub;

  constructor(private config: MarkdownReportConfig) {
    this.llm = new LLMServiceHub();
  }

  /**
   * 生成分析报告
   */
  async generateReport(analysis: StartupAnalysis, result: EnhancedWorkflowResult, outputPath: string): Promise<string> {
    try {
      // 1. 生成报告各个部分
      const [
        executiveSummary,
        marketTiming,
        strategySection,
        riskSection,
        validationSection,
        nextSteps
      ] = await Promise.all([
        this.generateExecutiveSummary(analysis, result),
        this.generateMarketTimingSection(analysis),
        this.generateStrategySection(analysis),
        this.generateRiskSection(analysis),
        this.generateValidationSection(analysis),
        this.generateNextStepsSection(analysis)
      ]);

      // 2. 组装完整报告
      const markdown = this.config.language === 'zh' 
        ? this.createChineseReport([executiveSummary, marketTiming, strategySection, riskSection, validationSection, nextSteps], result)
        : this.createEnglishReport([executiveSummary, marketTiming, strategySection, riskSection, validationSection, nextSteps], result);

      // 3. 保存报告
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      
      return outputPath;
    } catch (error) {
      logger.error('生成报告失败:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private createChineseReport(sections: string[], result: EnhancedWorkflowResult): string {
    const t = TRANSLATIONS.zh;
    
    // 如果有关键词和搜索词，添加到报告中
    let keywordSection = '';
    if (result?.keyword) {
      // 添加保留原始形式的关键词部分
      if (this.config.preserveKeywords && this.config.preserveKeywords.length > 0) {
        keywordSection = `## ${t.preservedKeywords}\n\n`;
        keywordSection += this.config.preserveKeywords.map(keyword => `- \`${keyword}\``).join('\n');
        keywordSection += '\n\n';
      }
    }

    return `# ${t.reportTitle}

${keywordSection ? keywordSection : ''}${sections.join('\n\n')}

---
${t.generatedAt}: ${new Date().toLocaleString('zh-CN')}
`;
  }

  private createEnglishReport(sections: string[], result: EnhancedWorkflowResult): string {
    const t = TRANSLATIONS.en;
    
    // 如果有关键词和搜索词，添加到报告中
    let keywordSection = '';
    if (result?.keyword) {
      // 添加保留原始形式的关键词部分
      if (this.config.preserveKeywords && this.config.preserveKeywords.length > 0) {
        keywordSection = `## ${t.preservedKeywords}\n\n`;
        keywordSection += this.config.preserveKeywords.map(keyword => `- \`${keyword}\``).join('\n');
        keywordSection += '\n\n';
      }
    }

    return `# ${t.reportTitle}

${keywordSection ? keywordSection : ''}${sections.join('\n\n')}

---
${t.generatedAt}: ${new Date().toLocaleString('en-US')}
`;
  }

  // 新增: 处理文本的工具方法，保留指定关键词
  private preserveKeywordsInText(text: string): string {
    if (!this.config.preserveKeywords || this.config.preserveKeywords.length === 0) {
      return text;
    }

    // 为每个关键词创建正则表达式，并替换文本中的关键词为标记版本
    let processedText = text;
    this.config.preserveKeywords.forEach(keyword => {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      processedText = processedText.replace(regex, `\`${keyword}\``);
    });

    return processedText;
  }

  /**
   * 生成执行摘要 - 高度概括核心机会和关键判断
   */
  private async generateExecutiveSummary(analysis: StartupAnalysis, result: EnhancedWorkflowResult): Promise<string> {
    // 保存原始关键词
    const originalKeyword = result?.keyword;
    
    // 根据语言设置决定提示语
    const prompt = this.config.language === 'zh' 
      ? `作为一位经验丰富的创业顾问，请基于以下分析结果，生成一段简洁有力的执行摘要。
      重点关注：
      1. 这个机会的核心价值主张是什么
      2. 为什么现在是合适的时机
      3. 最关键的差异化优势是什么
      4. 需要重点关注的风险是什么
      
      分析数据：
      ${JSON.stringify({ analysis, result })}
      
      要求：
      - 用简单直接的语言
      - 突出最重要的判断
      - 不超过300字
      - 确保每个判断都有数据支持
      ${originalKeyword ? `- 保持关键词 "${originalKeyword}" 的原始形式` : ''}`
      : `As an experienced startup advisor, please generate a concise and powerful executive summary based on the following analysis.
      Focus on:
      1. What is the core value proposition of this opportunity
      2. Why is now the right time
      3. What are the key differentiating advantages
      4. What are the critical risks to watch
      
      Analysis data:
      ${JSON.stringify({ analysis, result })}
      
      Requirements:
      - Use simple and direct language
      - Highlight the most important judgments
      - No more than 300 words
      - Ensure each judgment is supported by data
      ${originalKeyword ? `- Keep the keyword "${originalKeyword}" in its original form` : ''}`;

    const response = await this.llm.analyze(prompt, 'executive_summary', { temperature: 0.7 });
    let summary = typeof response === 'object' ? (response.content || response.raw || JSON.stringify(response)) : String(response);
    
    // 处理文本，确保关键词保留原始形式
    summary = this.preserveKeywordsInText(summary);
    let summaryText = typeof summary === 'object'
    ? (summary.content || summary.raw || JSON.stringify(summary))
    : String(summary);
    return this.config.language === 'zh' 
      ? `## 执行摘要\n\n${summaryText}`
      : `## Executive Summary\n\n${summaryText}`;
  }

  /**
   * 生成市场时机分析 - 帮助创业者判断进入时机
   */
  private async generateMarketTimingSection(analysis: StartupAnalysis): Promise<string> {
    const prompt = this.config.language === 'zh'
      ? `作为市场趋势分析专家，请基于以下数据，分析当前的市场时机：
      1. 市场发展到什么阶段
      2. 机会窗口有多大
      3. 为什么要现在进入
      4. 延迟进入的风险是什么
      
      分析数据：
      ${JSON.stringify(analysis.opportunity)}
      
      要求：
      - 给出明确的判断和建议
      - 用数据支持你的观点
      - 指出时间敏感性
      - 说明竞争态势`
      : `As a market trend analyst, please analyze the current market timing based on the following data:
      1. What stage is the market in
      2. How big is the opportunity window
      3. Why enter now
      4. What are the risks of delayed entry
      
      Analysis data:
      ${JSON.stringify(analysis.opportunity)}
      
      Requirements:
      - Provide clear judgments and recommendations
      - Support your views with data
      - Point out time sensitivity
      - Explain competitive dynamics`;

    const timing = await this.llm.analyze(prompt, 'market_timing', { temperature: 0.7 });
    let timingText = typeof timing === 'object'
    ? (timing.content || timing.raw || JSON.stringify(timing))
    : String(timing);
    return this.config.language === 'zh'
      ? `## 市场时机分析\n\n${timingText}`
      : `## Market Timing Analysis\n\n${timingText}`;
  }

  /**
   * 生成策略部分 - 聚焦于实操建议
   */
  private async generateStrategySection(analysis: StartupAnalysis): Promise<string> {
    const prompt = this.config.language === 'zh'
      ? `作为创业战略顾问，请基于以下分析，提供切实可行的策略建议：
      1. 最佳的切入点和方式
      2. 如何建立差异化优势
      3. 资源配置的优先级
      4. 增长路径规划
      
      分析数据：
      ${JSON.stringify({
        strategy: analysis.strategy,
        resources: analysis.resources
      })}
      
      要求：
      - 建议要具体且可执行
      - 考虑资源约束
      - 分阶段规划
      - 重点是快速验证和调整`
      : `As a startup strategy consultant, please provide actionable strategic recommendations based on the following analysis:
      1. Best entry point and approach
      2. How to build differentiating advantages
      3. Resource allocation priorities
      4. Growth path planning
      
      Analysis data:
      ${JSON.stringify({
        strategy: analysis.strategy,
        resources: analysis.resources
      })}
      
      Requirements:
      - Recommendations must be specific and executable
      - Consider resource constraints
      - Phase-based planning
      - Focus on rapid validation and adjustment`;

    const strategy = await this.llm.analyze(prompt, 'strategy', { temperature: 0.7 });
    let strategyText = typeof strategy === 'object'
    ? (strategy.content || strategy.raw || JSON.stringify(strategy))
    : String(strategy);
    return this.config.language === 'zh'
      ? `## 策略建议\n\n${strategyText}`
      : `## Strategy Recommendations\n\n${strategyText}`;
  }

  /**
   * 生成风险分析 - 突出关键风险和应对方案
   */
  private async generateRiskSection(analysis: StartupAnalysis): Promise<string> {
    const prompt = this.config.language === 'zh'
      ? `作为风险管理专家，请基于以下分析，提供风险防范建议：
      1. 最需要立即关注的风险
      2. 具体的影响和后果
      3. 可行的规避方案
      4. 风险监控指标
      
      分析数据：
      ${JSON.stringify(analysis.risks)}
      
      要求：
      - 区分优先级
      - 给出具体的应对方案
      - 设置预警指标
      - 强调可控性`
      : `As a risk management expert, please provide risk prevention recommendations based on the following analysis:
      1. Most immediate risks to address
      2. Specific impacts and consequences
      3. Feasible mitigation strategies
      4. Risk monitoring metrics
      
      Analysis data:
      ${JSON.stringify(analysis.risks)}
      
      Requirements:
      - Prioritize risks
      - Provide specific countermeasures
      - Set warning indicators
      - Emphasize controllability`;

    const risks = await this.llm.analyze(prompt, 'risks', { temperature: 0.7 });
    let risksText = typeof risks === 'object'
    ? (risks.content || risks.raw || JSON.stringify(risks))
    : String(risks);
    return this.config.language === 'zh'
      ? `## 风险分析\n\n${risksText}`
      : `## Risk Analysis\n\n${risksText}`;
  }

  /**
   * 生成验证方案 - 帮助快速验证假设
   */
  private async generateValidationSection(analysis: StartupAnalysis): Promise<string> {
    const prompt = this.config.language === 'zh'
      ? `作为精益创业专家，请基于以下分析，设计验证方案：
      1. 最关键的假设是什么
      2. 如何最快验证这些假设
      3. 具体的验证指标
      4. 验证的最小成本
      
      分析数据：
      ${JSON.stringify(analysis.validation)}
      
      要求：
      - 方案要轻量级
      - 重点是速度
      - 明确的成功标准
      - 具体的时间节点`
      : `As a lean startup expert, please design a validation plan based on the following analysis:
      1. What are the most critical assumptions
      2. How to validate these assumptions quickly
      3. Specific validation metrics
      4. Minimum cost for validation
      
      Analysis data:
      ${JSON.stringify(analysis.validation)}
      
      Requirements:
      - Keep the plan lightweight
      - Focus on speed
      - Clear success criteria
      - Specific timeframes`;

    const validation = await this.llm.analyze(prompt, 'validation', { temperature: 0.7 });
    let validationText = typeof validation === 'object'
    ? (validation.content || validation.raw || JSON.stringify(validation))
    : String(validation);
    return this.config.language === 'zh'
      ? `## 验证方案\n\n${validationText}`
      : `## Validation Plan\n\n${validationText}`;
  }

  /**
   * 生成下一步行动建议 - 确保可立即执行
   */
  private async generateNextStepsSection(analysis: StartupAnalysis): Promise<string> {
    const prompt = this.config.language === 'zh'
      ? `作为创业导师，请基于以下分析，规划具体的行动方案：
      1. 接下来3个月最重要的3件事
      2. 每件事的具体步骤
      3. 需要的资源和工具
      4. 预期的结果和评估标准
      
      分析数据：
      ${JSON.stringify({
        validation: analysis.validation,
        strategy: analysis.strategy
      })}
      
      要求：
      - 行动项要具体
      - 有明确的时间表
      - 考虑资源约束
      - 可以立即开始`
      : `As a startup mentor, please plan specific action items based on the following analysis:
      1. Three most important things for the next 3 months
      2. Specific steps for each item
      3. Required resources and tools
      4. Expected results and evaluation criteria
      
      Analysis data:
      ${JSON.stringify({
        validation: analysis.validation,
        strategy: analysis.strategy
      })}
      
      Requirements:
      - Action items must be specific
      - Clear timeline
      - Consider resource constraints
      - Can start immediately`;

    const nextSteps = await this.llm.analyze(prompt, 'next_steps', { temperature: 0.7 });
    let nextStepsText = typeof nextSteps === 'object'
    ? (nextSteps.content || nextSteps.raw || JSON.stringify(nextSteps))
    : String(nextSteps);
    return this.config.language === 'zh'
      ? `## 下一步行动计划\n\n${nextStepsText}`
      : `## Next Steps Action Plan\n\n${nextStepsText}`;
  }
} 