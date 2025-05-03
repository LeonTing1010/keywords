# 多平台搜索关键词工具

这个工具用于获取各大搜索引擎的自动补全建议，可以帮助进行关键词研究和SEO优化。目前支持Google和百度，架构灵活可扩展至其他平台。

## 功能特性

- **多搜索引擎支持**：目前支持Google和百度，架构可扩展至其他平台
- **获取单个关键词的自动补全建议**
- **根据字母组合和常见模式获取关键词扩展建议**
- **批量获取大量关键词组合的建议**
- **自动提取新关键词进行二次查询**
- **支持完整的断点续传，可随时中断和恢复**
- **支持防爬技术，模拟人类搜索行为**
- **支持代理设置**
- **使用持久化浏览器配置，减少被封风险**
- **搜索引擎特定优化**：如百度的中文连接词模式

## 安装

```bash
npm install
```

## 使用方法

### 使用通用命令行工具 (推荐)

运行以下命令，使用任何支持的搜索引擎获取关键词建议：

```bash
npm run keywords -- "你的关键词" [选项]
```

例如：

```bash
# 使用Google(默认)
npm run keywords -- "iphone"

# 使用百度
npm run keywords -- "机器学习" --engine baidu

# 使用Google英国域名
npm run keywords -- "machine learning" --engine google --domain https://www.google.co.uk
```

#### 通用选项

```
--engine, -e <引擎名称>     使用指定的搜索引擎(默认: google)
                          可选值: google, baidu
--domain, -d <域名>        使用指定的搜索引擎域名(根据引擎有不同默认值)
--proxy, -p <代理地址>     使用指定的代理服务器
--temp-browser, -t         使用临时浏览器实例而非系统浏览器(部分引擎可能不支持)
--no-second-round          禁用二次查询(默认启用)
```

### 仅Google搜索关键词工具 (兼容旧版)

如果只需使用Google，也可以使用以下命令：

```bash
npm run google-keywords -- "你的关键词"
```

例如：

```bash
npm run google-keywords -- "iphone"
```

这将获取"iphone a"到"iphone z"的所有搜索建议，并自动提取新关键词进行二次查询。

#### Google特定选项

```
--domain, -d <域名>        使用指定的Google域名(默认: https://www.google.com)
--proxy, -p <代理地址>     使用指定的代理服务器
--temp-browser, -t         使用临时浏览器实例而非系统浏览器
--no-second-round          禁用二次查询(默认启用)
```

## 搜索引擎特性比较

| 特性 | Google | 百度 | 
|------|--------|------|
| 默认域名 | https://www.google.com | https://www.baidu.com |
| 系统浏览器支持 | ✓ | ✗ |
| 代理支持 | ✓ | ✓ |
| 二次查询支持 | ✓ | ✓ |
| 查询模式 | 字母a-z组合 | 字母a-z + 中文连接词 + 数字 |

## 架构设计

该项目使用面向对象的方式实现了可扩展的搜索引擎架构：

1. **`SearchEngine` 抽象基类**：定义了所有搜索引擎必须实现的接口和通用方法
2. **`SearchEngineFactory` 工厂类**：负责注册和创建具体的搜索引擎实例
3. **特定搜索引擎实现**：
   - `GoogleSearchEngine`：实现Google搜索特定的功能
   - `BaiduSearchEngine`：实现百度搜索特定的功能和中文搜索习惯优化

## 断点续传功能

工具支持完整的断点续传功能，包括：

1. **第一轮查询断点续传**：记录每个字母/组合查询的处理状态
2. **二次查询断点续传**：记录每个新提取关键词的处理状态
3. **自动去重**：无论中断多少次，结果文件中都不会出现重复内容

这意味着您可以随时中断程序（如Ctrl+C或关闭终端），再次运行时会从上次中断的位置继续执行。这对于处理大量关键词时特别有用。

## 二次查询功能

该工具拥有智能二次查询功能：

1. 在第一轮查询完成后，自动从结果中提取出新的有价值关键词
2. 对这些新关键词执行单独的查询，获取更多相关建议
3. 将二次查询结果保存到单独的文件中

这一功能可以帮助您：
- 发现长尾关键词和相关主题
- 扩展SEO关键词库
- 深入了解用户搜索意图和兴趣点

## 注意事项

1. 使用过于频繁可能触发搜索引擎的验证码机制，此时脚本会提示您完成人机验证
2. 建议使用代理服务器轮换IP，减少被检测的风险
3. 对于Google，默认使用您系统上已安装的Chrome浏览器，提高隐蔽性
4. 所有结果会保存到文本文件中，并自动去重

## 输出文件

执行后，程序会在项目的`output`目录生成以下文件：

- `{引擎名}_关键词}_alphabets_suggestions.txt`: 保存所有不重复的关键词建议
- `{引擎名}_关键词}_alphabets_progress.json`: 一级查询进度文件，便于中断后继续执行
- `{引擎名}_关键词}_second_round_suggestions.txt`: 二次查询获取的建议(如启用)
- `{引擎名}_关键词}_second_round_progress.json`: 二次查询进度文件，便于中断后继续执行

例如，使用Google搜索关键词"iphone"后会生成：
- `output/google_iphone_alphabets_suggestions.txt`
- `output/google_iphone_alphabets_progress.json`
- `output/google_iphone_second_round_suggestions.txt`
- `output/google_iphone_second_round_progress.json`

使用百度搜索关键词"手机"后会生成：
- `output/baidu_手机_alphabets_suggestions.txt`
- `output/baidu_手机_alphabets_progress.json`
- `output/baidu_手机_second_round_suggestions.txt`
- `output/baidu_手机_second_round_progress.json`

程序会自动创建output目录（如果不存在）。

## 搜索引擎特定优化

### 百度搜索引擎
百度搜索引擎实现添加了针对中文搜索习惯的优化：
- 添加常用中文连接词如"是"、"怎么"、"如何"等
- 支持数字后缀查询（如"手机1"、"手机2"等）
- 适应百度特定的搜索界面和元素选择器

### Google搜索引擎
Google搜索引擎实现包含高级防检测功能：
- 随机化用户代理和浏览器指纹
- 模拟更真实的人类输入行为
- 支持系统浏览器使用
- 优化的验证码检测和处理机制

## 扩展新搜索引擎

如果您想添加新的搜索引擎支持，只需：
1. 创建一个继承自`SearchEngine`的新类
2. 实现必要的方法（如`fetchAutocomplete`）
3. 在`keywordsTool.ts`中注册新的搜索引擎

## 输出示例

以下是使用Google搜索"iphone"关键词可能获得的部分建议：

```
iphone 13
iphone 14
iphone 15
iphone se
iphone 13 pro
iphone 14 pro
iphone 15 pro
iphone 15 pro max
iphone 充电器
iphone xr
```

以下是使用百度搜索"手机"关键词可能获得的部分建议：

```
手机怎么截屏
手机是谁发明的
手机如何定位
手机有什么功能
手机排行榜前十名
手机壳
手机号码查询
手机可以连接电脑吗
手机需要贴膜吗
```

## 贡献与反馈

欢迎提交问题和功能建议，帮助我们改进这个工具！