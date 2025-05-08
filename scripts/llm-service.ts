/**
 * llm-service.ts
 * 
 * 运行LLM服务作为永久服务，支持流式响应测试
 * 使用Express创建一个简单的API服务器，提供LLM分析功能
 */

import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { EnhancedLLMService } from '../src/core/llm/EnhancedLLMService';
import { logger } from '../src/infra/logger';

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
app.use(express.json());
app.use(cors());

// 创建LLM服务实例
const llmService = new EnhancedLLMService({
  enableCache: true,
  autoModelSelection: true,
  enableStreamingByDefault: false,
  collectFeedback: true
});

// 根路由
app.get('/', (req, res) => {
  res.send('增强版LLM服务正在运行');
});

// 服务信息路由
app.get('/api/info', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    features: {
      streaming: true,
      cache: true,
      autoModelSelection: true,
      feedback: true,
      abTesting: true
    },
    stats: llmService.getStats()
  });
});

// 标准分析API
app.post('/api/analyze', async (req, res) => {
  try {
    const { prompt, analysisType = 'general', options = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: '缺少prompt参数' });
    }
    
    // 执行分析
    const result = await llmService.analyze(prompt, analysisType, options);
    
    // 返回结果
    res.json({ success: true, result });
  } catch (error: any) {
    logger.error('API分析失败', { error });
    res.status(500).json({ 
      error: '分析失败', 
      message: error?.message || '未知错误'
    });
  }
});

// 流式分析API
app.post('/api/analyze/stream', async (req, res) => {
  try {
    const { prompt, analysisType = 'general', options = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: '缺少prompt参数' });
    }
    
    // 设置SSE头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 生成请求ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    let fullResponse = '';
    
    // 处理流式分析
    await llmService.analyze(prompt, analysisType, {
      ...options,
      stream: true,
      onChunk: (chunk) => {
        // 发送SSE事件
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        fullResponse += chunk;
      },
      progressCallback: (progress) => {
        // 发送进度更新
        res.write(`data: ${JSON.stringify({ progress, type: 'progress' })}\n\n`);
      }
    });
    
    // 发送完成事件
    res.write(`data: ${JSON.stringify({ type: 'done', requestId })}\n\n`);
    res.end();
    
    logger.info('流式分析完成', { requestId });
  } catch (error: any) {
    logger.error('流式API分析失败', { error });
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error?.message || '未知错误'
    })}\n\n`);
    res.end();
  }
});

// 提交反馈API
app.post('/api/feedback', (req, res) => {
  try {
    const { requestId, rating, feedback } = req.body;
    
    if (!requestId || rating === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 提交反馈
    llmService.submitFeedback(requestId, rating, feedback);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('提交反馈失败', { error });
    res.status(500).json({ error: '提交失败', message: error?.message || '未知错误' });
  }
});

// 设置A/B测试
app.post('/api/ab-test', (req, res) => {
  try {
    const { testId, variants } = req.body;
    
    if (!testId || !variants || !Array.isArray(variants)) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 配置A/B测试
    llmService.configureABTest(testId, variants);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('配置A/B测试失败', { error });
    res.status(500).json({ error: '配置失败', message: error?.message || '未知错误' });
  }
});

// 服务器端口
const PORT = process.env.SERVER_PORT || 3000;

// 启动服务器
app.listen(PORT, () => {
  logger.info(`增强版LLM服务已启动，监听端口 ${PORT}`);
  console.log(`增强版LLM服务已启动，监听端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT}/ 查看服务状态`);
  console.log(`流式API: http://localhost:${PORT}/api/analyze/stream`);
});

// 处理退出信号
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，优雅关闭中...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，优雅关闭中...');
  process.exit(0);
}); 