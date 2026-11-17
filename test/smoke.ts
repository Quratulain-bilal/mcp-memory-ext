import { MemoryStore } from "../src/store.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok: ${msg}`);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-test-"));
const store = new MemoryStore({ dir });

const e1 = store.store({
  content: "User prefers Roman Urdu explanations with short examples",
  type: "preference",
  tags: ["language", "style"],
  pinned: true,
});
assert(!!e1.id, "store returns id");

const e2 = store.store({
  content: "Palette MCP app runs on port 3001 with cloudflared tunnel",
  type: "project",
  project: "mcp",
  tags: ["mcp", "palette"],
});

store.store({
  content: "Decision: build memory extension as local-first JSONL store",
  type: "decision",
  project: "memory",
  tags: ["memory", "decision"],
});

const hits = store.search("roman urdu preference");
assert(hits.length > 0 && hits[0].id === e1.id, "search finds pinned preference");

const hits2 = store.search("palette port");
assert(hits2.some((h) => h.id === e2.id), "search finds project entry");

const ctx = store.context("mcp", 10);
assert(ctx.length >= 1, "project context returns entries");

const recent = store.recent(5);
assert(recent.length === 3, "recent lists all entries");

const updated = store.store({ id: e1.id, content: "Updated preference text" });
assert(updated.id === e1.id && updated.content === "Updated preference text", "update by id works");
assert(store.stats().total === 3, "no duplicate after update");

const stats = store.stats();
assert(stats.total === 3 && stats.pinned === 1, "stats correct");

const gone = store.forget(e2.id);
assert(gone.removed === 1, "forget by id works");
assert(store.stats().total === 2, "entry removed");

const gone2 = store.forget("Updated preference");
assert(gone2.removed === 1, "forget by content substring works");

const store2 = new MemoryStore({ dir });
assert(store2.stats().total === 1, "persistence: reload sees remaining entry");

console.log("\nALL TESTS PASSED");
