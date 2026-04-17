import { prisma } from './db';
import type { Conversation, Message } from '../../generated/prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;

// ========== Conversation CRUD ==========

export async function createConversation(data: {
  title?: string;
  backend: string;
  modelId: string;
  persona?: string;
}): Promise<Conversation> {
  return prisma.conversation.create({ data });
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function listConversations(options?: {
  limit?: number;
  offset?: number;
}): Promise<Conversation[]> {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: { _count: { select: { messages: true } } },
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await prisma.conversation.delete({ where: { id } });
}

// ========== Message CRUD ==========

export async function addMessage(data: {
  conversationId: string;
  role: string;
  content: string;
  parts?: JsonInput;
}): Promise<Message> {
  return prisma.message.create({ data });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}

// ========== 辅助函数 ==========

/** 根据首条用户消息自动生成对话标题 */
export function generateTitle(content: string): string {
  const maxLen = 30;
  const cleaned = content.replace(/\n/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned;
}
