/**
 * Similarity Detector
 * 
 * Responsible for detecting similarity between problems and 
 * managing merges of similar problems.
 */

import { logger } from '../../infra/logger';
import { Problem, SimilarityDetectionSettings } from '../../types/discovery';
import { AgentLLMService } from '../llm/AgentLLMService';
import { AgentLLMServiceExtensions } from '../llm/extensions';
import { z } from 'zod';

// Define schemas for validation
const similarProblemGroupSchema = z.record(z.string(), z.array(z.string()));

const mergedProblemSchema = z.object({
  id: z.string(),
  currentFormulation: z.string(),
  originalFormulation: z.string().optional(),
  domain: z.array(z.string()),
  targetAudience: z.array(z.string()).optional(),
  evidence: z.array(z.any()),
  relatedProblems: z.array(z.any()),
  mergeReasoning: z.string()
});

export class SimilarityDetector {
  private settings: SimilarityDetectionSettings;
  private llmService: AgentLLMService;
  
  constructor(settings: SimilarityDetectionSettings, llmService?: AgentLLMService) {
    this.settings = settings;
    
    if (llmService) {
      this.llmService = llmService;
    } else {
      // Import dynamically to avoid circular dependencies
      const { getDefaultLLMService } = require('../../core/llm/providers/llmFactory');
      this.llmService = getDefaultLLMService();
    }
    
    logger.debug({}, 'SimilarityDetector initialized with LLM service');
  }
  
