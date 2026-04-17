import { withGetHandler, withApiHandler } from '@/lib/api-utils';
import { listReminders, createReminder } from '@/lib/reminders';
import { z } from 'zod';

const createReminderSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  conversationId: z.string().optional(),
});

export const GET = withGetHandler(async (req) => {
  const url = new URL(req.url);
  const includeDone = url.searchParams.get('includeDone') === 'true';
  const reminders = await listReminders(includeDone);
  return Response.json({ reminders });
});

export const POST = withApiHandler(
  async (req, body) => {
    const reminder = await createReminder(body);
    return Response.json({ reminder }, { status: 201 });
  },
  { schema: createReminderSchema },
);
