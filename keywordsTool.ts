#!/usr/bin/env node
import { SearchEngineFactory } from './src/scrapers/SearchEngine';
import { GoogleSearchEngine } from './src/scrapers/GoogleSearchEngine';
import { BaiduSearchEngine } from './src/scrapers/BaiduSearchEngine';
import { SearchEngineType, SearchOptions } from './src/types';

// 注册搜索引擎
SearchEngineFactory.register('google', GoogleSearchEngine);
SearchEngineFactory.register('baidu', BaiduSearchEngine);

/**
 * 使用说明
 */
function printHelp() {
  // 获取所有注册的搜索引擎
  const availableEngines = SearchEngineFactory.getRegisteredEngines();
  
  console.log(`
关键词搜索工具

使用方法:
  npx ts-node keywordsTool.ts <关键词> [选项]

选项:
  --engine, -e <引擎名称>     使用指定的搜索引擎(默认: google)
                            可选值: ${availableEngines.join(', ')}
  --domain, -d <域名>        使用指定的搜索引擎域名(根据引擎有不同默认值)
  --proxy, -p <代理地址>     使用指定的代理服务器
  --temp-browser, -t         使用临时浏览器实例而非系统浏览器(部分引擎可能不支持)
  --no-second-round          禁用二次查询(默认启用)
  --help, -h                 显示帮助信息

示例:
  npx ts-node keywordsTool.ts "iphone"                    # 默认使用Google搜索引擎
  npx ts-node keywordsTool.ts "机器学习" --engine baidu   # 使用百度搜索
  npx ts-node keywordsTool.ts "machine learning" --engine google --domain https://www.google.co.uk
  npx ts-node keywordsTool.ts "best laptops" --proxy http://127.0.0.1:7890 --temp-browser
  npx ts-node keywordsTool.ts "android" --no-second-round
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
    let engineType: SearchEngineType = 'google'; // 默认使用Google
    let domain: string | undefined = undefined;
    let proxyServer: string | undefined = undefined;
    let useSystemBrowser = true;
    let enableSecondRound = true;
    
    // 提取命令行参数
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--engine' || arg === '-e') {
        const engineName = args[++i];
        if (engineName && SearchEngineFactory.isRegistered(engineName as SearchEngineType)) {
          engineType = engineName as SearchEngineType;
        } else {
          console.error(`错误: 不支持的搜索引擎 "${engineName}"`);
          printHelp();
          return;
        }
      } else if (arg === '--domain' || arg === '-d') {
        domain = args[++i];
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
    
    // 创建搜索引擎实例
    const engine = SearchEngineFactory.create(engineType);
    const engineConfig = engine.getConfig();
    
    // 显示启动信息
    console.log(`开始为关键词 "${keyword}" 获取自动补全建议...`);
    console.log(`搜索引擎: ${engineConfig.name}`);
    
    if (domain) {
      console.log(`使用自定义域名: ${domain}`);
    } else {
      console.log(`使用默认域名: ${engineConfig.defaultDomain}`);
      domain = engineConfig.defaultDomain;
    }
    
    if (proxyServer) {
      console.log(`使用代理服务器: ${proxyServer}`);
    }
    
    if (!engineConfig.supportsSystemBrowser && useSystemBrowser) {
      console.log(`警告: ${engineConfig.name}不支持系统浏览器模式，将使用临时浏览器`);
      useSystemBrowser = false;
    }
    
    if (!engineConfig.supportsSecondRound && enableSecondRound) {
      console.log(`警告: ${engineConfig.name}不支持二次查询，将禁用此功能`);
      enableSecondRound = false;
    } else if (enableSecondRound) {
      console.log('已启用二次查询，将在第一轮结束后自动找出新关键词进行查询');
    } else {
      console.log('已禁用二次查询');
    }
    
    // 配置搜索选项
    const searchOptions: SearchOptions = {
      domain,
      proxyServer,
      useSystemBrowser,
      enableSecondRound
    };
    
    // 执行搜索
    const outputFile = await engine.fetchAutocompleteWithAlphabets(keyword, searchOptions);
    
    console.log(`\n处理完成! 结果保存在: ${outputFile}`);
    
    if (enableSecondRound) {
      // 检查二次查询结果文件是否存在
      const path = require('path');
      const fs = require('fs');
      
      const outputDir = path.dirname(outputFile);
      const safeKeyword = keyword.replace(/\s+/g, '_');
      const secondRoundFile = path.join(
        outputDir, 
        `${engineConfig.name.toLowerCase()}_${safeKeyword}_second_round_suggestions.txt`
      );
      
      if (fs.existsSync(secondRoundFile)) {
        console.log(`二次查询结果保存在: ${secondRoundFile}`);
      }
    }
    
  } catch (error) {
    console.error('执行过程中出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main(); 