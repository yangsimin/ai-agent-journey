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

// AI SDK v6 tool invocation part 的运行时类型
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

  const toggleTodoDone = async (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

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
      <div className="flex flex-col w-full max-w-3xl mx-auto h-full p-2 sm:p-4 md:p-6 overflow-hidden">
        
        {/* 头部栏 */}
        <header className="flex-none mb-3 p-3 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold truncate text-lg">
            AI 助手<Badge variant="secondary" className="text-[10px]">实战版</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {modelsLoading ? (
              <div className="w-24 h-8 animate-pulse bg-muted rounded-lg" />
            ) : (
              <Select
                value={selectedModel}
                onValueChange={v => { if (v) { setSelectedModel(v); localStorage.setItem('selectedModel', v); } }}
                disabled={isLoading}
              >
                <SelectTrigger className="w-[180px]" title={currentModelObj?.description}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.displayName} {m.thinking ? '(Thinking)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />

            <Button
              variant={dbReady ? 'default' : 'secondary'}
              size="sm"
              disabled={isUploading}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              {isUploading ? '吸收中...' : dbReady ? '外脑已连接' : '上传知识库'}
              <input id="file-upload" type="file" className="hidden" accept=".txt,.md,.mdx" onChange={onFileUpload} />
            </Button>
            
            <Separator orientation="vertical" className="h-4 mx-1" />

            <Select
              value={selectedPersona}
              onValueChange={v => { if (v) { setSelectedPersona(v); localStorage.setItem('selectedPersona', v); } }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSONAS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* 对话区域 */}
        <div className={`${showTodos ? 'flex-[3]' : 'flex-1'} min-h-0`}>
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
                          {/* 文本内容 - 使用 MessageResponse 渲染 Markdown */}
                          {textParts.map((p, i) => (
                            <MessageResponse key={i}>
                              {(p as { type: 'text'; text: string }).text}
                            </MessageResponse>
                          ))}

                          {/* 工具调用 - 使用 Tool 组件 */}
                          {toolParts.map((p, i) => {
                            const inv = p as unknown as ToolCallPart;
                            const toolName = inv.toolName ?? inv.type;
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

                  {/* 加载指示器 */}
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
        </div>

        <Separator className="flex-none mt-2" />
        {showTodos && (
          <div className="flex-none py-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTodos(false)} className="text-xs mb-2">
              收起待办列表
            </Button>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {todos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">暂无待办事项，试试对我说「帮我创建一个提醒」</p>
              ) : (
                todos.map(todo => (
                  <div key={todo.id} className={"flex items-center gap-3 p-3 rounded-xl border" + (todo.done ? ' opacity-60' : '')}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTodoDone(todo.id)}
                      className={todo.done ? 'bg-primary text-primary-foreground' : ''}
                    >
                      {todo.done && '✓'}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className={"text-sm truncate" + (todo.done ? ' line-through text-muted-foreground' : '')}>{todo.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {todo.dueDate && <span className="text-xs text-muted-foreground">{todo.dueDate}</span>}
                        <Badge variant={todo.priority === 'high' ? 'destructive' : 'secondary'} className="text-[11px]">
                          {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!showTodos && (
          <Button variant="ghost" size="sm" onClick={() => { setShowTodos(true); fetchTodos(); }} className="flex-none text-xs mt-2">
            展开待办列表 {todos.length > 0 && `(${todos.length})`}
          </Button>
        )}

        {/* 底部输入框 */}
        <PromptInput
          onSubmit={handleSubmit}
          className="flex-none mt-2"
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={selectedModel ? '发条消息给助理...' : '模型加载中...'}
              disabled={isLoading || !selectedModel}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit status={status} disabled={!selectedModel} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
