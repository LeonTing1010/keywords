# LangGraph Integration Fix Guide

## Problem Summary

The current LangGraph implementation in the NeedMiner system is experiencing TypeScript compatibility issues due to changes in the LangGraph API between versions. The core issues are:

1. Incompatible TypeScript type definitions between the LangGraph library and our implementation
2. Outdated API usage patterns in the StateGraph initialization
3. Parameter mismatch in the invoke method

## Quick Solution

A temporary workaround script has been created that provides a simplified implementation:

```bash
./analyze-langgraph-fix.sh "your keyword here"
```

You can also install the compatible dependencies:

```bash
./analyze-langgraph-fix.sh --install
```

## Comprehensive Solution

To fully fix the LangGraph integration, follow these steps:

### 1. Update Dependencies

Update the package.json file with compatible versions:

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.0.8",
    "@langchain/openai": "^0.0.10",
    "langchain": "^0.1.9",
    "langchain-core": "^0.0.4",
    "zod": "^3.22.4"
  }
}
```

Then run:

```bash
npm install
```

### 2. Fix BaseAgent.ts

Update the BaseAgent.ts file to use the correct parameter for the ChatOpenAI client:

```typescript
// In BaseAgent.ts - Use dynamic configuration to handle API differences
const modelConfig: any = {
  modelName: this.config.modelName,
  temperature: this.config.temperature,
  openAIApiKey: this.config.apiKey,
  verbose: this.config.verbose,
  maxRetries: this.config.maxRetries,
};

// Add API base URL using a compatible approach
if (this.config.apiBaseUrl) {
  // Try different property names that might work with the current version
  modelConfig.endpoint = this.config.apiBaseUrl;
  // Some versions use different property names
  modelConfig.apiUrl = this.config.apiBaseUrl;
}

this.model = new ChatOpenAI(modelConfig);
```

Also, update imports in BaseAgent.ts by removing the problematic import:

```typescript
// Remove this import that's causing errors
// import { StateGraphArgs } from "@langchain/langgraph/graph";
```

### 3. Fix KeywordAnalysisGraph.ts

The StateGraph initialization needs to be updated to match version 0.0.8:

```typescript
// Create the workflow graph
const builder = new StateGraph({
  channels: {
    keywordDiscovery: {},
    journeySimulation: {},
    contentAnalysis: {},
    reportGeneration: {}
  }
});

// Use the correct method signatures for the version
builder.addNode("keywordDiscovery", keywordAgent.createGraphNode());
builder.addNode("journeySimulation", journeyAgent.createGraphNode());
builder.addNode("contentAnalysis", contentAgent.createGraphNode());
builder.addNode("reportGeneration", reportAgent.createGraphNode());

// Configure edges with object syntax
builder.addEdge({
  from: "__start__",
  to: "keywordDiscovery"
});

// For conditional routing
builder.addConditionalEdges({
  from: "keywordDiscovery",
  to: (state) => {
    if (state.input.options?.fast === true) {
      return "contentAnalysis";
    }
    return "journeySimulation";
  }
});

// Remaining edges
builder.addEdge({
  from: "journeySimulation",
  to: "contentAnalysis"
});

builder.addEdge({
  from: "contentAnalysis",
  to: "reportGeneration"
});

builder.addEdge({
  from: "reportGeneration",
  to: "__end__"
});
```

### 4. Fix NeedMinerSystem.ts

Update how the graph is invoked:

```typescript
// Simplify the input structure when invoking the graph
const result = await graph.invoke({
  keyword,
  options: {
    includeDetails: options.includeDetails || false,
    fast: options.fast || false,
    maxKeywords: options.maxKeywords,
    maxRetries: options.maxRetries
  }
});
```

### 5. Update JourneyAgent.ts Type Error

Fix the type error in JourneyAgent.ts line 197:

```typescript
${step.nextQueries.length > 0 ? `可能的下一步: ${step.nextQueries.map((q: any) => `"${q.suggestion}"`).join(', ')}` : '无下一步建议'}
```

## Alternative Approach

If the dependencies and TypeScript errors persist, consider creating a simplified version without LangGraph:

1. Create a sequential execution flow without the LangGraph dependency
2. Connect the agents directly with normal function calls
3. Maintain the same structure but simplify the orchestration

## Additional Resources

- [LangGraph Documentation](https://python.langchain.com/docs/langgraph)
- [LangGraph TypeScript GitHub Repository](https://github.com/langchain-ai/langgraphjs)
- [OpenAI Client Documentation](https://www.npmjs.com/package/@langchain/openai)

## Testing the Fix

After implementing these changes, test with:

```bash
./analyze-langgraph.sh "智能家居控制系统" --fast
``` 