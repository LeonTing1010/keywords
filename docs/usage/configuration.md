# KeywordIntent 配置选项

KeywordIntent 提供了丰富的配置选项，可以通过命令行参数和环境变量进行配置。

## 环境变量配置

环境变量可以在 `.env` 文件中设置或直接在系统中设置。

### 核心环境变量

| 环境变量 | 描述 | 默认值 | 示例 |
|----------|------|--------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥，用于 LLM 分析功能 | - | `sk-abcdef123456...` |
| `OPENAI_API_BASE` | 可选的 OpenAI API 基础 URL | `https://api.openai.com/v1` | `https://api.your-proxy.com/v1` |
| `OUTPUT_DIR` | 输出目录路径 | `./output` | `/home/user/data/output` |
| `CACHE_DIR` | 缓存目录路径 | `./output/cache` | `/home/user/data/cache` |
| `DEBUG` | 启用调试模式 | `false` | `true` |
| `MAX_RETRIES` | API 调用最大重试次数 | `3` | `5` |
| `REQUEST_TIMEOUT` | API 请求超时时间(毫秒) | `60000` | `90000` |

### 可选环境变量

| 环境变量 | 描述 | 默认值 | 示例 |
|----------|------|--------|------|
| `DEFAULT_LLM_MODEL` | 默认使用的LLM模型 | `gpt-4` | `gpt-3.5-turbo` |
| `DEFAULT_SATISFACTION_THRESHOLD` | 默认的满意度阈值 | `0.85` | `0.9` |
| `DEFAULT_MAX_ITERATIONS` | 默认的最大迭代次数 | `5` | `7` |
| `DEFAULT_ANALYSIS_DEPTH` | 默认的分析深度 | `5` | `8` |
| `DEFAULT_CACHE_EXPIRY` | 默认的缓存过期时间(小时) | `24` | `48` |

## 命令行选项

命令行选项优先级高于环境变量配置。

### 基本选项

```bash
命令格式:
npm run intent <关键词> [选项]
```

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--engine, -e <引擎名称>` | 使用指定的搜索引擎 | `google` |
| `--domain, -d <域名>` | 使用指定的搜索引擎域名 | 引擎默认值 |
| `--proxy, -p <代理地址>` | 使用指定的代理服务器 | - |
| `--temp-browser, -t` | 使用临时浏览器实例而非系统浏览器 | `false` |
| `--max-results <数量>` | 查询最大结果数 | `300` |
| `--output, -o <文件路径>` | 指定输出文件路径 | 自动生成 |
| `--help, -h` | 显示帮助信息 | - |

### 功能模块选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--domain-expert` | 启用垂直领域专家系统 | `false` |
| `--journey-sim` | 启用用户旅程模拟 | `false` |
| `--cross-domain` | 启用跨域关联分析 | `false` |
| `--value-predict` | 启用关键词价值预测 | `false` |
| `--no-intent-analysis` | 禁用意图分析 | 默认启用 |

### AI分析选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--model <模型名称>` | 指定LLM模型 | `gpt-4` |
| `--max-iterations <次数>` | 最大迭代次数 | `5` |
| `--satisfaction <值>` | 满意度阈值(0-1之间) | `0.85` |

### 高级选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--depth <值>` | 分析深度(1-10) | `5` |
| `--cache <时间>` | 缓存过期时间(小时) | `24` |
| `--format <格式>` | 输出格式(json, markdown, csv) | `json` |
| `--verbose` | 启用详细日志输出 | `false` |

## 工作流配置

如果通过代码使用KeywordIntent，可以使用WorkflowController进行配置:

```typescript
// 创建工作流控制器
const workflowController = new WorkflowController({
  searchEngine,            // 搜索引擎实例
  llmService,              // LLM服务实例
  maxIterations: 5,        // 最大迭代次数
  satisfactionThreshold: 0.85, // 满意度阈值
  analysisDepth: 5,        // 分析深度
  outputFormat: 'json',    // 输出格式
  enableDomainExpert: true, // 启用领域专家系统
  enableJourneySim: true,  // 启用用户旅程模拟
  enableCrossDomain: true, // 启用跨域分析
  enableValuePredict: true, // 启用价值预测
  enableIntentAnalysis: true, // 启用意图分析
  verbose: true            // 详细日志
});
```

## LLM 服务配置

LLMServiceHub 配置选项:

```typescript
// 创建LLM服务
const llmService = new LLMServiceHub({
  model: 'gpt-4',          // 默认模型
  cacheExpiry: 24 * 60 * 60, // 缓存过期时间(秒)
  verbose: true            // 详细日志
});
```

## 用户旅程模拟器配置

UserJourneySim 配置选项:

```typescript
// 创建用户旅程模拟器
const journeySim = new UserJourneySim({
  llmService,              // LLM服务实例
  searchEngine,            // 可选的搜索引擎实例
  maxSteps: 5,             // 最大步骤数
  verbose: true            // 详细日志
});
```

## 配置示例

### 基本使用示例

```bash
# 使用默认配置
npm run intent "人工智能"

# 使用代理
npm run intent "人工智能" --proxy http://127.0.0.1:7890

# 指定输出格式
npm run intent "人工智能" --format markdown --output ./reports/ai-report.md
```

### 深度分析示例

```bash
# 启用所有高级分析功能
npm run intent "电动汽车" --domain-expert --journey-sim --cross-domain --value-predict

# 增加分析深度和迭代次数
npm run intent "机器学习" --depth 8 --max-iterations 7 

# 使用更高的满意度阈值
npm run intent "投资策略" --satisfaction 0.9
```

### 优化性能示例

```bash
# 减少API调用，延长缓存时间
npm run intent "网络安全" --cache 72

# 不使用价值预测和跨域分析
npm run intent "健康饮食" --domain-expert --journey-sim
``` 