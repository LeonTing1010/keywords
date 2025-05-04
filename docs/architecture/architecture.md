# KeywordIntent 系统架构

KeywordIntent 是一个用于高级用户意图挖掘与搜索行为分析的系统，采用模块化设计，通过整合搜索引擎数据与AI大模型能力，实现深度的用户意图分析。

## 整体架构

系统分为以下主要层次:

```
┌─────────────────────────────────────────────────────────────┐
│                       KeywordIntent                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                     工作流控制层                           │
│                  WorkflowController                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────┬───────────┬───┴───────┬────────────┬────────────┐
│  关键词挖掘 │  意图分析  │ 领域专家  │ 用户旅程   │  价值分析  │
│ Discovery │  Intent   │ Domain    │ Journey   │  Value     │
└─────┬─────┴─────┬─────┴─────┬─────┴─────┬──────┴─────┬──────┘
      │           │           │           │            │
┌─────┴───────────┴───────────┴───────────┴────────────┴──────┐
│                       LLM服务中心                           │
│                     LLMServiceHub                           │
└─────────────────────────────┬─────────────────────────────┬─┘
                              │                             │
┌────────────────────────────┐│┌────────────────────────────┐│
│        搜索引擎层          ││       外部API层             ││
│      SearchEngine          ││       ExternalAPI           ││
└────────────────────────────┘└─────────────────────────────┘
```

## 详细架构实现

KeywordIntent v3.0.0 的架构由以下主要组件组成，每个组件都有明确的职责和接口:

### 1. 工作流控制器 (WorkflowController)

**路径**: `src/core/WorkflowController.ts`

**职责**: 
- 协调各模块的执行流程，控制整体分析过程
- 管理分析过程的状态和结果整合
- 确保各组件正确初始化和资源释放
- 提供统一的分析入口和结果格式

**核心方法**:
- `executeWorkflow(keyword: string)`: 执行完整分析流程，返回综合结果
- `getAllDiscoveredKeywords(discoveryResult)`: 提取所有发现的关键词
- `generateRecommendations(result)`: 生成基于所有分析的综合建议

**执行步骤**:
1. 关键词挖掘 - 使用迭代发现引擎
2. 意图分析 - 分析关键词背后的用户意图
3. 领域分析 - 识别关键词的专业领域
4. 用户旅程模拟 - 模拟搜索行为路径
5. 综合分析 - 执行跨域关联和价值预测

### 2. LLM服务中心 (LLMServiceHub)

**路径**: `src/llm/LLMServiceHub.ts`

**职责**: 
- 统一管理所有AI模型交互
- 提供缓存机制减少API调用
- 处理会话上下文和错误重试
- 为各模块提供专业化分析接口

**核心方法**:
- `sendPrompt(prompt, options)`: 发送提示到LLM并获取响应
- `analyze(analysisType, data, options)`: 执行特定类型的分析任务
- 各种专业分析方法: `identifyDomain()`, `simulateUserJourney()`, `analyzeCrossDomain()`, `predictKeywordValue()`

**设计特点**:
- 提供缓存机制减少API调用
- 支持会话管理，维护上下文
- 错误处理和重试机制
- 响应解析和格式化

### 3. 迭代发现引擎 (IterativeDiscoveryEngine)

**路径**: `src/discovery/IterativeDiscoveryEngine.ts`

**职责**: 
- 通过多轮智能迭代发现相关长尾关键词
- 持续优化查询策略，最大化关键词价值和多样性
- 处理搜索引擎交互和结果解析

**核心方法**:
- `discover(keyword)`: 开始关键词发现流程
- `performInitialDiscovery(keyword)`: 执行初始查询
- `planNextIteration(keyword, iterationNumber)`: 规划下一轮迭代
- `executeIteration(query, iterationNumber)`: 执行一轮迭代

**执行流程**:
1. 初始查询获取第一批关键词
2. 使用LLM规划下一轮查询策略
3. 执行迭代查询并评估结果
4. 根据满意度决定是否继续迭代
5. 整合所有发现的关键词

### 4. 意图分析器 (IntentAnalyzer)

**路径**: `src/intent/IntentAnalyzer.ts`

**职责**: 
- 识别和分类关键词背后的用户意图
- 分析意图分布和模式
- 提供意图相关的内容建议

**核心方法**:
- `analyzeKeywords(keywords)`: 分析关键词集合的意图
- `extractIntentIndicators(keywords)`: 提取意图指示词
- `filterKeywordsByIntent(keywords, intentType)`: 按意图类型筛选关键词
- `identifyIntentShifts(keywordJourney)`: 识别意图转换点

**输出内容**:
- 意图分类和分布
- 高价值关键词识别
- 内容机会建议
- 意图模式分析

### 5. 领域专家系统 (DomainExpertSystem)

**路径**: `src/domain/DomainExpertSystem.ts`

**职责**: 
- 自动适配不同行业知识体系
- 提供垂直领域专业分析
- 解释领域术语和专业概念
- 评估关键词技术水平

