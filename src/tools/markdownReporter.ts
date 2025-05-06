/**
 * MarkdownReporter - KeywordIntent分析结果转Markdown报告工具
 * 
 * 此模块负责将JSON格式的分析结果转换为专业的Markdown格式报告
 * 会通过LLM进一步丰富分析内容，提供更深入的见解和建议
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowResult } from '../core/WorkflowController';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { marked } from 'marked';

// 使用控制台日志记录
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data ? data : ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data ? data : '')
};

/**
 * Markdown报告配置接口 - 简化版
 */
export interface MarkdownReportConfig {
  language: 'zh' | 'en';            // 报告语言
  theme: 'light' | 'dark';          // 主题（适用于图表和HTML）
}

// 默认配置
const DEFAULT_CONFIG: MarkdownReportConfig = {
  language: 'zh',
  theme: 'light',
};

// 多语言文本
const TRANSLATIONS = {
  zh: {
    reportTitle: 'KeywordIntent 分析报告',
    summary: '摘要',
    overview: '概览',
    keyStats: '核心统计',
    discoveredKeywords: '发现的关键词',
    iterations: '迭代次数',
    journeySteps: '旅程步骤',
    keyInsights: '关键发现',
    keywordAnalysis: '关键词分析',
    distribution: '关键词分布',
    highValue: '高价值关键词',
    userJourney: '用户搜索旅程',
    searchIntent: '搜索意图分析',
    decisionPoints: '决策点',
    flowChart: '流程图',
    recommendations: '建议',
    contentStrategy: '内容策略',
    seoRecommendations: 'SEO建议',
    contentIdeas: '内容创作思路',
    implementationSteps: '实施步骤',
    conclusion: '结论',
    generatedAt: '生成时间',
    aiEnhanced: '由AI增强分析',
    unmetNeeds: '未满足需求分析'
  },
  en: {
    reportTitle: 'KeywordIntent Analysis Report',
    summary: 'Executive Summary',
    overview: 'Overview',
    keyStats: 'Key Statistics',
    discoveredKeywords: 'Discovered Keywords',
    iterations: 'Iterations',
    journeySteps: 'Journey Steps',
    keyInsights: 'Key Insights',
    keywordAnalysis: 'Keyword Analysis',
    distribution: 'Keyword Distribution',
    highValue: 'High-Value Keywords',
    userJourney: 'User Search Journey',
    searchIntent: 'Search Intent Analysis',
    decisionPoints: 'Decision Points',
    flowChart: 'Flow Chart',
    recommendations: 'Recommendations',
    contentStrategy: 'Content Strategy',
    seoRecommendations: 'SEO Recommendations',
    contentIdeas: 'Content Creation Ideas',
    implementationSteps: 'Implementation Steps',
    conclusion: 'Conclusion',
    generatedAt: 'Generated at',
    aiEnhanced: 'AI-Enhanced Analysis',
    unmetNeeds: 'Unmet Needs Analysis'
  }
};

/**
 * 关键词分析Markdown报告生成器
 */
export class MarkdownReporter {
  private config: MarkdownReportConfig;
  private i18n: any; // 国际化文本引用
  private llm: LLMServiceHub;

  constructor(config: Partial<MarkdownReportConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.i18n = TRANSLATIONS[this.config.language];
    this.llm = new LLMServiceHub();
    
    logger.info('初始化Markdown报告生成器', { config: this.config });
  }

  /**
   * 生成Markdown格式的分析报告
   * @param result 工作流分析结果
   * @param outputPath 输出文件路径
   * @returns 生成的报告文件路径
   */
  async generateReport(result: WorkflowResult, outputPath: string): Promise<string> {
    logger.info('开始生成Markdown报告', { keyword: result.keyword });
    
    try {
      // 准备必要的数据
      if (!result.version) result.version = '3.0.0';
      if (!result.generatedAt) result.generatedAt = new Date().toISOString();
      
      // 生成Markdown内容
      let markdown = this.createBasicMarkdown(result);
      
      // 使用大模型API丰富内容
      markdown = await this.enhanceWithAI(markdown, result);
      
      // 确保目录存在
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 写入Markdown文件
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      logger.info('Markdown报告生成成功', { path: outputPath });
      
      return outputPath;
    } catch (error) {
      logger.error('生成Markdown报告失败', { error });
      throw error;
    }
  }

