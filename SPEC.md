# MCP Extension: Memory

**Status:** Draft / Reference implementation
**Vendor prefix (proposed):** `dev.mcpmemory/memory` (rename to your domain)
**Target:** SEP (Extensions Track) for the Model Context Protocol

---

## 1. Abstract

This extension defines a **standard, portable long-term memory layer for MCP clients and agents**. Today every AI host stores memory its own proprietary way; sessions die with the chat and moving between hosts loses everything. This extension specifies:

1. A **memory data model** (`MemoryEntry`) stored in an append-safe local store
2. A **standard toolset** (`memory_store`, `memory_search`, `memory_context`, `memory_forget`, `memory_stats`) that any MCP server MAY expose
3. A **portability rule**: memory lives in a single user-owned file that any conforming host or server can read

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, MAY are to be interpreted as described in RFC 2119.

---

## 2. Motivation

- MCP core connects models to **tools** and (via MCP Apps) to **screens**, but has no standard for **state that survives sessions**.
- Hosts today implement memory privately (memory features per vendor). Users cannot move their memory between hosts.
- Agents re-derive the same facts every session — wasteful and inconsistent.

An extension is the right shape: optional, opt-in, implementable incrementally — the same path MCP Apps took.

---

## 3. Data model

A **MemoryEntry** is a JSON object:

| Field | Type | Req | Meaning |
|---|---|---|---|
| `id` | string (UUID) | MUST | Stable identifier |
| `type` | enum: `fact` \| `preference` \| `decision` \| `project` \| `episode` | MUST | Kind of memory |
| `content` | string | MUST | The memory itself, 1–2 sentences |
| `tags` | string[] (lowercase) | SHOULD | Search keys |
| `project` | string | MAY | Workspace scoping |
| `source` | string | MAY | Provenance (chat URL, file) |
| `pinned` | boolean | MAY | Prefer during context assembly |
| `created_at` / `updated_at` | ISO 8601 | MUST | Timestamps |

**Store file:** `~/.mcp-memory/memory.jsonl` (override: `MCP_MEMORY_DIR`). One JSON object per line. Writers MUST write atomically (temp file + rename).

---

## 4. Tools

A conforming memory server MUST implement the following tools with equivalent names, descriptions and schemas:

### `memory_store`
Persist or update an entry. Input: `content` (required), `type`, `tags`, `project`, `source`, `pinned`, `id`.
If `id` refers to an existing entry, the entry is **updated** (not duplicated). Output: confirmation line containing the entry id.

### `memory_search`
Keyword/relevance search. Input: `query` (required), `limit` (default 10).
Servers SHOULD rank by: term match in content > tags, recency boost, pinned boost.

### `memory_context`
Context assembly for session start. Input: `project` (optional), `limit` (default 30).
MUST return pinned entries first, then most recently updated.

### `memory_forget`
Deletion by exact `id` or content substring. MUST return removed ids (empty if no match).

### `memory_stats`
Counts by type + pinned count + store file path (for debuggability).

---

## 5. Portability rules

1. A conforming store MUST be readable by any other conforming implementation given the same file (no proprietary compression, no vendor encryption).
2. A host MAY copy the store file to migrate; no export step SHOULD be required.
3. Memory MUST NOT be silently sent to a model provider beyond the normal prompt path — hosts SHOULD load via `memory_context` only.

---

## 6. Security & privacy

- The store is **local-first**: no network requirement.
- Servers MUST NOT exfiltrate the store; network transports (HTTP) MUST be user-initiated.
- `memory_forget` MUST be destructive and immediate (GDPR-style right to be forgotten).

---

## 7. Non-goals (v0)

- Embeddings/vector search (MAY be added by servers as ranking improvement)
- Cross-device sync (future SEP)
- Automatic extraction from conversations (hosts decide when to call `memory_store`)

---

## 8. Reference implementation

See [`src/`](./src) — TypeScript, stdio + Streamable HTTP transports, JSONL store. MIT licensed.
