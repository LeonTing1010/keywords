# 多平台搜索关键词工具

## 项目概述

这是一个强大的多平台搜索关键词工具，可以从各大搜索引擎获取关键词建议，帮助进行SEO优化和内容创作。目前支持Google搜索引擎，可以轻松扩展到其他搜索平台。

## 主要功能

- **自动补全搜索**: 从搜索引擎获取关键词自动补全建议
- **字母组合查询**: 将关键词与字母组合进行查询，获取更多建议
- **智能二次查询**: 从初始结果中提取二次关键词进行拓展查询
- **LLM增强分析**: 使用大语言模型分析关键词价值和意图
- **迭代优化查询**: 基于评估分数持续优化并挖掘更有价值的长尾词
- **关键词分类**: 自动将关键词分类为信息查询、问题解决、商业交易等类别
- **价值评分**: 根据长尾特征、商业价值等维度评分关键词
- **断点续传**: 支持长时间任务的断点续传功能
- **批量处理**: 智能管理浏览器资源，批量处理查询
- **格式转换**: 自动保存为JSON和CSV格式，方便后续分析

## 项目结构

项目采用模块化设计，结构清晰，便于维护和扩展：

```
/
├── src/                      # 源代码目录
│   ├── cli/                  # 命令行工具
│   │   └── keywordsTool.ts    # 统一的命令行接口
│   ├── engines/              # 搜索引擎实现
│   │   ├── SearchEngine.ts   # 搜索引擎基类和工厂
│   │   ├── GoogleSearchEngine.ts  # Google搜索实现
│   │   ├── BaiduSearchEngine.ts   # 百度搜索实现
│   │   └── ...              # 其他搜索引擎实现
│   ├── tools/                # 工具脚本
│   │   ├── googleTrends.ts   # Google Trends工具
│   │   ├── semrush.ts        # SEMrush工具
│   │   └── similarweb.ts     # SimilarWeb工具
│   ├── types/                # 类型定义
│   │   ├── index.ts         # 通用类型
│   │   └── searchEngineTypes.ts  # 搜索引擎相关类型
│   ├── utils/                # 工具函数
│   │   ├── browserUtils.ts   # 浏览器相关工具
│   │   ├── fileUtils.ts      # 文件操作工具
│   │   ├── errorHandler.ts   # 错误处理工具
│   │   ├── llmService.ts     # LLM服务模块
│   │   ├── keywordAnalyzer.ts # 关键词分析模块
│   │   ├── iterativeQueryEngine.ts # 迭代查询引擎
│   │   └── ...                # 其他工具模块
│   ├── config/                # 配置文件
│   │   ├── index.ts           # 主配置文件
│   │   └── ...                # 其他配置文件
│   └── tests/                # 测试目录
├── keywordsTool.ts           # 主入口文件
└── playwright.config.ts      # Playwright配置
```

## 主要改进

1. **目录结构优化**：
   - 创建了更清晰的目录结构，将共享功能移至专用工具目录
   - 分离了类型定义、工具函数和核心逻辑

2. **代码复用**：
   - 抽取了重复代码到共享工具函数
   - 统一了浏览器操作相关的功能到`browserUtils.ts`

3. **错误处理**：
   - 添加了统一的错误处理机制
   - 提供了友好的错误提示和建议

4. **类型系统**：
   - 增强了类型定义，提高代码可靠性
   - 集中管理所有类型定义

5. **命令行工具**：
   - 整合了多个命令行工具到统一接口
   - 提供了更一致的用户体验

## 使用方法

### 基本用法

```bash
npx ts-node keywordsTool.ts "关键词" [选项]
```

### 选项

- `--engine, -e <引擎名称>` - 使用指定的搜索引擎(默认: google)
- `--domain, -d <域名>` - 使用指定的搜索引擎域名
- `--proxy, -p <代理地址>` - 使用指定的代理服务器
- `--temp-browser, -t` - 使用临时浏览器实例而非系统浏览器
- `--no-second-round` - 禁用二次查询(默认启用)
- `--secondary-mode <模式>` - 指定二次查询模式(alphabets/keywords/both, 默认: alphabets)
- `--batch-size <数量>` - 指定批处理大小(默认: 26或10，取决于查询模式)
- `--retry-count <次数>` - 查询失败重试次数(默认: 1)
- `--max-secondary <数量>` - 二次关键词最大提取数量(默认: 10)
- `--max-results <数量>` - 二次查询最大结果数(默认: 300)
- `--output, -o <文件名>` - 指定输出文件名
- `--help, -h` - 显示帮助信息
- `--use-llm` - 使用LLM增强分析功能
- `--llm-model <模型名称>` - 指定LLM模型(默认: gpt-4)
- `--iterative` - 启用迭代查询模式
- `--max-iterations <次数>` - 最大迭代次数(默认: 5)
- `--satisfaction-threshold <值>` - 满意度阈值(0-1之间，默认: 0.85)

