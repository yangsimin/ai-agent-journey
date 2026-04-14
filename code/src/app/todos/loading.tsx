import { SiteHeader } from '@/components/site-header';

export default function Loading() {
  return (
    <>
      <SiteHeader title="学习进度" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 阶段标题骨架 */}
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-32 rounded bg-secondary/50 animate-pulse" />
            <div className="h-3 w-48 rounded bg-secondary/30 animate-pulse" />
            <div className="space-y-2 ml-2">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-muted-foreground/20" />
                  <div className="h-4 flex-1 rounded bg-secondary/30 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
