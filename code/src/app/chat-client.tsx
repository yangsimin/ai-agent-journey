'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from '@ai-sdk/react';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import dynamic from 'next/dynamic';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { useStickToBottomContext } from 'use-stick-to-bottom';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SiteHeader } from '@/components/site-header';
import { ConversationList } from '@/components/conversation-list';

const ToolComponents = dynamic(() =>
  import('@/components/ai-elements/tool').then(m => ({
    default: function DynamicTool({ defaultOpen, children }: { defaultOpen: boolean; children: React.ReactNode }) {
      return <m.Tool defaultOpen={defaultOpen}>{children}</m.Tool>;
    }
  }))
);

interface ToolCallPart {
  type: string;
  toolCallId?: string;
  toolName?: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: string;
  done: boolean;
  doneAt?: string | null;
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

/** 返回一个同时更新状态和 localStorage 的 onValueChange 处理函数 */
function makePersistHandler<T extends string>(setter: (v: T) => void, key: string) {
  return (v: string | null) => { if (v) { setter(v as T); localStorage.setItem(key, v); } };
}

function ReminderSidebar({ reminders, open, onOpenChange, onComplete, onDelete }: {
  reminders: Reminder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-64 p-0" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between p-3 border-b border-border">
          <SheetTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">提醒事项</SheetTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => onOpenChange(false)}>
            ✕
          </Button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {reminders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">
                暂无提醒事项
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                试试说「提醒我明天下午开会」
              </p>
            </div>
          ) : (
            reminders.map(rem => (
              <div
                key={rem.id}
                className={
                  'flex items-start gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors group'
                  + (rem.done ? ' opacity-50' : '')
                }
              >
                <Checkbox 
                  checked={rem.done} 
                  className="mt-0.5" 
                  onCheckedChange={() => { if (!rem.done) onComplete(rem.id); }}
                />
                <div className="flex-1 min-w-0">
                  <p className={'text-sm leading-snug' + (rem.done ? ' line-through text-muted-foreground' : '')}>{rem.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {rem.dueDate && <span className="text-[11px] text-muted-foreground">{new Date(rem.dueDate).toLocaleDateString('zh-CN')}</span>}
                    {rem.priority === 'high' && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">高</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => onDelete(rem.id)}
                >
                  ✕
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ErrorBubble({ error }: { error: string }) {
  return (
    <div className="text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-lg p-3 break-all leading-relaxed">{error}</div>
  );
}

/** 消息列表区域 — 必须在 StickToBottom (Conversation) 内部才能使用 useStickToBottomContext */
function ScrollableMessages({
  messages,
  status,
  isLoading,
  chatErrorMap,
  scrollFnRef,
}: {
  messages: UIMessage[];
  status: string;
  isLoading: boolean;
  chatErrorMap: Record<string, string>;
  scrollFnRef: React.MutableRefObject<(() => void) | null>;
}) {
  const { scrollToBottom } = useStickToBottomContext();

  // 将 scrollToBottom 暴露给父组件（发送消息时调用）
  useEffect(() => {
    scrollFnRef.current = scrollToBottom;
  }, [scrollToBottom, scrollFnRef]);

  // 流式输出时持续滚动到底部
  useEffect(() => {
    if (status === 'streaming') {
      scrollToBottom();
    }
  }, [messages, status, scrollToBottom]);

  return (
    <>
      <ConversationContent>
        {messages.length === 0 ? (
          <ConversationEmptyState
            title="开始你的第一次对话吧！"
            description="试试问我：什么是 AI Agent？"
          />
        ) : (
          <div className="space-y-6 pb-6">
            {messages.map((m: UIMessage, index: number) => {
              const textParts = m.parts?.filter(p => p.type === 'text') ?? [];
              const isLastMessage = index === messages.length - 1;
              const isStreamingThis = isLoading && isLastMessage && m.role === 'assistant';
              const hasText = textParts.some(p => (p as { type: 'text'; text: string }).text.trim().length > 0);

              const toolParts = m.parts?.filter(
                p => p.type.startsWith('tool-')
              ) ?? [];
              const hasTools = toolParts.length > 0;

              if (!isStreamingThis && !hasText && !hasTools && !chatErrorMap[m.id]) return null;

              return (
                <React.Fragment key={m.id}>
                  <Message from={m.role}>
                    <MessageContent>
                      {textParts.map((p, i) => (
                        <MessageResponse
                          key={i}
                          isAnimating={isStreamingThis}
                          animated={isStreamingThis ? false : { animation: 'fadeIn', sep: 'word', stagger: 15, duration: 200 }}
                        >
                          {(p as { type: 'text'; text: string }).text}
                        </MessageResponse>
                      ))}

                      {toolParts.map((p, i) => {
                        const inv = p as unknown as ToolCallPart;
                        return (
                          <ToolComponents
                            key={i}
                            defaultOpen={inv.state === 'output-available' || inv.state === 'output-error'}
                          >
                            {/* Tool 组件的子内容需要延迟导入的组件 — 使用内联方式 */}
                            <DynamicToolContent inv={inv} />
                          </ToolComponents>
                        );
                      })}
                    </MessageContent>
                  </Message>
                  {chatErrorMap[m.id] && <ErrorBubble error={chatErrorMap[m.id]} />}
                </React.Fragment>
              );
            })}

            {/* Loading 效果：在提交后、最后一条 assistant 消息有内容前显示 */}
            {isLoading && messages.length > 0 && (
              (() => {
                const lastMsg = messages[messages.length - 1];
                if (lastMsg.role === 'user') return true;
                if (lastMsg.role === 'assistant') {
                  const hasTextContent = lastMsg.parts?.some(
                    p => p.type === 'text' && (p as { text: string }).text.trim().length > 0
                  );
                  return !hasTextContent;
                }
                return false;
              })()
            ) && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>思考中</Shimmer>
                  </MessageContent>
                </Message>
              )}
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </>
  );
}

/** Tool 内容的延迟加载包装器 */
function DynamicToolContent({ inv }: { inv: ToolCallPart }) {
  return (
    <>
      <InlineToolHeader
        type={inv.type as `tool-${string}`}
        state={inv.state as 'input-streaming' | 'input-available' | 'output-available' | 'output-error'}
      />
      <InlineToolContent>
        <InlineToolInput input={inv.input} />
        {(inv.state === 'output-available' || inv.state === 'output-error') && (
          <InlineToolOutput
            output={inv.output ? JSON.stringify(inv.output, null, 2) : undefined}
            errorText={inv.errorText}
          />
        )}
      </InlineToolContent>
    </>
  );
}

// 延迟导入 Tool 子组件
const InlineToolHeader = dynamic(() =>
  import('@/components/ai-elements/tool').then(m => ({ default: m.ToolHeader }))
);
const InlineToolContent = dynamic(() =>
  import('@/components/ai-elements/tool').then(m => ({ default: m.ToolContent }))
);
const InlineToolInput = dynamic(() =>
  import('@/components/ai-elements/tool').then(m => ({ default: m.ToolInput }))
);
const InlineToolOutput = dynamic(() =>
  import('@/components/ai-elements/tool').then(m => ({ default: m.ToolOutput }))
);

/** 将 DB 中存储的 ContentPart[] 转换为前端 UIMessage 期望的 UIMessagePart[] */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contentPartsToUIParts(parts: any, fallbackText: string): UIMessage['parts'] {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [{ type: 'text' as const, text: fallbackText }];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parts.map((part: any) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text as string };
    }
    // ContentPart 'tool-call' → UIMessagePart 'tool-{toolName}'
    if (part.type === 'tool-call') {
      return {
        type: `tool-${part.toolName}` as const,
        toolCallId: part.toolCallId as string,
        toolName: part.toolName as string,
        state: 'input-available' as const,
        input: part.input,
      };
    }
    // ContentPart 'tool-result' → UIMessagePart 'tool-{toolName}' (state: output-available)
    if (part.type === 'tool-result') {
      return {
        type: `tool-${part.toolName}` as const,
        toolCallId: part.toolCallId as string,
        toolName: part.toolName as string,
        state: 'output-available' as const,
        input: part.input,
        output: part.output,
      };
    }
    // 其他类型直接透传
    return part;
  });
}

/** 对话区域子组件 — 通过 key 强制重新挂载以切换后端 */
function ChatArea({ backend, selectedModel, selectedPersona, conversationId, fetchReminders, chatErrorMap, onChatError, onConversationIdChange, onFirstSend }: {
  backend: 'vercel' | 'langchain';
  selectedModel: string;
  selectedPersona: string;
  conversationId: string | null;
  fetchReminders: () => void;
  chatErrorMap: Record<string, string>;
  onChatError: (msg: string, msgId: string) => void;
  onConversationIdChange: (id: string) => void;
  onFirstSend: (text: string) => void;
}) {
  const transport = useMemo(() => new DefaultChatTransport({
    api: backend === 'langchain' ? '/api/chat-langchain' : '/api/chat',
  }), [backend]);

  const { messages, setMessages, status, sendMessage } = useChat({
    transport,
    experimental_throttle: 50,
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg?.id) onChatError(msg, lastUserMsg.id);
    },
    onFinish: ({ message }) => {
      // 从 message metadata 中获取后端返回的 conversationId
      const meta = message.metadata as Record<string, unknown> | undefined;
      if (meta?.conversationId && typeof meta.conversationId === 'string') {
        onConversationIdChange(meta.conversationId);
      }
    },
  });

  // 切换对话时加载历史消息或清空
  useEffect(() => {
    if (conversationId) {
      fetch(`/api/conversations/${conversationId}`)
        .then(r => r.json())
        .then(data => {
          const conv = data.conversation;
          if (conv?.messages) {
            const uiMessages: UIMessage[] = conv.messages.map((m: { id: string; role: string; content: string; parts?: unknown }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant' | 'system',
              parts: contentPartsToUIParts(m.parts, m.content),
              createdAt: new Date(),
            }));
            setMessages(uiMessages);
          } else {
            setMessages([]);
          }
        })
        .catch(() => setMessages([]));
    } else {
      setMessages([]);
    }
  }, [conversationId, setMessages]);

  const scrollFnRef = useRef<(() => void) | null>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      fetchReminders();
    }
  }, [isLoading, messages.length, fetchReminders]);

