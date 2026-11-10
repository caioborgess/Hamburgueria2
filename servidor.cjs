/* Node 24+. Sirva somente dist/ ao público. A base fica fora da pasta do site. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

const board = require("./balcao.cjs");
const paymentsReady = Boolean(
  process.env.MP_ACCESS_TOKEN &&
    process.env.MP_WEBHOOK_SECRET &&
    process.env.BALCAO_PASSWORD?.length >= 16,
);
const root = path.join(__dirname, "dist");
const token = process.env.MP_ACCESS_TOKEN;
const origin = process.env.PUBLIC_ORIGIN;
if (
  token &&
  (!origin || !/^https:\/\//.test(origin) || new URL(origin).origin !== origin)
)
  throw Error(
    "Configure PUBLIC_ORIGIN com a origem HTTPS pública, sem barra final.",
  );
const context = vm.createContext({ window: {}, crypto: crypto.webcrypto });
for (const file of ["data.js", "script.js"])
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
const catalog = context.window.BRASA_DATA;
const core = context.window.BrasaCore;
let db;
if (token) {
  db = new DatabaseSync(
    process.env.ORDER_DB_PATH || path.join(__dirname, "pedidos.sqlite"),
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, chave TEXT UNIQUE, resumo TEXT NOT NULL, centavos INTEGER NOT NULL, checkout TEXT, estado TEXT DEFAULT 'pendente', criado TEXT DEFAULT CURRENT_TIMESTAMP)",
  );
  board.migrate(db);
}

function reply(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
async function mercado(endpoint, body) {
  const response = await fetch("https://api.mercadopago.com" + endpoint, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error("Falha na comunicação com Mercado Pago.");
  return response.json();
}
function quote(input) {
  if (
    !["pickup", "delivery"].includes(input.fulfillment) ||
    (input.fulfillment === "delivery" && !catalog.deliveryVerified) ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 80 ||
    !Array.isArray(input.cart) ||
    !input.cart.length ||
    input.cart.length > 50
  )
    return null;
  const customer = { ...input, customerName: input.name };
  if (core.validateCustomer(customer)) return null;
  const fee = core.deliveryFee(customer);
  const items = [];
  const details = [];
  for (const raw of input.cart) {
    const item = core.normalizeItem(raw);
    if (
      !item ||
      item.quantity !== raw.quantity ||
      !Array.isArray(raw.extras) ||
      !Array.isArray(raw.removed) ||
      item.extras.length !== raw.extras.length ||
      item.removed.length !== raw.removed.length
    )
      return null;
    const product = catalog.products.find((p) => p.id === item.productId);
    items.push({
      id: product.id,
      title: product.name,
      quantity: item.quantity,
      currency_id: "BRL",
      unit_price: core.unitPrice(item) / 100,
    });
    details.push({ ...item, id: undefined });
  }
  if (fee > 0)
    items.push({
      id: "delivery",
      title: "Taxa de entrega",
      quantity: 1,
      currency_id: "BRL",
      unit_price: fee / 100,
    });
  return {
    items,
    total: core.total(details) + fee,
    summary: core.buildMessage(details, customer),
    slip: core.orderSlip(details, customer),
  };
}
const active = new Set();
async function checkout(req, res) {
  if (!paymentsReady)
    return reply(res, 503, { error: "Pagamento em demonstração." });
  if (
    req.headers.origin !== origin ||
    !/^application\/json\b/.test(req.headers["content-type"] || "")
  )
    return reply(res, 403, {});
  let text = "",
    bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 65536) return reply(res, 413, {});
    text += chunk.toString("latin1");
  }
  let input;
  try {
    input = JSON.parse(Buffer.from(text, "latin1").toString("utf8"));
  } catch {
    return reply(res, 400, {});
  }
  if (!input || !/^[a-f\d-]{36}$/i.test(input.key || ""))
    return reply(res, 400, {});
  const q = quote(input);
  if (!q || q.total !== input.expected)
    return reply(res, 409, {
      error: "Confira o pedido e os preços antes de continuar.",
    });
  if (active.has(input.key))
    return reply(res, 409, { error: "Aguarde a criação do pagamento." });
  active.add(input.key);
  try {
    db.prepare(
      "INSERT OR IGNORE INTO pedidos(id,chave,resumo,centavos,ficha) VALUES(?,?,?,?,?)",
    ).run(
      crypto.randomUUID(),
      input.key,
      q.summary,
      q.total,
      JSON.stringify(q.slip),
    );
    const row = db
      .prepare("SELECT * FROM pedidos WHERE chave=?")
      .get(input.key);
    if (row.resumo !== q.summary || row.centavos !== q.total)
      return reply(res, 409, { error: "Revise o pedido novamente." });
    const tracking = "/pagamento/" + row.id;
    if (row.checkout) return reply(res, 200, { url: row.checkout, tracking });
    const back = origin + "/pagamento/" + row.id;
    const pref = await mercado("/checkout/preferences", {
      items: q.items,
      external_reference: row.id,
      notification_url:
        origin + "/api/notificacoes/mercado-pago?source_news=webhooks",
      back_urls: { success: back, pending: back, failure: back },
      auto_return: "approved",
    });
    const url = new URL(pref.init_point);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname)
    )
      throw Error("Checkout inesperado");
    db.prepare("UPDATE pedidos SET checkout=? WHERE id=?").run(
      url.href,
      row.id,
    );
    reply(res, 200, { url: url.href, tracking });
  } finally {
    active.delete(input.key);
  }
}
async function refreshStatus(row) {
  const id = row.id;
  const payments = await mercado(
    "/v1/payments/search?sort=date_created&criteria=desc&external_reference=" +
      encodeURIComponent(id),
  );
  const matches = payments.results.filter(
    (p) =>
      p.external_reference === id &&
      p.currency_id === "BRL" &&
      Math.round(p.transaction_amount * 100) === row.centavos,
  );
  const paid = matches.some(
    (p) => p.status === "approved" && !(p.transaction_amount_refunded > 0),
  );
  const state = paid
    ? "Pagamento aprovado"
    : matches[0]?.status === "rejected"
      ? "Pagamento recusado"
      : "Pagamento sem confirmação";
  if (matches.length || row.estado !== "Pagamento aprovado")
    board.updatePayment(db, id, state);
  return state;
}
const lastChecked = new Map();
async function tracking(req, res, id, asData) {
  let row = db
    ?.prepare("SELECT rowid AS sequence,* FROM pedidos WHERE id=?")
    .get(id);
  if (!row) return reply(res, 404, { error: "Pedido não encontrado." });
  if (!asData)
    return reply(res, 200, board.shell(false), "text/html; charset=utf-8");
  if (
    row.estado !== "Pagamento aprovado" &&
    Date.now() - (lastChecked.get(id) || 0) > 25000
  ) {
    lastChecked.set(id, Date.now());
    try {
      await refreshStatus(row);
    } finally {
      setTimeout(() => lastChecked.delete(id), 26000).unref();
    }
    row = db
      .prepare("SELECT rowid AS sequence,* FROM pedidos WHERE id=?")
      .get(id);
  }
  return reply(res, 200, board.project(row, false));
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".md": "text/plain; charset=utf-8",
};
async function handle(req, res) {
  const route = new URL(req.url, "http://localhost").pathname;
  if (req.method === "GET" && route === "/api/pagamento")
    return reply(res, 200, { enabled: paymentsReady });
  if (req.method === "POST" && route === "/api/checkout")
    return checkout(req, res);
  if (
    route === "/balcao" ||
    route === "/api/balcao" ||
    route.startsWith("/api/balcao/")
  )
    return board.staffRoute(req, res, route, db, origin, reply);
  if (req.method === "POST" && route === "/api/notificacoes/mercado-pago")
    return board.webhook(req, res, new URL(req.url, "http://localhost"), {
      db,
      mercado,
      reply,
      refreshStatus,
    });
  if (
    req.method === "GET" &&
    route.startsWith("/api/pedidos/") &&
    board.uuid.test(route.slice(13))
  )
    return tracking(req, res, route.slice(13), true);
  if (req.method !== "GET") return reply(res, 405, {});
  if (/^\/pagamento\/[a-f\d-]{36}$/.test(route))
    return tracking(req, res, route.slice(11), false);
  const file = path.resolve(
    root,
    "." + (route === "/" ? "/index.html" : decodeURIComponent(route)),
  );
  if (
    !file.startsWith(root + path.sep) ||
    !mime[path.extname(file)] ||
    !fs.existsSync(file)
  )
    return reply(res, 404, {});
  reply(res, 200, fs.readFileSync(file), mime[path.extname(file)]);
}
async function listOrders() {
  if (!db) throw Error("Configure as credenciais do restaurante.");
  for (const row of db
    .prepare("SELECT * FROM pedidos ORDER BY criado DESC LIMIT 50")
    .all()) {
    const state = await refreshStatus(row);
    console.log(row.criado, row.id, state, "\n" + row.resumo + "\n");
  }
}
if (require.main === module && process.argv.includes("--pedidos"))
  listOrders().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
else if (require.main === module)
  http
    .createServer((req, res) =>
      handle(req, res).catch(() =>
        reply(res, 502, {
          error: "Serviço de pagamento indisponível. Tente novamente.",
        }),
      ),
    )
    .listen(Number(process.env.PORT || 4195), process.env.HOST || "127.0.0.1");
module.exports = { quote, handle };
