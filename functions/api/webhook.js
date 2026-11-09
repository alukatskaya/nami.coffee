// POST /api/webhook — сюди Monobank повідомляє про результат оплати.
// Підпис X-Sign перевіряється, сума звіряється із замовленням, потім замовлення йде в Telegram.
import { json, orderText, sendTelegram, verifyMonoSignature } from "../_lib/common.js";

const TTL = 60 * 60 * 24 * 45;

export async function onRequestPost({ request, env }) {
  if (!env.MONO_TOKEN || !env.ORDERS) return json({ error: "not_configured" }, 503);

  const buf = await request.arrayBuffer();
  const sign = request.headers.get("X-Sign") || "";

  let ok = false;
  try {
    ok = await verifyMonoSignature(env, buf, sign);
  } catch (e) {
    console.log("signature check error", e && e.message);
    return json({ error: "verify_failed" }, 503); // Monobank повторить спробу пізніше
  }
  if (!ok) return json({ error: "bad_signature" }, 400);

  let data;
  try { data = JSON.parse(new TextDecoder().decode(buf)); } catch (e) { return json({ error: "bad_json" }, 400); }

  const ref = data.reference;
  if (!ref) return json({ ok: true });
  const raw = await env.ORDERS.get("order:" + ref);
  if (!raw) return json({ ok: true });
  const order = JSON.parse(raw);
  if (data.invoiceId && order.invoiceId && data.invoiceId !== order.invoiceId) return json({ ok: true });

  const save = () => env.ORDERS.put("order:" + ref, JSON.stringify(order), { expirationTtl: TTL });

  if (data.status === "success") {
    if (Number(data.amount) !== order.total * 100) {
      console.log("amount mismatch", ref, data.amount, order.total * 100);
      return json({ ok: true });
    }
    if (order.status !== "paid") {
      order.status = "paid";
      order.paidAt = Date.now();
      await save();
    }
    if (!order.notified) {
      const sent = await sendTelegram(env, orderText(order));
      if (!sent) return json({ error: "telegram_failed" }, 502); // Monobank повторить, замовлення не загубиться
      order.notified = true;
      await save();
    }
  } else if ((data.status === "failure" || data.status === "expired" || data.status === "reversed") && order.status !== "paid") {
    order.status = data.status;
    await save();
  }
  return json({ ok: true });
}