### 示例

```bash
# 使用Google搜索引擎(默认)进行简单查询
npx ts-node keywordsTool.ts "iphone"

# 使用字母组合模式进行查询(默认)
npx ts-node keywordsTool.ts "web design" --secondary-mode alphabets

# 使用关键词模式进行二次查询
npx ts-node keywordsTool.ts "web design" --secondary-mode keywords  

# 同时使用字母组合和关键词模式
npx ts-node keywordsTool.ts "digital marketing" --secondary-mode both

# 使用自定义域名
npx ts-node keywordsTool.ts "machine learning" --engine google --domain https://www.google.co.uk

# 使用代理服务器
npx ts-node keywordsTool.ts "best laptops" --proxy http://127.0.0.1:7890 --temp-browser

# 禁用二次查询
npx ts-node keywordsTool.ts "android" --no-second-round

# 指定批处理大小和最大结果数
npx ts-node keywordsTool.ts "yoga" --secondary-mode both --batch-size 15 --max-results 500

# 提高重试次数，应对不稳定网络
npx ts-node keywordsTool.ts "javascript" --retry-count 3

# 使用LLM分析关键词
npx ts-node keywordsTool.ts "machine learning" --use-llm

# 使用迭代查询模式
npx ts-node keywordsTool.ts "web design" --iterative --max-iterations 3

# 结合LLM和迭代查询
npx ts-node keywordsTool.ts "digital marketing" --iterative --use-llm --max-iterations 4
```

## 二次查询模式

工具提供三种二次查询模式，可以根据需求选择：

1. **字母组合模式 (alphabets)**: 默认模式，将关键词与26个英文字母组合查询（如 "iphone a", "iphone b"...）
2. **关键词模式 (keywords)**: 从初始查询结果中提取高价值关键词进行二次查询
3. **混合模式 (both)**: 同时使用上述两种模式，获取最全面的结果

## 进阶功能

### 断点续传

工具会在查询过程中自动创建进度文件，如果查询中断，下次运行相同命令时会自动从中断处继续。进度文件保存在输出目录中，格式为 `*.json.progress`。

### 批量处理优化

通过 `--batch-size` 参数可以调整每次处理的查询数量，系统会在处理完指定批次后重启浏览器，避免资源占用过高。

### 结果输出

所有查询结果会同时保存为JSON和CSV格式：
- JSON文件包含完整的元数据
- CSV文件方便导入到电子表格程序进行分析

## 性能优化建议

1. 对于大型查询，建议增加批处理大小以减少浏览器重启次数
2. 如果网络不稳定，可以通过 `--retry-count` 增加重试次数
3. 对于字母组合模式，批处理大小默认为26（覆盖所有字母）
4. 对于关键词模式，可以通过 `--max-secondary` 控制二次关键词数量

## 注意事项

- 使用代理服务器可以避免IP被封禁
- 建议使用系统浏览器模式，可以利用已登录的会话减少验证码出现
- 长时间运行可能需要手动处理验证码
- 输出文件默认保存在项目根目录的 `output` 文件夹中

## 扩展新搜索引擎

如果您想添加新的搜索引擎支持，只需：

1. 创建一个继承自`SearchEngine`的新类
2. 实现必要的方法（如`fetchAutocomplete`）
3. 在`src/cli/keywordsTool.ts`中注册新的搜索引擎

示例：

```typescript
// 1. 创建新的搜索引擎类
export class BingSearchEngine extends SearchEngine {
  constructor() {
    super({
      name: 'Bing',
      defaultDomain: 'https://www.bing.com',
      supportsProxy: true,
      supportsSystemBrowser: true,
      supportsSecondRound: true,
      description: 'Bing搜索引擎'
    });
  }
  
  async fetchAutocomplete(keyword: string, options?: SearchOptions): Promise<AutocompleteSuggestion> {
    // 实现Bing搜索的自动补全逻辑
  }
}

// 2. 在keywordsTool.ts中注册
SearchEngineFactory.register('bing', BingSearchEngine);
```

