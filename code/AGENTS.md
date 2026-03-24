<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context

This is **AI Agent Journey** — a systematic learning repository for building AI Agents step-by-step. It is a learning project, not production software.

**Monorepo structure:**
- `code/` — Next.js application (this directory)
- `docs/` — Roadmap, task tracking (`todo.md`), Q&A (`qa.md`), HTML slides (`slides/level1.html`, `level2.html`)
- `GEMINI.md` — Project-level context and instructions (root directory)

## Build & Run

```bash
cd code
npm install
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm start        # production server
```

No test framework is configured. No single-test command exists.

## Environment Variables

Create `.env.local` in `code/` (not committed):

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_key       # Required — used by chat, models, and embedding routes
GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash # Optional — override default chat model
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1 # Optional — enables local embedding via LM Studio
LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text  # Optional — model name for LM Studio embeddings
```

When both `LM_STUDIO_BASE_URL` and `LM_STUDIO_EMBEDDING_MODEL` are set, embeddings use a local LM Studio instance (`@ai-sdk/openai` compatible client). Otherwise, falls back to Google `text-embedding-004` (768-dimensional).

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **AI SDK:** Vercel AI SDK 6 (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/react`)
- **Validation:** Zod 4
- **Styling:** Tailwind CSS v4
- **LLM:** Google Gemini (default: `gemini-2.5-flash`)
- **Text Splitting:** `@langchain/textsplitters`

## Architecture

```
src/
  app/
    page.tsx                    # Main chat UI (client component, entire UI in one file)
    layout.tsx                  # Root layout (lang="zh-CN")
    globals.css                 # Tailwind v4 + CSS custom properties
    api/
      chat/route.ts             # POST: streaming chat with RAG enhancement
      ingest/route.ts           # POST: document ingestion (chunk → embed → store)
      models/route.ts           # GET: list available Gemini models
  lib/
    embeddings.ts               # Embedding provider abstraction (LM Studio / Google)
    vectorStore.ts              # File-based vector store with cosine similarity
```

### Chat Data Flow

```
page.tsx (useChat hook)
  → POST /api/chat { messages, modelId, systemPrompt }
    → convertToModelMessages()     [UIMessage[] → ModelMessage[]]
    → embedText(lastMessage)       [embeddings.ts]
    → searchStore(embedding, 10)   [vectorStore.ts, brute-force cosine similarity]
    → Append RAG context to systemPrompt
    → streamText()                 [Google Gemini]
    → toUIMessageStreamResponse()
```

### RAG Data Flow

```
page.tsx (file upload)
  → POST /api/ingest { text, filename }
    → RecursiveCharacterTextSplitter (chunkSize=800, overlap=150)
    → embedTexts()                [embeddings.ts]
    → clearStore() + addChunks()  [vectorStore.ts → .vector_store.json]
```

### Persona System

Hardcoded in `page.tsx` as a `PERSONAS` array. Selection persisted to `localStorage`. The chosen prompt is sent as `systemPrompt` in the chat request body and used as the base system instruction; RAG context is appended below it.

## Key Architectural Decisions

- **Vector store uses JSON file** (`.vector_store.json`) instead of in-memory singleton to avoid Next.js App Router worker isolation issues where state is lost across different API route workers.
- **No ANN index** — `searchStore()` does brute-force O(n) cosine similarity over all stored vectors. Suitable for learning-scale datasets only.
- **Replace-on-upload** — each document upload calls `clearStore()` then `addChunks()`. No incremental indexing or multi-document support.
- **Vercel AI SDK 3.x multi-part messages** — `UIMessage.parts` format is used; message rendering filters for `p.type === 'text'`.
- **Model resolution priority** — `modelId` from frontend > `GOOGLE_GENERATIVE_AI_MODEL` env > `'gemini-2.0-flash'` fallback.

## Development Conventions

- Use `'use client'` for client-side components.
- Use `@/*` path alias for imports (maps to `./src/*`).
- API routes export named HTTP-method functions (`export async function POST() {}`).
- Environment variables are accessed via `process.env` — never hardcode keys.
- Each API route sets `export const maxDuration` for Vercel serverless timeout.

## Learning Stage Progress

| Stage | Topic | Status |
|-------|-------|--------|
| Level 1 | Streaming Chat & Context Management | Done |
| Level 2 | RAG with LangChain.js & Vector Store | Done |
| Level 3 | Function Calling & Structured Outputs | Not started |
| Level 4 | Autonomous Agents with LangGraph.js | Not started |
| Advanced | Model Context Protocol (MCP) | Not started |