  const handleSubmit = (message: { text: string }) => {
    if (!message.text.trim() || isLoading || !selectedModel) return;
    if (!conversationId) onFirstSend(message.text.trim());
    const currentPrompt = PERSONAS.find(p => p.id === selectedPersona)?.prompt || PERSONAS[0].prompt;
    sendMessage({ text: message.text }, { body: { modelId: selectedModel, systemPrompt: currentPrompt, conversationId: conversationId ?? undefined } });
    // 发送后滚动到底部（通过 ref 访问 StickToBottom 的 scrollToBottom）
    setTimeout(() => scrollFnRef.current?.(), 50);
  };

  return (
    <main id="main-content" className="flex-1 min-w-0 flex flex-col min-h-0">
      {/* 消息滚动区域 — Conversation 只包裹消息列表，不包含输入框 */}
      <Conversation className="flex-1 min-h-0">
        <ScrollableMessages
          messages={messages}
          status={status}
          isLoading={isLoading}
          chatErrorMap={chatErrorMap}
          scrollFnRef={scrollFnRef}
        />
      </Conversation>

      {/* 底部输入框 — 在 Conversation 外部，不参与滚动，始终固定在底部 */}
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
    </main>
  );
}

export default function ChatClient() {
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0].id);
  const [backend, setBackend] = useState<'vercel' | 'langchain'>('vercel');

  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminders, setShowReminders] = useState(false);
  const [chatErrorMap, setChatErrorMap] = useState<Record<string, string>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingConvTitle, setPendingConvTitle] = useState<string | null>(null);

  // 初始化时从 URL 恢复 conversationId
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session');
    if (id) setConversationId(id);
  }, []);

  // conversationId 变化时同步 URL
  useEffect(() => {
    const url = conversationId ? `?session=${conversationId}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [conversationId]);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders');
      const data = await res.json();
      setReminders(data.reminders ?? []);
    } catch { /* ignore */ }
  }, []);

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

  const currentModelObj = models.find(m => m.id === selectedModel);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // 延迟读取 localStorage 避免 hydration mismatch
  useEffect(() => {
    const savedPersona = localStorage.getItem('selectedPersona');
    if (savedPersona) setSelectedPersona(savedPersona);
    const savedBackend = localStorage.getItem('selectedBackend') as 'vercel' | 'langchain' | null;
    if (savedBackend) setBackend(savedBackend);
  }, []);

  useEffect(() => {
    fetch('/api/models')
      .then(async (r) => {
        const data = await r.json();
        const list: Model[] = data.models ?? [];
        const defaultModelId: string | undefined = data.defaultModelId;
        if (list.length === 0) {
          setModels([]);
          setSelectedModel('');
          return;
        }
        setModels(list);
        const saved = localStorage.getItem('selectedModel');
        const savedInList = saved && list.some(m => m.id === saved);
        const initial = savedInList
          ? saved!
          : (defaultModelId || list[0]?.id || '');
        setSelectedModel(initial);
      })
      .catch(() => {
        setModels([]);
        setSelectedModel('');
      })
      .finally(() => setModelsLoading(false));
  }, []);

  return (
    <>
      {/* 头部栏 */}
      <SiteHeader
        title="AI 助手"
        actions={
          <>
            {modelsLoading ? (
              <div className="w-20 h-7 animate-pulse bg-secondary rounded-md" />
            ) : (
              <Select
                value={selectedModel}
                onValueChange={makePersistHandler(setSelectedModel, 'selectedModel')}
                disabled={false}
              >
                <SelectTrigger className="w-auto min-w-35 h-7 text-xs border-none bg-transparent hover:bg-secondary focus:bg-secondary focus:ring-0" title={currentModelObj?.description}>
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
              onValueChange={makePersistHandler(setSelectedPersona, 'selectedPersona')}
              disabled={false}
            >
              <SelectTrigger className="w-auto min-w-22.5 h-7 text-xs border-none bg-transparent hover:bg-secondary focus:bg-secondary focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSONAS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-4 w-px bg-border mx-1" />

            {/* 后端切换 — 切换时清空对话 */}
            <Select
              value={backend}
              onValueChange={makePersistHandler<'vercel' | 'langchain'>(v => setBackend(v), 'selectedBackend')}
              disabled={false}
            >
              <SelectTrigger className="w-auto min-w-25 h-7 text-xs border-none bg-transparent hover:bg-secondary focus:bg-secondary focus:ring-0" title="切换后端实现（会清空对话）">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vercel">Vercel AI SDK</SelectItem>
                <SelectItem value="langchain">LangChain</SelectItem>
              </SelectContent>
            </Select>

            {/* 提醒面板切换按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => { if (!showReminders) fetchReminders(); setShowReminders(!showReminders); }}
            >
              提醒 {reminders.length > 0 && `(${reminders.length})`}
            </Button>
          </>
        }
      />

      {/* 主内容区：对话 + 侧边栏 — backend 变化时重新挂载 ChatArea */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧对话列表 */}
        <ConversationList
          activeConversationId={conversationId}
          pendingTitle={pendingConvTitle}
          onSelect={(id) => { setPendingConvTitle(null); setConversationId(id); }}
          onNew={() => { setPendingConvTitle('新对话'); setConversationId(null); }}
          onDelete={(id) => { if (conversationId === id) setConversationId(null); }}
        />

        <ChatArea
          key={`${backend}-${conversationId ?? 'new'}`}
          backend={backend}
          selectedModel={selectedModel}
          selectedPersona={selectedPersona}
          conversationId={conversationId}
          fetchReminders={fetchReminders}
          chatErrorMap={chatErrorMap}
          onChatError={(msg, msgId) => setChatErrorMap(prev => ({ ...prev, [msgId]: msg }))}
          onConversationIdChange={(id) => { setPendingConvTitle(null); setConversationId(id); }}
          onFirstSend={(text) => setPendingConvTitle(text)}
        />

        {/* 提醒列表侧边栏 */}
        <ReminderSidebar
          reminders={reminders}
          open={showReminders}
          onOpenChange={setShowReminders}
          onComplete={async (id) => {
            await fetch(`/api/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: true }) });
            fetchReminders();
          }}
          onDelete={async (id) => {
            await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
            fetchReminders();
          }}
        />
      </div>
    </>);
}
