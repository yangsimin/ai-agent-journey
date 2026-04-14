import { SiteHeader } from '@/components/site-header';

export default function Loading() {
  return (
    <>
      <SiteHeader title="AI 助手" />
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 flex flex-col min-h-0">
          {/* 消息区域骨架 */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground">
              <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">加载中...</p>
            </div>
          </div>
          {/* 输入框骨架 */}
          <div className="flex-none px-2 pb-2">
            <div className="max-w-3xl mx-auto">
              <div className="h-24 rounded-xl border border-border bg-secondary/30 animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
