/**
 * KeywordNova 检查点服务模块
 * 处理发现引擎状态的保存和恢复，支持断点续传
 */
import * as fs from 'fs';
import * as path from 'path';
import { ensureOutputDirectory, saveJsonToFile, readJsonFromFile, fileExists } from './fileUtils';
import { DiscoveryResult, IterationHistory } from '../types';
import { ErrorType, AppError } from './errorHandler';

// 检查点数据结构
export interface DiscoveryCheckpoint {
  timestamp: string;
  originalKeyword: string;
  totalIterations: number;
  discoveredKeywords: string[];
  iterationHistory: IterationHistory[];
  lastCompletedIteration: number;
  engineState: {
    satisfactionScore?: number;
    lastQuery?: string;
    recommendedQueries?: string[];
  };
}

/**
 * 检查点服务类
 * 处理发现引擎状态的保存和恢复
 */
export class CheckpointService {
  private checkpointDir: string;
  private checkpointFile: string | null = null;
  
  /**
   * 创建检查点服务实例
   * @param originalKeyword 原始关键词
   */
  constructor(originalKeyword: string) {
    // 创建检查点目录
    this.checkpointDir = path.join(ensureOutputDirectory(), 'checkpoints');
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
    
    // 为当前关键词设置检查点文件
    const safeKeyword = originalKeyword.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    this.checkpointFile = path.join(this.checkpointDir, `${safeKeyword}_checkpoint.json`);
  }
  
  /**
   * 保存检查点
   * @param discoveredKeywords 已发现的关键词集合
   * @param iterationHistory 迭代历史记录
   * @param lastCompletedIteration 最后完成的迭代编号
   * @param engineState 引擎状态
   */
  public saveCheckpoint(
    originalKeyword: string,
    discoveredKeywords: Set<string>,
    iterationHistory: IterationHistory[],
    lastCompletedIteration: number,
    engineState: {
      satisfactionScore?: number;
      lastQuery?: string;
      recommendedQueries?: string[];
    } = {}
  ): void {
    if (!this.checkpointFile) return;
    
    try {
      const checkpoint: DiscoveryCheckpoint = {
        timestamp: new Date().toISOString(),
        originalKeyword,
        totalIterations: iterationHistory.length,
        discoveredKeywords: Array.from(discoveredKeywords),
        iterationHistory,
        lastCompletedIteration,
        engineState
      };
      
      saveJsonToFile(checkpoint, this.checkpointFile);
      console.log(`[检查点] 保存迭代状态 #${lastCompletedIteration}`);
    } catch (error) {
      console.error(`[检查点] 保存失败: ${(error as Error).message}`);
    }
  }
  
  /**
   * 检查是否存在检查点
   * @returns 是否存在检查点
   */
  public hasCheckpoint(): boolean {
    return this.checkpointFile !== null && fileExists(this.checkpointFile);
  }
  
  /**
   * 恢复检查点
   * @returns 恢复的检查点数据或null（如果不存在）
   */
  public restoreCheckpoint(): DiscoveryCheckpoint | null {
    if (!this.hasCheckpoint()) {
      return null;
    }
    
    try {
      const checkpoint = readJsonFromFile<DiscoveryCheckpoint>(this.checkpointFile!);
      console.log(`[检查点] 恢复迭代状态 #${checkpoint.lastCompletedIteration}`);
      return checkpoint;
    } catch (error) {
      console.error(`[检查点] 恢复失败: ${(error as Error).message}`);
      return null;
    }
  }
  
  /**
   * 删除检查点文件
   */
  public clearCheckpoint(): void {
    if (this.checkpointFile && fileExists(this.checkpointFile)) {
      try {
        fs.unlinkSync(this.checkpointFile);
        console.log(`[检查点] 已清除检查点`);
      } catch (error) {
        console.error(`[检查点] 清除失败: ${(error as Error).message}`);
      }
    }
  }
  
  /**
   * 从检查点和当前结果创建最终发现结果
   * @param checkpoint 检查点数据
   * @returns 发现结果对象
   */
  public createResultFromCheckpoint(checkpoint: DiscoveryCheckpoint): DiscoveryResult {
    // 从检查点数据创建发现结果
    const discoveryResult: DiscoveryResult = {
      originalKeyword: checkpoint.originalKeyword,
      totalIterations: checkpoint.lastCompletedIteration,
      totalKeywordsDiscovered: checkpoint.discoveredKeywords.length,
      keywordsByIteration: {},
      satisfactionByIteration: {},
      keywords: checkpoint.discoveredKeywords,
      highValueKeywords: [],
      intentAnalysis: null,
      iterationHistory: checkpoint.iterationHistory,
      summary: `通过检查点恢复，执行了 ${checkpoint.lastCompletedIteration} 次迭代，发现了 ${checkpoint.discoveredKeywords.length} 个关键词`
    };
    
    // 添加每次迭代的关键词
    checkpoint.iterationHistory.forEach(iteration => {
      discoveryResult.keywordsByIteration[iteration.iterationNumber] = iteration.keywords;
      discoveryResult.satisfactionByIteration[iteration.iterationNumber] = iteration.satisfactionScore;
    });
    
    return discoveryResult;
  }
} 