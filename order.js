// GET /api/order?o=ID — повертає лише статус оплати (без персональних даних).
import { json } from "../_lib/common.js";

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("o") || "";
  if (!env.ORDERS || !/^N[0-9A-Z]{4,20}$/.test(id)) return json({ status: "unknown" });
  const raw = await env.ORDERS.get("order:" + id);
  if (!raw) return json({ status: "unknown" });
  return json({ status: JSON.parse(raw).status });
}
