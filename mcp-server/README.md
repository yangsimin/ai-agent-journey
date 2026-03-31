# Filesystem MCP Server

MCP (Model Context Protocol) 服务器，提供文件系统操作工具。支持两种传输方式：

## 传输方式对比

| 特性 | stdio | HTTP |
|------|-------|------|
| 通信方式 | 标准输入/输出 | HTTP POST/GET |
| 适用场景 | 本地进程、Claude Desktop | 远程服务、Web 应用 |
| 部署复杂度 | 低 | 中等 |
| 跨机器访问 | 不支持 | 支持 |

## 安装

```bash
npm install
npm run build
```

## 使用方式

### stdio 模式

适用于本地进程间通信、Claude Desktop 集成。

```bash
# 启动 stdio 模式
npm run start:stdio

# 或直接运行
node dist/stdio.js
```

**Claude Desktop 配置** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/stdio.js"],
      "env": {
        "ALLOWED_DIRS": "/Users/xxx/projects"
      }
    }
  }
}
```

### HTTP 模式

适用于远程服务部署、跨进程/跨机器调用。

```bash
# 启动 HTTP 模式（默认端口 3001）
npm run start:http

# 自定义端口和主机
MCP_PORT=8080 MCP_HOST=0.0.0.0 node dist/http.js
```

**客户端调用示例**:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-client", version: "1.0.0" }, {});
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3001/mcp"));

await client.connect(transport);
```

## 提供的工具

| 工具 | 功能 | 参数 |
|------|------|------|
| `read_file` | 读取文件内容 | `path: string` |
| `write_file` | 写入文件内容 | `path: string`, `content: string` |
| `list_directory` | 列出目录内容 | `path: string` |
| `create_directory` | 创建目录 | `path: string` |
| `delete_file` | 删除文件 | `path: string` |
| `search_files` | 搜索文件 | `path: string`, `pattern: string` |
| `get_file_info` | 获取文件信息 | `path: string` |

## 安全配置

通过环境变量 `ALLOWED_DIRS` 限制可访问的目录（多个目录用 `:` 分隔）：

```bash
ALLOWED_DIRS=/Users/xxx/projects:/Users/xxx/documents node dist/stdio.js
```

默认只允许访问当前工作目录。

## 调试

使用 MCP Inspector 可视化调试：

```bash
# stdio 模式
npm run inspector

# HTTP 模式（先启动 HTTP server，然后访问 inspector）
npm run start:http
# 在浏览器打开 MCP Inspector，输入 http://localhost:3001/mcp
```

## 目录结构

```
mcp-server/
├── src/
│   ├── server.ts    # 核心逻辑（工具定义和处理）
│   ├── stdio.ts     # stdio 传输入口
│   └── http.ts      # HTTP 传输入口
├── dist/            # 编译输出
├── package.json
└── tsconfig.json
```
