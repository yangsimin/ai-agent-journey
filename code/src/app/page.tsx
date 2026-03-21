'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { useRef, useEffect, useState, FormEvent } from 'react';

interface Model {
  id: string;
  displayName: string;
}

export default function Chat() {
  const [selectedModel, setSelectedModel] = useState(
    () => typeof window !== 'undefined' ? (localStorage.getItem('selectedModel') ?? '') : ''
  );
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  // 获取可用模型列表
  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
        const list: Model[] = data.models ?? [];
        setModels(list);
        // 优先恢复上次选择，其次取第一个
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
    <div className="flex flex-col w-full max-w-2xl mx-auto h-screen py-8 px-4 font-sans bg-gray-50/50">
      {/* 头部 */}
      <div className="mb-6 p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 shadow-sm">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4 text-center">
          AI 助手实战 - Level 1
        </h1>
        {/* 模型选择器 */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-500 whitespace-nowrap">选择模型</label>
          {modelsLoading ? (
            <div className="flex-1 h-10 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                localStorage.setItem('selectedModel', e.target.value);
              }}
              className="flex-1 h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
              disabled={isLoading}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto mb-6 space-y-6 px-2">
        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">开始你的第一次对话吧！</p>
            <p className="text-sm mt-2">试试问我：什么是 AI Agent？</p>
          </div>
        )}
        {messages.map((m: UIMessage) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-3xl px-6 py-4 shadow-sm text-[15px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-sm shadow-blue-500/20'
                : 'bg-white border text-gray-800 rounded-bl-sm border-gray-100 shadow-gray-200/50'
            }`}>
              {m.parts?.filter(p => p.type === 'text').map((p, i) => (
                <span key={i}>{(p as { type: 'text'; text: string }).text}</span>
              ))}
            </div>
          </div>
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-3xl rounded-bl-sm px-6 py-5 shadow-sm border-gray-100 flex space-x-2.5 items-center">
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" />
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce delay-75" />
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* 输入框 */}
      <form onSubmit={onSubmit} className="flex gap-3 mt-auto bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        <input
          className="flex-1 px-5 py-4 rounded-xl focus:outline-none focus:bg-gray-50 transition-colors text-gray-800 placeholder:text-gray-400"
          value={input}
          placeholder={selectedModel ? '给你的 AI 助理发条消息吧...' : '模型加载中...'}
          onChange={e => setInput(e.target.value)}
          disabled={isLoading || !selectedModel}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !selectedModel}
          className="px-8 py-4 bg-gray-900 text-white font-medium rounded-xl shadow-md hover:bg-black hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? '回复中...' : '发送'}
        </button>
      </form>
    </div>
  );
}