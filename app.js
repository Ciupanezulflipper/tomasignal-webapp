(function () {
  const tg = window.Telegram?.WebApp;
  const root = document.documentElement;

  // Theme sync
  function setTheme(light) {
    if (light) root.classList.add("light"); else root.classList.remove("light");
  }
  setTheme(tg?.colorScheme === "light");
  tg?.onEvent("themeChanged", () => setTheme(tg.colorScheme === "light"));
  tg?.expand?.();

  // Tabs
  const tabs = document.querySelectorAll(".tab");
  const pages = {
    news: document.getElementById("tab-news"),
    commodities: document.getElementById("tab-commodities"),
    pairs: document.getElementById("tab-pairs"),
  };
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      Object.values(pages).forEach(p => p.classList.remove("active"));
      pages[key].classList.add("active");
    });
  });

  // Buttons
  document.getElementById("btnTheme")?.addEventListener("click", () => {
    const light = !root.classList.contains("light");
    setTheme(light);
  });

  document.getElementById("btnSend")?.addEventListener("click", () => {
    // Send simple payload back to bot (it will appear in update.message.web_app_data)
    try {
      tg?.sendData?.(JSON.stringify({ action: "hello", ts: Date.now() }));
    } catch(e) {
      alert("This only works when opened inside Telegram as a WebApp.");
    }
  });
})();
