"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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

  const handleCheckedChange = async () => {
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

  if (loading) {
    return (
      <div className="mt-0.5 size-4 shrink-0 flex items-center justify-center opacity-70">
        <Loader2 className="size-3 animate-spin" />
      </div>
    );
  }

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleCheckedChange}
      disabled={!editable}
      className={cn(!editable && "cursor-default")}
      aria-label={localChecked ? "标记为未完成" : "标记为完成"}
    />
  );
}
