/**
 * MCP Server - Streamable HTTP 传输方式
 *
 * 通过 HTTP 进行通信，适用于：
 * - 远程服务部署
 * - 跨进程/跨机器调用
 * - Web 应用集成
 *
 * 基于 MCP Streamable HTTP 规范实现
 */

import http from "http";
import { createServer, ALLOWED_DIRS } from "./server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

// 配置
const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3001;
const HOST = process.env.MCP_HOST || "localhost";

// 存储会话传输
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

/**
 * 解析请求体
 */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * 处理 MCP 请求
 */
async function handleMCPRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    if (req.method === "POST") {
      // 处理 MCP 请求
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        // 复用现有会话
        transport = transports.get(sessionId)!;
      } else if (!sessionId) {
        // 创建新会话
        const server = createServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport);
            console.log(`[MCP HTTP] 新会话创建: ${newSessionId}`);
          },
        });

        await server.connect(transport);
      } else {
        // 无效会话 ID
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid session ID" }));
        return;
      }

      // 处理请求
      const body = await parseBody(req);
      await transport.handleRequest(req, res, body);
    } else if (req.method === "GET") {
      // SSE 流（可选，用于服务器推送）
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session required for SSE" }));
      }
    } else if (req.method === "DELETE") {
      // 关闭会话
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        console.log(`[MCP HTTP] 会话关闭: ${sessionId}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "session closed" }));
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid session ID" }));
      }
    } else {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
    }
  } catch (error) {
    console.error("[MCP HTTP] 请求处理错误:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      })
    );
  }
}

// 创建 HTTP 服务器
const httpServer = http.createServer(handleMCPRequest);

// 启动服务器
httpServer.listen(PORT, HOST, () => {
  console.log(`[MCP Server - HTTP] 已启动`);
  console.log(`  地址: http://${HOST}:${PORT}`);
  console.log(`  允许访问的目录: ${ALLOWED_DIRS.join(", ")}`);
  console.log(`\n使用方式:`);
  console.log(`  POST http://${HOST}:${PORT}/mcp - 发送 MCP 请求`);
  console.log(`  Header: Content-Type: application/json`);
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n[MCP HTTP] 正在关闭...");
  httpServer.close(() => {
    console.log("[MCP HTTP] 已关闭");
    process.exit(0);
  });
});
