// RPG 游戏节点函数
// 每个节点接收完整 state，返回 partial update

import { interrupt } from '@langchain/langgraph';
import { z } from 'zod';
import { getModel } from '@/lib/llm';
import {
  SCENE_NARRATOR_PROMPT,
  ACTION_PARSER_PROMPT,
  CONSEQUENCE_EVALUATOR_PROMPT,
  NPC_RESPONDER_PROMPT,
  GAME_OVER_PROMPT,
  VICTORY_PROMPT,
} from './prompts';
import type { RpgStateType, RpgUpdateType } from './types';

/** 节点函数的 config 类型 */
type NodeConfig = { configurable?: { modelId?: string } };

// NPC 数据库
const NPC_DATABASE: Record<string, { personality: string }> = {
  '老铁匠': { personality: '粗犷豪爽，爱喝酒，说话直来直去，对勇者很热情。擅长锻造武器，也许能帮你强化装备。' },
  '神秘旅者': { personality: '神秘莫测，说话模棱两可，似乎知道很多秘密。总是在关键时刻出现，提供隐晦的指引。' },
  '药店老板': { personality: '精明但善良，喜欢讨价还价，但关键时刻会伸出援手。对草药了如指掌。' },
  '森林精灵': { personality: '优雅而警惕，对人类保持距离但并不敌对。熟知森林中的一切，是迷路时的好帮手。' },
};

// ============ 结构化输出 Schema ============

const SceneNarratorOutput = z.object({
  narration: z.string().describe('场景描述，200字以内'),
  suggestedActions: z.array(z.string()).describe('2-3个行动选项'),
});

const ActionParserOutput = z.object({
  type: z.enum(['combat', 'explore', 'dialogue', 'use_item', 'other']),
  description: z.string().describe('行动的简短描述'),
  target: z.string().optional().describe('行动目标'),
});

const ConsequenceEvaluatorOutput = z.object({
  sceneUpdate: z.string().describe('新的场景描述，无变化返回空字符串'),
  hpChange: z.number().describe('HP变化，正为治疗负为伤害'),
  itemsGained: z.array(z.string()).describe('获得的物品'),
  itemsLost: z.array(z.string()).describe('失去的物品'),
  eventsToAdd: z.array(z.string()).describe('新增事件'),
  narration: z.string().describe('行动结果叙述，100字内'),
  isVictory: z.boolean().describe('是否胜利'),
  triggerNpc: z.string().nullable().describe('触发的NPC名称，无则null'),
});

// ============ 节点函数 ============

/** 场景叙述节点：根据当前状态生成沉浸式场景描述 + 建议行动 */
export async function sceneNarrator(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);
  const structuredModel = model.withStructuredOutput(SceneNarratorOutput);

  const messages = await SCENE_NARRATOR_PROMPT.formatMessages({
    scene: state.scene,
    playerHp: String(state.playerHp),
    playerMaxHp: String(state.playerMaxHp),
    inventory: state.inventory.join('、') || '空',
    eventLog: state.eventLog.slice(-5).join('；') || '无',
  });

  const result = await structuredModel.invoke(messages);

  return {
    scene: result.narration,
    messages: [{ role: 'assistant', content: result.narration }],
    suggestedActions: result.suggestedActions.slice(0, 3),
  };
}

/** 等待玩家输入节点：调用 interrupt() 暂停，等待人类输入 */
export async function waitForPlayer(state: RpgStateType): Promise<RpgUpdateType> {
  // interrupt() 暂停图执行，返回值通过 Command({ resume }) 传入
  const playerInput = interrupt({
    type: 'await_player_input',
    scene: state.scene,
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    inventory: state.inventory,
    gameOver: state.gameOver,
    victory: state.victory,
    suggestedActions: state.suggestedActions,
  }) as string;

  return {
    messages: [{ role: 'user', content: playerInput }],
    lastPlayerInput: playerInput,
    suggestedActions: [],
  };
}

