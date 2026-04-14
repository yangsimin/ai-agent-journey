import { SiteHeader } from '@/components/site-header';

export default function Loading() {
  return (
    <>
      <SiteHeader title="幽暗森林 — 文字冒险" />
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-4">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mb-3" />
            <p className="text-sm">加载中...</p>
          </div>
        </main>
      </div>
    </>
  );
}
