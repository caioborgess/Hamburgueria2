(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;
  function updateOffset() {
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty(
      "--header-height",
      `${height}px`,
    );
  }
  updateOffset();
  if ("ResizeObserver" in window)
    new ResizeObserver(updateOffset).observe(header);
  else window.addEventListener("resize", updateOffset, { passive: true });
  // Links nativos preservam histórico, teclado e o comportamento de voltar.
  document.fonts?.ready.then(updateOffset);
})();

/* Revela a barra quando o mouse chega à borda de rolagem. */
document.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") return;
  const nearEdge = event.clientX >= document.documentElement.clientWidth - 36;
  document.documentElement.classList.toggle("scroll-edge", nearEdge);
}, { passive: true });
document.addEventListener("pointerleave", () => document.documentElement.classList.remove("scroll-edge"));
