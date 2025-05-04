/**
 * KeywordIntent 提示词库
 * 集中管理模型提示词，提高一致性和可维护性
 */

/**
 * 系统角色定义
 * 为不同任务定义LLM角色提示
 */
export const systemRoles = {
  categorization: 'You are a keyword categorization expert who identifies user intent patterns in search terms.',
  queryGeneration: 'You are a search optimization expert who creates effective discovery queries for uncovering valuable long-tail keywords.',
  evaluation: 'You are a keyword analysis expert who evaluates quality and commercial value of keywords across multiple dimensions.',
  planning: 'You are a keyword discovery strategist who finds patterns and gaps in keyword collections to maximize new discoveries.',
  reporting: 'You are an SEO expert who extracts actionable insights from keyword data with focus on commercial opportunities.'
};

/**
 * 核心分析指令
 * 用于增强系统提示的专业分析指令
 */
export const analysisInstructions = {
  // 领域多样性分析指令
  domainDiversity: 'Ensure keywords cover multiple domains (industries/topics) without over-concentration in any single area. Identify underrepresented domains.',
  
  // 商业价值分析指令
  commercialValue: 'Identify keywords with high conversion potential and monetization opportunity. Look for buying intent signals and commercial modifiers.',
  
  // 长尾价值分析指令
  longTail: 'Focus on specific, niche terms with lower competition but targeted intent. Prioritize longer, more specific phrases.',
  
  // 意图分析指令
  intentAnalysis: 'Categorize keywords by user intent: informational, commercial, navigational, transactional, problem-solving.',
  
  // 格式指令
  jsonFormat: 'Respond with valid JSON only. No explanatory text, markdown formatting, or non-JSON content. Start with "{" or "[" and end with "}" or "]".'
};

/**
 * KeywordIntent核心价值描述
 * 精简版本，用于系统提示增强
 */
export const coreValueDescription = `
KeywordIntent identifies valuable long-tail keywords and user intent by:
1. Uncovering low-competition terms with high cumulative traffic
2. Analyzing user intent and behavior patterns
3. Identifying commercial keywords with conversion potential
4. Discovering keyword gaps competitors overlook

When analyzing, consider:
- Search intent (informational vs. commercial)
- Long-tail value (specificity, niche relevance)
- Domain coverage (topic distribution across industries)
`;

/**
 * 分析任务详细说明
 * 为特定任务提供更详细的分析指南
 */
export const taskInstructions = {
  // 关键词分类指南
  categorization: `
Categorize keywords into the following categories:
1. Informational - User seeking information or answers (how, what, guide, tutorial)
2. Commercial Investigation - User researching before purchase (best, top, review, vs, compare)
3. Transactional - User ready to purchase or complete an action (buy, order, download, price)
4. Navigational - User looking for a specific website or page (login, official, website)
5. Problem-Solving - User trying to solve a specific issue (fix, solve, troubleshoot, error)
6. Local - User seeking location-based information (near me, in [location])

Additionally, identify high-value keywords that indicate strong purchase intent or specific needs that could be easily monetized.`,

  // 查询生成指南
  queryGeneration: `
When generating queries to discover valuable long-tail keywords:
1. Add intent modifiers to the original keyword (how to, best, vs, problems, guide)
2. Create question-based queries that reveal specific user needs
3. Add qualifiers that target specific segments (for beginners, for professionals, cheap, premium)
4. Combine the original keyword with related concepts to explore topic intersections
5. Explore commercial intent by adding purchase-related modifiers (buy, price, alternatives)
6. Consider domain rotation to explore underrepresented areas`,

  // 迭代评估指南
  evaluation: `
When evaluating keyword quality, assess these dimensions:
1. Relevance - How closely related keywords are to the original topic
2. Long-tail Value - Specificity and niche characteristics
3. Commercial Value - Presence of buying intent or monetization opportunity
4. Diversity - Coverage of different angles and subtopics
5. Domain Coverage - Breadth across different industries and sectors
6. Repetition Assessment - Measure and penalize excessive similarity in keywords

Apply different standards based on iteration stage:
- Early iterations (1-2): Prioritize breadth and diversity
- Middle iterations (3-4): Balance breadth and depth
- Later iterations (5+): Allow deeper exploration of high-value areas`,

  // 规划下一轮指南
  planning: `
When planning the next iteration of keyword discovery:
1. Identify domain coverage gaps in the current collection
2. Detect oversaturated domains and rebalance focus
3. Recognize effective query patterns from previous iterations
4. Ensure diversification of query types and formats
5. Consider the current iteration number to adjust strategy:
   - Early: Focus on broad exploration
   - Middle: Mix breadth with targeted depth
   - Late: Target high-value, underexplored opportunities`,

  // 最终报告指南
  finalReport: `
When creating the final keyword analysis report:
1. Categorize keywords by user intent and commercial value
2. Identify the highest-value keywords with specific intent
3. Analyze domain coverage and highlight any imbalances
4. Suggest specific content opportunities based on patterns
5. Calculate the distribution of intents and domains
6. Highlight underrepresented areas with potential
7. Extract actionable insights for content strategy`
};

/**
 * 获取完整系统提示
 * 组合系统角色、核心价值和任务指令
 * @param roleKey 角色键名
 * @param taskKey 任务键名
 * @param includeJsonFormat 是否包含JSON格式指令
 * @returns 完整系统提示
 */
export function getSystemPrompt(
  roleKey: keyof typeof systemRoles, 
  taskKey: keyof typeof taskInstructions,
  includeJsonFormat = false
): string {
  let prompt = `${systemRoles[roleKey]}\n\n${coreValueDescription}\n\n${taskInstructions[taskKey]}`;
  
  if (includeJsonFormat) {
    prompt += `\n\n${analysisInstructions.jsonFormat}`;
  }
  
  return prompt;
} 