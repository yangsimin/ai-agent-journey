import { z } from 'zod';

/** POST /api/chat 和 POST /api/chat-langchain 的请求体校验 */
export const chatRequestSchema = z.object({
  messages: z.array(z.any()).min(1, 'messages 不能为空'),
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  conversationId: z.string().nullable().optional().transform(v => v ?? undefined),
});

/** POST /api/rpg 的请求体校验 */
export const rpgRequestSchema = z.object({
  action: z.enum(['start', 'resume', 'recover']),
  threadId: z.string().optional(),
  playerInput: z.string().max(2000).optional(),
  modelId: z.string().optional(),
});

/** POST /api/ingest 的请求体校验 */
export const ingestRequestSchema = z.object({
  text: z.string().min(1, 'text 不能为空'),
  filename: z.string().optional(),
});

/** PATCH /api/todo-md 的请求体校验 */
export const todoMdPatchSchema = z.object({
  lineNumber: z.number({ error: 'lineNumber is required' }),
});
