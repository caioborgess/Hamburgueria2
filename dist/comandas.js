/* A mesma comanda é desenhada no catálogo, no link do cliente e no balcão. */
(() => {
  "use strict";
  const money = (cents) =>
    (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  function el(tag, cls, text) {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function stages(delivery) {
    return [
      "Recebido",
      "Na chapa",
      delivery ? "Saiu para entrega" : "Pronto para retirar",
      delivery ? "Entregue" : "Retirado",
    ];
  }
  function render(root, order, { demo = false, advance } = {}) {
    const steps = stages(order.delivery);
    const current = order.times.length - 1;
    const header = el("section", "track-poster");
    header.append(
      el(
        "p",
        "track-kicker",
        demo ? "DEMONSTRAÇÃO · PEDIDO SIMULADO" : "COMANDA · " + order.label,
      ),
      el(
        "h2",
        "",
        order.approved ? steps[Math.max(0, current)] + "." : order.state,
      ),
      el(
        "p",
        "track-caption",
        order.delivery ? "Entrega" : "Retirada no balcão",
      ),
    );
    const flow = el("ol", "track-steps");
    for (const [index, name] of steps.entries()) {
      const li = el(
        "li",
        index <= current && order.approved ? "reached" : "",
        name,
      );
      if (index === current && order.approved)
        li.setAttribute("aria-current", "step");
      if (order.times[index])
        li.append(
          el(
            "time",
            "",
            new Date(order.times[index]).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          ),
        );
      flow.append(li);
    }
    const receipt = el("section", "track-slip");
    receipt.append(
      el("h3", "", "Sua comanda"),
      el("p", "track-status", order.state),
    );
    if (order.name) receipt.append(el("p", "", order.name));
    if (order.items?.length) {
      const list = el("ul", "track-lines");
      for (const item of order.items) {
        const li = el("li");
        li.append(
          el("strong", "", item.quantity + "× " + item.name),
          el("span", "", money(item.quantity * item.unit)),
        );
        if (item.detail) li.append(el("small", "", item.detail));
        list.append(li);
      }
      receipt.append(list);
    } else if (order.summary)
      receipt.append(el("pre", "track-summary", order.summary));
    if (order.delivery && Number.isInteger(order.fee))
      receipt.append(el("p", "", "Frete · " + money(order.fee)));
    receipt.append(el("p", "track-total", "Total · " + money(order.total)));
    if (order.destination)
      receipt.append(el("p", "track-address", order.destination));
    const body = el("div", "track-columns"),
      progress = el("section", "track-progress");
    progress.append(header, flow);
    if (advance && order.approved && current < 3) {
      const next = [
        "Começar preparo",
        order.delivery
          ? "Marcar saída para entrega"
          : "Marcar pronto para retirada",
        order.delivery ? "Confirmar entrega" : "Confirmar retirada",
      ][Math.max(0, current)];
      const button = el("button", "track-action", next);
      button.type = "button";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await advance();
        } finally {
          button.disabled = false;
        }
      });
      if (demo)
        progress.append(
          el(
            "p",
            "track-demo",
            "Teste a atualização do balcão neste pedido de exemplo.",
          ),
        );
      progress.append(button);
    }
    body.append(progress, receipt);
    root.replaceChildren(body);
  }
  window.FagulhaComandas = { render };
  const page = document.getElementById("order-page");
  if (!page) return;
  const staff = location.pathname === "/balcao";
  const id = location.pathname.split("/").pop();
  const status = document.getElementById("panel-status"),
    list = document.getElementById("panel-list");
  let selected = "",
    seen = null,
    busy = false;
  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const response = await fetch(
        staff ? "/api/balcao" : "/api/pedidos/" + encodeURIComponent(id),
        { cache: "no-store" },
      );
      if (!response.ok)
        throw Error(
          response.status === 404
            ? "Pedido não encontrado."
            : "Falha ao atualizar. Confira a conexão.",
        );
      const data = await response.json();
      if (!staff) {
        render(page, data);
        status.textContent = "Atualização automática";
        return;
      }
      const orders = data.orders;
      const fresh = seen && orders.filter((o) => !seen.has(o.id)).length;
      seen = new Set(orders.map((o) => o.id));
      status.textContent = fresh
        ? "Nova comanda recebida!"
        : "Comandas pagas · atualização automática";
      if (fresh) document.title = "Nova comanda · Fagulha";
      if (!orders.length) {
        page.replaceChildren(
          el("p", "track-empty", "Aguardando o primeiro pedido aprovado."),
        );
        list.replaceChildren();
        return;
      }
      if (!seen.has(selected)) selected = orders[0].id;
      function show() {
        const order = orders.find((o) => o.id === selected);
        const picker = list.querySelector("select") || el("select");
        picker.replaceChildren();
        picker.setAttribute("aria-label", "Escolher comanda paga");
        for (const o of orders)
          picker.add(
            new Option(
              o.label + " · " + (o.name || "Pedido") + " · " + money(o.total),
              o.id,
            ),
          );
        picker.value = selected;
        picker.onchange = () => {
          selected = picker.value;
          show();
        };
        if (!picker.isConnected)
          list.replaceChildren(picker);
        render(page, order, {
          advance: async () => {
            try {
              const result = await fetch("/api/balcao/" + order.id, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step: order.times.length }),
              });
              if (!result.ok && result.status !== 409) throw Error();
              await refresh();
            } catch {
              status.textContent =
                "Não foi possível atualizar a etapa. Confira a comanda.";
            }
          },
        });
      }
      show();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
    }
  }
  refresh();
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 8000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
})();
