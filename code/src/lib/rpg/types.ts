// RPG 游戏状态定义
// 使用 LangGraph v1 推荐的 StateSchema + Zod 定义

import { StateSchema, MessagesValue, ReducedValue } from '@langchain/langgraph';
import { z } from 'zod';

// 行动意图结构
const ActionSchema = z.object({
  type: z.enum(['combat', 'explore', 'dialogue', 'use_item', 'other']),
  description: z.string(),
  target: z.string().optional(),
});

// 游戏状态 Schema
export const RpgState = new StateSchema({
  // 消息历史（用于 LLM 上下文 + 前端显示，自动拼接）
  messages: MessagesValue,

  // 场景描述
  scene: z.string().default(''),

  // 建议行动选项（sceneNarrator 生成，waitForPlayer 消费后清空）
  suggestedActions: z.array(z.string()).default(() => []),

  // 玩家状态
  playerHp: z.number().default(100),
  playerMaxHp: z.number().default(100),
  // inventory 使用覆盖语义（非 reducer），节点必须返回完整的新数组
  inventory: z.array(z.string()).default(() => []),

  // 最近一次玩家输入（waitForPlayer 设置，actionParser/npcResponder 直接读取，避免反查 messages）
  lastPlayerInput: z.string().default(''),

  // 事件日志（追加式）
  eventLog: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (current, next) => [...current, ...next],
    },
  ),

  // 胜负标志
  gameOver: z.boolean().default(false),
  victory: z.boolean().default(false),

  // 当前行动意图（action_parser 填写，consequence_evaluator 消费）
  currentAction: ActionSchema.nullable().default(null),

  // NPC 对话上下文
  npcName: z.string().optional(),
  npcPersonality: z.string().optional(),
  // NPC 记忆（追加式）
  npcMemory: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (current, next) => [...current, ...next],
    },
  ),
});

// 导出类型
export type RpgStateType = typeof RpgState.State;
export type RpgUpdateType = typeof RpgState.Update;