## 错误处理

工具提供了统一的错误处理机制，当遇到问题时会显示友好的错误信息和建议。如果您遇到问题，请查看错误提示并按照建议操作。

## 注意事项

- 部分搜索引擎可能需要处理验证码，工具会提示您手动处理
- 使用代理服务器可以避免IP被封禁
- 建议使用系统浏览器模式，可以利用已登录的会话减少验证码出现

## LLM关键词分析

工具集成了大语言模型(LLM)能力，可以对关键词进行深度分析和评估，帮助您发现最有价值的长尾关键词。

### 使用LLM分析功能

```bash
npx ts-node keywordsTool.ts "your keyword" --use-llm
```

或使用简化的快捷命令：

```bash
npm run analyze -- "your keyword"
```

### LLM分析功能包括：

1. **关键词分类**：
   - 自动将关键词分类为信息查询、问题解决、商业交易、教程指南和定义解释等类别
   - 帮助您理解搜索意图分布

2. **高价值关键词识别**：
   - 基于多维度评分识别最有价值的长尾关键词
   - 考虑长尾特征、商业价值、问题导向等因素

3. **查询模式提取**：
   - 识别用户搜索模式和常见修饰词
   - 帮助您理解用户如何构建查询

4. **查询策略生成**：
   - 自动生成下一轮查询建议
   - 帮助您发现更多相关长尾关键词

### 注意事项

- 此功能需要OpenAI API密钥，可以通过环境变量`OPENAI_API_KEY`设置
- 默认使用gpt-4模型，可以通过`--llm-model`选项指定其他模型
- LLM分析结果会包含在输出文件中

## 迭代查询引擎

迭代查询引擎是一个强大的功能，可以持续优化关键词查询，并自动挖掘更有价值的长尾关键词。它通过多轮迭代，每轮评估结果并调整策略，直到达到满意的结果。

### 使用迭代查询引擎

```bash
npx ts-node keywordsTool.ts "your keyword" --iterative
```

或使用简化的快捷命令：

```bash
npm run iterative -- "your keyword"
```

### 高级选项：

```bash
npx ts-node keywordsTool.ts "your keyword" --iterative --max-iterations 4 --satisfaction-threshold 0.9
```

### 迭代查询过程：

1. **初始查询**：
   - 首先执行全面的初始查询，获取基础关键词集合

2. **结果分析**：
   - 分析当前关键词集合，识别模式和空缺

3. **策略生成**：
   - 基于分析结果生成针对性的查询策略
   - 选择最有可能发现高价值长尾词的查询

4. **执行迭代查询**：
   - 执行策略生成的查询
   - 将新发现的关键词添加到总集合

5. **满意度评估**：
   - 对迭代结果进行多维度评分
   - 评估长尾价值、商业价值、相关性等

6. **决策点**：
   - 如果满意度达到阈值，或已达到最大迭代次数，则停止
   - 否则，继续下一轮迭代

7. **最终报告**：
   - 生成全面的分析报告
   - 提供高价值关键词推荐和内容机会

### 迭代查询输出：

迭代查询完成后，会生成三种格式的输出：
- **JSON文件**：包含完整的迭代过程和分析结果
- **CSV文件**：所有发现的关键词列表，便于导入电子表格
- **Markdown报告**：可读性强的分析报告，包含关键词分类、高价值推荐和内容机会

### 最佳实践：

- 对于广泛主题，建议设置较高的`max-iterations`值(4-5)
- 对于特定领域，可以设置较高的`satisfaction-threshold`(0.9)以获取更精确的结果
- 结合`--use-llm`选项可以获得更深入的分析
- 对于英文关键词，结果通常更全面，中文关键词也得到良好支持

## 环境变量配置

工具支持通过环境变量进行配置，特别是对于LLM相关功能：

- `OPENAI_API_KEY`：OpenAI API密钥，用于LLM分析和迭代查询
- `DEBUG`：设置为"true"启用调试日志
- `VERBOSE`：设置为"true"启用详细日志
- `LOG_LEVEL`：日志级别，可选值：debug, info, warn, error
- `OUTPUT_DIR`：输出目录路径

示例：

```bash
OPENAI_API_KEY=your_key npx ts-node keywordsTool.ts "ai tools" --use-llm 