# BRAIN.md — AI Router

> Agent context file for dooz-ai-router

## Purpose

Multi-provider LLM router library for the Dooz ecosystem. Provides unified interface for routing requests across OpenRouter, Ollama, OpenAI, Anthropic, and Gemini.

## Architecture

```
src/
├── index.ts       # Public exports
├── router.ts      # Core LlmRouter class
├── client.ts      # HTTP client with retries
├── config.ts      # Configuration schemas
├── server.ts      # Optional Hono server
├── types.ts       # TypeScript types
└── providers/     # Provider implementations
```

## Key Concepts

- **Provider**: API backend (OpenRouter, Ollama, etc.)
- **Task Type**: Semantic hint for model selection (extraction, summarization, reasoning)
- **Fallback Chain**: Ordered list of backup providers
- **Smart Routing**: Automatic model selection per task

## Agent Boundaries

| Boundary | Rule |
|----------|------|
| File writes | `src/` and `dist/` only |
| Network | Provider API endpoints only |
| Credentials | Via environment variables only |
| Breaking changes | Require version bump |

## Common Operations

```bash
# Build library
bun run build

# Run tests
bun test

# Start dev server
bun run dev
```

## Dependencies

- `hono` — HTTP server framework
- `zod` — Schema validation

## Downstream Consumers

- dooz-brain
- dooz-pilot
- dooz-copilot
