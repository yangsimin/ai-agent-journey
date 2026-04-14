'use client';

import { createContext, useContext, useCallback, useSyncExternalStore } from 'react';

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
});

const STORAGE_KEY = 'sidebar-collapsed';

// --- useSyncExternalStore 订阅 localStorage ---

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function getServerSnapshot(): boolean {
  return false;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(STORAGE_KEY, String(next));
    // 手动触发 storage 事件让同页面的 useSyncExternalStore 感知变化
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
