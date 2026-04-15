'use client';

import { cn } from '@/lib/utils';
import { SidebarTrigger } from '@/components/ui/sidebar';

type SiteHeaderProps = {
  title: string;
  actions?: React.ReactNode;
  className?: string;
};

export function SiteHeader({ title, actions, className }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        'flex-none flex h-14 items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <SidebarTrigger className="md:hidden -ml-1" />
        <h1 className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
