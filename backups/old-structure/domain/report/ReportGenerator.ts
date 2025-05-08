import { StartupAnalysis } from '../analysis/types/AnalysisTypes';

interface ReportConfig {
  language: 'zh' | 'en';
  format: 'json' | 'markdown';
}

const TRANSLATIONS = {
  zh: {
    title: '创业机会分析报告',
    opportunity: '机会概述',
    strategy: '战略分析',
    risks: '风险评估',
    resources: '资源规划',
    validation: '验证计划',
    generatedAt: '生成时间'
  },
  en: {
    title: 'Startup Opportunity Analysis Report',
    opportunity: 'Opportunity Overview',
    strategy: 'Strategic Analysis',
    risks: 'Risk Assessment',
    resources: 'Resource Planning',
    validation: 'Validation Plan',
    generatedAt: 'Generated at'
  }
};

export class ReportGenerator {
  private config: ReportConfig = {
    language: 'zh',
    format: 'markdown'
  };

  /**
   * Configure the report generator
   */
  public configure(config: Partial<ReportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate a detailed report from startup analysis
   */
  public generateReport(analysis: StartupAnalysis): string {
    const t = TRANSLATIONS[this.config.language];

    if (this.config.format === 'json') {
      return JSON.stringify({
        title: t.title,
        sections: {
          opportunity: this.generateOpportunitySection(analysis.opportunity),
          strategy: this.generateStrategySection(analysis.strategy),
          risks: this.generateRisksSection(analysis.risks),
          resources: this.generateResourcesSection(analysis.resources),
          validation: this.generateValidationSection(analysis.validation)
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          language: this.config.language
        }
      }, null, 2);
    }

    return `# ${t.title}

## ${t.opportunity}
${this.generateOpportunitySection(analysis.opportunity)}

## ${t.strategy}
${this.generateStrategySection(analysis.strategy)}

## ${t.risks}
${this.generateRisksSection(analysis.risks)}

## ${t.resources}
${this.generateResourcesSection(analysis.resources)}

## ${t.validation}
${this.generateValidationSection(analysis.validation)}

---
${t.generatedAt}: ${new Date().toLocaleString(this.config.language === 'zh' ? 'zh-CN' : 'en-US')}`;
  }

  private generateOpportunitySection(opportunity: StartupAnalysis['opportunity']): string {
    return `
### ${this.config.language === 'zh' ? '市场时机' : 'Market Timing'}
${this.formatObject(opportunity.timing)}

### ${this.config.language === 'zh' ? '市场方向' : 'Market Direction'}
${this.formatObject(opportunity.direction)}`;
  }

  private generateStrategySection(strategy: StartupAnalysis['strategy']): string {
    return this.formatObject(strategy);
  }

  private generateRisksSection(risks: StartupAnalysis['risks']): string {
    return this.formatObject(risks);
  }

  private generateResourcesSection(resources: StartupAnalysis['resources']): string {
    return this.formatObject(resources);
  }

  private generateValidationSection(validation: StartupAnalysis['validation']): string {
    return this.formatObject(validation);
  }

  private formatObject(obj: any): string {
    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          return `- ${this.formatObjectInArray(item)}`;
        } else {
          return `- ${item}`;
        }
      }).join('\n');
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj)
        .map(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .replace(/^./, str => str.toUpperCase());
          return `**${formattedKey}**: ${this.formatObject(value)}`;
        })
        .join('\n\n');
    }

    return String(obj);
  }

  /**
   * 格式化数组中的对象
   * 专门用于处理数组中的对象，避免显示 [object Object]
   */
  private formatObjectInArray(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    return Object.entries(obj)
      .map(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .replace(/^./, str => str.toUpperCase());

        let formattedValue;
        if (Array.isArray(value)) {
          formattedValue = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          formattedValue = Object.entries(value)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(', ');
        } else {
          formattedValue = String(value);
        }

        return `${formattedKey}: ${formattedValue}`;
      })
      .join('; ');
  }
} 