"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TodoDocument, Phase, TaskGroup, TodoItem } from "@/lib/todo-parser";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TodoCheckbox } from "./todo-checkbox";

interface TodoViewerProps {
  data: TodoDocument;
}

export function TodoViewer({ data }: TodoViewerProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="min-h-full bg-background">
      {/* 导航栏 */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 返回聊天
          </Link>
          <h1 className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
            {data.title}
          </h1>
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "完成编辑" : "编辑"}
          </Button>
        </div>
      </header>

      {/* 内容区 */}
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* 前言部分 */}
        <IntroSection lines={data.introLines} />

        {/* 阶段列表 */}
        {data.phases.map((phase, i) => (
          <PhaseSection key={i} phase={phase} editing={editing} />
        ))}
      </main>
    </div>
  );
}

/** 前言部分渲染 */
function IntroSection({ lines }: { lines: string[] }) {
  // 过滤掉空行和分隔线，只保留有内容的段落
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^---\s*$/.test(line)) continue;

    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      {blocks.map((block, i) => {
        const text = block.join("\n");
        // ### 小标题
        if (text.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-semibold text-foreground">
              {text.replace(/^### /, "")}
            </h3>
          );
        }
        return (
          <p key={i}>
            <InlineMarkdown text={text} />
          </p>
        );
      })}
    </div>
  );
}

/** 简易内联 Markdown 渲染（粗体 + 链接 + 行内代码） */
function InlineMarkdown({ text }: { text: string }) {
  // 按 token 分割
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);

  return (
    <>
      {tokens.map((token, i) => {
        // 粗体 **text**
        const boldMatch = token.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
          return <strong key={i}>{boldMatch[1]}</strong>;
        }
        // 链接 [text](url)
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a
              key={i}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {linkMatch[1]}
            </a>
          );
        }
        // 行内代码 `code`
        const codeMatch = token.match(/^`(.+)`$/);
        if (codeMatch) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {codeMatch[1]}
            </code>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}

/** 阶段区块 */
function PhaseSection({
  phase,
  editing,
}: {
  phase: Phase;
  editing: boolean;
}) {
  const totalItems = phase.groups.flatMap((g) => g.items).length;
  const doneItems = phase.groups
    .flatMap((g) => g.items)
    .filter((item) => item.checked).length;
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{phase.title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {doneItems}/{totalItems} ({progress}%)
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 w-full rounded-full bg-muted mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 目标描述 */}
      {phase.goal && (
        <p className="text-sm text-muted-foreground mb-4">
          <strong>目标：</strong>
          <InlineMarkdown text={phase.goal} />
        </p>
      )}

      {/* 任务组 */}
      <div className="space-y-4">
        {phase.groups.map((group, i) => (
          <TaskGroupView key={i} group={group} editing={editing} />
        ))}
      </div>

      <Separator className="mt-8" />
    </section>
  );
}

/** 任务组 */
function TaskGroupView({
  group,
  editing,
}: {
  group: TaskGroup;
  editing: boolean;
}) {
  const doneCount = group.items.filter((item) => item.checked).length;
  const allDone = doneCount === group.items.length && group.items.length > 0;

  return (
    <div className={cn("space-y-1", allDone && "opacity-60")}>
      {group.items.map((item, i) => (
        <TodoItemView
          key={i}
          item={item}
          editing={editing}
          isGroupTitle={i === 0}
        />
      ))}
    </div>
  );
}

/** 单个 Todo 项 */
function TodoItemView({
  item,
  editing,
  isGroupTitle,
}: {
  item: TodoItem;
  editing: boolean;
  isGroupTitle: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2",
        isGroupTitle ? "mt-2" : "ml-6"
      )}
    >
      <TodoCheckbox
        checked={item.checked}
        lineNumber={item.lineNumber}
        editable={editing}
      />
      <span
        className={cn(
          "text-sm leading-relaxed pt-[3px]",
          isGroupTitle && "font-semibold",
          item.checked && !editing && "line-through text-muted-foreground"
        )}
      >
        <InlineMarkdown text={item.text} />
      </span>
    </div>
  );
}
