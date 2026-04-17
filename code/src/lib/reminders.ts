import { prisma } from './db';

// ========== Types ==========

export interface CreateReminderInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  conversationId?: string;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  done?: boolean;
}

// ========== Reminder CRUD ==========

export async function listReminders(includeDone = false) {
  return prisma.reminder.findMany({
    where: includeDone ? undefined : { done: false },
    orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createReminder(data: CreateReminderInput) {
  return prisma.reminder.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      priority: data.priority ?? 'medium',
      conversationId: data.conversationId || undefined,
    },
  });
}

export async function updateReminder(id: string, data: UpdateReminderInput) {
  return prisma.reminder.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.done === true && { done: true, doneAt: new Date() }),
    },
  });
}

export async function deleteReminder(id: string) {
  await prisma.reminder.delete({ where: { id } });
}
