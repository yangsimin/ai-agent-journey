import { withGetHandler } from '@/lib/api-utils';
import { prisma } from '@/lib/db';

export const GET = withGetHandler(
  async () => {
    const reminders = await prisma.reminder.findMany({
      where: { done: false },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    // 兼容旧前端，返回 { todos: [...] } 格式
    return Response.json({ todos: reminders });
  },
);
