import { todoStore } from '@/lib/tools';

export async function GET() {
  return Response.json({ todos: todoStore });
}
