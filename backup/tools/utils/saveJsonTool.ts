import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import * as path from "path";

const schema = z.object({
  data: z.any().describe("要保存的数据对象"),
  keyword: z.string().describe("搜索关键词，用于生成文件名"),
  outputDir: z.string().optional().describe("输出目录，默认为./output"),
  agentType: z.string().optional().describe("Agent类型标识，用于区分不同的调用者")
});

type SaveJsonInput = z.infer<typeof schema>;

class SaveJsonTool extends StructuredTool<typeof schema> {
  name = "save_json";
  description = "保存数据为JSON文件。自动生成文件名并保存。参数: { data: object, keyword: string, outputDir?: string, agentType?: string }";
  schema = schema;

  async _call({ data, keyword, outputDir = "./output", agentType = "unknown" }: SaveJsonInput): Promise<string> {
    try {
      // 确保输出目录存在
      mkdirSync(outputDir, { recursive: true });
      
      // 生成文件名
      const formattedDate = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16); // 20250506_1039
      const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30); // 保留中文并截取前30字符
      const uniqueId = Math.random().toString(36).substring(2, 6); // 随机标识符
      const fileName = `AIKR_${agentType}_${safeKeyword}_${formattedDate}_${uniqueId}.json`;
      const filePath = path.join(outputDir, fileName);

      // 写入文件
      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      return `JSON已保存到: ${filePath}`;
    } catch (error) {
      return `保存JSON文件失败: ${error}`;
    }
  }
}

export const saveJsonTool = new SaveJsonTool(); 