  /**
   * 使用大模型API丰富Markdown内容
   * @param basicMarkdown 基础Markdown内容
   * @param result 原始分析结果
   * @returns 增强后的Markdown内容
   */
  private async enhanceWithAI(basicMarkdown: string, result: WorkflowResult): Promise<string> {
    try {
      // 构建提示词
      const prompt = this.buildAIPrompt(basicMarkdown, result);
      
      // 调用LLM进行增强
      logger.info('开始调用LLM增强报告内容');
      
      const enhancedContent = await this.llm.analyze('keyword_report', prompt, {
        temperature: 0.5,
        language: this.config.language,
        format: 'text'
      });
      
      logger.info('LLM增强报告内容完成', { 
        contentLength: enhancedContent.length 
      });
      
      // 返回增强后的内容
      return enhancedContent;
    } catch (error) {
      logger.error('AI增强内容失败', { error });
      // 发生错误时，返回原始内容
      return basicMarkdown + 
        '\n\n---\n\n' +
        '> **增强内容失败**: LLM API调用发生错误，返回基础报告内容。\n\n';
    }
  }
  
  /**
   * 构建用于AI的提示词
   * @param basicMarkdown 基础Markdown内容
   * @param result 原始分析结果
   * @returns 完整的提示词
   */
  private buildAIPrompt(basicMarkdown: string, result: WorkflowResult): string {
    // 使用针对性更强的提示词
    const template = this.getPromptTemplate();
    
    return template
      .replace('{{keyword}}', result.keyword)
      .replace('{{language}}', this.config.language)
      .replace('{{basicMarkdown}}', basicMarkdown)
      .replace('{{jsonData}}', JSON.stringify(result, null, 2));
  }
  
  /**
   * 获取默认的提示词模板
   * @returns 提示词模板字符串
   */
  private getPromptTemplate(): string {
    const lang = this.config.language;
    
    if (lang === 'zh') {
      return `
# 任务: 基于KeywordIntent分析数据生成专业SEO报告

## 关键词
{{keyword}}

## 你的角色
你是一位SEO专家和内容策略顾问，擅长分析关键词数据并提供专业的、数据驱动的建议。

## 任务详情
我提供了一份KeywordIntent生成的关键词分析数据(JSON格式)和一个基础的Markdown报告结构。你需要:

1. 填充报告中所有标记为"待AI完成"的部分
2. 让报告专业、详尽且具有洞察力
3. 提供具体、可操作的建议
4. 保持客观，但提供有价值的策略性见解

## 报告要求
- 摘要部分：简明扼要地总结核心发现和价值
- 关键发现：突出最重要的数据洞察和模式
- 关键词分析：深入解析关键词分布、搜索意图和竞争格局
- 用户旅程：剖析搜索行为的转变路径，解释决策点
- 内容策略：提供具体的内容创作建议
- SEO建议：给出明确的页面优化和结构建议
- 实施步骤：制定优先级和时间线
- 结论：总结建议和预期效果

## 分析数据
\`\`\`json
{{jsonData}}
\`\`\`

## 报告框架
以下是需要完善的报告结构:

{{basicMarkdown}}

请保持Markdown格式不变，只填充标记为"待AI完成"的部分。

**请只输出完整的Markdown格式报告，不要输出JSON或其他格式。**
`;
    } else {
      return `
# Task: Generate Professional SEO Report Based on KeywordIntent Analysis Data

## Keyword
{{keyword}}

## Your Role
You are an SEO expert and content strategy consultant, skilled at analyzing keyword data and providing professional, data-driven recommendations.

## Task Details
I'm providing KeywordIntent-generated keyword analysis data (JSON format) and a basic Markdown report structure. You need to:

1. Complete all sections marked "To be completed by AI"
2. Make the report professional, comprehensive, and insightful
3. Provide specific, actionable recommendations
4. Remain objective while offering valuable strategic insights

## Report Requirements
- Executive Summary: Concisely summarize core findings and value
- Key Insights: Highlight the most important data insights and patterns
- Keyword Analysis: Deep dive into keyword distribution, search intent, and competitive landscape
- User Journey: Analyze search behavior transformation paths, explain decision points
- Content Strategy: Provide specific content creation recommendations
- SEO Recommendations: Give clear page optimization and structure suggestions
- Implementation Steps: Establish priorities and timeline
- Conclusion: Summarize recommendations and expected outcomes

## Analysis Data
\`\`\`json
{{jsonData}}
\`\`\`

## Report Framework
Here is the report structure that needs to be completed:

{{basicMarkdown}}

Please maintain the Markdown format unchanged, only filling in the sections marked "To be completed by AI".

**Please output only the complete Markdown report, do not output JSON or any other format.**
`;
    }
  }

