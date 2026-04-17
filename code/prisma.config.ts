import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // 开发环境 fallback，避免 pnpm install 时因缺少 DATABASE_URL 报错
    url: process.env.DATABASE_URL || "postgresql://aiagent:aiagent@localhost:5432/ai_agent_journey",
  },
});
