import { tool } from 'ai';
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

const CREATE_REMINDER_DESC = '创建一个提醒事项。当用户提到"提醒我"、"记住"、"别忘了"、"X点要"等关键词时调用此工具。对于时间相关表述（如"明天下午3点"、"下周一"），请结合当前时间计算出具体的 ISO 8601 日期时间填入 dueDate。';

export const createReminderTool = tool({
  description: CREATE_REMINDER_DESC,
  inputSchema: createReminderSchema,
  execute: coreCreateReminder,
});

export const listRemindersTool = tool({
  description: '列出提醒事项。当用户询问"有什么提醒"、"我的待办"等时调用此工具。',
  inputSchema: listRemindersSchema,
  execute: coreListReminders,
});

export const completeReminderTool = tool({
  description: '将一个提醒标记为已完成。当用户说"完成了X"、"取消提醒X"等时调用。',
  inputSchema: completeReminderSchema,
  execute: coreCompleteReminder,
});

export const getWeatherTool = tool({
  description: '获取指定城市的当前天气信息。当用户询问天气、气温、是否下雨时调用此工具。',
  inputSchema: getWeatherSchema,
  execute: coreGetWeather,
});

export const myTools = {
  create_reminder: createReminderTool,
  list_reminders: listRemindersTool,
  complete_reminder: completeReminderTool,
  get_weather: getWeatherTool,
};
