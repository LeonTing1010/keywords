#!/usr/bin/env node
import { GoogleSearchEngine } from './src/scrapers/GoogleSearchEngine';
import { SearchOptions } from './src/types';

/**
 * 使用说明
 */
function printHelp() {
  console.log(`
Google 关键词字母扩展工具

使用方法:
  node googleKeywords.js <关键词> [选项]

选项:
  --domain, -d <域名>        使用指定的Google域名(默认: https://www.google.com)
  --proxy, -p <代理地址>     使用指定的代理服务器
  --temp-browser, -t         使用临时浏览器实例而非系统浏览器
  --no-second-round          禁用二次查询(默认启用)
  --help, -h                 显示帮助信息

示例:
  node googleKeywords.js "iphone"
  node googleKeywords.js "machine learning" --domain https://www.google.co.uk
  node googleKeywords.js "best laptops" --proxy http://127.0.0.1:7890 --temp-browser
  node googleKeywords.js "android" --no-second-round
  `);
}

/**
 * 主函数
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    // 显示帮助信息
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      printHelp();
      return;
    }
    
    // 解析参数
    let keyword = '';
    let googleDomain = 'https://www.google.com';
    let proxyServer: string | undefined = undefined;
    let useSystemBrowser = true;
    let enableSecondRound = true;
    
    // 提取命令行参数
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--domain' || arg === '-d') {
        googleDomain = args[++i] || googleDomain;
      } else if (arg === '--proxy' || arg === '-p') {
        proxyServer = args[++i];
      } else if (arg === '--temp-browser' || arg === '-t') {
        useSystemBrowser = false;
      } else if (arg === '--no-second-round') {
        enableSecondRound = false;
      } else if (!arg.startsWith('-') && keyword === '') {
        keyword = arg;
      }
    }
    
    // 检查关键词
    if (!keyword) {
      console.error('错误: 请提供一个搜索关键词');
      printHelp();
      return;
    }
    
    // 开始执行
    console.log(`开始为关键词 "${keyword}" 获取字母组合自动补全建议...`);
    if (enableSecondRound) {
      console.log('已启用二次查询，将在第一轮结束后自动找出新关键词进行查询');
    } else {
      console.log('已禁用二次查询');
    }

    // 创建Google搜索引擎实例
    const engine = new GoogleSearchEngine();
    
    // 配置搜索选项
    const searchOptions: SearchOptions = {
      domain: googleDomain,
      proxyServer,
      useSystemBrowser,
      enableSecondRound
    };
    
    // 调用搜索引擎的方法
    const outputFile = await engine.fetchAutocompleteWithAlphabets(keyword, searchOptions);
    
    console.log(`\n处理完成! 结果保存在: ${outputFile}`);
    
    if (enableSecondRound) {
      // 提取输出目录和文件名
      const path = require('path');
      const fs = require('fs');
      
      const outputDir = path.dirname(outputFile);
      const safeKeyword = keyword.replace(/\s+/g, '_');
      const secondRoundFile = path.join(
        outputDir, 
        `google_${safeKeyword}_second_round_suggestions.txt`
      );
      
      // 检查二次查询结果文件是否存在
      if (fs.existsSync(secondRoundFile)) {
        console.log(`二次查询结果保存在: ${secondRoundFile}`);
      }
    }
    
  } catch (error) {
    console.error('执行过程中出错:', error);
  }
}

// 执行主函数
main(); 