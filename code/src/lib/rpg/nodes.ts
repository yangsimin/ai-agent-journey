// RPG 游戏节点函数
// 每个节点接收完整 state，返回 partial update

import { interrupt } from '@langchain/langgraph';
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

/** 从 LLM 响应中提取 JSON — 使用括号平衡匹配，避免贪婪匹配跨多段 JSON */
function extractJson(content: string): Record<string, unknown> | null {
  // 找到第一个 '{' 的位置
  const start = content.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    if (depth === 0) {
      try {
        return JSON.parse(content.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** 替换模板占位符 */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [key, val]) => acc.replaceAll(`{${key}}`, val), template);
}

// ============ 节点函数 ============

/** 场景叙述节点：根据当前状态生成沉浸式场景描述 + 建议行动 */
export async function sceneNarrator(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);

  const prompt = fillTemplate(SCENE_NARRATOR_PROMPT, {
    scene: state.scene,
    playerHp: String(state.playerHp),
    playerMaxHp: String(state.playerMaxHp),
    inventory: state.inventory.join('、') || '空',
    eventLog: state.eventLog.slice(-5).join('；') || '无',
  });

  const response = await model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: '请描述当前场景并提供行动建议。' },
  ]);

  const content = String(response.content);
  const parsed = extractJson(content);

  const narration = parsed?.narration ? String(parsed.narration) : content;
  const suggestedActions = Array.isArray(parsed?.suggestedActions)
    ? (parsed.suggestedActions as string[]).slice(0, 3)
    : [];

  return {
    scene: narration,
    messages: [{ role: 'assistant', content: narration }],
    suggestedActions,
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
    // 清空建议选项，避免残留到下一轮
    suggestedActions: [],
  };
}

/** 行动解析节点：解析玩家输入为结构化行动 */
export async function actionParser(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);

  // 从消息历史中获取最后一条用户输入
  const lastUserMsg = [...state.messages].reverse().find(m => m._getType() === 'human');
  const playerInput = String(lastUserMsg?.content ?? '');

  const prompt = fillTemplate(ACTION_PARSER_PROMPT, {
    playerInput,
    scene: state.scene,
  });

  const response = await model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: playerInput },
  ]);

  const parsed = extractJson(String(response.content));

  const validTypes = ['combat', 'explore', 'dialogue', 'use_item', 'other'] as const;
  const actionType = parsed && validTypes.includes(parsed.type as typeof validTypes[number])
    ? (parsed.type as typeof validTypes[number])
    : 'other';

  return {
    currentAction: {
      type: actionType,
      description: (parsed?.description as string) || playerInput,
      target: (parsed?.target as string) || undefined,
    },
  };
}

/** 后果判定节点：判断行动结果，更新状态 */
export async function consequenceEvaluator(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);
  const action = state.currentAction;
  if (!action) {
    return { messages: [{ role: 'assistant', content: '行动解析失败，请重新描述你的行动。' }] };
  }

  const prompt = fillTemplate(CONSEQUENCE_EVALUATOR_PROMPT, {
    scene: state.scene,
    playerHp: String(state.playerHp),
    playerMaxHp: String(state.playerMaxHp),
    inventory: state.inventory.join('、') || '空',
    action: `${action.type}: ${action.description}` + (action.target ? ` -> ${action.target}` : ''),
  });

  const response = await model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: '请判定行动结果。' },
  ]);

  const result = extractJson(String(response.content)) || {};

  // 计算新状态
  const hpChange = Number(result.hpChange) || 0;
  const newHp = Math.max(0, Math.min(state.playerMaxHp, state.playerHp + hpChange));
  const itemsGained = Array.isArray(result.itemsGained) ? result.itemsGained as string[] : [];
  const itemsLost = Array.isArray(result.itemsLost) ? result.itemsLost as string[] : [];
  const eventsToAdd = Array.isArray(result.eventsToAdd) ? result.eventsToAdd as string[] : [];
  const sceneUpdate = String(result.sceneUpdate || '');
  const isVictory = Boolean(result.isVictory);
  const triggerNpc = result.triggerNpc ? String(result.triggerNpc) : undefined;

  const newInventory = [
    ...state.inventory.filter(item => !itemsLost.includes(item)),
    ...itemsGained,
  ];

  // 查找 NPC 性格
  const npcPersonality = triggerNpc && NPC_DATABASE[triggerNpc]
    ? NPC_DATABASE[triggerNpc].personality
    : undefined;

  return {
    playerHp: newHp,
    inventory: newInventory,
    eventLog: eventsToAdd,
    scene: sceneUpdate || state.scene,
    gameOver: newHp <= 0,
    victory: isVictory,
    currentAction: null,
    npcName: triggerNpc,
    npcPersonality,
    messages: [{ role: 'assistant', content: String(result.narration || '行动已完成。') }],
  };
}

/** NPC 对话节点：有独立记忆与性格 */
export async function npcResponder(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);
  const npcName = state.npcName || '神秘旅者';
  const npcPersonality = state.npcPersonality || '友善且乐于助人';

  // 从消息中获取最后的用户输入
  const lastUserMsg = [...state.messages].reverse().find(m => m._getType() === 'human');
  const playerInput = String(lastUserMsg?.content ?? '');

  const prompt = fillTemplate(NPC_RESPONDER_PROMPT, {
    npcName,
    npcPersonality,
    npcMemory: state.npcMemory.slice(-5).join('；') || '无',
    playerInput,
    scene: state.scene,
  });

  const response = await model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: playerInput },
  ]);

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

  const prompt = fillTemplate(GAME_OVER_PROMPT, {
    eventLog: state.eventLog.join('；'),
    scene: state.scene,
  });

  const response = await model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: '请生成死亡结局。' },
  ]);

  return {
    gameOver: true,
    messages: [{ role: 'assistant', content: `💀 **游戏结束**\n\n${response.content}` }],
  };
}

/** 胜利节点：生成胜利结局 */
export async function victoryNode(state: RpgStateType, config?: NodeConfig): Promise<RpgUpdateType> {
  const model = getModel(config?.configurable?.modelId);

  const prompt = fillTemplate(VICTORY_PROMPT, {
    eventLog: state.eventLog.join('；'),
    scene: state.scene,
    inventory: state.inventory.join('、') || '空',
  });

  const response = await model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: '请生成胜利结局。' },
  ]);

  return {
    victory: true,
    messages: [{ role: 'assistant', content: `🎉 **胜利！**\n\n${response.content}` }],
  };
}
