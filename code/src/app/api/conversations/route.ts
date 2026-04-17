import { withGetHandler, withApiHandler } from '@/lib/api-utils';
import { listConversations, createConversation, generateTitle } from '@/lib/conversations';
import { z } from 'zod';

const createConversationSchema = z.object({
  backend: z.enum(['vercel', 'langchain']).default('vercel'),
  modelId: z.string(),
  persona: z.string().optional(),
  firstMessage: z.string().optional(),
});

export const GET = withGetHandler(
  async () => {
    const conversations = await listConversations({ limit: 50 });
    return Response.json({ conversations });
  },
);

export const POST = withApiHandler(
  async (req, body) => {
    const conversation = await createConversation({
      title: body.firstMessage ? generateTitle(body.firstMessage) : undefined,
      backend: body.backend,
      modelId: body.modelId,
      persona: body.persona,
    });
    return Response.json({ conversation }, { status: 201 });
  },
  { schema: createConversationSchema },
);