**核心方法**:
- `identifyDomain(keywords)`: 识别关键词所属领域
- `getExpertAnalysis(keywords, domainName)`: 获取专家分析
- `classifyKeywordsByDomain(keywords)`: 按领域分类关键词
- `adaptToDomain(keywords, targetDomain)`: 适配到特定领域

**执行流程**:
1. 识别关键词集合所属的主要领域
2. 生成领域知识体系资料
3. 解析领域特定术语和概念
4. 提供专业角度的关键词分析

### 6. 用户旅程模拟器 (UserJourneySim)

**路径**: `src/journey/UserJourneySim.ts`

**职责**: 
- 模拟用户在搜索引擎中的完整搜索路径
- 识别查询修改模式和决策点
- 分析意图变化和搜索行为模式

**核心方法**:
- `simulateJourney(initialQuery)`: 模拟完整搜索旅程
- `identifyDecisionPoints(steps)`: 识别决策转换点
- `identifyRefinementPatterns(steps)`: 识别查询精炼模式
- `analyzeMultipleJourneys(initialQueries)`: 分析多个旅程的共同模式

**输出内容**:
- 完整搜索路径模拟
- 决策点和转换原因
- 查询修改模式识别
- 意图变化分析

### 7. 跨领域分析器 (CrossDomainAnalyzer)

**路径**: `src/analyzer/CrossDomainAnalyzer.ts`

**职责**: 
- 发现不同领域间的关键词关联
- 识别跨域机会和内容空白
- 分析领域间连接强度

**核心方法**:
- `analyzeRelations(keywords, domains)`: 分析领域间关系
- `analyzeDomainRelations(keywords, domains)`: 分析特定领域关系
- `identifyCrossDomainOpportunities(keywords, domains, relations)`: 识别跨域机会
- `compareDomains(domainA, domainB, keywords)`: 比较两个领域的相似度

**执行流程**:
1. 识别关键词所属的多个领域
2. 分析领域间的关系强度
3. 识别跨域机会点
4. 创建领域连接图

### 8. 关键词价值预测器 (KeywordValuePredictor)

**路径**: `src/analyzer/KeywordValuePredictor.ts`

**职责**: 
- 评估关键词的商业价值和竞争程度
- 预测转化潜力和整体价值
- 识别低竞争高价值机会

**核心方法**:
- `predictValues(keywords)`: 预测关键词价值
- `generateValueSummary(keywordValues)`: 生成价值摘要
- `getKeywordsByScore(result, scoreType, ascending)`: 按分数类型排序关键词
- `getCommercialOpportunities(result)`: 获取商业机会

**输出内容**:
- 关键词价值评分
- 商业/信息价值分析
- 竞争程度评估
- 低竞争高价值机会识别

## 数据流

![数据流](../assets/data-flow.png)

1. **初始输入**:
   - 用户提供初始关键词
   - 命令行参数设置分析选项

2. **关键词发现流程**:
   - WorkflowController 启动 IterativeDiscoveryEngine
   - 发现引擎通过搜索引擎收集关键词建议
   - LLM 指导迭代策略和评估结果
   - 收集的关键词传递给各分析模块

3. **多维度分析流程**:
   - 关键词分别传递给各分析模块:
     - IntentAnalyzer: 分析意图类型和分布
     - DomainExpertSystem: 识别领域和术语
     - UserJourneySim: 模拟用户搜索路径
     - CrossDomainAnalyzer: 分析领域关联
     - KeywordValuePredictor: 评估价值和机会

4. **结果整合**:
   - WorkflowController 收集各模块分析结果
   - 生成综合分析报告和建议
   - 输出结构化数据到指定格式

## 构建和扩展

### 模块依赖关系

```
LLMServiceHub ◄─── IntentAnalyzer
     ▲              KeywordValuePredictor
     │              CrossDomainAnalyzer
     │              DomainExpertSystem
     │              UserJourneySim
     │              IterativeDiscoveryEngine
     │
WorkflowController
     │
     ▼
SearchEngine ◄──── IterativeDiscoveryEngine
                   UserJourneySim
```

### 扩展指南

1. **添加新分析模块**:
   - 创建新模块类实现相应接口
   - 在 WorkflowController 中添加模块初始化和调用
   - 更新结果结构以包含新模块输出

2. **扩展现有分析**:
   - 向现有模块添加新的分析方法
   - 更新 LLMServiceHub 以支持新的分析类型
   - 在 WorkflowController 中调用新方法

3. **支持新搜索引擎**:
   - 实现 SearchEngine 接口
   - 在 CLI 和工厂方法中添加新引擎支持

4. **自定义输出格式**:
   - 实现新的格式转换器
   - 在 WorkflowController 中支持新格式

## 技术特点

- **模块化设计**: 各组件可独立工作，也可协同运行
- **大模型驱动**: 核心分析由大语言模型提供支持，无需复杂规则库
- **可扩展架构**: 易于添加新的分析模块和功能
- **多维度分析**: 从意图、领域、用户旅程等多角度分析关键词
- **缓存优化**: 减少API调用，提高性能和稳定性
- **类型安全**: 全面使用TypeScript类型系统，提高代码质量 