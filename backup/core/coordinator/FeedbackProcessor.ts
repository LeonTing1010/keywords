/**
 * Feedback Processor
 * 
 * Responsible for processing and integrating agent feedback 
 * to improve and refine problems.
 */

import { logger } from '../../infra/logger';
import { AgentFeedback, Problem, ProblemEvolutionRecord } from '../../types/discovery';
import { v4 as uuidv4 } from 'uuid';
import { AgentLLMService } from '../llm/AgentLLMService';
import { AgentLLMServiceExtensions } from '../llm/extensions';
import { z } from 'zod';

// Define schemas for validation
const processedProblemSchema = z.object({
  id: z.string(),
  currentFormulation: z.string(),
  domain: z.array(z.string()),
  targetAudience: z.array(z.string()).optional(),
  branchSuggestions: z.array(z.object({
    formulation: z.string(),
    reason: z.string(),
    qualityEstimate: z.number().min(1).max(10)
  })).optional(),
  changesMade: z.array(z.object({
    field: z.string(),
    oldValue: z.string().or(z.array(z.string())).optional(),
    newValue: z.string().or(z.array(z.string())),
    reasoning: z.string()
  })),
  processingStrategy: z.string(),
  evolutionReasoning: z.string()
});

export class FeedbackProcessor {
  private strategy: 'accept_all' | 'majority_vote' | 'confidence_weighted';
  private llmService: AgentLLMService;
  
  constructor(
    strategy: 'accept_all' | 'majority_vote' | 'confidence_weighted' = 'confidence_weighted',
    llmService?: AgentLLMService
  ) {
    this.strategy = strategy;
    
    // Initialize LLM service
    if (llmService) {
      this.llmService = llmService;
    } else {
      // Import dynamically to avoid circular dependencies
      const { getDefaultLLMService } = require('../../core/llm/providers/llmFactory');
      this.llmService = getDefaultLLMService();
    }
    
    logger.debug({}, 'FeedbackProcessor initialized with LLM service');
  }
  
