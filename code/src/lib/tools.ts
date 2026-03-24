import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// ========== Todo 数据存储 (本地文件) ==========
// 解决 Next.js 开发环境下 API 路由隔离导致的内存丢失问题
export interface Todo {
  id: string;
  title: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
  createdAt: string;
}

const TODOS_PATH = path.join(process.cwd(), '.todos.json');

export function readTodos(): Todo[] {
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

export function writeTodos(todos: Todo[]) {
  fs.writeFileSync(TODOS_PATH, JSON.stringify(todos, null, 2), 'utf-8');
}

export function addTodo(todo: Todo) {
  const todos = readTodos();
  todos.push(todo);
  writeTodos(todos);
}

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

// ========== 工具定义 ==========
export const createTodoTool = tool({
  description: '创建一个待办事项。当用户要求创建提醒、任务、计划时调用此工具。',
  inputSchema: z.object({
    title: z.string().describe('任务标题，简短描述要做什么'),
    dueDate: z.string().optional().describe('截止日期，格式为 YYYY-MM-DD'),
    priority: z.enum(['high', 'medium', 'low']).optional().describe('任务优先级'),
  }),
  execute: async ({ title, dueDate, priority }) => {
    const todo: Todo = {
      id: Date.now().toString(),
      title,
      dueDate,
      priority: priority ?? 'medium',
      done: false,
      createdAt: new Date().toISOString(),
    };
    addTodo(todo);
    return { success: true, todo };
  },
});

export const getWeatherTool = tool({
  description: '获取指定城市的当前天气信息。当用户询问天气、气温、是否下雨时调用此工具。',
  inputSchema: z.object({
    city: z.string().describe('城市名称，例如：深圳、北京、上海'),
  }),
  execute: async ({ city }) => {
    const data = weatherData[city];
    if (data) {
      return { city, ...data };
    }
    // 未知城市返回随机模拟数据
    return {
      city,
      temperature: 20 + Math.floor(Math.random() * 10),
      condition: '晴',
      humidity: 50 + Math.floor(Math.random() * 30),
    };
  },
});

// ========== 导出工具集 ==========
export const myTools = {
  create_todo: createTodoTool,
  get_weather: getWeatherTool,
};
