/**
 * MCP Server 核心逻辑
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";

// ============ 安全配置 ============

export const ALLOWED_DIRS = process.env.ALLOWED_DIRS
  ? process.env.ALLOWED_DIRS.split(":")
  : [process.cwd()];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ============ 工具函数 ============

async function validatePath(requestedPath: string): Promise<string> {
  const absolutePath = path.resolve(requestedPath);
  const isAllowed = ALLOWED_DIRS.some(
    (dir) => absolutePath.startsWith(path.resolve(dir))
  );
  if (!isAllowed) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `访问被拒绝：路径 "${requestedPath}" 不在允许范围内`
    );
  }
  return absolutePath;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getStats(filePath: string) {
  const stats = await fs.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    type: stats.isDirectory() ? "directory" : "file",
    size: stats.size,
    modified: stats.mtime.toISOString(),
    created: stats.birthtime.toISOString(),
  };
}

const text = (content: string) => ({ content: [{ type: "text" as const, text: content }] });

// ============ 创建 Server 并注册工具 ============

export function createServer(): McpServer {
  const server = new McpServer({
    name: "filesystem-mcp-server",
    version: "1.0.0",
  });

  // read_file
  server.registerTool(
    "read_file",
    {
      description: "读取文件内容",
      inputSchema: { path: z.string().describe("文件路径") },
    },
    async ({ path: filePath }) => {
      const validPath = await validatePath(filePath);

      if (!(await pathExists(validPath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const stats = await fs.stat(validPath);
      if (stats.isDirectory()) {
        throw new McpError(ErrorCode.InvalidRequest, `路径是目录: ${filePath}`);
      }
      if (stats.size > MAX_FILE_SIZE) {
        throw new McpError(ErrorCode.InvalidRequest, `文件过大，超过限制 5MB`);
      }

      return text(await fs.readFile(validPath, "utf-8"));
    }
  );

  // write_file
  server.registerTool(
    "write_file",
    {
      description: "写入文件内容",
      inputSchema: {
        path: z.string().describe("文件路径"),
        content: z.string().describe("文件内容"),
      },
    },
    async ({ path: filePath, content }) => {
      const validPath = await validatePath(filePath);

      await fs.mkdir(path.dirname(validPath), { recursive: true });
      await fs.writeFile(validPath, content, "utf-8");

      return text(`文件写入成功: ${filePath}`);
    }
  );

  // list_directory
  server.registerTool(
    "list_directory",
    {
      description: "列出目录内容",
      inputSchema: { path: z.string().describe("目录路径") },
    },
    async ({ path: dirPath }) => {
      const validPath = await validatePath(dirPath);

      if (!(await pathExists(validPath))) {
        throw new McpError(ErrorCode.InvalidRequest, `目录不存在: ${dirPath}`);
      }

      const stats = await fs.stat(validPath);
      if (!stats.isDirectory()) {
        throw new McpError(ErrorCode.InvalidRequest, `路径是文件: ${dirPath}`);
      }

      const entries = await fs.readdir(validPath);
      const results = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(validPath, entry);
          try {
            return await getStats(entryPath);
          } catch {
            return { name: entry, path: entryPath, type: "unknown", size: 0, modified: "", created: "" };
          }
        })
      );

      return text(JSON.stringify(results, null, 2));
    }
  );

  // create_directory
  server.registerTool(
    "create_directory",
    {
      description: "创建目录",
      inputSchema: { path: z.string().describe("目录路径") },
    },
    async ({ path: dirPath }) => {
      const validPath = await validatePath(dirPath);
      await fs.mkdir(validPath, { recursive: true });
      return text(`目录创建成功: ${dirPath}`);
    }
  );

  // delete_file
  server.registerTool(
    "delete_file",
    {
      description: "删除文件",
      inputSchema: { path: z.string().describe("文件路径") },
    },
    async ({ path: filePath }) => {
      const validPath = await validatePath(filePath);

      if (!(await pathExists(validPath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const stats = await fs.stat(validPath);
      if (stats.isDirectory()) {
        throw new McpError(ErrorCode.InvalidRequest, `路径是目录，不支持删除目录`);
      }

      await fs.unlink(validPath);
      return text(`文件删除成功: ${filePath}`);
    }
  );

  // search_files
  server.registerTool(
    "search_files",
    {
      description: "搜索文件",
      inputSchema: {
        path: z.string().describe("搜索目录"),
        pattern: z.string().describe("glob 模式"),
      },
    },
    async ({ path: searchPath, pattern }) => {
      const validPath = await validatePath(searchPath);

      if (!(await pathExists(validPath))) {
        throw new McpError(ErrorCode.InvalidRequest, `目录不存在: ${searchPath}`);
      }

      const files = await glob(pattern, { cwd: validPath, nodir: true, absolute: true });
      const results = await Promise.all(
        files.slice(0, 100).map(async (file) => {
          try {
            return await getStats(file);
          } catch {
            return { name: path.basename(file), path: file, type: "file", size: 0, modified: "", created: "" };
          }
        })
      );

      return text(JSON.stringify(
        { pattern, searchPath: validPath, total: files.length, showing: results.length, files: results },
        null, 2
      ));
    }
  );

  // get_file_info
  server.registerTool(
    "get_file_info",
    {
      description: "获取文件信息",
      inputSchema: { path: z.string().describe("文件路径") },
    },
    async ({ path: filePath }) => {
      const validPath = await validatePath(filePath);

      if (!(await pathExists(validPath))) {
        throw new McpError(ErrorCode.InvalidRequest, `路径不存在: ${filePath}`);
      }

      return text(JSON.stringify(await getStats(validPath), null, 2));
    }
  );

  return server;
}
