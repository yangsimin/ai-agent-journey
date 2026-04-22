// 共享工具逻辑：schemas、mock 数据、核心执行函数
// tools.ts (Vercel AI SDK) 和 tools-langchain.ts (LangChain) 均从此导入
import { z } from 'zod';

// ========== 共享 Zod Schemas ==========

export const createReminderSchema = z.object({
  title: z.string().describe('提醒标题，简短描述要做什么'),
  description: z.string().optional().describe('提醒的详细描述'),
  dueDate: z.string().optional().describe('截止日期时间，ISO 8601 格式（如 2026-04-18T15:00:00）'),
  priority: z.enum(['high', 'medium', 'low']).optional().describe('优先级：high=高，medium=中，low=低'),
  conversationId: z.string().optional().describe('关联的对话 ID'),
});

export const listRemindersSchema = z.object({
  includeDone: z.boolean().optional().describe('是否包含已完成的提醒，默认 false'),
});

export const completeReminderSchema = z.object({
  id: z.string().describe('要完成的提醒 ID'),
});

export const getWeatherSchema = z.object({
  city: z.string().describe('城市名称，例如：深圳、北京、上海'),
});

// ========== Mock 天气数据 ==========

const weatherData: Record<string, { temperature: number; condition: string; humidity: number }> = {
  '深圳': { temperature: 25, condition: '晴', humidity: 65 },
  '北京': { temperature: 18, condition: '多云', humidity: 40 },
  '上海': { temperature: 22, condition: '阴', humidity: 72 },
  '广州': { temperature: 28, condition: '雷阵雨', humidity: 85 },
  '成都': { temperature: 20, condition: '小雨', humidity: 78 },
  '杭州': { temperature: 23, condition: '晴', humidity: 58 },
  '东京': { temperature: 19, condition: '晴', humidity: 55 },
  '纽约': { temperature: 15, condition: '多云', humidity: 50 },
};

// ========== 天气执行函数（含 mock 逻辑，不适合内联）==========

export async function coreGetWeather(input: z.infer<typeof getWeatherSchema>) {
  const data = weatherData[input.city];
  if (data) return { city: input.city, ...data };
  return {
    city: input.city,
    temperature: 20 + Math.floor(Math.random() * 10),
    condition: '晴',
    humidity: 50 + Math.floor(Math.random() * 30),
  };
}
