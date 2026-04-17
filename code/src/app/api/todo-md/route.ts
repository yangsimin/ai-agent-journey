import { NextResponse } from "next/server";
import { parseTodoMd, toggleCheckbox } from "@/lib/todo-parser";
import { withGetHandler, withApiHandler } from "@/lib/api-utils";
import { todoMdPatchSchema } from "@/lib/api-schemas";

export const GET = withGetHandler(
  async () => {
    const data = parseTodoMd();
    return NextResponse.json(data);
  },
);

export const PATCH = withApiHandler(
  async (req, body) => {
    const { lineNumber } = body;
    const checked = toggleCheckbox(lineNumber);
    return NextResponse.json({ success: true, checked });
  },
  { schema: todoMdPatchSchema },
);
