// LangChain 版工具定义
// 与 tools.ts 功能等价，使用 LangChain 的 tool() 函数封装
// 对比学习：Vercel AI SDK tool({ description, inputSchema, execute }) vs LangChain tool(fn, { name, description, schema })

import { tool } from 'langchain';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import type { Todo } from './tools';

// ========== 复用现有 Todo 存储逻辑 ==========
const TODOS_PATH = path.join(process.cwd(), '.todos.json');

function readTodos(): Todo[] {
  try {
    if (fs.existsSync(TODOS_PATH)) {
      const data = fs.readFileSync(TODOS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取 Todos 失败:', e);
  }
  return [];
}

function writeTodos(todos: Todo[]) {
  fs.writeFileSync(TODOS_PATH, JSON.stringify(todos, null, 2), 'utf-8');
}

// ========== Mock 天气数据（与 tools.ts 一致） ==========
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

// ========== LangChain 工具定义 ==========
// LangChain tool() 签名：tool(执行函数, { name, description, schema })
// 对比 Vercel AI SDK：tool({ description, inputSchema: z.object({...}), execute: async () => {} })

export const createTodoTool = tool(
  async ({ title, dueDate, priority }) => {
    const todo: Todo = {
      id: Date.now().toString(),
      title,
      dueDate,
      priority: priority ?? 'medium',
      done: false,
      createdAt: new Date().toISOString(),
    };
    const todos = readTodos();
    todos.push(todo);
    writeTodos(todos);
    return JSON.stringify({ success: true, todo });
  },
  {
    name: 'create_todo',
    description: '创建一个待办事项。当用户要求创建提醒、任务、计划时调用此工具。',
    schema: z.object({
      title: z.string().describe('任务标题，简短描述要做什么'),
      dueDate: z.string().optional().describe('截止日期，格式为 YYYY-MM-DD'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('任务优先级'),
    }),
  },
);

export const getWeatherTool = tool(
  async ({ city }) => {
    const data = weatherData[city];
    if (data) {
      return JSON.stringify({ city, ...data });
    }
    return JSON.stringify({
      city,
      temperature: 20 + Math.floor(Math.random() * 10),
      condition: '晴',
      humidity: 50 + Math.floor(Math.random() * 30),
    });
  },
  {
    name: 'get_weather',
    description: '获取指定城市的当前天气信息。当用户询问天气、气温、是否下雨时调用此工具。',
    schema: z.object({
      city: z.string().describe('城市名称，例如：深圳、北京、上海'),
    }),
  },
);

export const lcTools = [createTodoTool, getWeatherTool];
