import { parseTodoMd } from "@/lib/todo-parser";
import { TodoViewer } from "@/components/todos/todo-viewer";

export const metadata = {
  title: "学习进度 - AI Agent 实战",
};

export default function TodosPage() {
  const data = parseTodoMd();
  return <TodoViewer data={data} />;
}
