# 多平台搜索关键词工具

## 项目概述

这是一个强大的多平台搜索关键词工具，可以从各大搜索引擎获取关键词建议，帮助进行SEO优化和内容创作。目前支持Google搜索引擎，可以轻松扩展到其他搜索平台。

## 主要功能

- **自动补全搜索**: 从搜索引擎获取关键词自动补全建议
- **字母组合查询**: 将关键词与字母组合进行查询，获取更多建议
- **智能二次查询**: 从初始结果中提取二次关键词进行拓展查询
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
│   │   └── errorHandler.ts   # 错误处理工具
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