/* Brasas decorativas: movimento em CSS, sem redesenhar a página a cada frame. */
(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sections = [
    ...document.querySelectorAll(
      ".hero, .favorites, .about-section, .location-section",
    ),
  ];
  let observer;

  function refresh() {
    observer?.disconnect();
    sections.forEach((section) => {
      section.querySelector(".ember-field")?.remove();
      section.classList.remove("has-live-embers", "embers-visible");
    });
    if (reducedMotion.matches) return;

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) =>
            entry.target.classList.toggle(
              "embers-visible",
              entry.isIntersecting,
            ),
          );
        },
        { rootMargin: "80px" },
      );
    }
    sections.forEach((section, sectionIndex) => {
      const field = document.createElement("div");
      field.className = "ember-field";
      field.setAttribute("aria-hidden", "true");
      const count = section.matches(".hero")
        ? 48
        : section.matches(".about-section")
          ? 32
          : section.matches(".favorites")
            ? 24
            : section.matches(".location-section")
              ? 8
              : 18;
      for (let i = 0; i < count; i++) {
        const spark = document.createElement("span");
        spark.className = "ember";
        const seed = i * 37 + sectionIndex * 19;
        spark.style.cssText = `--x:${(seed * 7 + 3) % 100}%;--y:${(seed * 11 + 13) % 100}%;--drift:${(seed % 79) - 39}px;--rise:${160 + (seed % 140)}px;--speed:${7 + (seed % 8)}s;--delay:-${(seed % 130) / 10}s;--width:${2 + (seed % 3) * 0.5}px;--length:${5 + (seed % 7)}px;--brightness:${0.75 + (seed % 25) / 100}`;
        field.append(spark);
      }
      section.prepend(field);
      section.classList.add("has-live-embers");
      if (observer) observer.observe(section);
      else section.classList.add("embers-visible");
    });
  }
  function pauseWhenHidden() {
    document.body.classList.toggle("embers-paused", document.hidden);
  }
  reducedMotion.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", pauseWhenHidden);
  refresh();
  pauseWhenHidden();
})();
