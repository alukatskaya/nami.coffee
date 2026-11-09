// Спільні функції для серверної частини (Cloudflare Pages Functions).

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function loadProducts(context) {
  const url = new URL("/content/products.json", context.request.url);
  const res = context.env.ASSETS ? await context.env.ASSETS.fetch(url) : await fetch(url);
  if (!res.ok) throw new Error("products.json unavailable: " + res.status);
  const data = await res.json();
  return data.items || [];
}

export function money(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₴";
}

export function orderText(order) {
  const c = order.customer;
  const out = [`Оплачене замовлення NAMI ${order.orderId}`];
  order.lines.forEach((l, i) => out.push(`${i + 1}. ${l.name}, ${l.size} × ${l.qty} = ${money(l.unit * l.qty)}`));
  out.push(`Разом: ${money(order.total)}`, "", `Отримувач: ${c.name}`, `Телефон: ${c.phone}`, `Нова пошта: ${c.city}, ${c.branch}`);
  if (c.comment) out.push(`Коментар: ${c.comment}`);
  return out.join("\n");
}

export async function sendTelegram(env, text) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text }),
    });
    if (!res.ok) console.log("telegram error", res.status);
    return res.ok;
  } catch (e) {
    console.log("telegram exception", e && e.message);
    return false;
  }
}

/* ---------- перевірка підпису вебхука Monobank (ECDSA, SHA-256, підпис у DER) ---------- */

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Ключ від Monobank: base64 від PEM (SPKI). Підтримуємо також «чистий» PEM або base64 DER.
function spkiFromKey(key) {
  let pem = String(key);
  if (!pem.includes("BEGIN")) {
    try { pem = atob(pem); } catch (e) { /* залишаємо як є */ }
  }
  if (pem.includes("BEGIN")) {
    return b64ToBytes(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  }
  return b64ToBytes(String(key).replace(/\s+/g, ""));
}

// WebCrypto очікує підпис у форматі r||s, а Monobank надсилає ASN.1 DER.
function derToRaw(der, size) {
  let o = 0;
  if (der[o++] !== 0x30) throw new Error("bad signature");
  let len = der[o++];
  if (len & 0x80) o += len & 0x7f;
  const readInt = () => {
    if (der[o++] !== 0x02) throw new Error("bad signature");
    const l = der[o++];
    let v = der.slice(o, o + l);
    o += l;
    while (v.length > 0 && v[0] === 0) v = v.slice(1);
    if (v.length > size) throw new Error("bad signature");
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0);
  raw.set(s, size);
  return raw;
}

export async function verifyMonoSignature(env, bodyBuffer, xSign) {
  const res = await fetch("https://api.monobank.ua/api/merchant/pubkey", { headers: { "X-Token": env.MONO_TOKEN } });
  if (!res.ok) throw new Error("pubkey request failed: " + res.status);
  const { key } = await res.json();
  const spki = spkiFromKey(key);
  const der = b64ToBytes(String(xSign).replace(/\s+/g, ""));
  for (const [curve, size] of [["P-256", 32], ["P-384", 48]]) {
    let pub;
    try {
      pub = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: curve }, false, ["verify"]);
    } catch (e) {
      continue;
    }
    const sig = derToRaw(der, size);
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, sig, bodyBuffer);
  }
  throw new Error("unsupported public key");
}
