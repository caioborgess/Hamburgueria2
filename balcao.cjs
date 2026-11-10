const crypto = require("node:crypto");

const APPROVED = "Pagamento aprovado";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function migrate(db) {
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(pedidos)")
      .all()
      .map((c) => c.name),
  );
  if (!columns.has("ficha"))
    db.exec("ALTER TABLE pedidos ADD COLUMN ficha TEXT");
  if (!columns.has("etapas"))
    db.exec("ALTER TABLE pedidos ADD COLUMN etapas TEXT NOT NULL DEFAULT '[]'");
  db.prepare("UPDATE pedidos SET etapas=? WHERE estado=? AND etapas='[]'").run(
    JSON.stringify([Date.now()]),
    APPROVED,
  );
}
function updatePayment(db, id, state) {
  db.prepare(
    "UPDATE pedidos SET estado=?, etapas=CASE WHEN ?=? AND etapas='[]' THEN ? ELSE etapas END WHERE id=?",
  ).run(state, state, APPROVED, JSON.stringify([Date.now()]), id);
}
function project(row, staff) {
  const slip = row.ficha ? JSON.parse(row.ficha) : {};
  const order = {
    label: "#" + String(row.sequence).padStart(3, "0"),
    delivery: slip.delivery ?? !row.resumo.includes("Retirada no local."),
    total: row.centavos,
    state: row.estado,
    approved: row.estado === APPROVED,
    times: JSON.parse(row.etapas),
    fee: slip.fee,
    items: slip.items,
  };
  if (staff)
    Object.assign(order, {
      id: row.id,
      name: slip.name,
      destination: slip.destination,
      summary: row.resumo,
    });
  return order;
}
function shell(staff) {
  const title = staff ? "Balcão de pedidos" : "Acompanhar pedido";
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
    title +
    ' · Fagulha</title><link rel="stylesheet" href="/comandas.css"><script src="/comandas.js" defer></script></head><body class="order-board"><header><a href="/">FAGULHA</a></header><main><h1>' +
    title +
    '</h1><p id="panel-status" role="status">Carregando a comanda…</p><div id="panel-list"></div><div id="order-page"></div><p><a href="/">Voltar ao cardápio</a></p></main></body></html>'
  );
}
function equalSecret(a, b) {
  const hash = (s) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}
function authorize(req, res, reply) {
  const password = process.env.BALCAO_PASSWORD;
  if (!password || password.length < 16) {
    reply(res, 503, { error: "Balcão ainda não configurado." });
    return false;
  }
  const auth = req.headers.authorization || "";
  if (
    !auth.startsWith("Basic ") ||
    !equalSecret(
      Buffer.from(auth.slice(6), "base64").toString("utf8"),
      "balcao:" + password,
    )
  ) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Balcao Fagulha", charset="UTF-8"',
    );
    reply(res, 401, { error: "Entre com a conta da equipe." });
    return false;
  }
  return true;
}
async function staffRoute(req, res, route, db, origin, reply) {
  if (!authorize(req, res, reply)) return;
  if (!db) return reply(res, 503, { error: "Conecte o servidor de pedidos." });
  if (route === "/balcao" && req.method === "GET")
    return reply(res, 200, shell(true), "text/html; charset=utf-8");
  if (route === "/api/balcao" && req.method === "GET") {
    const rows = db
      .prepare(
        "SELECT rowid AS sequence,* FROM pedidos WHERE estado=? AND json_array_length(etapas)<4 ORDER BY rowid DESC",
      )
      .all(APPROVED);
    const recent = db
      .prepare(
        "SELECT rowid AS sequence,* FROM pedidos WHERE estado=? AND json_array_length(etapas)=4 ORDER BY rowid DESC LIMIT 20",
      )
      .all(APPROVED);
    return reply(res, 200, {
      orders: [...rows, ...recent].map((row) => project(row, true)),
    });
  }
  const id = route.split("/").pop();
  if (!uuid.test(id) || req.method !== "POST") return reply(res, 404, {});
  if (
    req.headers.origin !== origin ||
    !/^application\/json\b/.test(req.headers["content-type"] || "")
  )
    return reply(res, 403, {});
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 128) return reply(res, 413, {});
  }
  let step;
  try {
    step = JSON.parse(body).step;
  } catch {
    return reply(res, 400, {});
  }
  if (!Number.isInteger(step) || step < 1 || step > 3)
    return reply(res, 400, {});
  const result = db
    .prepare(
      "UPDATE pedidos SET etapas=json_insert(etapas,'$[#]',?) WHERE id=? AND estado=? AND json_array_length(etapas)=?",
    )
    .run(Date.now(), id, APPROVED, step);
  return reply(res, result.changes ? 200 : 409, { updated: !!result.changes });
}
async function webhook(req, res, url, { db, mercado, reply, refreshStatus }) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!db || !secret) return reply(res, 503, {});
  if (url.searchParams.get("type") !== "payment") return reply(res, 200, {});
  const id = url.searchParams.get("data.id") || "",
    rid = req.headers["x-request-id"] || "";
  const parts = Object.fromEntries(
    (req.headers["x-signature"] || "")
      .split(",")
      .map((v) => v.trim().split("=")),
  );
  if (
    !/^\d+$/.test(id) ||
    !rid ||
    !/^\d+$/.test(parts.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 || "")
  )
    return reply(res, 401, {});
  const expected = crypto
    .createHmac("sha256", secret)
    .update("id:" + id + ";request-id:" + rid + ";ts:" + parts.ts + ";")
    .digest("hex");
  if (!equalSecret(expected, parts.v1)) return reply(res, 401, {});
  const p = await mercado("/v1/payments/" + id);
  const row = db
    .prepare("SELECT * FROM pedidos WHERE id=?")
    .get(String(p.external_reference || ""));
  if (
    row &&
    p.currency_id === "BRL" &&
    Math.round(p.transaction_amount * 100) === row.centavos
  ) {
    if (p.status === "approved" && !(p.transaction_amount_refunded > 0))
      updatePayment(db, row.id, APPROVED);
    else await refreshStatus(row);
  }
  return reply(res, 200, { received: true });
}
module.exports = {
  migrate,
  updatePayment,
  project,
  shell,
  staffRoute,
  webhook,
  uuid,
};
