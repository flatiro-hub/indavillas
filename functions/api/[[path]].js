// /api/* on Cloudflare Pages. The pages still call the old PHP addresses (/api/audit.php, /api/market.php);
// both those and the short ones (/api/audit, /api/market) land here. Code: functions-lib/api.js.
import { audit, market } from "../../functions-lib/api.js";

export async function onRequest({ request, env, params }) {
  const name = String((params.path || [])[0] || "").replace(/\.php$/, "");
  if ((params.path || []).length === 1 && name === "audit") return audit(request, env);
  if ((params.path || []).length === 1 && name === "market") return market(request, env);
  return new Response(JSON.stringify({ ok: false, code: "not_found" }), { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
