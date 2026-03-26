import { NextResponse } from "next/server";
import { parseTodoMd, toggleCheckbox } from "@/lib/todo-parser";

export async function GET() {
  try {
    const data = parseTodoMd();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to read todo.md:", error);
    return NextResponse.json(
      { error: "Failed to read todo.md" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { lineNumber } = body;

    if (typeof lineNumber !== "number") {
      return NextResponse.json(
        { error: "lineNumber is required" },
        { status: 400 }
      );
    }

    const checked = toggleCheckbox(lineNumber);
    return NextResponse.json({ success: true, checked });
  } catch (error) {
    console.error("Failed to toggle checkbox:", error);
    return NextResponse.json(
      { error: "Failed to toggle checkbox" },
      { status: 500 }
    );
  }
}
