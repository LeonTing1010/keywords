/**
 * LangGraph NeedMiner 示例脚本
 * 演示如何使用基于LangGraph的多Agent系统
 * 
 * 使用方法:
 * ts-node examples/langgraph-demo.ts
 */
import { createNeedMinerSystem } from '../src/langgraph/NeedMinerSystem';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });
dotenv.config();

async function runDemo() {
  console.log('启动NeedMiner LangGraph示例...\n');

  try {
    // 创建NeedMiner系统实例
    const system = createNeedMinerSystem({
      outputDir: './output',
      format: 'markdown',
      language: 'zh',
      modelName: process.env.LLM_MODEL || 'gpt-4',
      verbose: true
    });

    console.log('✅ 系统初始化完成');
    console.log('🔍 分析关键词: "智能家居控制系统"');
    console.log('⏳ 分析中，请稍候...\n');

    // 执行关键词分析 - 快速模式
    const result = await system.analyzeKeyword('智能家居控制系统', {
      fast: true,  // 使用快速模式，减少处理时间
      includeDetails: true  // 包含详细信息
    });

    console.log('\n✅ 分析完成!');
    console.log(`📊 结果统计:`);
    console.log(`   - 发现关键词数: ${result.metrics.totalKeywordsDiscovered}`);
    console.log(`   - 未满足需求数: ${result.metrics.totalUnmetNeeds}`);
    console.log(`   - 洞察数: ${result.metrics.totalInsights}`);
    console.log(`   - 机会数: ${result.metrics.totalOpportunities}`);
    console.log(`   - 处理时间: ${(result.metrics.totalProcessingTimeMs / 1000).toFixed(2)}秒`);
    console.log(`\n📄 报告已保存至: ${result.reportPath}`);

    // 可选: 批量分析
    if (process.env.RUN_BATCH_EXAMPLE === 'true') {
      console.log('\n🔄 开始批量分析示例...');
      const batchResults = await system.batchAnalyzeKeywords(
        ['智能音箱', '家庭自动化', '智能门锁'], 
        { fast: true, concurrentLimit: 1 }
      );
      
      console.log('\n✅ 批量分析完成!');
      console.log(`📊 成功完成: ${batchResults.filter(r => r.success).length} / ${batchResults.length}`);
      
      // 显示每个结果的路径
      batchResults.forEach(r => {
        if (r.success) {
          console.log(`   - ${r.keyword}: ${r.reportPath}`);
        } else {
          console.log(`   - ${r.keyword}: 失败 (${r.error})`);
        }
      });
    }
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
  }
}

// 运行示例
runDemo().catch(console.error); 