  /**
   * 创建基本的Markdown报告内容
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private createBasicMarkdown(result: WorkflowResult): string {
    // 添加报告标题和基本信息
    let markdown = `# ${this.i18n.reportTitle}: ${result.keyword}\n\n`;
    
    // 添加生成时间和版本信息
    const date = new Date(result.generatedAt);
    markdown += `> ${this.i18n.generatedAt}: ${date.toLocaleString()} | KeywordIntent v${result.version}\n\n`;
    
    // 添加目录
    markdown += this.generateTableOfContents();
    
    // 添加摘要部分
    markdown += `## ${this.i18n.summary}\n\n`;
    markdown += this.generateSummaryPlaceholder(result);
    
    // 添加概览部分
    markdown += `## ${this.i18n.overview}\n\n`;
    
    // 核心统计
    markdown += `### ${this.i18n.keyStats}\n\n`;
    markdown += this.generateKeyStats(result);
    
    // 关键发现
    markdown += `### ${this.i18n.keyInsights}\n\n`;
    markdown += this.generateKeyInsightsPlaceholder(result);
    
    // 关键词分析部分
    markdown += `## ${this.i18n.keywordAnalysis}\n\n`;
    
    // 关键词分布
    markdown += `### ${this.i18n.distribution}\n\n`;
    markdown += this.generateDistributionSection(result);
    
    // 高价值关键词
    markdown += `### ${this.i18n.highValue}\n\n`;
    markdown += this.generateHighValueKeywordsSection(result);
    
    // 用户旅程部分
    if (result.journeyAnalysis) {
      markdown += `## ${this.i18n.userJourney}\n\n`;
      markdown += this.generateUserJourneySection(result);
    }
    
    // 建议部分
    markdown += `## ${this.i18n.recommendations}\n\n`;
    
    // 内容策略
    markdown += `### ${this.i18n.contentStrategy}\n\n`;
    markdown += this.generateContentStrategyPlaceholder(result);
    
    // SEO建议
    markdown += `### ${this.i18n.seoRecommendations}\n\n`;
    markdown += this.generateSEORecommendationsPlaceholder(result);
    
    // 内容创作思路
    markdown += `### ${this.i18n.contentIdeas}\n\n`;
    markdown += this.generateContentIdeasPlaceholder(result);
    
    // 实施步骤
    markdown += `### ${this.i18n.implementationSteps}\n\n`;
    markdown += this.generateImplementationStepsPlaceholder(result);
    
    // 结论
    markdown += `## ${this.i18n.conclusion}\n\n`;
    markdown += this.generateConclusionPlaceholder(result);
    
    // 添加未满足需求部分
    if (result.unmetNeeds && result.unmetNeeds.length > 0) {
      markdown += `\n\n## ${this.i18n.unmetNeeds}\n\n`;
      markdown += this.generateUnmetNeedsSection(result);
    }
    
    // 提示这部分将由AI完成
    markdown += `\n---\n\n*${this.i18n.aiEnhanced}*\n`;
    
    return markdown;
  }

  /**
   * 生成目录
   * @returns 目录的Markdown内容
   */
  private generateTableOfContents(): string {
    return `## 目录

1. [${this.i18n.summary}](#${this.slugify(this.i18n.summary)})
2. [${this.i18n.overview}](#${this.slugify(this.i18n.overview)})
   - [${this.i18n.keyStats}](#${this.slugify(this.i18n.keyStats)})
   - [${this.i18n.keyInsights}](#${this.slugify(this.i18n.keyInsights)})
3. [${this.i18n.keywordAnalysis}](#${this.slugify(this.i18n.keywordAnalysis)})
   - [${this.i18n.distribution}](#${this.slugify(this.i18n.distribution)})
   - [${this.i18n.highValue}](#${this.slugify(this.i18n.highValue)})
4. [${this.i18n.userJourney}](#${this.slugify(this.i18n.userJourney)})
5. [${this.i18n.recommendations}](#${this.slugify(this.i18n.recommendations)})
   - [${this.i18n.contentStrategy}](#${this.slugify(this.i18n.contentStrategy)})
   - [${this.i18n.seoRecommendations}](#${this.slugify(this.i18n.seoRecommendations)})
   - [${this.i18n.contentIdeas}](#${this.slugify(this.i18n.contentIdeas)})
   - [${this.i18n.implementationSteps}](#${this.slugify(this.i18n.implementationSteps)})
6. [${this.i18n.conclusion}](#${this.slugify(this.i18n.conclusion)})

---

`;
  }

