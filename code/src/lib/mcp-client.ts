/**
 * MCP Client 封装模块
 *
 * 支持两种传输方式：
 * - stdio: 通过标准输入/输出与本地 MCP Server 通信
 * - http: 通过 HTTP 与远程 MCP Server 通信
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ListToolsResultSchema,
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tool } from "ai";
import { tool as lcTool } from "langchain";
import { z } from "zod";
import path from "path";

// ============ 配置 ============
export type TransportType = "stdio" | "http";

interface McpClientConfig {
  transportType: TransportType;
  // stdio 配置
  serverPath?: string;
  allowedDirs?: string;
  // http 配置
  serverUrl?: string;
}

// 默认配置
const DEFAULT_STDIO_PATH = path.join(process.cwd(), "../mcp-server/dist/stdio.js");
const DEFAULT_HTTP_URL = "http://localhost:3001/mcp";

// MCP Client 单例
let mcpClient: Client | null = null;
const mcpTools: Map<string, Tool> = new Map();
let isConnected = false;
let currentConfig: McpClientConfig | null = null;

/**
 * 初始化 MCP Client 并连接到 Server
 */
export async function initMcpClient(config?: Partial<McpClientConfig>): Promise<Client> {
  if (mcpClient && isConnected) {
    return mcpClient;
  }

  const finalConfig: McpClientConfig = {
    transportType: config?.transportType || "stdio",
    serverPath: config?.serverPath || DEFAULT_STDIO_PATH,
    allowedDirs: config?.allowedDirs || process.cwd(),
    serverUrl: config?.serverUrl || process.env.MCP_SERVER_URL || DEFAULT_HTTP_URL,
  };

  currentConfig = finalConfig;

  mcpClient = new Client(
    {
      name: "ai-agent-journey-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  let transport;

  if (finalConfig.transportType === "stdio") {
    // stdio 传输
    transport = new StdioClientTransport({
      command: "node",
      args: [finalConfig.serverPath!],
      env: {
        ...process.env,
        ALLOWED_DIRS: finalConfig.allowedDirs!,
      } as Record<string, string>,
    });
  } else {
    // HTTP 传输
    transport = new StreamableHTTPClientTransport(
      new URL(finalConfig.serverUrl!)
    );
  }

  await mcpClient.connect(transport);
  isConnected = true;

  return mcpClient;
}

/**
 * 获取 MCP Server 提供的工具列表
 */
export async function getMcpTools(config?: Partial<McpClientConfig>): Promise<Tool[]> {
  const client = await initMcpClient(config);

  const response = await client.request(
    { method: "tools/list", params: {} },
    ListToolsResultSchema
  );

  // 缓存工具
  for (const t of response.tools) {
    mcpTools.set(t.name, t);
  }

  return response.tools;
}

/**
 * 调用 MCP 工具
 */
export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  config?: Partial<McpClientConfig>
): Promise<string> {
  const client = await initMcpClient(config);

  const response = await client.request(
    {
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    },
    CallToolResultSchema
  );

  // 提取文本内容
  const content = response.content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }

  return JSON.stringify(content);
}

/**
 * 将 JSON Schema 转换为 Zod Schema
 */
function convertJsonSchemaToZod(schema: Record<string, unknown>): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const properties = (schema.properties as Record<string, { type: string; description?: string }>) || {};
  const required = (schema.required as string[]) || [];

  const zodShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        zodType = z.string();
        if (prop.description) zodType = zodType.describe(prop.description);
        break;
      case "number":
      case "integer":
        zodType = z.number();
        if (prop.description) zodType = zodType.describe(prop.description);
        break;
      case "boolean":
        zodType = z.boolean();
        if (prop.description) zodType = zodType.describe(prop.description);
        break;
      case "array":
        zodType = z.array(z.any());
        if (prop.description) zodType = zodType.describe(prop.description);
        break;
      case "object":
        zodType = z.record(z.string(), z.any());
        if (prop.description) zodType = zodType.describe(prop.description);
        break;
      default:
        zodType = z.any();
        if (prop.description) zodType = zodType.describe(prop.description);
    }

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    zodShape[key] = zodType;
  }

  return z.object(zodShape);
}

/**
 * 将 MCP 工具转换为 Vercel AI SDK 格式
 */
export function convertMcpToolToAiSdk(mcpTool: Tool) {
  const zodSchema = convertJsonSchemaToZod(mcpTool.inputSchema as Record<string, unknown>);

  return tool({
    description: mcpTool.description || `MCP 工具: ${mcpTool.name}`,
    inputSchema: zodSchema,
    execute: async (args: Record<string, unknown>) => {
      try {
        const result = await callMcpTool(mcpTool.name, args);
        return { success: true, result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    },
  });
}

/**
 * 获取所有 MCP 工具（Vercel AI SDK 格式）
 */
export async function getMcpToolsAsAiSdk(
  config?: Partial<McpClientConfig>
): Promise<Record<string, ReturnType<typeof convertMcpToolToAiSdk>>> {
  const tools = await getMcpTools(config);
  const result: Record<string, ReturnType<typeof convertMcpToolToAiSdk>> = {};

  for (const t of tools) {
    result[t.name] = convertMcpToolToAiSdk(t);
  }

  return result;
}

/**
 * 获取当前传输类型
 */
export function getTransportType(): TransportType | null {
  return currentConfig?.transportType || null;
}

/**
 * 关闭 MCP Client 连接
 */
export async function closeMcpClient(): Promise<void> {
  if (mcpClient && isConnected) {
    await mcpClient.close();
    mcpClient = null;
    isConnected = false;
    currentConfig = null;
  }
}

/**
 * 将 MCP 工具转换为 LangChain 格式
 * 对比：Vercel AI SDK 用 tool({ description, inputSchema, execute })
 *       LangChain 用 tool(fn, { name, description, schema })
 */
export function convertMcpToolToLangChain(mcpTool: Tool) {
  const zodSchema = convertJsonSchemaToZod(mcpTool.inputSchema as Record<string, unknown>);

  return lcTool(
    async (args: Record<string, unknown>) => {
      try {
        const result = await callMcpTool(mcpTool.name, args);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `工具调用失败: ${errorMessage}`;
      }
    },
    {
      name: mcpTool.name,
      description: mcpTool.description || `MCP 工具: ${mcpTool.name}`,
      schema: zodSchema,
    }
  );
}

/**
 * 获取所有 MCP 工具（LangChain 格式）
 */
export async function getMcpToolsAsLangChain(
  config?: Partial<McpClientConfig>
): Promise<ReturnType<typeof convertMcpToolToLangChain>[]> {
  const tools = await getMcpTools(config);
  return tools.map(convertMcpToolToLangChain);
}
