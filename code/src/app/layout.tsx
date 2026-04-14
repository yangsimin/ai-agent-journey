import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/sidebar-context";
import { Sidebar } from "@/components/sidebar";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "AI Agent 实战",
  description: "AI Agent App - Level 1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn("h-full antialiased font-sans", "font-sans", geist.variable)}
    >
      <body className="h-dvh flex">
        <SidebarProvider>
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <TooltipProvider>{children}</TooltipProvider>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