/** 行动解析节点：解析玩家输入为结构化行动 */
export async function actionParser(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);
  const structuredModel = model.withStructuredOutput(ActionParserOutput);

  const playerInput = state.lastPlayerInput || '';

  const messages = await ACTION_PARSER_PROMPT.formatMessages({
    playerInput,
    scene: state.scene,
  });

  const result = await structuredModel.invoke(messages);

  return {
    currentAction: {
      type: result.type,
      description: result.description,
      target: result.target,
    },
  };
}

/** 后果判定节点：判断行动结果，更新状态 */
export async function consequenceEvaluator(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);
  const structuredModel = model.withStructuredOutput(ConsequenceEvaluatorOutput);

  const action = state.currentAction;
  if (!action) {
    return { messages: [{ role: 'assistant', content: '行动解析失败，请重新描述你的行动。' }] };
  }

  const messages = await CONSEQUENCE_EVALUATOR_PROMPT.formatMessages({
    scene: state.scene,
    playerHp: String(state.playerHp),
    playerMaxHp: String(state.playerMaxHp),
    inventory: state.inventory.join('、') || '空',
    action: `${action.type}: ${action.description}` + (action.target ? ` -> ${action.target}` : ''),
  });

  const result = await structuredModel.invoke(messages);

  const newHp = Math.max(0, Math.min(state.playerMaxHp, state.playerHp + result.hpChange));

  const newInventory = [
    ...state.inventory.filter(item => !result.itemsLost.includes(item)),
    ...result.itemsGained,
  ];

  // 查找 NPC 性格
  const npcPersonality = result.triggerNpc && NPC_DATABASE[result.triggerNpc]
    ? NPC_DATABASE[result.triggerNpc].personality
    : undefined;

  return {
    playerHp: newHp,
    inventory: newInventory,
    eventLog: result.eventsToAdd,
    scene: result.sceneUpdate || state.scene,
    gameOver: newHp <= 0,
    victory: result.isVictory,
    currentAction: null,
    npcName: result.triggerNpc ?? undefined,
    npcPersonality,
    messages: [{ role: 'assistant', content: result.narration || '行动已完成。' }],
  };
}

/** NPC 对话节点：有独立记忆与性格 */
export async function npcResponder(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);
  const npcName = state.npcName || '神秘旅者';
  const npcPersonality = state.npcPersonality || '友善且乐于助人';

  const playerInput = state.lastPlayerInput || '';

  const messages = await NPC_RESPONDER_PROMPT.formatMessages({
    npcName,
    npcPersonality,
    npcMemory: state.npcMemory.slice(-5).join('；') || '无',
    playerInput,
    scene: state.scene,
  });

  const response = await model.invoke(messages);
  const npcReply = String(response.content);

  return {
    npcName: undefined,
    npcPersonality: undefined,
    npcMemory: [`玩家说：${playerInput} | ${npcName}回复：${npcReply}`],
    messages: [{ role: 'assistant', content: `【${npcName}】：${npcReply}` }],
  };
}

/** 游戏结束节点：生成死亡结局 */
export async function gameOverNode(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);

  const messages = await GAME_OVER_PROMPT.formatMessages({
    eventLog: state.eventLog.join('；'),
    scene: state.scene,
  });

  const response = await model.invoke(messages);

  return {
    gameOver: true,
    messages: [{ role: 'assistant', content: `💀 **游戏结束**\n\n${response.content}` }],
  };
}

/** 胜利节点：生成胜利结局 */
export async function victoryNode(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);

  const messages = await VICTORY_PROMPT.formatMessages({
    eventLog: state.eventLog.join('；'),
    scene: state.scene,
    inventory: state.inventory.join('、') || '空',
  });

  const response = await model.invoke(messages);

  return {
    victory: true,
    messages: [{ role: 'assistant', content: `🎉 **胜利！**\n\n${response.content}` }],
  };
}
