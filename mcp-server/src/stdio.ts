#!/usr/bin/env node

/**
 * MCP Server - stdio 传输方式
 *
 * 通过标准输入/输出进行通信，适用于：
 * - 本地进程间通信
 * - Claude Desktop 集成
 * - CLI 工具调用
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, ALLOWED_DIRS } from "./server.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error(
    `[MCP Server - stdio] 已启动，允许访问的目录: ${ALLOWED_DIRS.join(", ")}`
  );
}

main().catch((error) => {
  console.error("[MCP Server - stdio] 启动失败:", error);
  process.exit(1);
});
