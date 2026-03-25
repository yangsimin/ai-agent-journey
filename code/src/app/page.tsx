'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { useEffect, useState, useCallback } from 'react';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Conversation, ConversationContent, ConversationEmptyState } from '@/components/ai-elements/conversation';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface ToolCallPart {
  type: string;
  toolCallId?: string;
  toolName?: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

interface Todo {
  id: string;
  title: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
  createdAt: string;
}

interface Model {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  thinking?: boolean;
}

const PERSONAS = [
  { id: 'helpful', name: '万能助手', prompt: '你是一个乐于助人的 AI 助手。请用清晰、简洁、友善的语言回答用户的问题。' },
  { id: 'coder', name: '代码极客', prompt: '你是一个资深的极客架构师。请全部使用严谨的计算机专业术语，如需提供代码则提供最简洁最高效的版本。如果用户提问非技术问题，冷酷地拒绝回答。' },
  { id: 'translator', name: '中英翻译官', prompt: '你是一个顶级的中外日同传翻译官。用户输入中文，你翻译成地道英文；用户输入英文，你翻译成地道中文。不允许回答多余的话，只能纯粹地翻译。' },
  { id: 'cat娘', name: '傲娇猫娘', prompt: '你是一只傲娇、毒舌但内心善良的猫娘。所有回答结尾都必须带上「喵~」。偶尔嘲笑用户的愚蠢，但始终会给出正确的答案。' }
];