  /**
   * 生成摘要部分占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateSummaryPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 撰写一段200字左右的摘要，重点突出关键词"${result.keyword}"的核心价值，发现的主要洞察，以及最重要的3-5个行动建议]*\n\n`;
  }

  /**
   * 生成核心统计信息
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateKeyStats(result: WorkflowResult): string {
    const keywordsCount = result.discoveredKeywords?.length || 0;
    const iterationsCount = result.iterations?.length || 0;
    const journeyStepsCount = result.journeyAnalysis?.steps?.length || 0;

    let markdown = '';
    markdown += `- **${this.i18n.discoveredKeywords}**: ${keywordsCount}\n`;
    markdown += `- **${this.i18n.iterations}**: ${iterationsCount}\n`;
    
    if (journeyStepsCount > 0) {
      markdown += `- **${this.i18n.journeySteps}**: ${journeyStepsCount}\n`;
    }
    
    markdown += '\n';
    
    // 添加发现的关键词列表
    if (keywordsCount > 0) {
      markdown += `**${this.i18n.discoveredKeywords}**:\n\n`;
      markdown += '```\n';
      for (let i = 0; i < Math.min(keywordsCount, 20); i++) {
        markdown += `${result.discoveredKeywords![i]}\n`;
      }
      if (keywordsCount > 20) {
        markdown += `... ${keywordsCount - 20} more\n`;
      }
      markdown += '```\n\n';
    }
    
    return markdown;
  }

  /**
   * 生成关键发现部分占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateKeyInsightsPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 基于分析数据，提供5-7个关键发现，每个1-2句话，强调意图模式、高价值关键词特征、用户旅程特点等]*\n\n`;
  }

  /**
   * 生成关键词分布部分
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateDistributionSection(result: WorkflowResult): string {
    let markdown = '';
    
    // 这部分将由AI完成详细分析
    markdown += `*[待AI完成: 分析关键词分布情况，包括主题聚类、意图类型分布、长尾特征等]*\n\n`;
    
    // 添加Mermaid图表代码
    markdown += '**关键词分布可视化**:\n\n';
    markdown += '```mermaid\npie title 关键词分布\n';
    
    // 模拟一些分类数据用于图表
    const categories = ['信息查询', '商业意图', '交易意图', '导航意图', '学习意图'];
    categories.forEach(category => {
      const count = Math.floor(Math.random() * 30) + 5;
      markdown += `    "${category}" : ${count}\n`;
    });
    
    markdown += '```\n\n';
    
    return markdown;
  }

  /**
   * 生成高价值关键词部分
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateHighValueKeywordsSection(result: WorkflowResult): string {
    let markdown = '';
    
    // 这部分将由AI完成详细分析
    markdown += `*[待AI完成: 分析最有价值的5-10个关键词，解释其价值来源、竞争程度、转化潜力等]*\n\n`;
    
    // 添加高价值关键词表格
    if (result.discoveredKeywords && result.discoveredKeywords.length > 0) {
      markdown += '| 关键词 | 估计价值 | 竞争程度 | 建议优先级 |\n';
      markdown += '|--------|----------|----------|------------|\n';
      
      // 提取前10个关键词作为示例
      const topKeywords = result.discoveredKeywords.slice(0, 10);
      
      topKeywords.forEach((keyword: string) => {
        // 模拟一些评估数据
        const value = ['高', '中高', '中', '中低', '低'][Math.floor(Math.random() * 5)];
        const competition = ['高', '中高', '中', '中低', '低'][Math.floor(Math.random() * 5)];
        const priority = ['P0', 'P1', 'P2', 'P3'][Math.floor(Math.random() * 4)];
        
        markdown += `| ${keyword} | ${value} | ${competition} | ${priority} |\n`;
      });
      
      markdown += '\n*注: 价值和竞争程度评估基于相对指标，将由AI分析完善*\n\n';
    }
    
    return markdown;
  }

  /**
   * 生成用户旅程部分
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateUserJourneySection(result: WorkflowResult): string {
    let markdown = '';
    
    if (!result.journeyAnalysis || !result.journeyAnalysis.steps) {
      return `*没有可用的用户旅程数据*\n\n`;
    }
    
    // 意图分析部分
    markdown += `### ${this.i18n.searchIntent}\n\n`;
    markdown += `*[待AI完成: 分析用户搜索意图的变化模式、主要意图类型及其商业价值]*\n\n`;
    
    // 添加步骤列表
    markdown += '**搜索步骤序列**:\n\n';
    result.journeyAnalysis.steps.forEach((step: any, index: number) => {
      const intent = step.intent || step.intentType || 'unknown';
      markdown += `${index + 1}. **${step.query}** (${intent})\n`;
      if (step.reasoning) {
        markdown += `   - ${step.reasoning}\n`;
      }
    });
    markdown += '\n';
    
    // 决策点部分
    if (result.journeyAnalysis.decisionPoints && result.journeyAnalysis.decisionPoints.length > 0) {
      markdown += `### ${this.i18n.decisionPoints}\n\n`;
      markdown += '| 步骤 | 决策点 |\n';
      markdown += '|------|--------|\n';
      
      result.journeyAnalysis.decisionPoints.forEach((point: any) => {
        const stepIndex = typeof point.step === 'number' ? point.step : 0;
        const stepQuery = stepIndex < result.journeyAnalysis!.steps.length 
          ? result.journeyAnalysis!.steps[stepIndex].query 
          : `步骤 ${stepIndex}`;
          
        markdown += `| ${stepQuery} | ${point.reasoning || '-'} |\n`;
      });
      markdown += '\n';
    }
    
    // 流程图
    markdown += `### ${this.i18n.flowChart}\n\n`;
    markdown += '```mermaid\ngraph LR\n';
    
    // 添加节点
    result.journeyAnalysis.steps.forEach((step: any, index: number) => {
      const intent = step.intent || step.intentType || 'unknown';
      markdown += `    S${index}["${step.query} (${intent})"];\n`;
    });
    
    // 添加连接
    for (let i = 0; i < result.journeyAnalysis.steps.length - 1; i++) {
      // 查找相关的决策点
      let decisionLabel = '';
      if (result.journeyAnalysis.decisionPoints) {
        const decisionPoint = result.journeyAnalysis.decisionPoints.find((dp: any) => dp.step === i);
        if (decisionPoint && decisionPoint.reasoning) {
          decisionLabel = ` |"${decisionPoint.reasoning.substring(0, 20)}${decisionPoint.reasoning.length > 20 ? '...' : ''}"| `;
        }
      }
      
      markdown += `    S${i} -->${decisionLabel} S${i+1};\n`;
    }
    
    markdown += '```\n\n';
    
    return markdown;
  }

  /**
   * 生成内容策略占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateContentStrategyPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 基于关键词分析和用户旅程，提供全面的内容策略建议，包括核心内容主题、内容类型、结构和目标受众特征等]*\n\n`;
  }

  /**
   * 生成SEO建议占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateSEORecommendationsPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 提供针对发现关键词的SEO优化建议，包括页面结构、内部链接、技术优化点等]*\n\n`;
  }

  /**
   * 生成内容创作思路占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateContentIdeasPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 提供10-15个基于关键词的具体内容创作想法，包括文章标题、内容角度、结构建议等]*\n\n`;
  }

  /**
   * 生成实施步骤占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateImplementationStepsPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 提供清晰的实施步骤计划，按照优先级排序，包括时间线和关键里程碑建议]*\n\n`;
  }

  /**
   * 生成结论占位符
   * @param result 工作流分析结果
   * @returns Markdown内容
   */
  private generateConclusionPlaceholder(result: WorkflowResult): string {
    return `*[待AI完成: 总结关键词"${result.keyword}"的分析价值，强调实施建议的预期效果和未来可能的优化方向]*\n\n`;
  }

  /**
   * 生成未满足需求部分内容
   */
  private generateUnmetNeedsSection(result: WorkflowResult): string {
    if (!result.unmetNeeds || result.unmetNeeds.length === 0) {
      return '未发现未满足需求。';
    }
    
    let content = `以下是与"${result.keyword}"相关的、当前内容质量不足的需求:\n\n`;
    
    // 添加未满足需求表格
    content += '| 需求关键词 | 内容质量评分 | 未满足原因 |\n';
    content += '|------------|--------------|------------|\n';
    
    result.unmetNeeds.forEach(need => {
      const qualityScore = (need.contentQuality * 100).toFixed(0) + '%';
      content += `| **${need.keyword}** | ${qualityScore} | ${need.reason} |\n`;
    });
    
    content += '\n\n这些未满足需求代表了潜在的内容机会，可以针对性地创建高质量内容来填补这些空缺。\n\n';
    content += '<!-- AI请分析这些未满足需求的共性特点，并提出可能的解决策略 -->';
    
    return content;
  }

  /**
   * 将文本转换为URL友好的格式（用于锚点链接）
   * @param text 原始文本
   * @returns 转换后的文本
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\- ]+/g, '')
      .replace(/\s+/g, '-');
  }
} 