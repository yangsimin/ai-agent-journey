'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { useRef, useEffect, useState, FormEvent } from 'react';

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

  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';
  
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

  const onSubmit = (e: FormEvent) => {
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
        <div className="flex-1 overflow-y-auto px-1 scroll-smooth">
          <div className="space-y-6 pb-6">
            {messages.length === 0 && (
              <div className="text-center py-20 text-gray-400 dark:text-gray-600">
                <p className="text-lg">开始你的第一次对话吧！</p>
                <p className="text-sm mt-2">试试问我：什么是 AI Agent？</p>
              </div>
            )}
            {messages.map((m: UIMessage) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-3xl px-5 py-3 shadow-sm text-[15px] leading-relaxed break-words ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-sm shadow-blue-500/20'
                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-gray-200/50 dark:shadow-none'
                }`}>
                  {m.parts?.filter(p => p.type === 'text').map((p, i) => (
                    <span key={i}>{(p as { type: 'text'; text: string }).text}</span>
                  ))}
                </div>
              </div>
            ))}

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