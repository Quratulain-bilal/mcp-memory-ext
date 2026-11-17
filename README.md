# mcp-memory-ext

**MCP Memory Extension — persistent, portable, local-first memory for AI agents.**

MCP connects models to tools and screens (MCP Apps). It has no standard for **memory that survives the session**. This repo is a draft extension: a spec + reference server you can use today.

## Why

- Claude forgets everything when the chat ends
- Switching between ChatGPT / Claude / Cursor means starting from zero
- Every host invents private memory — no portability

**This extension:** one local file (`~/.mcp-memory/memory.jsonl`) + 5 standard tools. Any host can adopt it. Your memory = your file.

## Tools

| Tool | Does |
|---|---|
| `memory_store` | Save/update a fact, preference, decision, project note |
| `memory_search` | Ranked keyword search |
| `memory_context` | Load pinned + recent context at session start |
| `memory_forget` | Delete by id or text (immediate) |
| `memory_stats` | Counts + store path |

## Quick start (Claude Desktop)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["tsx", "C:\\path\\to\\mcp-memory-ext\\src\\server.ts", "stdio"]
    }
  }
}
```

## Dev

```bash
npm install
npm test          # smoke test (store → search → context → forget)
npm run serve     # HTTP mode on :3004
npm start         # stdio mode
```

## Files

- `SPEC.md` — draft extension spec (RFC 2119 language, ready for SEP discussion)
- `src/store.ts` — JSONL memory store
- `src/server.ts` — MCP server (stdio + HTTP)

## Roadmap → official extension

1. ✅ Reference implementation + spec draft
2. Post discussion issue in [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps) / main repo
3. Join a working group → SEP (Extensions Track)
4. Adopters: Claude, Cursor, Goose...

MIT
