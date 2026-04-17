'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';

interface ConversationItem {
  id: string;
  title: string | null;
  backend: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface ConversationListProps {
  activeConversationId: string | null;
  pendingTitle?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  activeConversationId,
  pendingTitle,
  onSelect,
  onNew,
  onDelete,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const prevConvIdRef = useRef<string | null>(null);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      onDelete(id);
    } catch {
      /* ignore */
    }
  };

  const refreshList = () => {
    fetch('/api/conversations')
      .then(r => r.json())
      .then(data => setConversations(data.conversations ?? []))
      .catch(() => {});
  };

  // 初始加载 + activeConversationId 变化时刷新
  useEffect(() => {
    const isNewConv = activeConversationId !== prevConvIdRef.current;
    prevConvIdRef.current = activeConversationId;
    // 初始加载 或 新对话创建后刷新
    if (!activeConversationId || isNewConv) {
      refreshList();
    }
  }, [activeConversationId]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-60 border-r border-border flex flex-col bg-muted/30">
      {/* 新建对话按钮 */}
      <div className="p-3 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          新建对话
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* 发送第一条消息后立即显示的占位项 */}
          {pendingTitle && !activeConversationId && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{pendingTitle}</p>
                <span className="text-[10px] text-muted-foreground">正在创建...</span>
              </div>
            </div>
          )}
          {conversations.length === 0 && !pendingTitle ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">暂无对话记录</p>
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = activeConversationId === conv.id;
              return (
                <div
                  key={conv.id}
                  className={
                    'group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors'
                    + (isActive ? ' bg-secondary' : ' hover:bg-secondary/50')
                  }
                  onClick={() => onSelect(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {conv.title || '新对话'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge
                        variant={conv.backend === 'langchain' ? 'secondary' : 'outline'}
                        className="text-[9px] px-1 py-0"
                      >
                        {conv.backend === 'langchain' ? 'LC' : 'AI SDK'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(conv.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => handleDelete(conv.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
