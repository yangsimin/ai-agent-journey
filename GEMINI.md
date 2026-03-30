# GEMINI.md - Project Context & Instructions

This project, **AI Agent Journey**, is a systematic learning and development repository for building AI Agents using the Gemini model and modern web technologies.

## Project Overview

- **Core Goal:** To learn and implement AI Agent capabilities step-by-step, from basic chat to complex autonomous agents.
- **Architecture:** Monorepo-style structure with progressive learning levels.
  - `code/`: Next.js application demonstrating basic streaming chat using Vercel AI SDK and Google Gemini.
  - `docs/`: Task tracking and learning roadmap (`todo.md`), and Q&A records (`qa.md`).
  - `docs/slides/`: Beautiful HTML slides (`level1.html`, `level2.html`, etc.).
  - `docs/references/`: Reference materials including article summaries and concept notes.
- **Main Technologies:**
  - **Framework:** Next.js (App Router)
  - **Language:** TypeScript
  - **AI SDK:** Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/react`)
  - **Validation:** Zod
  - **Styling:** Tailwind CSS (v4)
  - **LLM:** Google Gemini (default: `gemini-2.5-flash`)

## Building and Running

### Learning Materials
- **Slides:** Open `docs/slides/level1.html` in any browser for a visual overview of Level 1.
- **Q&A Record:** Use `docs/qa.md` to track questions and answers during your learning process.

### Level 1: Basic Chat Assistant
1. Navigate to the project directory:
   ```bash
   cd code
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env.local` file in `code/` and add your Google Generative AI API Key:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
   GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) to interact with the agent.

## Development Conventions

- **Next.js Conventions:** Adhere strictly to App Router patterns. Use `'use client'` for client-side components.
- **AI Integration:** Use Vercel AI SDK for consistency and ease of streaming.
- **Type Safety:** Use TypeScript for all source code. Use Zod for runtime schema validation, especially for structured outputs in later levels.
- **Styling:** Use Tailwind CSS for rapid UI development. Favor modern, clean, and responsive designs.
- **Environment Variables:** Always use `process.env` for sensitive keys and configurable model names.
- **Code Structure:**
  - UI components in `src/app/`
  - API routes for AI interactions in `src/app/api/chat/`
- **Agent Rules:** Refer to `code/CLAUDE.md` and `code/AGENTS.md` for specific agent behavior guidelines.

## Roadmap Highlights

1. **Level 1:** Streaming Chat & Context Management.
2. **Level 2:** RAG (Retrieval Augmented Generation) with LangChain.js and Vector DBs.
3. **Level 4:** Autonomous Agents & Orchestration with LangGraph.js.
4. **Advanced:** Model Context Protocol (MCP) integration.
