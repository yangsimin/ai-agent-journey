import fs from "fs";
import path from "path";

export interface TodoItem {
  text: string;
  checked: boolean;
  lineNumber: number; // 0-based
}

export interface TaskGroup {
  title: string;
  items: TodoItem[];
}

export interface Phase {
  title: string;
  goal?: string;
  groups: TaskGroup[];
}

export interface TodoDocument {
  title: string;
  introLines: string[]; // 前言部分的原始文本行（不含阶段标题之后的内容）
  phases: Phase[];
}

const TODO_PATH = path.join(process.cwd(), "..", "docs", "todo.md");

/**
 * 解析 todo.md 为结构化数据
 */
export function parseTodoMd(): TodoDocument {
  const content = fs.readFileSync(TODO_PATH, "utf-8");
  const lines = content.split("\n");

  let title = "";
  const introLines: string[] = [];
  const phases: Phase[] = [];
  let currentPhase: Phase | null = null;
  let currentGroup: TaskGroup | null = null;
  let inIntro = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 提取文档标题
    if (i === 0 && line.startsWith("# ")) {
      title = line.replace(/^# /, "");
      continue;
    }

    // 检测阶段标题（## 开头，非 ### ）
    if (/^## /.test(line) && !/^### /.test(line)) {
      inIntro = false;
      const phaseTitle = line.replace(/^## /, "").trim();
      currentPhase = { title: phaseTitle, groups: [] };
      currentGroup = null;
      phases.push(currentPhase);
      continue;
    }

    // 如果还在前言阶段，收集文本行
    if (inIntro) {
      introLines.push(line);
      continue;
    }

    if (!currentPhase) continue;

    // 检测目标行（**目标：** 开头）
    if (/^\*\*目标：\*\*/.test(line)) {
      currentPhase.goal = line.replace(/^\*\*目标：\*\*/, "").trim();
      continue;
    }

    // 检测分隔线
    if (/^---\s*$/.test(line)) {
      continue;
    }

    // 匹配任务组：`- [x] **标题**` 或 `- [ ] **标题**`
    const groupMatch = line.match(/^(- \[([ x])\]) \*\*(.+?)\*\*\s*$/);
    if (groupMatch) {
      currentGroup = {
        title: groupMatch[3],
        items: [
          {
            text: groupMatch[3],
            checked: groupMatch[2] === "x",
            lineNumber: i,
          },
        ],
      };
      currentPhase.groups.push(currentGroup);
      continue;
    }

    // 匹配子任务：`  - [x] 描述`（两个空格缩进）
    const itemMatch = line.match(/^(  - \[([ x])\]) (.+)$/);
    if (itemMatch && currentGroup) {
      currentGroup.items.push({
        text: itemMatch[3],
        checked: itemMatch[2] === "x",
        lineNumber: i,
      });
      continue;
    }
  }

  return { title, introLines, phases };
}

/**
 * 切换指定行号上 checkbox 的状态，写回文件
 */
export function toggleCheckbox(lineNumber: number): boolean {
  const content = fs.readFileSync(TODO_PATH, "utf-8");
  const lines = content.split("\n");

  if (lineNumber < 0 || lineNumber >= lines.length) {
    throw new Error(`Invalid line number: ${lineNumber}`);
  }

  const line = lines[lineNumber];
  const newX = line.includes("- [x]") ? " " : "x";
  lines[lineNumber] = line.replace(/- \[([ x])\]/, `- [${newX}]`);

  fs.writeFileSync(TODO_PATH, lines.join("\n"), "utf-8");
  return newX === "x";
}

/**
 * 读取 todo.md 原始内容
 */
export function readTodoMdContent(): string {
  return fs.readFileSync(TODO_PATH, "utf-8");
}
