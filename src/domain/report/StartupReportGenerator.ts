import { EnhancedWorkflowResult, StartupAnalysis } from '../types/reportTypes';
import { StartupAnalyzer } from '../core/StartupAnalyzer';

const TRANSLATIONS = {
  zh: {
    reportTitle: 'NeedMiner 创业机会分析报告',
    summary: '核心发现',
    opportunity: '机会评估',
    strategy: '战略建议',
    risks: '风险分析',
    resources: '资源规划',
    validation: '验证计划',
    generatedAt: '生成时间',
    aiEnhanced: '由AI增强分析'
  },
  en: {
    reportTitle: 'NeedMiner Startup Opportunity Analysis Report',
    summary: 'Key Findings',
    opportunity: 'Opportunity Assessment',
    strategy: 'Strategic Recommendations',
    risks: 'Risk Analysis',
    resources: 'Resource Planning',
    validation: 'Validation Plan',
    generatedAt: 'Generated at',
    aiEnhanced: 'Enhanced by AI'
  }
};

export class StartupReportGenerator {
  private i18n: typeof TRANSLATIONS.en | typeof TRANSLATIONS.zh;
  private startupAnalyzer: StartupAnalyzer;

  constructor(language: 'en' | 'zh' = 'zh') {
    this.i18n = TRANSLATIONS[language];
    this.startupAnalyzer = new StartupAnalyzer();
  }

  /**
   * 生成创业机会分析报告
   */
  public async generateReport(result: EnhancedWorkflowResult): Promise<string> {
    const analysis = await this.startupAnalyzer.analyzeOpportunity(result);
    
    return `# ${this.i18n.reportTitle}

## ${this.i18n.opportunity}
- 领域: ${analysis.opportunity.domain}
- 市场时机: ${analysis.opportunity.timing.status}
- 机会窗口: ${analysis.opportunity.timing.window}
- 紧迫程度: ${analysis.opportunity.timing.urgency}
- 市场趋势: ${analysis.opportunity.direction.trend}
- 关键驱动因素: ${analysis.opportunity.direction.keyDrivers.join(', ')}

## ${this.i18n.strategy}
- 切入点: ${analysis.strategy.entryPoint}
- 核心优势: ${analysis.strategy.keyAdvantages.join(', ')}
- 关键挑战: ${analysis.strategy.criticalChallenges.join(', ')}
- 差异化策略: ${analysis.strategy.differentiators.join(', ')}
- 时机建议: ${analysis.strategy.timing}

## ${this.i18n.risks}
### 紧急风险
${analysis.risks.critical.map(risk => `- ${risk.description}
  影响: ${risk.impact}
  缓解措施: ${risk.mitigation.join(', ')}
  紧迫性: ${risk.urgency}`).join('\n')}

### 战略风险
${analysis.risks.strategic.map(risk => `- ${risk.description}
  影响: ${risk.impact}
  缓解措施: ${risk.mitigation.join(', ')}
  时间框架: ${risk.timeframe}`).join('\n')}

## ${this.i18n.resources}
### 立即需要
${analysis.resources.immediate.map(resource => `- ${resource.type}: ${resource.description}
  替代方案: ${resource.alternatives.join(', ')}
  优先级: ${resource.priority}`).join('\n')}

### 扩展需要
${analysis.resources.scaling.map(resource => `- ${resource.description}
  触发条件: ${resource.trigger}
  准备工作: ${resource.preparation.join(', ')}`).join('\n')}

## ${this.i18n.validation}
### 关键假设
${analysis.validation.keyHypotheses.map(hypothesis => `- ${hypothesis}`).join('\n')}

### 验证方法
${analysis.validation.methods.map(method => `- ${method.approach}
  指标: ${method.metrics.join(', ')}
  阈值: ${method.threshold}
  时间框架: ${method.timeframe}`).join('\n')}

### 下一步行动
${analysis.validation.nextSteps.map(step => `- ${step.action}
  目的: ${step.purpose}
  优先级: ${step.priority}`).join('\n')}

${this.i18n.generatedAt}: ${new Date().toLocaleString()}
${this.i18n.aiEnhanced}`;
  }
} 