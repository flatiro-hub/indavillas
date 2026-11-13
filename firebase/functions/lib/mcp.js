/* Remote MCP server for AI assistants (Grok, Claude, ChatGPT…): portalMcp in index.js.
 *
 * Transport: MCP "Streamable HTTP", stateless. Every request is one POST with a JSON-RPC message (or a batch); the answer
 * comes back as JSON, or as a single server-sent event when the client only accepts text/event-stream. No sessions, no
 * server-to-client stream (GET answers 405, as the spec allows).
 *
 * Auth: a bot key from the portal's Bots page (lib/bot.js), sent as
 *   Authorization: Bearer ivb_…      (xAI API "authorization", Claude/ChatGPT connectors with a header)
 *   X-Api-Key: ivb_…
 *   or in the URL: …/portalMcp/k/ivb_…  (for apps that only take a URL, e.g. grok.com custom connectors)
 * The key decides which tools are listed and which villas they reach. */
const bot = require("./bot");

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const INFO = { name: "indavillas-portal", title: "IndaVillas portal", version: "1.0.0" };
const INSTRUCTIONS = [
  "IndaVillas manages holiday villas in Bali through Hostex. These tools read and change the villas this bot key may reach.",
  "Start with list_villas to get villa ids. Dates are YYYY-MM-DD (Bali time); a date range's end is the last night.",
  "Amounts are in each villa's channel currency (often IDR or USD).",
  "Tools that change something first return a preview with needs_confirmation: show it to the user, and call again with confirm: true only after they agree.",
  "Never put guests' contact details or owners' personal data anywhere the user didn't ask for.",
].join(" ");

// Firestore Timestamps → ISO strings, so results are plain JSON
const ser = v => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : Array.isArray(v) ? v.map(ser) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])) : v);

function keyFrom(req) {
  const h = req.headers || {}, auth = String(h.authorization || h.Authorization || "");
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (m) return m[1];
  if (h["x-api-key"]) return String(h["x-api-key"]);
  const p = String(req.path || req.url || "").split("?")[0].match(/(?:^|\/)k\/(ivb_[^/]+)/) || String(req.path || "").match(/^\/(ivb_[^/]+)/);
  if (p) return decodeURIComponent(p[1]);
  return (req.query && req.query.key) ? String(req.query.key) : "";
}
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });

function send(req, res, status, body) {
  const accept = String((req.headers || {}).accept || "");
  if (accept.includes("text/event-stream") && !accept.includes("application/json") && !accept.includes("*/*")) {
    res.status(status).set("Content-Type", "text/event-stream").set("Cache-Control", "no-cache").send(`event: message\ndata: ${JSON.stringify(body)}\n\n`);
  } else res.status(status).set("Content-Type", "application/json").send(JSON.stringify(body));
}

async function one(m, ctx) {
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0" || typeof m.method !== "string") return rpcErr(m && m.id, -32600, "Invalid request");
  const isNote = m.id === undefined || m.id === null;
  if (isNote) return null; // notifications/initialized, cancelled, … need no answer
  const p = m.params || {};
  switch (m.method) {
    case "initialize":
      return ok(m.id, { protocolVersion: VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: INFO,
        instructions: `${INSTRUCTIONS} This key: "${ctx.bot.name}"${ctx.bot.write ? ", can make changes" : ", read-only"}.` });
    case "ping": return ok(m.id, {});
    case "tools/list":
      return ok(m.id, { tools: bot.toolsFor(ctx.bot).map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.schema,
        annotations: { title: t.title, readOnlyHint: !t.write, destructiveHint: !!t.write && t.destructive !== false, idempotentHint: !t.write, openWorldHint: false } })) });
    case "tools/call": {
      const name = String(p.name || "");
      if (!bot.toolsFor(ctx.bot).some(t => t.name === name)) return rpcErr(m.id, -32602, `Unknown tool: ${name}`);
      try {
        const out = ser(await bot.call({ ...ctx, name, args: p.arguments || {} }));
        const text = JSON.stringify(out, null, 1);
        return ok(m.id, { content: [{ type: "text", text: text.length > 180000 ? text.slice(0, 180000) + "\n…(cut: ask for a shorter range)" : text }], ...(out && typeof out === "object" && !Array.isArray(out) ? { structuredContent: out } : {}), isError: false });
      } catch (e) {
        if (e.code !== "permission-denied" && e.code !== "invalid-argument" && e.code !== "not-found" && e.code !== "failed-precondition") console.warn("mcp tool", name, e.message);
        return ok(m.id, { content: [{ type: "text", text: e.message || "Something went wrong." }], isError: true });
      }
    }
    case "resources/list": return ok(m.id, { resources: [] });
    case "resources/templates/list": return ok(m.id, { resourceTemplates: [] });
    case "prompts/list": return ok(m.id, { prompts: [] });
    case "logging/setLevel": return ok(m.id, {});
    default: return rpcErr(m.id, -32601, `Method not found: ${m.method}`);
  }
}

// deps: { db, api, key (Anthropic, for reply drafts), now }
async function handle(req, res, deps) {
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method === "GET" || req.method === "DELETE") return res.status(405).set("Allow", "POST").json({ error: "This MCP server answers POST requests (Streamable HTTP, stateless)." });
  if (req.method !== "POST") return res.status(405).set("Allow", "POST").json({ error: "Use POST." });
  let b;
  try { b = await bot.verify(deps.db, keyFrom(req)); } catch (e) {
    return send(req, res, e.code === "permission-denied" ? 403 : 401, rpcErr(null, -32001, e.message));
  }
  let body = req.body;
  if (typeof body === "string" || Buffer.isBuffer(body)) { try { body = JSON.parse(String(body)); } catch (e) { return send(req, res, 400, rpcErr(null, -32700, "Parse error")); } }
  if (body == null || (Array.isArray(body) && !body.length)) return send(req, res, 400, rpcErr(null, -32600, "Invalid request"));
  const ctx = { db: deps.db, api: deps.api, key: deps.key, now: deps.now, bot: b };
  const list = Array.isArray(body) ? body : [body], out = [];
  for (const m of list) { const r = await one(m, ctx); if (r) out.push(r); }
  if (!out.length) return res.status(202).send("");
  return send(req, res, 200, Array.isArray(body) ? out : out[0]);
}

module.exports = { handle, keyFrom, VERSIONS };
