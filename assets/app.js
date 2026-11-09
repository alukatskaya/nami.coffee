(function () {
  "use strict";
  var page = document.body.getAttribute("data-page") || "home";
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var S = {}, P = [];
  var CART_KEY = "nami_cart_v2", FORM_KEY = "nami_form_v2";
  var BG = { espresso: "#131A26", filter: "#E2D5C3" };

  /* ---------- helpers ---------- */
  function byId(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag), k;
    for (k in (attrs || {})) {
      var v = attrs[k];
      if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₴"; }
  function okColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : "#C9A57A"; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function paras(text) {
    return String(text || "").split(/\n\s*\n/).map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { return h("p", {}, [t]); });
  }
  function tg() { var u = String(S.telegram || "").replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, ""); return u.length >= 4 ? u : "namicoffee"; }
  function product(slug) { for (var i = 0; i < P.length; i++) if (P[i].slug === slug) return P[i]; return null; }
  function priceOf(p, size) { var a = p.prices || []; for (var i = 0; i < a.length; i++) if (a[i].size === size) return a[i]; return null; }
  function load(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }

  /* ---------- cart ---------- */
  var cart = lsGet(CART_KEY) || [];
  function saveCart() { lsSet(CART_KEY, cart); refreshCart(); }
  function lines() {
    var out = [];
    cart.forEach(function (l) {
      var p = product(l.slug), pr = p && p.available !== false ? priceOf(p, l.size) : null;
      if (p && pr) out.push({ p: p, size: pr.size, unit: pr.price, qty: l.qty, sum: pr.price * l.qty });
    });
    return out;
  }
  function total() { return lines().reduce(function (s, l) { return s + l.sum; }, 0); }
  function count() { return lines().reduce(function (s, l) { return s + l.qty; }, 0); }
  function addToCart(slug, size, q) {
    var f = null;
    cart.forEach(function (l) { if (l.slug === slug && l.size === size) f = l; });
    if (f) f.qty = Math.min(30, f.qty + q); else cart.push({ slug: slug, size: size, qty: q });
    saveCart();
    var b = document.querySelector(".cartbtn"); if (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  }
  function changeQty(slug, size, d) {
    cart.forEach(function (l) { if (l.slug === slug && l.size === size) l.qty += d; });
    cart = cart.filter(function (l) { return l.qty > 0; });
    saveCart();
  }
  function clearCart() { cart = []; saveCart(); }

  var cntEl = null, sheet = null, sheetLines = null, sheetTotal = null, sheetGo = null;
  function refreshCart() {
    if (cntEl) { var n = count(); cntEl.textContent = String(n); cntEl.setAttribute("data-n", String(n)); }
    if (sheet && sheet.classList.contains("open")) renderSheet();
  }
  function qtyEl(l) {
    return h("div", { "class": "qty" }, [
      h("button", { type: "button", "aria-label": "Менше", onclick: function () { changeQty(l.p.slug, l.size, -1); } }, ["−"]),
      h("span", {}, [String(l.qty)]),
      h("button", { type: "button", "aria-label": "Більше", onclick: function () { changeQty(l.p.slug, l.size, 1); } }, ["+"])
    ]);
  }
  function renderSheet() {
    var L = lines();
    sheetLines.innerHTML = "";
    if (!L.length) sheetLines.appendChild(h("p", { "class": "empty" }, ["Кошик порожній. Оберіть каву в каталозі."]));
    L.forEach(function (l) {
      sheetLines.appendChild(h("div", { "class": "line" }, [
        h("div", {}, [h("div", { "class": "n" }, [l.p.country + " " + l.p.name]), h("div", { "class": "m" }, [l.size + " · " + money(l.unit)])]),
        h("div", { "class": "sum" }, [money(l.sum)]),
        qtyEl(l)
      ]));
    });
    sheetTotal.hidden = sheetGo.hidden = !L.length;
    sheetTotal.innerHTML = "";
    sheetTotal.appendChild(h("span", {}, ["Разом"])); sheetTotal.appendChild(h("span", {}, [money(total())]));
  }
  function openSheet() { renderSheet(); sheet.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeSheet() { sheet.classList.remove("open"); document.body.style.overflow = ""; }

  /* ---------- chrome: header, cart sheet, footer ---------- */
  function buildChrome() {
    var mob = h("nav", { "class": "mobnav", "aria-label": "Меню" }, [
      h("a", { href: "/#catalog" }, ["Кава"]), h("a", { href: "/about.html" }, ["Про NAMI"]), h("a", { href: "/info.html" }, ["Доставка та контакти"])
    ]);
    var menuBtn = h("button", { "class": "menubtn", type: "button", "aria-expanded": "false", onclick: function () {
      var on = !mob.classList.contains("open"); mob.classList.toggle("open", on); menuBtn.setAttribute("aria-expanded", on ? "true" : "false");
      menuBtn.textContent = on ? "Закрити" : "Меню";
    } }, ["Меню"]);
    mob.addEventListener("click", function () { mob.classList.remove("open"); menuBtn.textContent = "Меню"; });
    cntEl = h("span", { "class": "cnt", "data-n": "0" }, ["0"]);
    var cartBtn = h("button", { "class": "cartbtn", type: "button", "aria-label": "Відкрити кошик", onclick: openSheet }, ["Кошик", cntEl]);
    var hdr = h("header", { "class": "hdr" }, [
      h("a", { "class": "logo", href: "/", "aria-label": "NAMI — на головну" },[S.logo ? h("img", { "class": "logoimg", src: S.logo, alt: S.brand || "NAMI" }) : (S.brand || "NAMI")]),
      h("nav", { "class": "nav", "aria-label": "Головне меню" }, [
        h("a", { href: "/#catalog" }, ["Кава"]), h("a", { href: "/about.html" }, ["Про NAMI"]), h("a", { href: "/info.html" }, ["Доставка та контакти"])
      ]),
      h("div", { "class": "hdr-r" }, [cartBtn, menuBtn])
    ]);
    byId("hdr").appendChild(hdr); byId("hdr").appendChild(mob);

    sheetLines = h("div"); sheetTotal = h("div", { "class": "total" });
    sheetGo = h("a", { "class": "btn solid", href: "/checkout.html", style: "width:100%" }, ["Оформити замовлення"]);
    sheet = h("div", { "class": "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Кошик" }, [
      h("div", { "class": "sheet-bg", onclick: closeSheet }),
      h("div", { "class": "panel" }, [
        h("header", {}, [h("h3", {}, ["Кошик"]), h("button", { "class": "close", type: "button", onclick: closeSheet }, ["Закрити"])]),
        sheetLines, sheetTotal, sheetGo
      ])
    ]);
    document.body.appendChild(sheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

    var ig = String(S.instagram || "").replace(/^@/, "");
    byId("ftr").appendChild(h("footer", { "class": "ftr" }, [h("div", { "class": "wrap" }, [
      h("p", { "class": "closing" }, [S.closing || ""]),
      h("div", { "class": "links" }, [
        h("a", { href: "https://t.me/" + tg(), target: "_blank", rel: "noopener" }, ["Telegram @" + tg()]),
        ig ? h("a", { href: "https://instagram.com/" + ig, target: "_blank", rel: "noopener" }, ["Instagram @" + ig]) : null,
        h("a", { href: "/about.html" }, ["Про NAMI"]), h("a", { href: "/info.html" }, ["Доставка та оплата"])
      ]),
      h("small", {}, [S.footer || ""])
    ])]));
    refreshCart();
  }

  /* ---------- waves (canvas) ---------- */
  function fit(c) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, hh = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
    var ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
  }
  function drawLayers(ctx, W, H, layers, t, extra) {
    layers.forEach(function (l, i) {
      var step = 8, x, y, a = l.a * H;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (x = 0; x <= W + step; x += step) {
        y = l.b * H + Math.sin(x / W * Math.PI * 2 * l.f + l.ph + t * l.sp) * a + Math.sin(x / W * Math.PI * 2 * l.f * 2.3 + l.ph * 1.7 - t * l.sp * 1.4) * a * l.x;
        if (extra) y += extra(x, i);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.globalAlpha = l.al; ctx.fillStyle = l.c; ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function artLayers(wave, seed) {
    var cols = (wave && wave.colors) || ["#3A4A78", "#6F7F9E", "#A5694B", "#C9A57A"], n = cols.length, amp = (wave && wave.amp) || 14, fr = (wave && wave.freq) || 1.4;
    var turb = amp > 20, out = [], i;
    for (i = 0; i < n; i++) out.push({ b: .47 + i * (.37 / Math.max(1, n - 1)), a: amp / 300, f: fr, ph: seed * 1.9 + i * 1.3, x: turb ? .5 : .15, sp: (turb ? .9 : .3) * (1 + i * .25), c: okColor(cols[i]), al: .92 });
    return out;
  }
  function waveCanvas(wave, bg, seed, live) {
    var cv = h("canvas", { "class": "art", role: "img", "aria-label": "Хвиля кави" });
    var layers = artLayers(wave, seed), raf = 0, t0 = 0, base = seed, cur = seed;
    function draw(t) {
      var W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
      var ctx = fit(cv); ctx.fillStyle = okColor(bg); ctx.fillRect(0, 0, W, H); drawLayers(ctx, W, H, layers, t);
    }
    function loop(now) { cur = base + (now - t0) / 1000; draw(cur); raf = requestAnimationFrame(loop); }
    function start() { if (!raf && !reduce) { t0 = performance.now(); raf = requestAnimationFrame(loop); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; base = cur; } }
    if (live) { setTimeout(start, 50); } else { cv.addEventListener("pointerenter", start); cv.addEventListener("pointerleave", stop); }
    if (window.ResizeObserver) new ResizeObserver(function () { if (!raf) draw(base); }).observe(cv); else setTimeout(function () { draw(base); }, 60);
    return cv;
  }
  function art(p, live) {
    if (p.photo) return h("img", { "class": "art", src: p.photo, alt: p.country + " " + p.name + " — хвиля", loading: "lazy" });
    return waveCanvas(p.wave, BG[p.tier] || BG.espresso, (p.slug.length % 7) + 1, live);
  }

  /* ---------- water (WebGL) ---------- */
  /* Вода зверху: шейдер WebGL. Один відтінок синього, світло лише на гребінцях. */
  var WATER_FS = [
  "#ifdef GL_FRAGMENT_PRECISION_HIGH", "precision highp float;", "#else", "precision mediump float;", "#endif",
  "uniform vec2 uRes; uniform float uTime; uniform float uNow; uniform vec4 uRip[6]; uniform float uFine; uniform float uGlow; uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uHi;",
  "float ripple(vec2 uv) {",
    "  float s = 0.0;",
    "  for (int i = 0; i < 6; i++) {",
    "    vec4 rp = uRip[i]; float age = uNow - rp.z;",
    "    if (rp.w > 0.0 && age > 0.0 && age < 4.5) {",
    "      float front = length(uv - rp.xy) - age * 0.30;",
    "      s += rp.w * exp(-age * 0.8) * exp(-front * front * 70.0) * sin(front * 34.0) * 0.22;",
    "    }",
    "  }",
    "  return s;",
    "}",
    "float hgt(vec2 p, float t) {",
  "  p += 0.22 * vec2(sin(p.y * 2.1 + t * 0.21), cos(p.x * 1.7 - t * 0.17));",
  "  float h = 0.0;",
  "  for (int i = 0; i < 8; i++) {",
  "    float fi = float(i); float ang = fi * 1.37 + 0.4; vec2 d = vec2(cos(ang), sin(ang));",
  "    float k = 3.0 + fi * 3.4; float w = 0.45 + fi * 0.16;",
  "    float amp = 1.0 / pow(k, 1.45 - uFine * 0.7);",
  "    h += sin(dot(p, d) * k + t * w + fi * 2.1) * amp;",
  "  }",
  "  return h;",
  "}",
  "void main() {",
  "  vec2 uv = gl_FragCoord.xy / uRes.y; vec2 p = uv * 2.6; float t = uTime;",
  "  float e = 0.003;",
  "  float h0 = hgt(p, t), hx = hgt(p + vec2(e, 0.0), t), hy = hgt(p + vec2(0.0, e), t);",
  "  h0 += ripple(uv); hx += ripple(uv + vec2(e / 2.6, 0.0)); hy += ripple(uv + vec2(0.0, e / 2.6));",
    "  vec3 n = normalize(vec3(-(hx - h0) / e * 0.32, -(hy - h0) / e * 0.32, 1.0));",
  "  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));",
  "  float diff = clamp(dot(n, L), 0.0, 1.0);",
  "  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0);",
  "  vec3 col = mix(uDeep, uMid, pow(diff, 2.2) * 1.5);",
  "  float y = gl_FragCoord.y / uRes.y; float x = gl_FragCoord.x / uRes.x;",
  "  float calm = 1.0 - 0.55 * smoothstep(0.62, 0.30, abs(y - 0.5) * 1.6 + 0.0) ;",
  "  col += uHi * spec * uGlow * (0.45 + 0.55 * calm);",
  "  float band = smoothstep(0.16, 0.32, y) * (1.0 - smoothstep(0.58, 0.76, y));",
  "  col = mix(col, mix(uDeep, col, 0.45), band * 0.7);",
  "  float vig = smoothstep(1.15, 0.2, length(vec2(x - 0.5, (y - 0.5) * 0.75)));",
  "  col *= 0.55 + 0.45 * vig;",
  "  gl_FragColor = vec4(col, 1.0);",
  "}"
  ].join("\n");
  function initWater(cv, opt) {
    var gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) || cv.getContext("experimental-webgl");
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"), fs = sh(gl.FRAGMENT_SHADER, WATER_FS);
    if (!vs || !fs) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ["uRes", "uTime", "uNow", "uRip", "uFine", "uGlow", "uDeep", "uMid", "uHi"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    var o = opt || {}, zero = new Float32Array(24);
    gl.uniform1f(U.uFine, o.fine == null ? .5 : o.fine); gl.uniform1f(U.uGlow, o.glow == null ? .5 : o.glow);
    gl.uniform3fv(U.uDeep, o.deep || [.047, .063, .102]); gl.uniform3fv(U.uMid, o.mid || [.16, .21, .35]); gl.uniform3fv(U.uHi, o.hi || [.62, .68, .80]);
    return {
      render: function (t, now, rips) {
        var s = Math.min(window.devicePixelRatio || 1, 2) * (o.scale || .7), w = Math.max(2, Math.round(cv.clientWidth * s)), h = Math.max(2, Math.round(cv.clientHeight * s));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        gl.viewport(0, 0, w, h); gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uNow, now || 0); gl.uniform4fv(U.uRip, rips || zero);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  /* ---------- home ---------- */
  /* Гірські хвилі: один відтінок, багато шарів. Далекі шари світліші й м'якші, ближні темніші. */
  var RIDGES = [
    { b: .60, a: .100, f: 1.15, ph: .4, sp: .050, c: [78, 94, 128], al: .42, ln: .20 },
    { b: .67, a: .097, f: 1.40, ph: 2.1, sp: .068, c: [62, 78, 112], al: .55, ln: .17 },
    { b: .74, a: .09, f: 1.70, ph: 3.7, sp: .088, c: [46, 60, 92], al: .72, ln: .14 },
    { b: .81, a: .08, f: 2.00, ph: 5.2, sp: .110, c: [31, 42, 68], al: .88, ln: .11 },
    { b: .89, a: .065, f: 2.40, ph: 1.0, sp: .135, c: [19, 26, 38], al: 1, ln: .08 }
  ];
  function ridge(u) { var s = Math.sin(u), s2 = Math.sin(u * 2.13 + 1.3), s3 = Math.sin(u * .47 + .6); return (1 - Math.sqrt(s * s + .035)) * .78 + (1 - Math.sqrt(s2 * s2 + .06)) * .22 + s3 * .25; }
  function drawRidges(ctx, W, H, t, rise, lift, px, sc) {
    var bgc = "19,26,38";
    RIDGES.forEach(function (l, i) {
      var step = 6, x, y, a = l.a * H * (1 + sc * .6), top = H, pts = [];
      for (x = 0; x <= W + step; x += step) {
        var u = x / W * Math.PI * 2 * l.f + l.ph + t * l.sp * 6.2832;
        y = l.b * H - ridge(u) * a + rise;
        var d = (x - px) / (W * .22); y -= lift * H * .06 * Math.exp(-d * d) * (1 - i * .15);
        pts.push(x, y); if (y < top) top = y;
      }
      var g = ctx.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, "rgba(" + l.c.join(",") + "," + l.al + ")"); g.addColorStop(1, "rgba(" + bgc + "," + Math.min(1, l.al + .1) + ")");
      ctx.beginPath(); ctx.moveTo(0, H);
      for (var k = 0; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath();
      for (k = 0; k < pts.length; k += 2) { if (k) ctx.lineTo(pts[k], pts[k + 1]); else ctx.moveTo(pts[k], pts[k + 1]); }
      ctx.strokeStyle = "rgba(237,227,214," + l.ln + ")"; ctx.lineWidth = 1; ctx.stroke();
    });
  }
  function heroEl() {
    var h1 = h("h1", {}, []);
    String(S.heroTitle || "").split(" ").forEach(function (w, i) { h1.appendChild(h("span", { "class": "w" }, [h("span", { "class": "wi", style: "--i:" + i }, [w])])); });
    var cv = h("canvas", { "aria-hidden": "true" }), hint = h("div", { "class": "hero-hint" }, [S.heroHint || ""]);
    var el = h("header", { "class": "hero" }, [cv, h("div", { "class": "hero-top" }, [h("span", {}, [S.season || ""])]),
      h("div", { "class": "hero-main" }, [h1, h("p", {}, [S.heroText || ""])]), hint]);
    var t0 = performance.now(), water = initWater(cv, { fine: .55, glow: .30, scale: .6, mid: [.12, .17, .28] }), running = true;
    if (!water) { var nc = h("canvas", { "aria-hidden": "true" }); cv.parentNode.replaceChild(nc, cv); cv = nc; }
    var px = 0, strength = 0, rips = new Float32Array(24), ri = 0, lx = -999, ly = -999, lt = 0;
    function drop(x, y, w) {
      var r = el.getBoundingClientRect(), W = r.width || 1, H = r.height || 1;
      rips[ri * 4] = (x - r.left) / H; rips[ri * 4 + 1] = 1 - (y - r.top) / H; rips[ri * 4 + 2] = (performance.now() - t0) / 1000; rips[ri * 4 + 3] = w;
      ri = (ri + 1) % 6; px = x - r.left; strength = Math.min(1, strength + .35); hint.classList.add("gone");
    }
    function touch(e, w, force) {
      var p = (e.touches && e.touches[0]) || e, now = performance.now(), dx = p.clientX - lx, dy = p.clientY - ly;
      if (force || dx * dx + dy * dy > 900 || now - lt > 260) { lx = p.clientX; ly = p.clientY; lt = now; drop(p.clientX, p.clientY, w); }
    }
    el.addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") touch(e, .8, false); });
    el.addEventListener("pointerdown", function (e) { if (e.pointerType !== "touch") touch(e, 1.1, true); });
    el.addEventListener("touchstart", function (e) { touch(e, 1.1, true); }, { passive: true });
    el.addEventListener("touchmove", function (e) { touch(e, .9, false); }, { passive: true });
    function ease(x) { return 1 - Math.pow(1 - x, 3); }
    function draw(now) {
      var t = (now - t0) / 1000;
      if (water) {
        water.render(reduce ? 6 : 6 + t * .55 + window.scrollY * .002, t, reduce ? null : rips);
      } else {
        var ctx = fit(cv), W = cv.clientWidth, H = cv.clientHeight;
        if (W && H) {
          ctx.clearRect(0, 0, W, H);
          var rise = reduce ? 0 : (1 - ease(Math.min(1, t / 2.6))) * H * .5, sc = Math.min(1, window.scrollY / Math.max(1, H));
          drawRidges(ctx, W, H, reduce ? 4 : t + window.scrollY * .004, rise, strength, px, sc);
        }
      }
      strength *= .95;
      if (!reduce && running) requestAnimationFrame(draw);
    }
    if (window.IntersectionObserver) new IntersectionObserver(function (en) {
      var vis = en[0].isIntersecting; if (vis && !running && !reduce) { running = true; requestAnimationFrame(draw); } else if (!vis) running = false;
    }).observe(el);
    requestAnimationFrame(draw);
    return el;
  }
  function card(p) {
    var url = "/coffee.html?c=" + encodeURIComponent(p.slug);
    var prices = h("div", { "class": "prices" }, (p.prices || []).map(function (pr) {
      var plus = h("span", { "class": "plus", "aria-hidden": "true" }, ["+"]);
      var b = h("button", { "class": "pricebtn", type: "button", "aria-label": "Додати в кошик: " + p.country + " " + p.name + ", " + pr.size + ", " + pr.price + " гривень", onclick: function () {
        addToCart(p.slug, pr.size, 1); b.classList.add("added"); plus.textContent = "Додано";
        setTimeout(function () { b.classList.remove("added"); plus.textContent = "+"; }, 1400);
      } }, [h("span", { "class": "s" }, [pr.size]), h("span", { "class": "a" }, [money(pr.price)]), plus]);
      return b;
    }));
    return h("article", { "class": "card" }, [
      h("a", { "class": "artlink", href: url, "aria-label": p.country + " " + p.name }, [art(p, false)]),
      h("p", { "class": "origin" }, [p.country]),
      h("h3", { "class": "cname" }, [h("a", { href: url }, [p.name])]),
      h("p", { "class": "proc" }, [p.process || ""]),
      h("p", { "class": "notes" }, [p.notes || ""]),
      prices
    ]);
  }
  function reveal(root) {
    var cards = root.querySelectorAll(".card");
    if (!("IntersectionObserver" in window)) { cards.forEach(function (c) { c.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    cards.forEach(function (c, i) { c.style.transitionDelay = (i % 3) * 90 + "ms"; io.observe(c); });
  }
  function tierItems(id) { return P.filter(function (p) { return p.tier === id && p.available !== false; }); }
  function renderHome(main) {
    main.appendChild(heroEl());
    main.appendChild(h("section", { "class": "s", "aria-labelledby": "tz" }, [h("div", { "class": "wrap" }, [
      h("div", { "class": "kanji", "aria-hidden": "true" }, [S.teaserKanji || ""]),
      h("h2", { "class": "page", id: "tz" }, [S.teaserTitle || ""]),
      h("div", { "class": "prose" }, [h("p", {}, [S.teaserText || ""])]),
      h("a", { "class": "link", href: "/about.html" }, ["Про NAMI →"])
    ])]));
    var tiers = S.tiers || [], active = 0;
    var menu = h("section", { "class": "menu", id: "catalog", "data-tier": (tiers[0] || {}).id || "espresso", "aria-label": S.catalogTitle || "Каталог" });
    var lede = h("p", { "class": "lede" }, [(tiers[0] || {}).lede || ""]);
    var gridWrap = h("div");
    function fill(i) { gridWrap.innerHTML = ""; var g = h("div", { "class": "grid" }, tierItems(tiers[i].id).map(card)); gridWrap.appendChild(g); reveal(g); }
    var tabs = h("div", { "class": "tabs", role: "tablist" }, tiers.map(function (t, i) {
      return h("button", { "class": "tab", type: "button", role: "tab", "aria-selected": i === 0 ? "true" : "false", onclick: function () {
        if (i === active) return; active = i;
        tabs.querySelectorAll(".tab").forEach(function (b, j) { b.setAttribute("aria-selected", j === i ? "true" : "false"); });
        menu.setAttribute("data-tier", t.id);
        var cur = gridWrap.firstChild; if (cur) cur.classList.add("swap");
        setTimeout(function () { lede.textContent = t.lede || ""; fill(i); }, reduce ? 0 : 280);
      } }, [t.title]);
    }));
    menu.appendChild(h("div", { "class": "wrap" }, [tabs, lede, h("p", { "class": "hint" }, [S.catalogHint || ""]), gridWrap]));
    main.appendChild(menu);
    if (tiers.length) fill(0);
    if (location.hash === "#catalog") setTimeout(function () { menu.scrollIntoView(); }, 50);
  }

  /* ---------- product page ---------- */
  function renderProduct(main) {
    var slug = new URLSearchParams(location.search).get("c"), p = product(slug);
    if (!p || p.available === false) {
      main.appendChild(h("div", { "class": "thanks" }, [h("h1", {}, ["Такої кави немає"]), h("p", {}, ["Можливо, вона вже закінчилась."]), h("a", { "class": "btn dark", href: "/#catalog" }, ["До каталогу"])]));
      return;
    }
    document.title = p.country + " " + p.name + " — " + (S.brand || "NAMI");
    var sel = 0, qn = 1;
    var sizeBtns = (p.prices || []).map(function (pr, k) {
      return h("button", { "class": "sizebtn", type: "button", "aria-pressed": k === 0 ? "true" : "false", onclick: function () {
        sel = k; sizeBtns.forEach(function (b, j) { b.setAttribute("aria-pressed", j === k ? "true" : "false"); });
      } }, [h("span", { "class": "s" }, [pr.size]), h("span", { "class": "a" }, [money(pr.price)])]);
    });
    var qv = h("span", {}, ["1"]);
    var qty = h("div", { "class": "qty" }, [
      h("button", { type: "button", "aria-label": "Менше", onclick: function () { qn = Math.max(1, qn - 1); qv.textContent = qn; } }, ["−"]), qv,
      h("button", { type: "button", "aria-label": "Більше", onclick: function () { qn = Math.min(20, qn + 1); qv.textContent = qn; } }, ["+"])
    ]);
    var add = h("button", { "class": "btn solid grow", type: "button", onclick: function () {
      var pr = p.prices[sel]; addToCart(p.slug, pr.size, qn); add.textContent = "Додано"; setTimeout(function () { add.textContent = "Додати в кошик"; }, 1500);
    } }, ["Додати в кошик"]);
    var spec = [["Обробка", p.process], ["Сорт", p.variety], ["Висота", p.altitude]].filter(function (r) { return r[1]; });
    var info = h("div", {}, [
      h("p", { "class": "origin" }, [p.country]), h("h1", {}, [p.name]), h("p", { "class": "proc" }, [p.process || ""]),
      h("p", { "class": "notes", style: "margin-top:14px;font-size:16px" }, [p.notes || ""]),
      spec.length ? h("dl", { "class": "spec" }, spec.reduce(function (a, r) { a.push(h("dt", {}, [r[0]]), h("dd", {}, [r[1]])); return a; }, [])) : null,
      h("div", { "class": "prose" }, paras(p.description)),
      h("div", { "class": "sizes" }, sizeBtns), h("div", { "class": "buy" }, [qty, add]),
      h("p", { "class": "fine", style: "margin-top:16px" }, [(p.tier === "espresso" ? "Профіль для еспресо. " : "Профіль для фільтра. ") + "Відправляємо Новою поштою."])
    ]);
    main.appendChild(h("div", { "class": "pdp" }, [h("a", { "class": "back", href: "/#catalog" }, ["← До каталогу"]), art(p, true), info]));
  }

  /* ---------- static pages ---------- */
  function renderAbout(main) {
    main.appendChild(h("section", { "class": "s" }, [h("div", { "class": "narrow" }, [
      h("div", { "class": "kanji", "aria-hidden": "true" }, [S.aboutKanji || ""]), h("h1", { "class": "page" }, [S.aboutTitle || ""]),
      h("div", { "class": "prose" }, paras(S.aboutText)), h("a", { "class": "btn dark", href: "/#catalog" }, ["До каталогу"])
    ])]));
  }
  function renderInfo(main) {
    var ig = String(S.instagram || "").replace(/^@/, "");
    function block(t, txt) { return h("div", { "class": "info-block" }, [h("h2", {}, [t])].concat(paras(txt))); }
    main.appendChild(h("section", { "class": "s" }, [h("div", { "class": "narrow" }, [
      h("h1", { "class": "page" }, [S.infoTitle || ""]),
      block(S.deliveryTitle, S.deliveryText), block(S.paymentTitle, S.paymentText),
      h("div", { "class": "info-block" }, [h("h2", {}, [S.contactTitle || "Контакти"]), h("div", { "class": "contact-links" }, [
        h("a", { href: "https://t.me/" + tg(), target: "_blank", rel: "noopener" }, ["@" + tg()]),
        ig ? h("a", { href: "https://instagram.com/" + ig, target: "_blank", rel: "noopener" }, ["@" + ig]) : null
      ])])
    ])]));
  }

  /* ---------- checkout ---------- */
  function renderCheckout(main) {
    var L = lines();
    if (!L.length) {
      main.appendChild(h("div", { "class": "thanks" }, [h("h1", {}, ["Кошик порожній"]), h("p", {}, ["Оберіть каву в каталозі, і вона з’явиться тут."]), h("a", { "class": "btn dark", href: "/#catalog" }, ["До каталогу"])]));
      return;
    }
    var form = lsGet(FORM_KEY) || { name: "", phone: "", city: "", branch: "", comment: "" };
    function fld(id, label, type, ac, area) {
      var inp = h(area ? "textarea" : "input", { id: "f-" + id, type: area ? null : type, rows: area ? "2" : null, autocomplete: ac, name: id });
      inp.value = form[id] || ""; inp.addEventListener("input", function () { form[id] = inp.value; lsSet(FORM_KEY, form); });
      return h("div", { "class": "fld" }, [h("label", { "for": "f-" + id }, [label]), inp]);
    }
    var err = h("p", { "class": "err", role: "alert" }), box = h("div", { "class": "sum-box" });
    function renderSum() {
      var cur = lines(); box.innerHTML = "";
      cur.forEach(function (l) {
        box.appendChild(h("div", { "class": "line" }, [
          h("div", {}, [h("div", { "class": "n" }, [l.p.country + " " + l.p.name]), h("div", { "class": "m" }, [l.size + " · " + money(l.unit)])]),
          h("div", { "class": "sum" }, [money(l.sum)]), qtyEl(l)
        ]));
      });
      box.appendChild(h("div", { "class": "total" }, [h("span", {}, ["Разом"]), h("span", {}, [money(total())])]));
      if (!cur.length) location.reload();
    }
    var _refresh = refreshCart; refreshCart = function () { _refresh(); renderSum(); };
    function valid() {
      var miss = [];
      if (form.name.trim().length < 2) miss.push("ім’я");
      if (form.phone.replace(/\D/g, "").length < 9) miss.push("телефон");
      if (!form.city.trim()) miss.push("місто");
      if (!form.branch.trim()) miss.push("відділення Нової пошти");
      if (miss.length) { err.textContent = "Вкажіть: " + miss.join(", ") + "."; return false; }
      err.textContent = ""; return true;
    }
    function orderText() {
      var cur = lines();
      return "Замовлення NAMI\n" + cur.map(function (l, i) { return (i + 1) + ". " + l.p.country + " " + l.p.name + ", " + l.size + " × " + l.qty + " = " + money(l.sum); }).join("\n") +
        "\nРазом: " + money(total()) + "\n\nДоставка: Нова пошта\nОтримувач: " + form.name.trim() + "\nТелефон: " + form.phone.trim() + "\nМісто: " + form.city.trim() +
        "\nВідділення/поштомат: " + form.branch.trim() + (form.comment.trim() ? "\nКоментар: " + form.comment.trim() : "");
    }
    var canCard = S.payCard !== false, canCod = S.payCod !== false;
    if (!canCard && !canCod) canCod = true;
    var method = canCard ? "card" : "cod";
    var fine = h("p", { "class": "fine" });
    var payBtn = h("button", { "class": "btn solid", type: "button", style: "width:100%", onclick: submit });
    function sync() {
      payBtn.textContent = method === "card" ? "Оплатити карткою" : "Підтвердити замовлення";
      fine.textContent = method === "card"
        ? "Оплата проходить на захищеній сторінці Monobank. Дані картки ми не отримуємо."
        : "Оплата при отриманні на відділенні Нової пошти. Комісія Нової пошти за накладений платіж діє за тарифами перевізника. Після оформлення ми напишемо вам для підтвердження.";
    }
    function opt(val, label) {
      var inp = h("input", { type: "radio", name: "paym", value: val });
      inp.checked = method === val;
      inp.addEventListener("change", function () { method = val; sync(); });
      return h("label", { "class": "pm" }, [inp, h("span", {}, [label])]);
    }
    var pays = (canCard && canCod) ? h("div", { "class": "pays", role: "radiogroup", "aria-label": "Спосіб оплати" }, [opt("card", "Оплата карткою онлайн"), opt("cod", "Накладений платіж (оплата при отриманні)")]) : null;
    function submit() {
      if (!valid()) return;
      var cod = method === "cod";
      payBtn.disabled = true; payBtn.textContent = cod ? "Відправляємо замовлення…" : "Створюємо оплату…";
      var body = { method: method, items: lines().map(function (l) { return { slug: l.p.slug, size: l.size, qty: l.qty }; }), customer: { name: form.name.trim(), phone: form.phone.trim(), city: form.city.trim(), branch: form.branch.trim(), comment: form.comment.trim() } };
      fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (x.ok && cod && x.j.orderId) { var id = x.j.orderId; clearCart(); location.href = "/thanks?o=" + encodeURIComponent(id) + "&m=cod"; }
          else if (x.ok && x.j.pageUrl) { location.href = x.j.pageUrl; }
          else { throw new Error("fail"); }
        })
        .catch(function () {
          payBtn.disabled = false; sync();
          err.textContent = cod
            ? "Не вдалося надіслати замовлення. Спробуйте ще раз або напишіть нам у Telegram @" + tg() + "."
            : "Оплата карткою зараз недоступна." + (canCod ? " Оберіть накладений платіж або напишіть нам у Telegram @" + tg() + "." : " Напишіть нам у Telegram @" + tg() + ".");
        });
    }
    main.appendChild(h("div", { "class": "co" }, [h("h1", {}, ["Оформлення"]),
      h("div", { "class": "form" }, [h("h2", {}, ["Доставка Новою поштою"]),
        fld("name", "Ім’я та прізвище отримувача", "text", "name"), fld("phone", "Телефон", "tel", "tel"), fld("city", "Місто", "text", "address-level2"),
        fld("branch", "Відділення або поштомат Нової пошти (номер)", "text", "off"), fld("comment", "Коментар до замовлення (за бажанням)", "text", "off", true),
        pays, err, h("div", { "class": "actions" }, [payBtn]), fine]),
      h("div", {}, [box])]));
    sync();
    renderSum();
  }

  /* ---------- thanks ---------- */
  function renderThanks(main) {
    var qs = new URLSearchParams(location.search), o = qs.get("o") || "";
    if (qs.get("m") === "cod" && o) {
      main.appendChild(h("div", { "class": "thanks" }, [h("h1", {}, ["Дякуємо, замовлення прийнято"]),
        h("p", {}, ["Номер замовлення: " + o + ". Ми вже отримали його й скоро напишемо вам для підтвердження. Оплата при отриманні на відділенні Нової пошти."]),
        h("a", { "class": "btn dark", href: "/#catalog" }, ["До каталогу"])]));
      clearCart();
      return;
    }
    var title = h("h1", {}, ["Перевіряємо оплату…"]), text = h("p", {}, ["Це займе кілька секунд."]);
    main.appendChild(h("div", { "class": "thanks" }, [title, text, h("a", { "class": "btn dark", href: "/#catalog" }, ["До каталогу"])]));
    var tries = 0;
    function poll() {
      tries++;
      fetch("/api/order?o=" + encodeURIComponent(o), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.status === "paid") { title.textContent = "Дякуємо, оплату отримано"; text.textContent = "Ми вже бачимо ваше замовлення й напишемо вам у Telegram або за номером телефону, який ви вказали."; clearCart(); return; }
        again();
      }).catch(again);
    }
    function again() {
      if (tries < 8) return setTimeout(poll, 3000);
      title.textContent = "Дякуємо за замовлення";
      text.textContent = "Якщо оплата пройшла, ми скоро її побачимо й напишемо вам. Якщо щось пішло не так, напишіть нам у Telegram @" + tg() + ".";
    }
    if (o) poll(); else again();
  }

  /* ---------- boot ---------- */
  Promise.all([load("/content/site.json"), load("/content/products.json")]).then(function (r) {
    S = r[0] || {}; P = (r[1] && r[1].items) || [];
    buildChrome();
    var main = byId("main"); main.innerHTML = "";
    ({ home: renderHome, coffee: renderProduct, about: renderAbout, info: renderInfo, checkout: renderCheckout, thanks: renderThanks }[page] || renderHome)(main);
    refreshCart();
  }).catch(function () {
    byId("main").innerHTML = "";
    byId("main").appendChild(h("div", { "class": "thanks" }, [h("h1", {}, ["Сайт тимчасово недоступний"]), h("p", {}, ["Спробуйте оновити сторінку."])]));
  });
})();
