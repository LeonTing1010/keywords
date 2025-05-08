/**
 * monitor-llm-logs.js - LLM调用日志监控工具
 * 
 * 此脚本监控logs/debug目录中的LLM调用日志文件，实时提供统计信息
 * 和错误分析，帮助诊断LLM相关问题
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置
const config = {
  debugDir: path.join(process.cwd(), 'logs', 'debug'),
  pollInterval: 2000, // 轮询间隔（毫秒）
  tailLines: 20,       // tail显示的行数
  errorPatterns: [
    'JSON格式验证失败',
    'JSON结构验证失败',
    'LLM返回格式错误',
    'API调用失败',
    '模型API调用失败',
    'Failed to generate',
    'Error in report generation'
  ]
};

// 统计变量
let stats = {
  totalFiles: 0,
  promptFiles: 0,
  responseFiles: 0,
  errorFiles: 0,
  parseFailedFiles: 0,
  lastCheckTime: Date.now(),
  errorsFound: [],
  filesSinceLastCheck: 0
};

// 初始化
function initialize() {
  console.log(`启动LLM调用日志监控`);
  console.log(`监控目录: ${config.debugDir}`);
  
  // 创建目录（如果不存在）
  if (!fs.existsSync(config.debugDir)) {
    fs.mkdirSync(config.debugDir, { recursive: true });
    console.log(`创建了监控目录: ${config.debugDir}`);
  }
  
  // 开始轮询
  setInterval(checkForNewFiles, config.pollInterval);
  
  // 立即执行一次检查
  checkForNewFiles();
}

// 检查新文件
function checkForNewFiles() {
  try {
    if (!fs.existsSync(config.debugDir)) {
      return;
    }
    
    // 获取目录中的所有文件
    const files = fs.readdirSync(config.debugDir)
      .filter(f => f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(config.debugDir, f),
        stats: fs.statSync(path.join(config.debugDir, f))
      }))
      .filter(f => f.stats.isFile())
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // 最新的优先
    
    // 更新统计信息
    stats.totalFiles = files.length;
    stats.promptFiles = files.filter(f => f.name.startsWith('llm_prompt_')).length;
    stats.responseFiles = files.filter(f => f.name.startsWith('llm_response_')).length;
    stats.errorFiles = files.filter(f => f.name.startsWith('json_parse_failed_')).length;
    
    // 计算上次检查后的新文件
    const newFiles = files.filter(f => f.stats.mtimeMs > stats.lastCheckTime);
    stats.filesSinceLastCheck = newFiles.length;
    
    // 如果有新文件，显示信息
    if (newFiles.length > 0) {
      console.log(`\n[${new Date().toISOString()}] 发现 ${newFiles.length} 个新文件`);
      printStats();
      
      // 检查每个新文件中是否有错误模式
      newFiles.forEach(file => {
        checkFileForErrors(file);
      });
    }
    
    stats.lastCheckTime = Date.now();
  } catch (error) {
    console.error('检查新文件时出错:', error);
  }
}

// 检查文件中的错误
function checkFileForErrors(file) {
  try {
    const content = fs.readFileSync(file.path, 'utf8');
    
    // 检查是否匹配错误模式
    const matchedPatterns = config.errorPatterns.filter(pattern => 
      content.includes(pattern)
    );
    
    if (matchedPatterns.length > 0) {
      console.log(`\n发现错误 [${file.name}]:`);
      console.log(`  - 匹配错误模式: ${matchedPatterns.join(', ')}`);
      console.log(`  - 文件路径: ${file.path}`);
      
      // 显示文件末尾的几行以便查看错误上下文
      const lines = content.split('\n');
      const startLine = Math.max(0, lines.length - config.tailLines);
      console.log(`  - 文件末尾 ${config.tailLines} 行:`);
      console.log('  ---------------------------------');
      for (let i = startLine; i < lines.length; i++) {
        console.log(`  | ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
      }
      console.log('  ---------------------------------');
      
      // 添加到已发现的错误列表
      stats.errorsFound.push({
        time: new Date().toISOString(),
        file: file.name,
        patterns: matchedPatterns
      });
    }
  } catch (error) {
    console.error(`读取文件 ${file.path} 时出错:`, error);
  }
}

// 显示统计信息
function printStats() {
  console.log(`📊 统计信息:`);
  console.log(`  - 总文件数: ${stats.totalFiles}`);
  console.log(`  - 提示词文件: ${stats.promptFiles}`);
  console.log(`  - 响应文件: ${stats.responseFiles}`);
  console.log(`  - 解析错误文件: ${stats.errorFiles}`);
  
  if (stats.errorsFound.length > 0) {
    console.log(`  - 检测到的错误数: ${stats.errorsFound.length}`);
    console.log(`  - 最近错误: ${stats.errorsFound[stats.errorsFound.length - 1].patterns.join(', ')}`);
  }
}

// 启动监控
initialize(); 