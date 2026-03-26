"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

interface TodoCheckboxProps {
  checked: boolean;
  lineNumber: number;
  editable: boolean;
}

export function TodoCheckbox({
  checked,
  lineNumber,
  editable,
}: TodoCheckboxProps) {
  const [loading, setLoading] = useState(false);
  const [localChecked, setLocalChecked] = useState(checked);

  const handleClick = async () => {
    if (!editable || loading) return;

    // 乐观更新
    const nextChecked = !localChecked;
    setLocalChecked(nextChecked);
    setLoading(true);

    try {
      const res = await fetch("/api/todo-md", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineNumber }),
      });

      if (!res.ok) {
        // 回滚
        setLocalChecked(!nextChecked);
        console.error("Failed to toggle checkbox");
      }
    } catch {
      setLocalChecked(!nextChecked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!editable || loading}
      className={cn(
        "mt-0.5 size-4 shrink-0 rounded border flex items-center justify-center transition-colors",
        (localChecked || checked)
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/40 hover:border-muted-foreground",
        editable && !loading && "cursor-pointer",
        !editable && "cursor-default",
        loading && "opacity-70"
      )}
      aria-label={localChecked ? "标记为未完成" : "标记为完成"}
    >
      {loading ? (
        <Loader2 className="size-2.5 animate-spin" />
      ) : localChecked || checked ? (
        <Check className="size-2.5" />
      ) : null}
    </button>
  );
}