  /**
   * Detect similar problems across a collection using LLM
   */
  public async detectSimilarProblems(problems: Problem[]): Promise<Map<string, string[]>> {
    logger.debug({}, `Detecting similar problems among ${problems.length} problems using LLM`);
    
    // Skip if we have fewer than 2 problems
    if (problems.length < 2) {
      return new Map<string, string[]>();
    }
    
    try {
      // Prepare problem data for LLM
      const problemsData = problems.map(p => ({
        id: p.id,
        formulation: p.currentFormulation,
        domain: p.domain.join(', '),
        audience: p.targetAudience ? p.targetAudience.join(', ') : 'Unknown'
      }));
      
      // Construct prompt
      const prompt = `
        作为相似性检测专家，请分析以下问题并识别相似问题组，遵循NeuralMiner的多Agent协作生态理念。
        
        # 待分析问题:
        ${problemsData.map((p, i) => `
        问题 ${i+1} [ID: ${p.id}]:
        - 问题描述: "${p.formulation}"
        - 领域: ${p.domain}
        - 目标用户: ${p.audience}`).join('\n')}
        
        # 相似性分析指南:
        1. 识别语义相似的问题 (相似度阈值: ${this.settings.threshold})
        2. 将相似问题与主要问题分组 (选择描述最全面的作为主要问题)
        3. 对每个主要问题，列出相似的次要问题ID
        
        # 相似度评估标准:
        - 问题描述相似度权重: ${this.settings.useWeightedFactors ? this.settings.weightFactors?.formulationSimilarity || 0.6 : 0.6}
        - 领域相似度权重: ${this.settings.useWeightedFactors ? this.settings.weightFactors?.domainSimilarity || 0.15 : 0.15}
        - 目标用户相似度权重: ${this.settings.useWeightedFactors ? this.settings.weightFactors?.audienceSimilarity || 0.15 : 0.15}
        - 证据相似度权重: ${this.settings.useWeightedFactors ? this.settings.weightFactors?.evidenceSimilarity || 0.1 : 0.1}
        
        # 优先考虑真实用户需求:
        - 确保识别出真实存在但尚未被解决的高价值用户需求相似组
        - 考虑问题的紧迫性和影响规模
        - 评估问题解决缺口的相似度
        
        仅返回一个JSON对象，其中:
        - 每个键是主要问题的ID
        - 每个值是相似次要问题ID的数组
        
        示例格式:
        {
          "problem-id-1": ["problem-id-2", "problem-id-3"],
          "problem-id-4": ["problem-id-5"]
        }
        
        只包含至少有一个相似问题的问题组。没有相似匹配的问题应省略。
      `;
      // Default value in case of failure
      const defaultValue: Record<string, string[]> = {};
      
      // Use LLM to analyze with schema validation
      const similarityGroups = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '6-detect-similar-problems',
        similarProblemGroupSchema,
        {
          temperature: 0.2,
          defaultValue
        }
      );
      
      // Convert to Map
      const result = new Map<string, string[]>();
      Object.entries(similarityGroups).forEach(([primaryId, secondaryIds]) => {
        result.set(primaryId, secondaryIds);
        
        // Update the relationship in the problems
        const primaryProblem = problems.find(p => p.id === primaryId);
        if (primaryProblem) {
          secondaryIds.forEach(secondaryId => {
            const secondaryProblem = problems.find(p => p.id === secondaryId);
            if (secondaryProblem) {
              // Record similarity relationship in both problems
              this.recordSimilarityRelationship(primaryProblem, secondaryProblem, this.settings.threshold);
            }
          });
        }
      });
      
      logger.info({}, `LLM detected ${result.size} similarity groups among ${problems.length} problems`);
      return result;
    } catch (error: any) {
      logger.error({ error }, `Error detecting similar problems with LLM: ${error.message}`);
      return new Map<string, string[]>();
    }
  }
  
  /**
   * Record similarity relationship in both problems
   */
  private recordSimilarityRelationship(problem1: Problem, problem2: Problem, similarityScore: number): void {
    // Add to problem1's related problems if not already there
    if (!problem1.relatedProblems.some(rp => rp.problemId === problem2.id)) {
      problem1.relatedProblems.push({
        problemId: problem2.id,
        relationshipType: 'similar',
        similarityScore
      });
    }
    
    // Add to problem2's related problems if not already there
    if (!problem2.relatedProblems.some(rp => rp.problemId === problem1.id)) {
      problem2.relatedProblems.push({
        problemId: problem1.id,
        relationshipType: 'similar',
        similarityScore
      });
    }
  }
  
  /**
   * Merge similar problems into a single improved problem using LLM
   */
  public async mergeProblems(primaryProblem: Problem, secondaryProblems: Problem[]): Promise<Problem> {
    if (secondaryProblems.length === 0) {
      return primaryProblem;
    }
    
    logger.debug({}, `Merging ${secondaryProblems.length} problems into primary problem ${primaryProblem.id} using LLM`);
    
    try {
      // Create a deep copy of the primary problem for merging
      const mergedProblem: Problem = JSON.parse(JSON.stringify(primaryProblem));
      
      // Store the IDs of merged problems
      const mergedIds = secondaryProblems.map(p => p.id);
      
      // Prepare problem data for LLM
      const primaryData = {
        id: primaryProblem.id,
        formulation: primaryProblem.currentFormulation,
        domain: primaryProblem.domain.join(', '),
        audience: primaryProblem.targetAudience ? primaryProblem.targetAudience.join(', ') : 'Not specified',
        evidenceCount: primaryProblem.evidence.length
      };
      
      const secondaryData = secondaryProblems.map(p => ({
        id: p.id,
        formulation: p.currentFormulation,
        domain: p.domain.join(', '),
        audience: p.targetAudience ? p.targetAudience.join(', ') : 'Not specified',
        evidenceCount: p.evidence.length
      }));
      
      // Construct merge prompt
      const prompt = `
        作为需求分析与综合专家，请将这些相似问题合并为一个改进版本。

        # 主要问题:
        ID: ${primaryData.id}
        问题描述: "${primaryData.formulation}"
        领域: ${primaryData.domain}
        目标用户: ${primaryData.audience}
        证据数量: ${primaryData.evidenceCount}
        
        # 次要问题(待合并):
        ${secondaryData.map((p, i) => `
        问题 ${i+1} [ID: ${p.id}]:
        - 问题描述: "${p.formulation}"
        - 领域: ${p.domain}
        - 目标用户: ${p.audience}
        - 证据数量: ${p.evidenceCount}`).join('\n')}
        
        # 合并指南:
        1. 创建一个综合所有洞察的改进问题描述，确保发现真实存在但尚未被解决的高价值用户需求
        2. 合并所有问题的领域，形成完整的领域覆盖
        3. 合并所有问题的目标用户群体，确保全面性
        4. 提供合并决策的详细理由，体现问题的真实性与价值
        5. 确保合并后的问题具有足够的细节和深度，便于后续分析和解决方案设计
        
        请返回符合以下格式的JSON对象:
        {
          "id": "${primaryProblem.id}",
          "currentFormulation": "改进后的综合问题描述",
          "domain": ["领域1", "领域2", ...],
          "targetAudience": ["用户群体1", "用户群体2", ...],
          "evidence": [],
          "relatedProblems": [],
          "mergeReasoning": "合并决策的详细解释"
        }
        
        # 合并评估标准:
        - 问题真实性(用户确实在搜索此问题): 1-10分
        - 问题紧迫性(用户解决问题的迫切程度): 1-10分
        - 影响规模(受此问题影响的潜在用户数量): 1-10分
        - 解决缺口(现有解决方案的质量差距): 1-10分
        - 实施可行性(构建解决方案的难度): 1-10分
      `;
      
      // Create default merged values in case of failure
      const defaultMerged = {
        id: primaryProblem.id,
        currentFormulation: primaryProblem.currentFormulation,
        originalFormulation: primaryProblem.originalFormulation || primaryProblem.currentFormulation,
        domain: [...new Set([...primaryProblem.domain, ...secondaryProblems.flatMap(p => p.domain)])],
        targetAudience: primaryProblem.targetAudience || [],
        evidence: [],
        relatedProblems: [],
        mergeReasoning: `Automated merge of ${secondaryProblems.length} similar problems`
      };
      
      // Use LLM to perform merge with schema validation
      const mergeResult = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        '6-merge-similar-problems',
        mergedProblemSchema,
        {
          temperature: 0.3,
          defaultValue: defaultMerged
        }
      );
      
      // Update the merged problem with LLM-generated content
      mergedProblem.currentFormulation = mergeResult.currentFormulation;
      mergedProblem.domain = mergeResult.domain;
      if (mergeResult.targetAudience && mergeResult.targetAudience.length > 0) {
        mergedProblem.targetAudience = mergeResult.targetAudience;
      }
      
      // Update metadata
      mergedProblem.metadata.updatedAt = new Date().toISOString();
      mergedProblem.metadata.updatedBy = 'similarity_detector';
      
      // Add merge history
      if (!mergedProblem.metadata.mergeHistory) {
        mergedProblem.metadata.mergeHistory = [];
      }
      
      mergedProblem.metadata.mergeHistory.push({
        mergedProblemIds: mergedIds,
        mergeReasoning: mergeResult.mergeReasoning,
        timestamp: new Date().toISOString()
      });
      
      // Combine evidence from all problems
      for (const problem of secondaryProblems) {
        mergedProblem.evidence = [
          ...mergedProblem.evidence,
          ...problem.evidence.map(e => ({
            ...e,
            metadata: { ...e.metadata, originalProblemId: problem.id }
          }))
        ];
      }
      
      // Add an evolution record for the merge
      mergedProblem.evolutionPath.push({
        timestamp: new Date().toISOString(),
        stage: 'merge',
        previousFormulation: primaryProblem.currentFormulation,
        currentFormulation: mergedProblem.currentFormulation,
        agent: 'similarity_detector',
        reasoning: mergeResult.mergeReasoning,
        qualityScoreBefore: mergedProblem.qualityScore.overall,
        qualityScoreAfter: mergedProblem.qualityScore.overall // will be updated later
      });
      
      // Combine feedback history
      for (const problem of secondaryProblems) {
        mergedProblem.feedbackHistory = [
          ...mergedProblem.feedbackHistory,
          ...problem.feedbackHistory.map(f => ({
            ...f,
            problemId: mergedProblem.id,
            metadata: { ...f.metadata, originalProblemId: problem.id }
          }))
        ];
      }
      
      logger.info({}, `Successfully merged problems [${mergedIds.join(', ')}] into ${mergedProblem.id}`);
      return mergedProblem;
    } catch (error: any) {
      logger.error({ error }, `Error merging problems with LLM: ${error.message}`);
      
      // Fallback: Create a minimal merge without LLM
      const mergedProblem = JSON.parse(JSON.stringify(primaryProblem));
      mergedProblem.metadata.updatedAt = new Date().toISOString();
      
      // Simple domain combination
      const allDomains = new Set(mergedProblem.domain);
      for (const problem of secondaryProblems) {
        problem.domain.forEach(domain => allDomains.add(domain));
      }
      mergedProblem.domain = Array.from(allDomains);
      
      return mergedProblem;
    }
  }
} 