/**
 * 用户旅程Agent (用户行为分析专家)
 * 
 * 核心职责:
 * 1. 模拟具有不同搜索行为和偏好的多样化用户角色
 * 2. 映射用户从初始查询到最终行动或放弃的完整旅程
 * 3. 识别搜索旅程中的摩擦点和决策分支
 * 4. 从搜索优化和放弃模式中提取隐含需求
 * 5. 分析跨设备和跨平台的搜索连续性
 * 6. 验证高价值问题的真实性和用户价值
 * 7. 从用户视角评估问题的紧迫性和需求强度
 * 
 * 主要功能:
 * - 模拟用户完整搜索旅程并识别关键决策点
 * - 分析每个搜索步骤的用户满意度
 * - 识别搜索过程中的主要痛点和困难
 * - 发现搜索行为中隐含的机会
 * - 生成相关搜索查询以扩展分析范围
 * - 验证问题的真实性和用户重视程度
 * - 确认问题对用户的价值和痛点程度
 */
import { BaseAgent, BaseAgentConfig } from './base/BaseAgent';
import { GraphStateType } from '../types/schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../infra/logger';
import { SearchEngine } from '../infra/search/SearchEngine';
import { MockSearchEngine } from '../infra/search/engines/MockSearchEngine';
import { SearchTools } from '../tools/search/SearchTools';
import { MultiSearchTools } from '../tools/search/MultiSearchTools';

// 用户旅程Agent配置
export interface UserJourneySimulatorAgentConfig extends BaseAgentConfig {
  maxSteps?: number;
  minSatisfactionScore?: number;
  maxQueryDepth?: number;
  painPointThreshold?: number;
  enableRelatedQueries?: boolean;
  searchEngine?: SearchEngine;
  searchTools?: SearchTools;
  multiSearchTools?: MultiSearchTools;
  enableUserPersonas?: boolean; // 启用多样化用户角色模拟
  crossPlatformAnalysis?: boolean; // 启用跨平台搜索行为分析
  detailedJourneyMapping?: boolean; // 启用详细的旅程映射
  enableProblemValidation?: boolean; // 启用问题验证功能
  minProblemValidityScore?: number; // 问题有效性最低分数
  maxProblemsToValidate?: number; // 要验证的最大问题数量
}

/**
 * 用户旅程模拟Agent (用户行为分析专家)
 * 负责模拟多样化用户角色、完整搜索旅程和跨平台行为
 */
