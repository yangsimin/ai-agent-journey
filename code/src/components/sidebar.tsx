'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  Sword,
  ListTodo,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/sidebar-context';

const NAV_ITEMS = [
  { href: '/', label: 'AI 助手', icon: MessageSquare },
  { href: '/rpg', label: '文字冒险 RPG', icon: Sword },
  { href: '/todos', label: '学习进度', icon: ListTodo },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        'flex flex-col flex-none border-r border-border bg-background transition-all duration-200',
        collapsed ? 'w-12' : 'w-52',
      )}
    >
      {/* 折叠按钮 */}
      <div className="flex items-center justify-end h-14 px-2 border-b border-border">
        <button
          onClick={toggle}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 py-2 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-4 flex-none" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
