// POST /api/checkout — перераховує суму на сервері за content/products.json
// і створює рахунок в еквайринзі Monobank. Повертає {pageUrl} для оплати.
import { json, loadProducts } from "../_lib/common.js";

const clean = (v, max) => String(v || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.MONO_TOKEN || !env.ORDERS) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }

  const c = body.customer || {};
  const customer = {
    name: clean(c.name, 100),
    phone: clean(c.phone, 30),
    city: clean(c.city, 100),
    branch: clean(c.branch, 120),
    comment: clean(c.comment, 500),
  };
  if (customer.name.length < 2 || customer.phone.replace(/\D/g, "").length < 9 || !customer.city || !customer.branch) {
    return json({ error: "invalid_customer" }, 400);
  }

  let products;
  try { products = await loadProducts(context); } catch (e) { return json({ error: "catalog_unavailable" }, 500); }

  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const lines = [];
  let total = 0;
  for (const it of items) {
    const p = products.find((x) => x.slug === it.slug && x.available !== false);
    const pr = p && (p.prices || []).find((x) => x.size === it.size);
    const qty = Math.floor(Number(it.qty));
    if (!p || !pr || !(qty >= 1 && qty <= 30)) return json({ error: "invalid_item" }, 400);
    lines.push({ slug: p.slug, name: `${p.country} ${p.name}`, size: pr.size, unit: pr.price, qty });
    total += pr.price * qty;
  }
  if (!lines.length || total <= 0) return json({ error: "empty" }, 400);

  const orderId = "N" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0");
  const origin = new URL(request.url).origin;

  const res = await fetch("https://api.monobank.ua/api/merchant/invoice/create", {
    method: "POST",
    headers: { "X-Token": env.MONO_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: total * 100, // копійки
      ccy: 980, // UAH
      merchantPaymInfo: { reference: orderId, destination: `Замовлення NAMI ${orderId}` },
      redirectUrl: `${origin}/thanks.html?o=${orderId}`,
      webHookUrl: `${origin}/api/webhook`,
      validity: 3600,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.pageUrl) {
    console.log("monobank invoice error", res.status, JSON.stringify(data).slice(0, 300));
    return json({ error: "mono_failed" }, 502);
  }

  await env.ORDERS.put(
    "order:" + orderId,
    JSON.stringify({ orderId, invoiceId: data.invoiceId, total, lines, customer, status: "pending", notified: false, createdAt: Date.now() }),
    { expirationTtl: 60 * 60 * 24 * 45 }
  );
  return json({ pageUrl: data.pageUrl, orderId });
}
