import { onRequestPost as checkout } from "./functions/api/checkout.js";
import { onRequestPost as webhook } from "./functions/api/webhook.js";
import { onRequestGet as order } from "./functions/api/order.js";

const routes = {
  "/api/checkout": { POST: checkout },
  "/api/webhook": { POST: webhook },
  "/api/order": { GET: order },
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = routes[pathname];
    if (!route) return env.ASSETS.fetch(request);
    const handler = route[request.method];
    if (!handler) return new Response("Method Not Allowed", { status: 405 });
    return handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
  },
};
