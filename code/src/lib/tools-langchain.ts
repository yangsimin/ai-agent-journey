// LangChain 版工具定义
// 与 tools.ts 功能等价，使用 LangChain 的 tool() 函数封装
// 对比学习：Vercel AI SDK tool({ description, inputSchema, execute }) vs LangChain tool(fn, { name, description, schema })

import { tool } from 'langchain';
import {
  createReminderSchema,
  listRemindersSchema,
  completeReminderSchema,
  getWeatherSchema,
  coreCreateReminder,
  coreListReminders,
  coreCompleteReminder,
  coreGetWeather,
} from './tools-core';

// LangChain 工具返回 JSON 字符串（区别于 AI SDK 返回对象）

export const createReminderTool = tool(
  async (input) => JSON.stringify(await coreCreateReminder(input)),
  {
    name: 'create_reminder',
    description: '创建一个提醒事项。当用户提到"提醒我"、"记住"、"别忘了"、"X点要"等关键词时调用此工具。对于时间相关表述（如"明天下午3点"、"下周一"），请结合当前时间计算出具体的 ISO 8601 日期时间填入 dueDate。',
    schema: createReminderSchema,
  },
);

export const listRemindersTool = tool(
  async (input) => JSON.stringify(await coreListReminders(input)),
  {
    name: 'list_reminders',
    description: '列出提醒事项。当用户询问"有什么提醒"、"我的待办"等时调用此工具。',
    schema: listRemindersSchema,
  },
);

export const completeReminderTool = tool(
  async (input) => JSON.stringify(await coreCompleteReminder(input)),
  {
    name: 'complete_reminder',
    description: '将一个提醒标记为已完成。当用户说"完成了X"、"取消提醒X"等时调用。',
    schema: completeReminderSchema,
  },
);

export const getWeatherTool = tool(
  async (input) => JSON.stringify(await coreGetWeather(input)),
  {
    name: 'get_weather',
    description: '获取指定城市的当前天气信息。当用户询问天气、气温、是否下雨时调用此工具。',
    schema: getWeatherSchema,
  },
);

export const lcTools = [createReminderTool, listRemindersTool, completeReminderTool, getWeatherTool];
