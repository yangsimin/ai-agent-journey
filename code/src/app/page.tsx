'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { SubmitEvent } from 'react';

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
      e.target.value = ''; // 允许重复上传同一文件
    }
  };

  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // 消息发送完成后刷新 TodoList
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      fetchTodos();
    }
  }, [isLoading, messages.length, fetchTodos]);
  
  const currentModelObj = models.find(m => m.id === selectedModel);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedModel) return;
    
    // 获取当选选中的 Persona 的 Prompt
    const currentPrompt = PERSONAS.find(p => p.id === selectedPersona)?.prompt || PERSONAS[0].prompt;
    
    sendMessage({ text: input }, { body: { modelId: selectedModel, systemPrompt: currentPrompt } });
    setInput('');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50/50 dark:bg-gray-950 font-sans">
      <div className="flex flex-col w-full max-w-3xl mx-auto h-full p-2 sm:p-4 md:p-6 overflow-hidden">
        
        {/* 极简头部栏 */}
        <div className="flex-none mb-3 p-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 truncate text-lg">
            AI 助手<span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md align-middle shadow-inner">实战版</span>
          </div>
          
          <div className="flex items-center gap-2">
            {modelsLoading ? (
              <div className="w-24 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedModel}
                onChange={e => {
                  setSelectedModel(e.target.value);
                  localStorage.setItem('selectedModel', e.target.value);
                }}
                className="h-8 pl-3 md:pl-2 pr-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm truncate max-w-[120px] md:max-w-[180px]"
                title={currentModelObj?.description}
                disabled={isLoading}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName} {m.thinking ? '(Thinking)' : ''}</option>
                ))}
              </select>
            )}

            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block"></div>

            <label className={`relative flex items-center h-8 px-3 rounded-lg border text-xs font-semibold cursor-pointer shadow-sm transition-colors whitespace-nowrap ${
              dbReady 
                ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' 
                : 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
            }`}>
              {isUploading ? (
                <><i className="fas fa-spinner fa-spin mr-1.5 opacity-80"></i>吸收中...</>
              ) : dbReady ? (
                <><i className="fas fa-check-circle mr-1.5 opacity-80"></i>外脑已连接</>
              ) : (
                <><i className="fas fa-book mr-1.5 opacity-80"></i>上传知识库</>
              )}
              <input type="file" className="hidden" accept=".txt,.md,.mdx" onChange={onFileUpload} disabled={isUploading} />
            </label>
            
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

            <select
              value={selectedPersona}
              onChange={e => {
                setSelectedPersona(e.target.value);
                localStorage.setItem('selectedPersona', e.target.value);
              }}
              className="h-8 pl-3 md:pl-2 pr-6 rounded-lg border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-semibold focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-sm max-w-[110px]"
              disabled={isLoading}
            >
              {PERSONAS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 对话信息区域（主视区） */}
        <div className={`${showTodos ? 'flex-[3]' : 'flex-1'} overflow-y-auto px-1 scroll-smooth min-h-0`}>
          <div className="space-y-6 pb-6">
            {messages.length === 0 && (
              <div className="text-center py-20 text-gray-400 dark:text-gray-600">
                <p className="text-lg">开始你的第一次对话吧！</p>
                <p className="text-sm mt-2">试试问我：什么是 AI Agent？</p>
              </div>
            )}
            {messages.map((m: UIMessage) => {
              const textParts = m.parts?.filter(p => p.type === 'text') ?? [];
              const hasText = textParts.some(p => (p as { type: 'text'; text: string }).text.trim().length > 0);
              
              // 提取 tool 相关的 parts（只展示 tool-invocation 和 tool-{name} 类型）
              const toolParts = m.parts?.filter(p => p.type === 'tool-invocation' || (p.type.startsWith('tool-') && p.type !== 'tool-invocation')) ?? [];
              // step-start / reasoning 等非 tool part 直接忽略，不展示
              const hasTools = toolParts.length > 0;
              
              if (!hasText && !hasTools) return null;

              return (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] flex flex-col gap-1.5 items-start">
                    {hasText && (
                      <div className={`rounded-3xl px-5 py-3 shadow-sm text-[15px] leading-relaxed break-words ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-sm shadow-blue-500/20'
                          : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-gray-200/50 dark:shadow-none'
                      }`}>
                        {textParts.length > 0 ? (
                          textParts.map((p, i) => <span key={i}>{(p as { type: 'text'; text: string }).text}</span>)
                        ) : null}
                      </div>
                    )}
                    {hasTools && (
                      <div className={`flex flex-wrap gap-2 ${hasText ? 'ml-2 mt-0.5' : ''}`}>
                        {toolParts.map((p, i) => {
                          const toolData = p as { type: string; toolInvocation?: { toolName: string; state: string; result?: unknown }; state?: string; output?: unknown; result?: unknown };
                          // 兼容嵌套 toolInvocation 和直接平铺的 tool-{name} 格式
                          const inv = toolData.toolInvocation ?? (toolData as { toolName?: string; state?: string; result?: unknown });
                          const toolName = inv.toolName ?? toolData.type.replace('tool-', '');
                          const isComplete = inv.state === 'result' || !!inv.result || !!toolData.output;
                          return (
                            <div key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border shadow-sm transition-all ${isComplete ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-500/20'}`}>
                              {isComplete ? (
                                <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 opacity-80 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              )}
                              <span className="font-mono tracking-tight">{toolName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl rounded-bl-sm px-6 py-4 shadow-sm flex space-x-2.5 items-center">
                  <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
            {/* 滚动锚点 */}
            <div ref={messagesEndRef} className="h-px" />
          </div>
        </div>

        {/* TodoList 面板 */}
        {showTodos && (
          <div className="flex-none border-t border-gray-100 dark:border-gray-800 mt-2 pt-2">
            <button
              onClick={() => setShowTodos(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-2 flex items-center gap-1"
            >
              <i className="fas fa-chevron-down text-[10px]"></i> 收起待办列表
            </button>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
              {todos.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">暂无待办事项，试试对我说「帮我创建一个提醒」</p>
              ) : (
                todos.map(todo => {
                  const itemClass = todo.done
                    ? 'flex items-center gap-3 p-3 rounded-xl border transition-colors bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60'
                    : 'flex items-center gap-3 p-3 rounded-xl border transition-colors bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700';
                  const checkClass = todo.done
                    ? 'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors bg-emerald-500 border-emerald-500'
                    : 'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors border-gray-300 dark:border-gray-600 hover:border-emerald-400';
                  const prioClass = todo.priority === 'high'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : todo.priority === 'medium'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
                  const prioLabel = todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低';

                  return (
                    <div key={todo.id} className={itemClass}>
                      <button onClick={() => toggleTodoDone(todo.id)} className={checkClass}>
                        {todo.done && <i className="fas fa-check text-white text-[10px]"></i>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={todo.done ? 'text-sm truncate line-through text-gray-400' : 'text-sm truncate text-gray-800 dark:text-gray-100'}>{todo.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {todo.dueDate && <span className="text-[11px] text-gray-400"><i className="fas fa-calendar-alt mr-0.5"></i>{todo.dueDate}</span>}
                          <span className={'text-[11px] px-1.5 py-0.5 rounded font-medium ' + prioClass}>{prioLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {!showTodos && (
          <button
            onClick={() => { setShowTodos(true); fetchTodos(); }}
            className="flex-none text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-2 flex items-center gap-1"
          >
            <i className="fas fa-chevron-up text-[10px]"></i> 展开待办列表 {todos.length > 0 && `(${todos.length})`}
          </button>
        )}

        {/* 底部输入框 */}
        <form onSubmit={onSubmit} className="flex-none flex gap-2 sm:gap-3 mt-2 bg-white dark:bg-gray-900 p-2 sm:p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <input
            className="flex-1 px-4 py-3 rounded-xl focus:outline-none bg-transparent hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-gray-800 dark:focus:bg-gray-800 transition-colors text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-[15px]"
            value={input}
            placeholder={selectedModel ? '发条消息给助理...' : '模型加载中...'}
            onChange={e => setInput(e.target.value)}
            disabled={isLoading || !selectedModel}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !selectedModel}
            className="px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl shadow-md hover:bg-black dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm sm:text-base whitespace-nowrap"
          >
            {isLoading ? '...' : '发送'}
          </button>
        </form>
      </div>
    </div>
  );
}