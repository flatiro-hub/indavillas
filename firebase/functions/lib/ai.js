/* Claude API calls for reply drafts and review summaries. Optional: without a key the portal hides the AI buttons. */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const BASE = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const aiOn = key => !!key && /^sk-/.test(String(key).trim());

async function aiText(key, { system, prompt, maxTokens = 700 }) {
  if (!aiOn(key)) { const e = new Error("AI drafts aren't set up. Add an Anthropic API key (see the README)."); e.code = "failed-precondition"; throw e; }
  const res = await fetch(BASE + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": String(key).trim(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("AI service: " + (j.error?.message || res.status));
  return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
}

module.exports = { aiOn, aiText, MODEL };
