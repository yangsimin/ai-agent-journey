import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || 'postgresql://aiagent:aiagent@localhost:5432/ai_agent_journey',
  }),
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
