// RPG 游戏状态图构建与编译
// LangGraph StateGraph 定义：节点 + 边 + 条件路由
// 注意：节点名不能与状态字段名相同（LangGraph 限制）

import { StateGraph, MemorySaver, START, END } from '@langchain/langgraph';
import { RpgState } from './types';
import {
  sceneNarrator,
  waitForPlayer,
  actionParser,
  consequenceEvaluator,
  npcResponder,
  gameOverNode,
  victoryNode,
} from './nodes';

/** 条件路由：从 consequence_evaluator 出发 */
function routeAfterConsequence(state: typeof RpgState.State): string {
  if (state.playerHp <= 0 || state.gameOver) return 'end_death';
  if (state.victory) return 'end_victory';
  if (state.npcName) return 'npc_responder';
  return 'scene_narrator';
}

/** 条件路由：从 npc_responder 出发 */
function routeAfterNpc(state: typeof RpgState.State): string {
  if (state.playerHp <= 0 || state.gameOver) return 'end_death';
  if (state.victory) return 'end_victory';
  return 'wait_for_player';
}

// 构建图
const graphBuilder = new StateGraph(RpgState)
  // 添加节点（名称不能与状态字段名冲突）
  .addNode('scene_narrator', sceneNarrator)
  .addNode('wait_for_player', waitForPlayer)
  .addNode('action_parser', actionParser)
  .addNode('consequence_evaluator', consequenceEvaluator)
  .addNode('npc_responder', npcResponder)
  .addNode('end_death', gameOverNode)
  .addNode('end_victory', victoryNode)

  // 固定边
  .addEdge(START, 'scene_narrator')
  .addEdge('scene_narrator', 'wait_for_player')
  .addEdge('wait_for_player', 'action_parser')
  .addEdge('action_parser', 'consequence_evaluator')

  // 条件边：consequence_evaluator 之后
  .addConditionalEdges('consequence_evaluator', routeAfterConsequence, {
    end_death: 'end_death',
    end_victory: 'end_victory',
    npc_responder: 'npc_responder',
    scene_narrator: 'scene_narrator',
  })

  // 条件边：npc_responder 之后
  .addConditionalEdges('npc_responder', routeAfterNpc, {
    end_death: 'end_death',
    end_victory: 'end_victory',
    wait_for_player: 'wait_for_player',
  })

  // 终局节点 → END
  .addEdge('end_death', END)
  .addEdge('end_victory', END);

// 内存 Checkpointer（interrupt 必需，开发阶段使用 MemorySaver）
const checkpointer = new MemorySaver();

// 编译图
export const rpgGraph = graphBuilder.compile({ checkpointer });

// 重导出类型
export type { RpgStateType, RpgUpdateType } from './types';