export class UserJourneySimulatorAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private searchTools: SearchTools | null = null;
  private multiSearchTools: MultiSearchTools | null = null;
  private maxSteps: number;
  private minSatisfactionScore: number;
  private maxQueryDepth: number;
  private painPointThreshold: number;
  private enableRelatedQueries: boolean;
  private enableUserPersonas: boolean;
  private crossPlatformAnalysis: boolean;
  private detailedJourneyMapping: boolean;
  private enableProblemValidation: boolean;
  private minProblemValidityScore: number;
  private maxProblemsToValidate: number;
  
  constructor(config: UserJourneySimulatorAgentConfig = {}) {
    super(config);
    
    this.maxSteps = config.maxSteps || 5; // 增加默认步数以获取更完整旅程
    this.minSatisfactionScore = config.minSatisfactionScore || 0.7;
    this.maxQueryDepth = config.maxQueryDepth || 4; // 增加默认深度
    this.painPointThreshold = config.painPointThreshold || 3;
    this.enableRelatedQueries = config.enableRelatedQueries !== false;
    this.enableUserPersonas = config.enableUserPersonas !== false; // 默认启用
    this.crossPlatformAnalysis = config.crossPlatformAnalysis !== false; // 默认启用
    this.detailedJourneyMapping = config.detailedJourneyMapping !== false; // 默认启用
    this.enableProblemValidation = config.enableProblemValidation !== false; // 默认启用
    this.minProblemValidityScore = config.minProblemValidityScore || 7; // 默认最低有效性分数(10分制)
    this.maxProblemsToValidate = config.maxProblemsToValidate || 10; // 默认验证10个问题
    
    logger.debug('UserJourneySimulatorAgent initialized', {
      maxSteps: this.maxSteps,
      minSatisfactionScore: this.minSatisfactionScore,
      maxQueryDepth: this.maxQueryDepth,
      painPointThreshold: this.painPointThreshold,
      enableRelatedQueries: this.enableRelatedQueries,
      enableUserPersonas: this.enableUserPersonas,
      crossPlatformAnalysis: this.crossPlatformAnalysis,
      detailedJourneyMapping: this.detailedJourneyMapping,
      enableProblemValidation: this.enableProblemValidation,
      minProblemValidityScore: this.minProblemValidityScore,
      maxProblemsToValidate: this.maxProblemsToValidate
    });
    
    // 在constructor最后初始化SearchTools，确保在setupTools之后
    this.initializeSearchTools(config);
  }
  
  /**
   * 设置Agent所需的工具
   * 实现BaseAgent抽象方法
   */
  protected setupTools(): void {
    // 在BaseAgent构造函数中调用时，searchTools可能还不存在
    // 我们将在构造函数完成后手动注册工具
    logger.debug('setupTools called in UserJourneySimulatorAgent, will register tools later');
  }
  
  /**
   * 初始化搜索工具 - 在constructor的最后调用，避免继承初始化顺序问题
   */
  private initializeSearchTools(config: UserJourneySimulatorAgentConfig): void {
    // 优先使用提供的SearchTools，其次使用SearchEngine创建SearchTools，最后创建默认的SearchTools
    if (config.searchTools) {
      this.searchTools = config.searchTools;
      logger.debug('Using provided SearchTools instance');
    } else if (config.searchEngine) {
      logger.debug('Creating SearchTools with provided searchEngine');
      this.searchTools = new SearchTools({ searchEngine: config.searchEngine });
    } else {
      logger.debug('Creating default SearchTools instance');
      this.searchTools = new SearchTools();
      logger.warn('No search engine/tools provided to UserJourneySimulatorAgent, using default web search');
    }
    
    // 初始化MultiSearchTools（如果提供）
    if (config.multiSearchTools) {
      this.multiSearchTools = config.multiSearchTools;
      logger.debug('Using provided MultiSearchTools instance');
    } else if (this.enableProblemValidation) {
      logger.debug('Creating default MultiSearchTools instance for problem validation');
      this.multiSearchTools = new MultiSearchTools({
        enabledEngines: ['google', 'web'],
        defaultEngine: 'google'
      });
    }
    
    // 如果工具还没有注册，现在注册它们
    if (this.tools.length === 0) {
      try {
        if (this.searchTools) {
          const tools = this.searchTools.getAllTools();
          this.registerTools(tools);
          logger.debug('SearchTools registered', { count: tools.length });
        }
        
        if (this.multiSearchTools) {
          const multiTools = this.multiSearchTools.getAllTools();
          this.registerTools(multiTools);
          logger.debug('MultiSearchTools registered', { count: multiTools.length });
        }
        
        logger.debug('UserJourneySimulatorAgent tools registered', { count: this.tools.length });
      } catch (error) {
        logger.error('Failed to register search tools', { error });
      }
    }
  }
  
  /**
   * 获取搜索建议
   */
  private async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      logger.debug('Getting search suggestions', { query });
      
      // 确保searchTools已初始化
      if (!this.searchTools) {
        this.searchTools = new SearchTools();
        logger.warn('SearchTools was not initialized, creating default instance');
      }
      
      // 使用搜索建议工具获取相关建议
      const suggestionsTool = this.searchTools.getSearchSuggestionsTool();
      const result = await suggestionsTool.invoke({ keyword: query });
      
      try {
        // 解析工具返回的JSON
        const suggestions = JSON.parse(result);
        const queries = suggestions.map((s: any) => s.query);
        return queries.slice(0, 5); // 返回前5个建议
      } catch (error) {
        logger.error('Failed to parse search suggestions', { error });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get search suggestions', { error });
      return [];
    }
  }
  
  /**
   * 创建多样化用户角色
   * 生成不同技术水平、搜索习惯和目标的用户角色
   */
  private async generateUserPersonas(keyword: string): Promise<any[]> {
    if (!this.enableUserPersonas) {
      // 返回默认角色
      return [{
        name: "标准用户",
        techLevel: "中等",
        searchBehavior: "直接",
        primaryDevice: "桌面电脑",
        goal: `查找关于"${keyword}"的信息`
      }];
    }
    
    try {
      logger.debug('Generating diverse user personas');
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        作为用户研究专家，请为关键词"${keyword}"创建3个多样化的用户角色，这些用户可能会搜索这个关键词。
        
        为每个角色提供:
        1. 用户名称/描述
        2. 技术水平 (初级/中等/高级)
        3. 搜索行为特征 (如：细致、快速浏览、比较型等)
        4. 首选设备 (桌面电脑、移动设备、平板等)
        5. 主要搜索目标 (信息收集、购买决策、问题解决等)
        6. 次要目标 (如适用)
        7. 关注点 (时间、质量、价格、综合等)
        
        以JSON数组返回，格式如下:
        [
          {{
            "name": "用户角色描述",
            "techLevel": "技术水平",
            "searchBehavior": "搜索行为特征",
            "primaryDevice": "首选设备",
            "secondaryDevice": "次选设备",
            "goal": "主要搜索目标",
            "secondaryGoal": "次要目标",
            "focusPoint": "主要关注点"
          }}
        ]
        
        确保这些角色具有不同特点，能反映出真实的搜索行为差异。只返回JSON，不要其他解释。
      `);
      
      // 使用LLM创建角色
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM响应
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for user personas', { content });
          return [{
            name: "标准用户",
            techLevel: "中等",
            searchBehavior: "直接",
            primaryDevice: "桌面电脑",
            goal: `查找关于"${keyword}"的信息`
          }];
        }
        
        const personas = JSON.parse(jsonMatch[0]);
        logger.debug('Generated user personas', { count: personas.length });
        
        return personas;
      } catch (parseError) {
        logger.error('Failed to parse user personas JSON', { parseError });
        return [{
          name: "标准用户",
          techLevel: "中等",
          searchBehavior: "直接",
          primaryDevice: "桌面电脑",
          goal: `查找关于"${keyword}"的信息`
        }];
      }
    } catch (error) {
      logger.error('Failed to generate user personas', { error });
      return [{
        name: "标准用户",
        techLevel: "中等",
        searchBehavior: "直接",
        primaryDevice: "桌面电脑",
        goal: `查找关于"${keyword}"的信息`
      }];
    }
  }
  
  /**
   * 模拟跨平台搜索行为
   * 模拟用户在不同设备和平台间的搜索行为差异
   */
  private async simulateCrossPlatformSearch(
    keyword: string, 
    persona: any
  ): Promise<any> {
    if (!this.crossPlatformAnalysis) {
      return { platformSpecific: false };
    }
    
    try {
      logger.debug('Simulating cross-platform search behavior');
      
      // 确定要模拟的平台
      const primaryDevice = persona.primaryDevice || '桌面电脑';
      const secondaryDevice = persona.secondaryDevice || '移动设备';
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        作为用户体验研究专家，请模拟以下用户在不同平台上搜索"${keyword}"的行为差异:
        
        用户角色:
        - 名称: ${persona.name}
        - 技术水平: ${persona.techLevel}
        - 搜索行为: ${persona.searchBehavior}
        - 搜索目标: ${persona.goal}
        
        请模拟该用户在以下平台上搜索的区别:
        1. ${primaryDevice}
        2. ${secondaryDevice}
        
        对于每个平台，分析:
        - 搜索查询的差异 (如移动设备上查询更简短)
        - 交互方式的不同 (如语音搜索vs打字)
        - 对搜索结果的浏览差异
        - 平台特有的摩擦点
        - 完成目标的可能路径差异
        
        以JSON格式返回，格式如下:
        {{
          "primaryPlatform": {{
            "device": "用户主要设备",
            "queryStyle": "查询风格描述",
            "interactionMethod": "交互方式",
            "browsingBehavior": "浏览行为",
            "frictionPoints": ["摩擦点1", "摩擦点2"],
            "completionPath": "目标完成路径"
          }},
          "secondaryPlatform": {{
            "device": "用户次要设备",
            "queryStyle": "查询风格描述",
            "interactionMethod": "交互方式",
            "browsingBehavior": "浏览行为",
            "frictionPoints": ["摩擦点1", "摩擦点2"],
            "completionPath": "目标完成路径"
          }},
          "crossPlatformFrictions": ["跨平台摩擦点1", "跨平台摩擦点2"],
          "deviceSwitchingBehavior": "切换设备的可能行为描述"
        }}
        
        只返回JSON，不要其他解释。
      `);
      
      // 使用LLM模拟
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM响应
        const content = response.toString();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse cross-platform simulation', { content });
          return { platformSpecific: false };
        }
        
        const crossPlatformData = JSON.parse(jsonMatch[0]);
        return {
          ...crossPlatformData,
          platformSpecific: true
        };
      } catch (parseError) {
        logger.error('Failed to parse cross-platform JSON', { parseError });
        return { platformSpecific: false };
      }
    } catch (error) {
      logger.error('Failed to simulate cross-platform search', { error });
      return { platformSpecific: false };
    }
  }
  
  /**
   * 增强版搜索步骤模拟
   * 考虑用户角色特征的搜索步骤模拟
   */
  private async simulateEnhancedSearchStep(
    query: string,
    persona: any,
    previousSteps: any[],
    platform: string = '桌面电脑'
  ): Promise<any> {
    try {
      logger.debug('Simulating enhanced search step', { 
        query, 
        personaName: persona.name,
        platform,
        stepCount: previousSteps.length + 1 
      });
      
      // 获取搜索建议
      const suggestions = await this.getSearchSuggestions(query);
      
      // 获取搜索结果
      const searchResultsTool = this.searchTools ? this.searchTools.getSearchResultsTool() : null;
      let searchResults = [];
      
      if (searchResultsTool) {
        try {
          const searchResultsJson = await searchResultsTool.invoke({ keyword: query, maxResults: 5 });
          searchResults = JSON.parse(searchResultsJson);
        } catch (e) {
          logger.warn('Failed to parse search results', { error: e });
        }
      }
      
      // 为LLM准备搜索结果文本
      const searchResultsText = searchResults.map((r: any, i: number) => 
        `结果 ${i+1}:\n标题: ${r.title}\n摘要: ${r.snippet}\n网址: ${r.url}\n`
      ).join('\n');
      
      // 准备之前步骤的历史
      const previousStepsText = previousSteps.map((step, i) => 
        `步骤 ${i+1} (${step.platform || '默认平台'}):\n查询: "${step.query}"\n满意度: ${step.satisfaction}\n操作: ${step.nextAction || '继续搜索'}\n`
      ).join('\n');
      
      // 创建增强版LLM提示，整合用户角色信息
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个精通用户搜索行为分析的专家。请以下面这个特定用户角色的视角，评估搜索体验和决策行为。
        
        用户角色:
        - 名称: ${persona.name}
        - 技术水平: ${persona.techLevel}
        - 搜索行为: ${persona.searchBehavior}
        - 使用设备: ${platform}
        - 搜索目标: ${persona.goal}
        - 关注点: ${persona.focusPoint || '未指定'}
        
        当前搜索查询: "${query}"
        
        搜索结果:
        ${searchResultsText}
        
        搜索建议:
        ${suggestions.map((s, i) => `${i+1}. ${s}`).join('\n')}
        
        ${previousSteps.length > 0 ? `之前的搜索步骤:\n${previousStepsText}` : '这是第一次搜索。'}
        
        请根据这个特定用户角色的特点，分析:
        1. 用户对当前搜索结果的满意度 (0-1，1为完全满意)
        2. 用户的详细反应 (考虑用户的搜索行为特点和技术水平)
        3. 用户可能遇到的摩擦点或困难
        4. 用户会采取的下一步操作:
           - 点击哪个搜索结果
           - 修改搜索查询
           - 尝试新的搜索建议
           - 放弃搜索
           - 切换平台/设备
        5. 如果用户决定继续搜索，会选择哪个查询，为什么?
        
        以JSON格式返回详细分析:
        {{
          "satisfaction": 0.7,
          "detailedReaction": "用户反应的详细描述",
          "frictionPoints": ["摩擦点1", "摩擦点2"],
          "nextAction": "点击结果/修改查询/尝试建议/放弃/切换平台",
          "actionDetails": "下一步操作的具体细节",
          "chosenResult": {{
            "index": 2,
            "reason": "为什么选择这个结果"
          }},
          "queryModification": {{
            "newQuery": "新的查询词",
            "reason": "为什么修改为这个查询"
          }},
          "nextQueries": [
            {{
              "suggestion": "可能的后续查询",
              "confidence": 0.8,
              "reason": "为什么用户会选择这个查询"
            }}
          ],
          "abandonReason": "如果放弃，放弃的原因",
          "deviceSwitch": {{
            "newDevice": "新设备",
            "reason": "切换设备的原因"
          }}
        }}
        
        只返回JSON，不要有其他文字。确保JSON格式正确。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const content = await chain.invoke({});
      
      // 解析LLM返回的JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        logger.warn('Failed to parse LLM response for enhanced search step', { content });
        return {
          query,
          platform,
          suggestions,
          satisfaction: 0.5,
          nextAction: "继续搜索",
          nextQueries: []
        };
      }
      
      // 解析结果并添加基本信息
      const result = JSON.parse(jsonMatch[0]);
      return {
        query,
        platform,
        suggestions,
        ...result
      };
    } catch (error) {
      logger.error('Failed to simulate enhanced search step', { error, query });
      return {
        query,
        platform,
        suggestions: [],
        satisfaction: 0.5,
        nextAction: "继续搜索",
        nextQueries: []
      };
    }
  }
  
  /**
   * 增强版用户旅程痛点识别
   * 深入分析决策分支和摩擦点
   */
  private async identifyEnhancedPainPoints(
    keyword: string,
    searchSteps: any[],
    persona: any,
    crossPlatformData: any
  ): Promise<any[]> {
    if (searchSteps.length === 0) {
      return [];
    }
    
    try {
      logger.debug('Identifying enhanced pain points from search journey');
      
      // 提取搜索步骤的关键信息
      const stepsText = searchSteps.map((step, i) => `
      步骤 ${i+1} (${step.platform || '默认平台'}):
      查询: "${step.query}"
      满意度: ${step.satisfaction}
      用户反应: ${step.detailedReaction || '未记录'}
      摩擦点: ${step.frictionPoints ? step.frictionPoints.join(', ') : '无'}
      操作: ${step.nextAction || '继续搜索'}
      ${step.actionDetails ? `详情: ${step.actionDetails}` : ''}
      `).join('\n');
      
      // 提取跨平台数据
      const crossPlatformText = crossPlatformData.platformSpecific 
        ? `
        跨平台摩擦点:
        ${crossPlatformData.crossPlatformFrictions ? crossPlatformData.crossPlatformFrictions.join('\n') : '无'}
        
        设备切换行为:
        ${crossPlatformData.deviceSwitchingBehavior || '未指定'}
        ` 
        : '未进行跨平台分析';
      
      // 创建增强版LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        作为用户体验和搜索行为分析专家，请深入分析以下用户搜索旅程中的痛点和决策分支。
        
        关键词: "${keyword}"
        
        用户角色:
        - 名称: ${persona.name}
        - 技术水平: ${persona.techLevel}
        - 搜索行为: ${persona.searchBehavior}
        - 搜索目标: ${persona.goal}
        
        搜索旅程:
        ${stepsText}
        
        跨平台分析:
        ${crossPlatformText}
        
        请提供深入分析:
        
        1. 主要痛点分析 - 识别关键摩擦点和困难
        2. 决策分支分析 - 识别关键决策点及可能的替代路径
        3. 搜索放弃风险分析 - 确定用户可能放弃搜索的点和原因
        4. 跨设备连续性问题 - 在不同设备间切换时的挑战
        5. 未表达需求分析 - 从搜索行为推断出的隐含需求
        
        对于每个识别的问题，提供:
        1. 问题类型 (pain-point/decision-branch/abandonment-risk/continuity-issue/implicit-need)
        2. 详细描述
        3. 严重度 (1-10)
        4. 出现阶段 (搜索旅程中的哪个步骤)
        5. 对用户体验的影响
        6. 解决方案建议
        
        以JSON数组返回:
        [
          {{
            "type": "问题类型",
            "description": "详细描述",
            "severity": 7,
            "stage": "出现阶段",
            "userImpact": "对用户体验的影响",
            "solutionSuggestion": "解决方案建议"
          }}
        ]
        
        只返回JSON，不要有其他文字。尽量识别至少5-8个高质量的问题点。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for enhanced pain points', { content });
          return [];
        }
        
        const painPoints = JSON.parse(jsonMatch[0]);
        
        // 过滤出严重度高于阈值的痛点
        const significantPainPoints = painPoints.filter(
          (p: any) => p.severity >= this.painPointThreshold
        );
        
        logger.debug('Identified enhanced pain points', { 
          total: painPoints.length, 
          significant: significantPainPoints.length 
        });
        
        return significantPainPoints;
      } catch (parseError) {
        logger.error('Failed to parse enhanced pain points JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to identify enhanced pain points', { error });
      return [];
    }
  }
  
  /**
   * 分析隐含需求
   * 从搜索优化和放弃模式中提取隐含需求
   */
  private async extractImplicitNeeds(
    keyword: string,
    searchSteps: any[],
    painPoints: any[]
  ): Promise<any[]> {
    try {
      logger.debug('Extracting implicit needs from search patterns');
      
      // 提取搜索优化模式
      const queryRefinements = searchSteps
        .map(step => step.query)
        .filter((q, i, arr) => i > 0 && q !== arr[i-1]);
      
      const refinementText = queryRefinements.length > 0
        ? `查询优化序列:\n${queryRefinements.join(' → ')}`
        : '没有明显的查询优化';
      
      // 提取痛点模式
      const painPointText = painPoints.length > 0
        ? `主要痛点:\n${painPoints.map(p => `- ${p.description} (严重度: ${p.severity})`).join('\n')}`
        : '没有明显的痛点';
      
      // 提取放弃模式
      const abandonmentSteps = searchSteps.filter(step => 
        step.nextAction === "放弃" || 
        step.nextAction === "放弃搜索" ||
        step.satisfaction < 0.3
      );
      
      const abandonmentText = abandonmentSteps.length > 0
        ? `放弃模式:\n${abandonmentSteps.map(step => 
            `- 查询: "${step.query}" (满意度: ${step.satisfaction})\n  原因: ${step.abandonReason || '未指定'}`
          ).join('\n')}`
        : '没有明显的放弃模式';
      
      // 创建LLM提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        作为搜索意图和用户需求分析专家，请从以下搜索行为模式中提取隐含的用户需求。
        
        关键词: "${keyword}"
        
        ${refinementText}
        
        ${painPointText}
        
        ${abandonmentText}
        
        请分析上述搜索模式，识别隐藏在搜索行为背后的未表达需求:
        
        1. 查询优化暗示的需求 - 用户如何优化查询揭示了什么需求？
        2. 痛点暗示的需求 - 遇到的困难表明用户真正需要什么？
        3. 放弃模式暗示的需求 - 放弃搜索的模式揭示了什么未满足需求？
        
        对于每个识别出的隐含需求，提供:
        1. 需求描述
        2. 需求类型 (信息型/交易型/导航型/功能型)
        3. 置信度 (0.1-1.0)
        4. 证据来源 (query-refinement/pain-point/abandonment/cross-device)
        5. 支持证据
        6. 满足此需求的潜在解决方案
        
        以JSON数组返回:
        [
          {{
            "description": "隐含需求的详细描述",
            "type": "需求类型",
            "confidence": 0.8,
            "evidenceSource": "证据来源",
            "supportingEvidence": "支持这一需求存在的具体证据",
            "potentialSolution": "可能的解决方案"
          }}
        ]
        
        只返回JSON，不要有其他文字。尽量识别3-5个高质量的隐含需求。
      `);
      
      // 使用LLM执行分析
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for implicit needs', { content });
          return [];
        }
        
        const implicitNeeds = JSON.parse(jsonMatch[0]);
        logger.debug('Extracted implicit needs', { count: implicitNeeds.length });
        
        return implicitNeeds;
      } catch (parseError) {
        logger.error('Failed to parse implicit needs JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to extract implicit needs', { error });
      return [];
    }
  }
  
  /**
   * 执行LLM链，统一处理LLM调用
   */
  private async llmChain(config: {
    prompt: ChatPromptTemplate;
    outputParser: StringOutputParser;
  }) {
    // 使用父类的llm实例
    return this.llm.pipe(config.prompt).pipe(config.outputParser);
  }
  
  /**
   * 从用户旅程视角评估问题的真实性和价值
   * 验证问题是否真实存在且对用户有价值
   */
  private async validateProblemFromUserPerspective(
    problem: any,
    personas: any[]
  ): Promise<any> {
    try {
      const question = problem.refinedQuestion || problem.originalQuestion || '';
      logger.debug('Validating problem from user perspective', { question });
      
      // 至少需要一个用户角色
      if (!personas || personas.length === 0) {
        personas = await this.generateUserPersonas(question);
      }
      
      // 准备验证提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的用户行为分析专家，现在需要评估一个问题对用户的真实价值。
        
        问题: "${question}"
        
        请从以下不同用户角色的视角评估这个问题:
        ${personas.map((p, i) => `
        用户 ${i+1}: ${p.name}
        技术水平: ${p.techLevel}
        搜索行为: ${p.searchBehavior}
        设备: ${p.primaryDevice}
        目标: ${p.goal}
        `).join('\n')}
        
        请深入分析并评估:
        1. 真实性 (1-10分): 这个问题是否真实存在？真实用户会面临这个问题吗？
        2. 紧迫性 (1-10分): 用户解决此问题的迫切程度如何？
        3. 频率 (1-10分): 用户多久会遇到一次这个问题？
        4. 痛点程度 (1-10分): 这个问题给用户带来多大的困扰或损失？
        5. 已有解决方案满意度 (1-10分，10分表示完全不满意): 现有解决方案有多少缺陷？
        6. 支付意愿 (1-10分): 用户愿意为解决此问题投入多少资源？
        7. 综合分数 (1-10分): 基于以上各项的综合评估
        
        为每种用户角色提供评分，并给出最终的加权评分。分析不同角色对该问题的看法差异。
        
        以JSON格式返回结果:
        {
          "problem": "问题内容",
          "userValidations": [
            {
              "personaType": "用户类型",
              "authenticityScore": 8,
              "urgencyScore": 7,
              "frequencyScore": 6,
              "painPointScore": 8,
              "solutionGapScore": 9,
              "willingnessToPay": 7,
              "overallScore": 7.5,
              "reasoning": "该用户角色对问题的看法分析"
            }
          ],
          "finalValidityScore": 7.8,
          "validationReasoning": "综合分析该问题的有效性理由",
          "targetAudience": "最适合该问题的目标受众",
          "marketPotential": "市场潜力评估"
        }
      `);
      
      // 执行LLM验证
      const chain = this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      });
      
      const validationResult = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const parsedValidation = JSON.parse(validationResult);
        
        // 合并原始问题信息与验证结果
        return {
          ...problem,
          validation: parsedValidation,
          validityScore: parsedValidation.finalValidityScore,
          targetAudience: parsedValidation.targetAudience,
          marketPotential: parsedValidation.marketPotential,
          validationReasoning: parsedValidation.validationReasoning
        };
      } catch (error) {
        logger.error('Failed to parse problem validation result', { error });
        return {
          ...problem,
          validityScore: 0,
          validationFailed: true,
          validationError: 'Failed to parse validation result'
        };
      }
    } catch (error) {
      logger.error('Failed to validate problem from user perspective', { error });
      return {
        ...problem,
        validityScore: 0,
        validationFailed: true,
        validationError: 'Validation process failed'
      };
    }
  }
  
  /**
   * 模拟用户如何搜索问题相关解决方案
   * 分析用户在尝试解决问题时的行为和决策
   */
  private async simulateUserProblemSolvingJourney(
    problem: any,
    persona: any
  ): Promise<any> {
    try {
      const question = problem.refinedQuestion || problem.originalQuestion || '';
      logger.debug('Simulating user problem solving journey', { question, persona: persona.name });
      
      // 生成初始搜索查询
      const initialSearchQuery = await this.generateInitialSearchQuery(question, persona);
      
      // 模拟搜索步骤
      const searchSteps = [];
      let currentQuery = initialSearchQuery;
      let satisfactionReached = false;
      
      for (let i = 0; i < this.maxSteps && !satisfactionReached; i++) {
        // 执行搜索步骤
        const step = await this.simulateEnhancedSearchStep(
          currentQuery,
          persona,
          searchSteps,
          persona.primaryDevice
        );
        
        searchSteps.push(step);
        
        // 检查是否达到满意程度
        if (step.satisfactionScore >= this.minSatisfactionScore) {
          satisfactionReached = true;
          logger.debug('User satisfied with search results', { 
            step: i+1, 
            satisfactionScore: step.satisfactionScore 
          });
        } else {
          // 如果不满意，生成下一个查询
          if (i < this.maxSteps - 1) {
            currentQuery = step.nextQuery || currentQuery;
            logger.debug('User proceeding to next search step', { 
              step: i+1, 
              nextQuery: currentQuery 
            });
          }
        }
      }
      
      // 分析旅程结果
      const journeyAnalysis = {
        problem: question,
        persona: persona.name,
        searchSteps: searchSteps.length,
        initialQuery: initialSearchQuery,
        finalQuery: searchSteps[searchSteps.length - 1]?.query || initialSearchQuery,
        satisfactionReached,
        finalSatisfactionScore: searchSteps[searchSteps.length - 1]?.satisfactionScore || 0,
        averageSatisfactionScore: 
          searchSteps.reduce((acc, step) => acc + (step.satisfactionScore || 0), 0) / searchSteps.length,
        totalTimeSpent: searchSteps.reduce((acc, step) => acc + (step.timeSpent || 0), 0),
        painPoints: searchSteps
          .filter(step => step.painPoints && step.painPoints.length > 0)
          .flatMap(step => step.painPoints),
        solutionFound: searchSteps[searchSteps.length - 1]?.solutionFound || false,
        solutionQuality: searchSteps[searchSteps.length - 1]?.solutionQuality || 0,
        searchSteps
      };
      
      return journeyAnalysis;
    } catch (error) {
      logger.error('Failed to simulate user problem solving journey', { error });
      return {
        problem: problem.refinedQuestion || problem.originalQuestion,
        persona: persona.name,
        failed: true,
        error: 'Simulation failed'
      };
    }
  }
  
  /**
   * 生成初始搜索查询
   */
  private async generateInitialSearchQuery(
    problem: string,
    persona: any
  ): Promise<string> {
    try {
      // 根据问题和用户角色生成自然的初始搜索查询
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个搜索行为专家，需要预测用户会如何搜索解决特定问题。
        
        问题: "${problem}"
        
        用户角色:
        - 类型: ${persona.name}
        - 技术水平: ${persona.techLevel}
        - 搜索行为特征: ${persona.searchBehavior}
        - 设备: ${persona.primaryDevice}
        - 目标: ${persona.goal || '解决上述问题'}
        
        请预测这位用户最可能使用的初始搜索查询。考虑:
        - 用户的技术水平和搜索经验
        - 用户使用的设备特点(手机打字更简短)
        - 用户的搜索行为特征(精确/粗略等)
        
        只返回一个最可能的搜索查询，不要包含引号或其他解释。查询应该自然且符合该用户特点。
      `);
      
      const chain = this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      });
      
      const query = await chain.invoke({});
      return query.trim();
    } catch (error) {
      logger.error('Failed to generate initial search query', { error });
      // 失败时，简单使用原问题作为查询
      return problem;
    }
  }
  
  /**
   * 批量验证多个问题
   * 对一组问题进行用户视角验证
   */
  private async validateProblems(
    problems: any[],
    keyword: string
  ): Promise<any[]> {
    if (!problems || problems.length === 0) {
      logger.debug('No problems to validate');
      return [];
    }
    
    try {
      logger.debug(`Starting validation for ${problems.length} problems`, { keyword });
      
      // 限制要验证的问题数量
      const problemsToValidate = problems.slice(0, this.maxProblemsToValidate);
      
      // 生成用户角色
      const personas = await this.generateUserPersonas(keyword);
      
      // 对每个问题进行验证
      const validatedProblemsPromises = problemsToValidate.map(problem => 
        this.validateProblemFromUserPerspective(problem, personas)
      );
      
      const validatedProblems = await Promise.all(validatedProblemsPromises);
      
      // 为每个高分问题模拟一个用户旅程
      const journeySimulationsPromises = validatedProblems
        .filter(p => (p.validityScore || 0) >= this.minProblemValidityScore)
        .map(problem => {
          // 选择最相关的用户角色
          const bestPersona = this.selectBestPersonaForProblem(problem, personas);
          return this.simulateUserProblemSolvingJourney(problem, bestPersona);
        });
      
      const journeySimulations = await Promise.all(journeySimulationsPromises);
      
      // 合并验证结果和旅程模拟结果
      const validatedProblemsWithJourneys = validatedProblems.map(problem => {
        // 查找该问题的旅程模拟结果
        const journey = journeySimulations.find(j => {
          const problemQuestion = problem.refinedQuestion || problem.originalQuestion || '';
          const journeyQuestion = j.problem;
          return problemQuestion === journeyQuestion;
        });
        
        if (journey) {
          // 合并旅程信息
          return {
            ...problem,
            userJourney: journey,
            // 调整最终得分以考虑旅程中的发现
            finalScore: this.calculateFinalScore(problem, journey)
          };
        }
        
        return problem;
      });
      
      // 按最终得分排序
      const sortedProblems = validatedProblemsWithJourneys.sort((a, b) => {
        const scoreA = a.finalScore || a.validityScore || 0;
        const scoreB = b.finalScore || b.validityScore || 0;
        return scoreB - scoreA; // 降序排序
      });
      
      logger.debug('Problem validation completed', {
        validated: validatedProblems.length,
        withJourneys: journeySimulations.length,
        highValueProblems: sortedProblems.filter(p => (p.finalScore || p.validityScore || 0) >= this.minProblemValidityScore).length
      });
      
      return sortedProblems;
    } catch (error) {
      logger.error('Problem validation process failed', { error });
      return problems; // 返回原始问题列表
    }
  }
  
  /**
   * 为问题选择最适合的用户角色
   */
  private selectBestPersonaForProblem(problem: any, personas: any[]): any {
    // 默认使用第一个用户角色
    if (!personas || personas.length === 0 || !problem.validation?.userValidations) {
      return personas[0] || {
        name: '标准用户',
        techLevel: '中等',
        searchBehavior: '直接',
        primaryDevice: '桌面电脑',
        goal: '解决问题'
      };
    }
    
    try {
      // 查找评分最高的用户角色
      const userValidations = problem.validation.userValidations;
      const highestScoreValidation = userValidations.reduce((best: any, current: any) => {
        return (current.overallScore > best.overallScore) ? current : best;
      }, userValidations[0]);
      
      // 查找匹配的persona
      const matchingPersona = personas.find(p => p.name.includes(highestScoreValidation.personaType) || 
                                             highestScoreValidation.personaType.includes(p.name));
      
      return matchingPersona || personas[0];
    } catch (error) {
      logger.error('Error selecting best persona for problem', { error });
      return personas[0];
    }
  }
  
  /**
   * 计算问题的最终得分
   * 综合验证分数和用户旅程分析
   */
  private calculateFinalScore(problem: any, journey: any): number {
    try {
      // 基础分数
      const baseScore = problem.validityScore || 0;
      
      // 没有旅程数据时直接返回基础分数
      if (!journey || journey.failed) {
        return baseScore;
      }
      
      // 旅程因素调整
      const journeyFactors = {
        // 如果找到解决方案，得分降低(表示已有好的解决方案)
        solutionFound: journey.solutionFound ? -1.5 : 0,
        // 解决方案质量影响：质量越差，问题价值越高
        solutionQuality: journey.solutionQuality ? -journey.solutionQuality / 5 : 0,
        // 痛点数量：痛点越多，问题价值越高
        painPointsCount: Math.min(2, journey.painPoints?.length * 0.5) || 0,
        // 用户满意度：满意度越低，问题价值越高
        satisfactionFactor: journey.satisfactionReached ? -1 : 1,
        // 搜索步骤数：步骤越多，表示解决越困难，问题价值越高
        stepsCountFactor: Math.min(1, (journey.searchSteps - 1) * 0.25)
      };
      
      // 计算因素总和
      const journeyScore = Object.values(journeyFactors).reduce((sum, value) => sum + value, 0);
      
      // 最终分数 = 基础分数 + 旅程调整(不超过±3分)
      const finalScore = Math.max(0, Math.min(10, baseScore + journeyScore));
      
      logger.debug('Calculated final problem score', {
        baseScore,
        journeyFactors,
        journeyScore,
        finalScore
      });
      
      return Number(finalScore.toFixed(1));
    } catch (error) {
      logger.error('Error calculating final problem score', { error });
      return problem.validityScore || 0;
    }
  }
  
  /**
   * Agent执行入口
   */
  protected async executeImpl(state: any, config?: RunnableConfig): Promise<any> {
    try {
      // 从状态中获取关键词和发现的问题
      const keyword = state.input?.keyword;
      if (!keyword) {
        throw new Error('No keyword provided in state');
      }
      
      // 获取前一阶段MarketNeedExplorerAgent发现的问题
      const discoveredProblems = state.keywordDiscovery?.highValueProblems || [];
      
      logger.info(`Starting UserJourneySimulatorAgent for keyword: ${keyword}`);
      
      // 结果对象
      const result: any = {
        timestamp: new Date().toISOString(),
        keyword,
        userPersonas: [],
        problemValidations: [],
        statistics: {}
      };
      
      // Step 1: 生成用户角色
      result.userPersonas = await this.generateUserPersonas(keyword);
      
      // Step 2: 如果启用问题验证，验证前一阶段的问题
      if (this.enableProblemValidation && discoveredProblems.length > 0) {
        result.problemValidations = await this.validateProblems(discoveredProblems, keyword);
      }
      
      // Step 3: 如果没有问题验证或前一阶段未提供问题，执行标准旅程模拟
      if (!this.enableProblemValidation || result.problemValidations.length === 0) {
        // 执行标准的用户旅程模拟
        // ... 原有代码逻辑 ...
        
        // 对一个主要用户角色执行搜索旅程模拟
        const mainPersona = result.userPersonas[0];
        const crossPlatformData = await this.simulateCrossPlatformSearch(keyword, mainPersona);
        result.crossPlatformJourney = crossPlatformData;
        
        // 识别痛点和隐含需求
        const painPoints = await this.identifyEnhancedPainPoints(
          keyword,
          crossPlatformData.searchSteps || [],
          mainPersona,
          crossPlatformData
        );
        
        const implicitNeeds = await this.extractImplicitNeeds(
          keyword,
          crossPlatformData.searchSteps || [],
          painPoints
        );
        
        result.painPoints = painPoints;
        result.implicitNeeds = implicitNeeds;
      }
      
      // 统计数据
      result.statistics = {
        personasCount: result.userPersonas.length,
        validatedProblemsCount: result.problemValidations.length,
        highValueProblemsCount: result.problemValidations.filter(
          (p: any) => (p.finalScore || p.validityScore || 0) >= this.minProblemValidityScore
        ).length,
        averageValidityScore: result.problemValidations.length > 0 
          ? result.problemValidations.reduce((sum: number, p: any) => sum + (p.validityScore || 0), 0) / 
            result.problemValidations.length
          : 0
      };
      
      logger.info(`UserJourneySimulatorAgent completed for ${keyword}`);
      
      // 返回状态更新
      return {
        journeySimulation: result
      };
    } catch (error: any) {
      logger.error('Error in UserJourneySimulatorAgent', { 
        error: error.message, 
        stack: error.stack
      });
      throw error;
    }
  }
} 