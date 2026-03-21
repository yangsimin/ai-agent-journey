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

export default function Chat() {
  const [selectedModel, setSelectedModel] = useState('');
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
    sendMessage({ text: input }, { body: { modelId: selectedModel } });
    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-screen py-8 px-4 font-sans bg-gray-50/50 dark:bg-gray-950">
      {/* 头部 */}
      <div className="mb-6 p-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 mb-4 text-center">
          AI 助手实战 - Level 1
        </h1>
        {/* 模型选择器 */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">选择模型</label>
          {modelsLoading ? (
            <div className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                localStorage.setItem('selectedModel', e.target.value);
              }}
              className="flex-1 h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
              disabled={isLoading}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          )}
        </div>
        
        {/* 模型详细信息展示 */}
        {currentModelObj && (
          <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl text-sm border border-blue-100/50 dark:border-blue-800/30 transition-all">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                {currentModelObj.displayName}
              </span>
              
              {currentModelObj.thinking && (
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40 rounded-full border border-purple-200 dark:border-purple-800/50">
                  Thinking
                </span>
              )}
              
              {!!currentModelObj.inputTokenLimit && currentModelObj.inputTokenLimit > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                  {(currentModelObj.inputTokenLimit / 1000).toFixed(0)}k Tokens
                </span>
              )}
            </div>
            {currentModelObj.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {currentModelObj.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto mb-6 space-y-6 px-2">
        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600">
            <p className="text-lg">开始你的第一次对话吧！</p>
            <p className="text-sm mt-2">试试问我：什么是 AI Agent？</p>
          </div>
        )}
        {messages.map((m: UIMessage) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-3xl px-6 py-4 shadow-sm text-[15px] leading-relaxed ${
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
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl rounded-bl-sm px-6 py-5 shadow-sm flex space-x-2.5 items-center">
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" />
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce delay-75" />
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* 输入框 */}
      <form onSubmit={onSubmit} className="flex gap-3 mt-auto bg-white dark:bg-gray-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <input
          className="flex-1 px-5 py-4 rounded-xl focus:outline-none bg-transparent focus:bg-gray-50 dark:focus:bg-gray-800 transition-colors text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          value={input}
          placeholder={selectedModel ? '给你的 AI 助理发条消息吧...' : '模型加载中...'}
          onChange={e => setInput(e.target.value)}
          disabled={isLoading || !selectedModel}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !selectedModel}
          className="px-8 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl shadow-md hover:bg-black dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? '回复中...' : '发送'}
        </button>
      </form>
    </div>
  );
}