function TodoSidebar({ todos, showTodos, setShowTodos }: {
  todos: Todo[];
  showTodos: boolean;
  setShowTodos: (v: boolean) => void;
}) {

  return (
    <aside className={`flex-none border-l border-border transition-all duration-200 ${showTodos ? 'w-64' : 'w-0 overflow-hidden'}`}>
      <div className={`h-full flex flex-col ${showTodos ? 'opacity-100' : 'opacity-0'} transition-opacity duration-150`}>
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">待办事项</h2>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setShowTodos(false)}>
            ✕
          </Button>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {todos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              暂无待办事项
              <br />
              <span className="text-muted-foreground/70">试试说「帮我创建一个提醒」</span>
            </p>
          ) : (
            todos.map(todo => (
              <div
                key={todo.id}
                className={
                  'flex items-start gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group'
                  + (todo.done ? ' opacity-50' : '')
                }
                onClick={() => {
                  // toggle via re-fetch (simplistic — in production use proper state lifting)
                }}
              >
                <div className={
                  'w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors text-[10px]'
                  + (todo.done
                    ? ' bg-primary border-primary text-primary-foreground'
                    : ' border-muted-foreground/40 group-hover:border-muted-foreground')
                }>
                  {todo.done && '✓'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={'text-sm leading-snug' + (todo.done ? ' line-through text-muted-foreground' : '')}>{todo.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {todo.dueDate && <span className="text-[11px] text-muted-foreground">{todo.dueDate}</span>}
                    {todo.priority === 'high' && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">高</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

export default function Chat() {
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(
    () => typeof window !== 'undefined' ? (localStorage.getItem('selectedPersona') ?? PERSONAS[0].id) : PERSONAS[0].id
  );

  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showTodos, setShowTodos] = useState(true);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data.todos ?? []);
    } catch { /* ignore */ }
  }, []);

  const toggleTodoDone = useCallback(async (id: string) => {
    try {
      await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done: !todos.find(t => t.id === id)?.done })
      });
      fetchTodos();
    } catch { /* ignore */ }
  }, [todos, fetchTodos]);

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setDbReady(false);
    try {
      const text = await file.text();
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename: file.name })
      });
      const data = await res.json();
      if (data.success) {
        setDbReady(true);
        alert(`成功导入知识库：${file.name}\n智能分块数：${data.chunkCount}`);
      } else {
        alert('导入知识库失败：' + data.error);
      }
    } catch (err: unknown) {
      alert('网络错误，导入出错：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const { messages, status, sendMessage } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  const currentModelObj = models.find(m => m.id === selectedModel);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      fetchTodos();
    }
  }, [isLoading, messages.length, fetchTodos]);

  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
        const list: Model[] = data.models ?? [];
        setModels(list);
        const saved = localStorage.getItem('selectedModel');
        const initial = list.find(m => m.id === saved) ? saved! : list[0]?.id ?? '';
        setSelectedModel(initial);
      })
      .catch(console.error)
      .finally(() => setModelsLoading(false));
  }, []);

  const handleSubmit = (message: { text: string }) => {
    if (!message.text.trim() || isLoading || !selectedModel) return;
    const currentPrompt = PERSONAS.find(p => p.id === selectedPersona)?.prompt || PERSONAS[0].prompt;
    sendMessage({ text: message.text }, { body: { modelId: selectedModel, systemPrompt: currentPrompt } });
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-none focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        跳到对话区域
      </a>

      {/* 头部栏 */}
      <header className="flex-none px-2 py-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-muted-foreground tracking-tight">
          AI 助手
        </h1>

        <div className="flex items-center gap-1">
          {modelsLoading ? (
            <div className="w-20 h-7 animate-pulse bg-secondary rounded-md" />
          ) : (
            <Select
              value={selectedModel}
              onValueChange={v => { if (v) { setSelectedModel(v); localStorage.setItem('selectedModel', v); } }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-auto min-w-[140px] h-7 text-xs border-none bg-transparent hover:bg-secondary focus:bg-secondary focus:ring-0" title={currentModelObj?.description}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.displayName} {m.thinking ? '(Thinking)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant={dbReady ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isUploading}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            {isUploading ? '吸收中...' : dbReady ? '已连接' : '知识库'}
            <input id="file-upload" type="file" className="hidden" accept=".txt,.md,.mdx" onChange={onFileUpload} />
          </Button>

          <Select
            value={selectedPersona}
            onValueChange={v => { if (v) { setSelectedPersona(v); localStorage.setItem('selectedPersona', v); } }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-auto min-w-[90px] h-7 text-xs border-none bg-transparent hover:bg-secondary focus:bg-secondary focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* 侧边栏切换按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => { if (!showTodos) fetchTodos(); setShowTodos(!showTodos); }}
          >
            待办 {todos.length > 0 && `(${todos.length})`}
          </Button>
        </div>
      </header>

      {/* 主内容区：对话 + 侧边栏 */}
      <div className="flex-1 flex min-h-0">
        {/* 对话区域 */}
        <main id="main-content" className="flex-1 min-w-0">
          <Conversation className="h-full">
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  title="开始你的第一次对话吧！"
                  description="试试问我：什么是 AI Agent？"
                />
              ) : (
                <div className="space-y-6 pb-6">
                  {messages.map((m: UIMessage) => {
                    const textParts = m.parts?.filter(p => p.type === 'text') ?? [];
                    const hasText = textParts.some(p => (p as { type: 'text'; text: string }).text.trim().length > 0);

                    const toolParts = m.parts?.filter(
                      p => p.type.startsWith('tool-')
                    ) ?? [];
                    const hasTools = toolParts.length > 0;

                    if (!hasText && !hasTools) return null;

                    return (
                      <Message key={m.id} from={m.role}>
                        <MessageContent>
                          {textParts.map((p, i) => (
                            <MessageResponse key={i}>
                              {(p as { type: 'text'; text: string }).text}
                            </MessageResponse>
                          ))}

                          {toolParts.map((p, i) => {
                            const inv = p as unknown as ToolCallPart;
                            return (
                              <Tool key={i} defaultOpen={inv.state === 'output-available' || inv.state === 'output-error'}>
                                <ToolHeader
                                  type={inv.type as `tool-${string}`}
                                  state={inv.state as 'input-streaming' | 'input-available' | 'output-available' | 'output-error'}
                                />
                                <ToolContent>
                                  <ToolInput input={inv.input} />
                                  {(inv.state === 'output-available' || inv.state === 'output-error') && (
                                    <ToolOutput
                                      output={inv.output ? JSON.stringify(inv.output, null, 2) : undefined}
                                      errorText={inv.errorText}
                                    />
                                  )}
                                </ToolContent>
                              </Tool>
                            );
                          })}
                        </MessageContent>
                      </Message>
                    );
                  })}

                  {isLoading && status === 'submitted' && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                    <Message from="assistant">
                      <MessageContent>
                        <Shimmer>思考中</Shimmer>
                      </MessageContent>
                    </Message>
                  )}
                </div>
              )}
            </ConversationContent>
          </Conversation>
        </main>

        {/* 待办列表侧边栏 */}
        <TodoSidebar
          todos={todos}
          showTodos={showTodos}
          setShowTodos={setShowTodos}
        />
      </div>

      {/* 底部输入框 */}
      <div className="flex-none px-2 pb-2">
        <div className="max-w-3xl mx-auto">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={selectedModel ? '发条消息给助理...' : '模型加载中...'}
                disabled={isLoading || !selectedModel}
              />
            </PromptInputBody>
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!selectedModel} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
