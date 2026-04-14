'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/site-header';

// 游戏状态类型
interface GameStatus {
  scene: string;
  playerHp: number;
  playerMaxHp: number;
  inventory: string[];
  eventLog: string[];
  gameOver: boolean;
  victory: boolean;
  suggestedActions: string[];
}

// 消息类型
interface ChatMessage {
  role: 'narrator' | 'player' | 'system';
  content: string;
}

// SSE 事件数据
interface SSEInterruptData {
  type: 'await_player_input';
  threadId: string;
  gameState: GameStatus;
  messages: { role: string; content: string }[];
}

interface SSECompleteData {
  threadId: string;
  gameState: GameStatus;
  messages: { role: string; content: string }[];
}

/** 将后端消息列表转为前端 ChatMessage[]，按角色映射 */
function toDisplayMessages(msgs: { role: string; content: string }[]): ChatMessage[] {
  return msgs
    .filter(m => m.content.trim())
    .map(m => {
      if (m.role === 'assistant' || m.role === 'ai') return { role: 'narrator' as const, content: m.content };
      if (m.role === 'human' || m.role === 'user') return { role: 'player' as const, content: m.content };
      return { role: 'system' as const, content: m.content };
    });
}

export default function RPGPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlThreadId = searchParams.get('thread') || '';
  const [threadId, setThreadId] = useState(urlThreadId);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingPlayerMsgRef = useRef<string | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);

  // 同步 threadId 到 URL search params
  const setThreadIdWithUrl = useCallback((tid: string) => {
    setThreadId(tid);
    const params = new URLSearchParams(searchParams.toString());
    if (tid) {
      params.set('thread', tid);
    } else {
      params.delete('thread');
    }
    router.replace(`/rpg?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // 页面加载时恢复游戏状态（State Hydration）
  useEffect(() => {
    if (!urlThreadId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rpg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'recover', threadId: urlThreadId }),
        });
        if (res.status === 404) {
          // threadId 已失效（服务器重启），清除 URL 参数
          router.replace('/rpg', { scroll: false });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.status === 'awaiting_input' || data.status === 'completed') {
          setGameStatus(data.gameState);
          setMessages(toDisplayMessages(data.messages));
          setSuggestedActions(data.gameState?.suggestedActions ?? []);
          setGameStarted(true);
        }
      } catch {
        // 恢复失败，静默忽略
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 合并临时玩家消息（loading 期间乐观显示）
  const displayMessages = useMemo(() => {
    if (loading && pendingPlayerMsgRef.current) {
      return [...messages, { role: 'player' as const, content: pendingPlayerMsgRef.current }];
    }
    return messages;
  }, [messages, loading]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, loading]);

  // 处理 SSE 响应
  const processSSEResponse = useCallback(async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (currentEvent === 'interrupt') {
              const interruptData = data as SSEInterruptData;
              setGameStatus(interruptData.gameState);
              setMessages(toDisplayMessages(interruptData.messages ?? []));
              setSuggestedActions(interruptData.gameState.suggestedActions ?? []);
              pendingPlayerMsgRef.current = null;
            } else if (currentEvent === 'complete') {
              const completeData = data as SSECompleteData;
              setGameStatus(completeData.gameState);
              setMessages(toDisplayMessages(completeData.messages ?? []));
              pendingPlayerMsgRef.current = null;
            } else if (currentEvent === 'error') {
              setMessages(prev => [...prev, {
                role: 'system',
                content: `错误：${data.message || '未知错误'}`,
              }]);
            }
          } catch {
            // 忽略 JSON 解析错误
          }
          currentEvent = '';
        }
      }
    }
  }, []);

  // 取消进行中的 SSE 请求
  const abortPendingRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  // 启动新游戏
  const startGame = useCallback(async () => {
    abortPendingRequest();
    const tid = `rpg-${Date.now()}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setThreadIdWithUrl(tid);
    setSuggestedActions([]);
    setLoading(true);
    setMessages([]);
    setGameStatus(null);
    setGameStarted(true);

    try {
      const res = await fetch('/api/rpg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', threadId: tid }),
        signal: controller.signal,
      });
      await processSSEResponse(res);
    } catch (error) {
      if (controller.signal.aborted) return; // 用户主动取消，不显示错误
      console.error('启动游戏失败:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: '启动游戏失败，请重试。',
      }]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoading(false);
    }
  }, [processSSEResponse, abortPendingRequest, setThreadIdWithUrl]);

  // 提交玩家行动
  const submitAction = useCallback(async () => {
    if (!input.trim() || loading) return;

    abortPendingRequest();
    const playerInput = input.trim();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setInput('');
    pendingPlayerMsgRef.current = playerInput;
    setSuggestedActions([]);
    setLoading(true);

    try {
      const res = await fetch('/api/rpg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', threadId, playerInput }),
        signal: controller.signal,
      });
      await processSSEResponse(res);
    } catch (error) {
      if (controller.signal.aborted) return; // 用户主动取消
      console.error('提交行动失败:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: '提交行动失败，请重试。',
      }]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoading(false);
    }
  }, [input, threadId, loading, processSSEResponse, abortPendingRequest]);

  // HP 百分比颜色
  const hpPercent = gameStatus ? (gameStatus.playerHp / gameStatus.playerMaxHp) * 100 : 100;
  const hpColorClass = hpPercent > 50
    ? 'bg-green-500'
    : hpPercent > 25
      ? 'bg-yellow-500'
      : 'bg-red-500';

  const isGameEnd = gameStatus?.gameOver || gameStatus?.victory;

  return (
    <>
      {/* 头部 */}
      <SiteHeader title="幽暗森林 — 文字冒险" />

      <div className="flex-1 flex min-h-0">
        {/* 主聊天区域 */}
        <main className="flex-1 flex flex-col min-h-0">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!gameStarted && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-4">
                <p className="text-5xl mb-6">&#x2694;&#xFE0F;</p>
                <p className="text-xl font-semibold mb-2">幽暗森林</p>
                <p className="text-sm mb-8 max-w-md">用自然语言行动，AI 负责演绎世界、推进剧情、判断生死。</p>
                <Button onClick={startGame} size="lg" className="px-8">
                  开始冒险
                </Button>
                <p className="text-xs text-muted-foreground/50 mt-8">
                  LangGraph 状态机引擎 — 掌握状态机与 Agent 编排闭环工作流
                </p>
              </div>
            )}

            {loading && displayMessages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p className="animate-pulse">正在生成冒险世界...</p>
              </div>
            )}

            {displayMessages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === 'player'
                    ? 'ml-auto max-w-[80%] bg-primary text-primary-foreground rounded-lg px-3 py-2'
                    : msg.role === 'system'
                      ? 'mx-auto max-w-[80%] bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-3 py-2'
                      : 'mr-auto max-w-[80%] bg-secondary rounded-lg px-3 py-2'
                }
              >
                {msg.role === 'narrator' && (
                  <span className="text-xs text-muted-foreground block mb-1">叙述者</span>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {loading && displayMessages.length > 0 && (
              <div className="mr-auto max-w-[80%] bg-secondary rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground block mb-1">叙述者</span>
                <p className="text-sm animate-pulse">正在思考...</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 建议行动 */}
          {gameStarted && !isGameEnd && suggestedActions.length > 0 && !loading && (
            <div className="flex-none px-4 pb-1">
              <div className="flex flex-wrap gap-2 max-w-3xl mx-auto">
                {suggestedActions.map((action, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => { setInput(action); }}
                    className="text-xs"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 输入框 */}
          {gameStarted && !isGameEnd && (
            <div className="flex-none px-4 pb-4">
              <form
                onSubmit={(e) => { e.preventDefault(); submitAction(); }}
                className="flex gap-2 max-w-3xl mx-auto"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={loading ? '等待回应...' : '你想做什么？（如：拔剑冲向暗处的身影）'}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button type="submit" disabled={loading || !input.trim()} size="sm">
                  行动
                </Button>
              </form>
            </div>
          )}

          {/* 游戏结束提示 */}
          {isGameEnd && (
            <div className="flex-none px-4 pb-4 text-center">
              <p className="text-muted-foreground mb-2">
                {gameStatus?.victory ? '冒险结束，你取得了胜利！' : '冒险结束，你倒下了...'}
              </p>
              <Button onClick={startGame} size="sm">
                再来一次
              </Button>
            </div>
          )}
        </main>

        {/* 右侧状态面板 */}
        {gameStatus && (
          <aside className="flex-none w-60 border-l p-4 space-y-4 overflow-y-auto">
            {/* HP 血条 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                生命值 {gameStatus.playerHp}/{gameStatus.playerMaxHp}
              </h3>
              <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                <div
                  className={'h-full rounded-full transition-all duration-500 ' + hpColorClass}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
            </div>

            {/* 物品栏 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                物品栏 ({gameStatus.inventory.length})
              </h3>
              {gameStatus.inventory.length === 0 ? (
                <p className="text-xs text-muted-foreground">空空如也</p>
              ) : (
                <ul className="space-y-1">
                  {gameStatus.inventory.map((item, i) => (
                    <li key={i} className="text-xs bg-secondary/50 rounded px-2 py-1">{item}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* 事件日志 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                事件记录
              </h3>
              <ul className="space-y-1 max-h-60 overflow-y-auto">
                {gameStatus.eventLog.map((event, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{event}</li>
                ))}
              </ul>
            </div>

            {/* LangGraph 信息 */}
            <div className="pt-4 border-t">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                引擎信息
              </h3>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>状态机: LangGraph StateGraph</li>
                <li>节点数: 7</li>
                <li>条件边: 2</li>
                <li>Interrupt: Human-in-the-Loop</li>
              </ul>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
