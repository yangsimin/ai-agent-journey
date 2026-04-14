// RPG 游戏 API 路由
// 处理 start（新游戏）、resume（提交玩家输入）、recover（刷新恢复）三种请求
// start/resume 使用 SSE 流式返回，recover 使用 JSON 直接返回

import '@/instrumentation';

import { rpgGraph } from '@/lib/rpg/graph';
import { createInitialState } from '@/lib/rpg/initial-state';
import { createLangfuseCallbacks } from '@/lib/langfuse';
import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/** 提取后的游戏状态类型 */
interface GameState {
  scene: string;
  playerHp: number;
  playerMaxHp: number;
  inventory: string[];
  eventLog: string[];
  gameOver: boolean;
  victory: boolean;
  suggestedActions: string[];
}

/** 提取后的消息类型 */
interface ExtractedMessage {
  role: string;
  content: string;
}

const MAX_PLAYER_INPUT_LENGTH = 2000;

const encoder = new TextEncoder();

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { action, threadId, playerInput, modelId } = body as {
    action: string;
    threadId?: string;
    playerInput?: string;
    modelId?: string;
  };

  // threadId 是游戏会话标识，用于 checkpointer 定位状态
  const tid = threadId || `rpg-${Date.now()}`;
  const config = {
    configurable: { thread_id: tid, modelId },
    ...createLangfuseCallbacks({
      sessionId: tid,
      tags: ['rpg-game'],
      traceMetadata: { modelId, action },
    }),
  };

  if (action === 'start') {
    // 启动新游戏
    return handleGameStream(
      () => rpgGraph.invoke(createInitialState(), config),
      tid,
    );
  }

  if (action === 'resume') {
    // 恢复中断（提交玩家输入）
    if (!playerInput) {
      return Response.json({ error: 'playerInput is required for resume action' }, { status: 400 });
    }
    if (playerInput.length > MAX_PLAYER_INPUT_LENGTH) {
      return Response.json({ error: `playerInput too long (max ${MAX_PLAYER_INPUT_LENGTH} characters)` }, { status: 400 });
    }
    return handleGameStream(
      () => rpgGraph.invoke(new Command({ resume: playerInput }), config),
      tid,
    );
  }

  if (action === 'recover') {
    // 探针接口：从 checkpointer 拉取当前线程状态（用于页面刷新恢复）
    const snapshot = await rpgGraph.getState({ configurable: { thread_id: tid } });

    // 没有状态 = 无效 threadId（服务器重启或从未存在）
    if (!snapshot.values || Object.keys(snapshot.values).length === 0) {
      return Response.json({ error: 'Game session not found' }, { status: 404 });
    }

    const hasPendingInterrupt = snapshot.next.length > 0
      && snapshot.tasks.some(t => t.interrupts.length > 0);

    if (hasPendingInterrupt) {
      // 游戏卡在 interrupt，返回完整状态供前端恢复
      return Response.json({
        status: 'awaiting_input',
        gameState: extractGameState(snapshot.values as AnyRecord),
        messages: extractMessages(snapshot.values as AnyRecord),
      });
    }

    // 游戏已结束（到 END 节点）
    return Response.json({
      status: 'completed',
      gameState: extractGameState(snapshot.values as AnyRecord),
      messages: extractMessages(snapshot.values as AnyRecord),
    });
  }

  return Response.json({ error: 'Invalid action. Use "start", "resume", or "recover".' }, { status: 400 });
}

async function handleGameStream(
  invokeFn: () => Promise<AnyRecord>,
  threadId: string,
) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await invokeFn();

        // 检查是否被中断（等待玩家输入）
        if (isInterrupted(result)) {
          const interruptValue = (result as AnyRecord)[INTERRUPT];
          const interruptData = Array.isArray(interruptValue) ? interruptValue[0]?.value : undefined;
          controller.enqueue(encoder.encode(
            formatSSE('interrupt', {
              type: 'await_player_input',
              threadId,
              interrupt: interruptData,
              gameState: extractGameState(result),
              messages: extractMessages(result),
            }),
          ));
        } else {
          // 正常完成（game_over 或 victory）
          controller.enqueue(encoder.encode(
            formatSSE('complete', {
              threadId,
              gameState: extractGameState(result),
              messages: extractMessages(result),
            }),
          ));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[RPG API] Error:', msg);
        controller.enqueue(encoder.encode(
          formatSSE('error', { message: msg }),
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** 格式化 SSE 消息 */
function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** 从图结果中提取游戏状态 */
function extractGameState(result: AnyRecord): GameState {
  return {
    scene: result.scene ?? '',
    playerHp: result.playerHp ?? 100,
    playerMaxHp: result.playerMaxHp ?? 100,
    inventory: result.inventory ?? [],
    eventLog: result.eventLog ?? [],
    gameOver: result.gameOver ?? false,
    victory: result.victory ?? false,
    suggestedActions: result.suggestedActions ?? [],
  };
}

/** 将 LangChain 消息 role 映射为前端期望的 role（ai → assistant） */
function normalizeRole(role: string): string {
  if (role === 'ai') return 'assistant';
  return role;
}

/** 从图结果中提取消息列表 */
function extractMessages(result: AnyRecord): ExtractedMessage[] {
  const messages = result.messages;
  if (!Array.isArray(messages)) return [];

  return messages.map((m: AnyRecord) => ({
    role: normalizeRole(m._getType ? m._getType() : (m.role || 'assistant')),
    content: typeof m.content === 'string' ? m.content : String(m.content),
  }));
}
