import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export type MemoryType = "fact" | "preference" | "decision" | "project" | "episode";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  project?: string;
  source?: string;
  pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreOptions {
  dir?: string;
}

export class MemoryStore {
  readonly file: string;
  private entries: MemoryEntry[] = [];

  constructor(opts: StoreOptions = {}) {
    const dir =
      opts.dir ??
      process.env.MCP_MEMORY_DIR ??
      path.join(os.homedir(), ".mcp-memory");
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "memory.jsonl");
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.file)) return;
    const lines = fs.readFileSync(this.file, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as MemoryEntry;
        if (entry && typeof entry.id === "string") {
          const idx = this.entries.findIndex((e) => e.id === entry.id);
          if (idx >= 0) this.entries[idx] = entry;
          else this.entries.push(entry);
        }
      } catch {
        /* skip corrupt lines */
      }
    }
  }

  private persist(): void {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(
      tmp,
      this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf-8",
    );
    fs.renameSync(tmp, this.file);
  }

  store(input: {
    content: string;
    type?: MemoryType;
    tags?: string[];
    project?: string;
    source?: string;
    pinned?: boolean;
    id?: string;
  }): MemoryEntry {
    const now = new Date().toISOString();
    if (input.id) {
      const existing = this.entries.find((e) => e.id === input.id);
      if (existing) {
        existing.content = input.content;
        if (input.type) existing.type = input.type;
        if (input.tags) existing.tags = input.tags;
        if (input.project !== undefined) existing.project = input.project;
        if (input.source) existing.source = input.source;
        if (input.pinned !== undefined) existing.pinned = input.pinned;
        existing.updated_at = now;
        this.persist();
        return existing;
      }
    }
    const entry: MemoryEntry = {
      id: input.id ?? crypto.randomUUID(),
      type: input.type ?? "fact",
      content: input.content,
      tags: (input.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      project: input.project,
      source: input.source,
      pinned: input.pinned ?? false,
      created_at: now,
      updated_at: now,
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  forget(idOrQuery: string): { removed: number; ids: string[] } {
    const byId = this.entries.filter((e) => e.id === idOrQuery);
    const targets =
      byId.length > 0
        ? byId
        : this.entries.filter((e) =>
            e.content.toLowerCase().includes(idOrQuery.toLowerCase()),
          );
    const ids = targets.map((e) => e.id);
    this.entries = this.entries.filter((e) => !ids.includes(e.id));
    this.persist();
    return { removed: ids.length, ids };
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  search(query: string, limit = 10): MemoryEntry[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = this.entries.map((e) => {
      const hay = `${e.content} ${e.tags.join(" ")} ${e.project ?? ""} ${e.type}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (hay.includes(t)) score += 10;
        if (e.content.toLowerCase().includes(t)) score += 5;
        if (e.tags.includes(t)) score += 8;
      }
      if (e.pinned) score += 6;
      const ageDays =
        (Date.now() - Date.parse(e.updated_at)) / (1000 * 60 * 60 * 24);
      if (ageDays < 7) score += 4;
      else if (ageDays < 30) score += 2;
      return { e, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.e.updated_at < b.e.updated_at ? 1 : -1)
      .slice(0, limit)
      .map((s) => s.e);
  }

  recent(limit = 20): MemoryEntry[] {
    return [...this.entries]
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .slice(0, limit);
  }

  context(project?: string, limit = 30): MemoryEntry[] {
    const pool = project
      ? this.entries.filter((e) => !e.project || e.project === project)
      : this.entries;
    return [...pool]
      .sort((a, b) => {
        const pin = Number(b.pinned ?? 0) - Number(a.pinned ?? 0);
        if (pin !== 0) return pin;
        return a.updated_at < b.updated_at ? 1 : -1;
      })
      .slice(0, limit);
  }

  stats(): { total: number; pinned: number; types: Record<string, number> } {
    const types: Record<string, number> = {};
    for (const e of this.entries) types[e.type] = (types[e.type] ?? 0) + 1;
    return {
      total: this.entries.length,
      pinned: this.entries.filter((e) => e.pinned).length,
      types,
    };
  }
}