  /**
   * Process a collection of feedback for a problem using LLM
   */
  public async processFeedback(problem: Problem, feedbackItems: AgentFeedback[]): Promise<Problem> {
    if (!feedbackItems || feedbackItems.length === 0) {
      return problem;
    }
    
    logger.debug({}, `Processing ${feedbackItems.length} feedback items for problem ${problem.id} using LLM`);
    
    try {
      // Create a deep copy of the problem to modify
      const updatedProblem: Problem = JSON.parse(JSON.stringify(problem));
      
      // Add all feedback to history
      for (const feedback of feedbackItems) {
        if (!updatedProblem.feedbackHistory.some(f => 
            f.agentId === feedback.agentId && 
            f.timestamp === feedback.timestamp)) {
          updatedProblem.feedbackHistory.push(feedback);
        }
      }
      
      // Prepare feedback data for LLM
      const feedbackData = feedbackItems.map(f => ({
        id: f.id,
        agentId: f.agentId,
        agentType: f.agentType,
        feedbackType: f.feedbackType,
        confidence: f.confidenceScore,
        validationResults: f.validationResults,
        suggestedChanges: f.suggestedChanges?.map(c => ({
          field: c.fieldName,
          value: c.suggestedValue,
          reason: c.changeReasoning
        })),
        alternativeBranches: f.alternativeBranches?.map(b => ({
          formulation: b.alternativeFormulation,
          reason: b.branchReasoning,
          quality: b.estimatedQualityScore
        }))
      }));
      
      // Prepare problem data
      const problemData = {
        id: problem.id,
        currentFormulation: problem.currentFormulation,
        originalFormulation: problem.originalFormulation || problem.currentFormulation,
        domain: problem.domain,
        targetAudience: problem.targetAudience,
        qualityScore: problem.qualityScore,
        evidenceCount: problem.evidence.length,
        iterationCount: problem.metadata.iterationCount
      };
      
      // Construct prompt for feedback processing
      const prompt = `
        作为问题精炼专家，请全面分析这个问题的所有反馈，进行深度思考，并做出适当的改进。
        
        # 问题信息
        ID: ${problemData.id}
        当前表述: "${problemData.currentFormulation}"
        原始表述: "${problemData.originalFormulation}"
        领域: ${problemData.domain.join(', ')}
        目标受众: ${problemData.targetAudience ? problemData.targetAudience.join(', ') : '未指定'}
        质量评分: ${problemData.qualityScore.overall}/10
        证据数量: ${problemData.evidenceCount}
        迭代次数: ${problemData.iterationCount}
        
        # 来自Agent的反馈 (${feedbackItems.length} 项)
        ${feedbackData.map((f, i) => `
        反馈 ${i+1}:
        - Agent: ${f.agentType} (ID: ${f.agentId})
        - 类型: ${f.feedbackType}
        - 置信度: ${f.confidence}
        - 验证结果: ${f.validationResults?.isValid ? '有效' : '无效'} - ${f.validationResults?.validationReasoning || '未提供推理'}
        
        ${f.suggestedChanges?.length ? `建议修改:
        ${f.suggestedChanges.map(c => `- ${c.field}: "${c.value}" (原因: ${c.reason})`).join('\n')}` : '没有建议修改'}
        
        ${f.alternativeBranches?.length ? `替代分支:
        ${f.alternativeBranches.map(b => `- "${b.formulation}" (质量评分: ${b.quality}, 原因: ${b.reason})`).join('\n')}` : '没有建议分支'}
        `).join('\n')}
        
        # 处理策略: ${this.strategy.toUpperCase()}
        ${this.strategy === 'accept_all' ? 
          '- 应用所有具有合理置信度的建议修改' : 
          this.strategy === 'majority_vote' ? 
          '- 应用大多数Agent同意的修改' : 
          '- 根据Agent的置信度加权应用修改'}
        
        # 任务
        1. 全面分析所有反馈，进行系统性思考
        2. 综合考虑所有建议，深入理解问题本质
        3. 根据处理策略确定要应用的修改
        4. 基于深度思考重新定义和优化问题
        5. 评估是否需要创建问题分支
        
        请返回一个JSON对象，包含:
        {
          "id": "${problem.id}",
          "currentFormulation": "经过深度思考的优化问题表述",
          "domain": ["领域1", "领域2"],
          "targetAudience": ["受众1", "受众2"],
          "branchSuggestions": [
            {
              "formulation": "替代分支表述",
              "reason": "创建此分支的原因",
              "qualityEstimate": 7
            }
          ],
          "changesMade": [
            {
              "field": "currentFormulation",
              "oldValue": "之前的表述",
              "newValue": "新的表述",
              "reasoning": "为什么做这个改变的详细理由"
            }
          ],
          "processingStrategy": "采用了哪种策略",
          "evolutionReasoning": "问题演变的全面解释，包括思考过程和综合理由"
        }
      `;
      
      // Create default values in case of failure
      const defaultResult = {
        id: problem.id,
        currentFormulation: problem.currentFormulation,
        domain: problem.domain,
        targetAudience: problem.targetAudience || [],
        branchSuggestions: [],
        changesMade: [],
        processingStrategy: this.strategy,
        evolutionReasoning: "No changes made due to processing failure"
      };
      
      // Use LLM to process feedback with schema validation
      const processingResult = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '5-process-problem-feedback',
        processedProblemSchema,
        {
          temperature: 0.3,
          defaultValue: defaultResult
        }
      );
      
      // Record original formulation for evolution tracking
      const previousFormulation = updatedProblem.currentFormulation;
      const originalQualityScore = updatedProblem.qualityScore.overall;
      
      // Apply changes from LLM result
      updatedProblem.currentFormulation = processingResult.currentFormulation;
      
      if (processingResult.domain && processingResult.domain.length > 0) {
        updatedProblem.domain = processingResult.domain;
      }
      
      if (processingResult.targetAudience && processingResult.targetAudience.length > 0) {
        updatedProblem.targetAudience = processingResult.targetAudience;
      }
      
      // Create branches if suggested
      if (processingResult.branchSuggestions && processingResult.branchSuggestions.length > 0) {
        if (!updatedProblem.branches) {
          updatedProblem.branches = [];
        }
        
        for (const suggestion of processingResult.branchSuggestions) {
          // Skip if too similar to existing branches (simple check)
          if (this.isDuplicateBranch(updatedProblem, suggestion.formulation)) {
            continue;
          }
          
          const branchId = uuidv4();
          updatedProblem.branches.push({
            branchId,
            formulation: suggestion.formulation,
            creationReason: suggestion.reason,
            qualityScore: suggestion.qualityEstimate,
            isExplored: false
          });
          
          logger.debug({}, `Added branch ${branchId} to problem ${updatedProblem.id}`);
        }
      }
      
      // Update metadata
      updatedProblem.metadata.updatedAt = new Date().toISOString();
      updatedProblem.metadata.updatedBy = 'feedback_processor';
      updatedProblem.metadata.iterationCount += 1;
      
      // Record the evolution if formulation changed
      if (previousFormulation !== updatedProblem.currentFormulation) {
        updatedProblem.evolutionPath.push(this.createEvolutionRecord(
          updatedProblem,
          previousFormulation,
          updatedProblem.currentFormulation,
          'feedback_processor',
          processingResult.evolutionReasoning,
          originalQualityScore,
          updatedProblem.qualityScore.overall
        ));
        
        logger.info({}, `Updated problem ${updatedProblem.id} based on feedback processing`);
      } else {
        logger.info({}, `No formulation changes made to problem ${updatedProblem.id}`);
      }
      
      return updatedProblem;
    } catch (error: any) {
      logger.error({ error }, `Error processing feedback with LLM: ${error.message}`);
      
      // Fallback: Return problem with feedback history updated but no other changes
      const fallbackProblem: Problem = JSON.parse(JSON.stringify(problem));
      
      // Add feedback to history
      for (const feedback of feedbackItems) {
        if (!fallbackProblem.feedbackHistory.some(f => 
            f.agentId === feedback.agentId && 
            f.timestamp === feedback.timestamp)) {
          fallbackProblem.feedbackHistory.push(feedback);
        }
      }
      
      // Update metadata
      fallbackProblem.metadata.updatedAt = new Date().toISOString();
      fallbackProblem.metadata.updatedBy = 'feedback_processor';
      
      return fallbackProblem;
    }
  }
  
  /**
   * Simple check if a branch formulation is too similar to existing branches
   */
  private isDuplicateBranch(problem: Problem, formulation: string): boolean {
    // Skip if formulation is identical to the current formulation
    if (formulation === problem.currentFormulation) {
      return true;
    }
    
    // Check existing branches with simple text comparison
    if (problem.branches && problem.branches.length > 0) {
      for (const branch of problem.branches) {
        // Simple similarity check
        const normalizedFormulation = formulation.toLowerCase().trim();
        const normalizedBranchFormulation = branch.formulation.toLowerCase().trim();
        
        if (normalizedFormulation === normalizedBranchFormulation ||
            normalizedFormulation.includes(normalizedBranchFormulation) ||
            normalizedBranchFormulation.includes(normalizedFormulation)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Create an evolution record for tracking problem changes
   */
  private createEvolutionRecord(
    problem: Problem,
    previousFormulation: string,
    currentFormulation: string,
    agent: string,
    reasoning: string,
    qualityScoreBefore: number,
    qualityScoreAfter: number
  ): ProblemEvolutionRecord {
    return {
      timestamp: new Date().toISOString(),
      stage: 'refinement',
      previousFormulation,
      currentFormulation,
      agent,
      reasoning,
      qualityScoreBefore,
      qualityScoreAfter
    };
  }
  
  /**
   * Process and refine a collection of problems
   */
  public async processAllProblems(
    problems: Problem[], 
    feedbackMap: Map<string, AgentFeedback[]>
  ): Promise<Problem[]> {
    const refinedProblems: Problem[] = [];
    
    for (const problem of problems) {
      const feedback = feedbackMap.get(problem.id) || [];
      const refinedProblem = await this.processFeedback(problem, feedback);
      refinedProblems.push(refinedProblem);
    }
    
    return refinedProblems;
  }
} 