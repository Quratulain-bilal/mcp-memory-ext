import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import cors from "cors";
import { MemoryStore } from "./store.js";

const store = new MemoryStore();

const server = new McpServer({
  name: "mcp-memory-ext",
  version: "0.1.0",
});

const typeSchema = z
  .enum(["fact", "preference", "decision", "project", "episode"])
  .describe("Kind of memory")
  .default("fact");

function render(entries: ReturnType<MemoryStore["search"]>): string {
  if (!entries.length) return "No matching memories.";
  return entries
    .map(
      (e) =>
        `- [${e.type}] ${e.id.slice(0, 8)}${e.pinned ? " 📌" : ""} (${e.updated_at.slice(0, 10)})${e.project ? ` project:${e.project}` : ""}: ${e.content}`,
    )
    .join("\n");
}

server.registerTool(
  "memory_store",
  {
    title: "Store memory",
    description:
      "Persist a fact, preference, decision, project note or episode to long-term memory. Re-pass an existing id to update it.",
    inputSchema: {
      content: z.string().min(1).describe("What to remember, in one or two sentences"),
      type: typeSchema,
      tags: z.array(z.string()).optional().describe("Lowercase search tags"),
      project: z.string().optional().describe("Project or workspace this belongs to"),
      source: z.string().optional().describe("Where this came from, e.g. chat URL"),
      pinned: z.boolean().optional().describe("Pin important memories to context"),
      id: z.string().optional().describe("Update existing entry with this id"),
    },
  },
  async ({ content, type, tags, project, source, pinned, id }) => {
    const entry = store.store({ content, type, tags, project, source, pinned, id });
    return {
      content: [
        {
          type: "text",
          text: `Stored ${entry.type} memory ${entry.id}: ${entry.content}`,
        },
      ],
    };
  },
);

server.registerTool(
  "memory_search",
  {
    title: "Search memory",
    description:
      "Semantic-ish keyword search over long-term memory. Use before answering questions about past work, preferences or decisions.",
    inputSchema: {
      query: z.string().min(1).describe("What to look for"),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  async ({ query, limit }) => {
    const results = store.search(query, limit ?? 10);
    return { content: [{ type: "text", text: render(results) }] };
  },
);

server.registerTool(
  "memory_context",
  {
    title: "Load memory context",
    description:
      "Load the most relevant long-term context (pinned + recent, optionally project-filtered) at the start of a session.",
    inputSchema: {
      project: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  async ({ project, limit }) => {
    const entries = store.context(project, limit ?? 30);
    const stats = store.stats();
    const header = `Memory context: ${entries.length} entries (store has ${stats.total} total, ${stats.pinned} pinned)`;
    return { content: [{ type: "text", text: header + "\n" + render(entries) }] };
  },
);

server.registerTool(
  "memory_forget",
  {
    title: "Forget memory",
    description: "Delete a memory by exact id, or by content substring.",
    inputSchema: {
      id_or_query: z.string().min(1).describe("Exact id, or text to match"),
    },
  },
  async ({ id_or_query }) => {
    const res = store.forget(id_or_query);
    return {
      content: [
        {
          type: "text",
          text:
            res.removed === 0
              ? "Nothing matched."
              : `Removed ${res.removed} entries: ${res.ids.join(", ")}`,
        },
      ],
    };
  },
);

server.registerTool(
  "memory_stats",
  {
    title: "Memory stats",
    description: "Show how many memories exist and their breakdown by type.",
    inputSchema: {},
  },
  async () => {
    const s = store.stats();
    return {
      content: [
        {
          type: "text",
          text: `total=${s.total} pinned=${s.pinned} types=${JSON.stringify(s.types)} file=${store.file}`,
        },
      ],
    };
  },
);

const mode = process.argv[2] ?? "stdio";

async function main() {
  if (mode === "http") {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: "2mb" }));
    app.post("/mcp", async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
    app.get("/mcp", (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed" },
        id: null,
      });
    });
    const port = Number(process.env.PORT || 3004);
    app.listen(port, () => {
      console.log(`mcp-memory-ext listening on http://localhost:${port}/mcp`);
      console.log(`store: ${store.file}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`mcp-memory-ext ready (stdio), store: ${store.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
