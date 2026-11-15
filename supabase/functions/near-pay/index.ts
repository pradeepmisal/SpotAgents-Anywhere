import { admin, caller, cors, json } from "../_shared/common.ts";
import { handleQuote } from "./quote.ts";
import { handleVerify } from "./verify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return json({ error: "unauthorized" }, 401);

  const route = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();
  try {
    if (route === "quote") return await handleQuote(req, db, userId);
    if (route === "verify") return await handleVerify(req, db, userId);
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
