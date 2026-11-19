(function () {
  "use strict";

  const Storage = window.TemuWishlistStorage;
  const Extractor = window.TemuExtractor;
  if (!Storage || !Extractor) return;

  let lastUrl = window.location.href;
  let lastRightClickedEl = null;
  let toastTimer = null;

  function showToast(message) {
    let toast = document.getElementById("temu-wl-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "temu-wl-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  function notifyBadgeUpdate() {
    try {
      chrome.runtime.sendMessage({ type: "UPDATE_BADGE" });
    } catch {
      // Ignore if extension context invalidated
    }
  }

  async function isCurrentPageSaved() {
    const cleanUrl = Storage.cleanTemuUrl(window.location.href);
    const goodsId = Storage.extractGoodsId(cleanUrl);
    const items = await Storage.getItems();
    return items.some((it) => {
      if (goodsId && it.goodsId && it.goodsId === goodsId) return true;
      if (cleanUrl && it.url && Storage.cleanTemuUrl(it.url) === cleanUrl) return true;
      return false;
    });
  }

  async function saveCurrentProduct() {
    const product = Extractor.extractProductFromPage();
    if (!product || !product.url) {
      showToast("Nije moguće prepoznati artikal na ovoj stranici.");
      return;
    }
    const result = await Storage.saveItem(product);
    notifyBadgeUpdate();
    await refreshButtonState();

    if (result.status === "added") {
      showToast("Sačuvano u Wishlistu!");
    } else if (result.status === "updated") {
      showToast("Ažurirano u Wishlisti!");
    } else {
      showToast("Artikal je već u vašoj Wishlisti.");
    }
  }

  async function refreshButtonState() {
    const saveBtn = document.getElementById("temu-wl-save-btn");
    if (!saveBtn) return;
    const saved = await isCurrentPageSaved();
    if (saved) {
      saveBtn.classList.add("is-saved");
      saveBtn.innerHTML = "<span>&#10003;</span><span>U Wishlisti</span>";
    } else {
      saveBtn.classList.remove("is-saved");
      saveBtn.innerHTML = "<span>&#9829;</span><span>Dodaj u Wishlistu</span>";
    }
  }

  async function renderFloatingBar() {
    const settings = await Storage.getSettings();
    const existing = document.getElementById("temu-wl-floating-bar");

    if (!settings.showFloatingButton || !Extractor.isProductPage()) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      const bar = document.createElement("div");
      bar.id = "temu-wl-floating-bar";

      const saveBtn = document.createElement("button");
      saveBtn.id = "temu-wl-save-btn";
      saveBtn.type = "button";
      saveBtn.addEventListener("click", saveCurrentProduct);

      const openBtn = document.createElement("button");
      openBtn.id = "temu-wl-open-btn";
      openBtn.type = "button";
      openBtn.title = "Otvori Wishlistu";
      openBtn.innerHTML = "&#9776;";
      openBtn.addEventListener("click", () => {
        try {
          chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
        } catch {
          // Ignore
        }
      });

      bar.appendChild(saveBtn);
      bar.appendChild(openBtn);
      document.body.appendChild(bar);
    }

    await refreshButtonState();
  }

  // Track right-clicked element for context menu saving on product cards
  document.addEventListener(
    "contextmenu",
    (e) => {
      lastRightClickedEl = e.target;
    },
    true
  );

  // Optional Add-to-Cart interception if enabled in settings
  document.addEventListener(
    "click",
    async (e) => {
      const btn = e.target?.closest?.("button, [role='button'], a");
      if (!btn) return;
      if (btn.id === "temu-wl-save-btn" || btn.id === "temu-wl-open-btn") return;

      const text = (btn.innerText || btn.getAttribute("aria-label") || "").trim();
      if (!/(add to cart|dodaj u korpu|u korpu|add to bag)/i.test(text)) return;

      const settings = await Storage.getSettings();
      if (!settings.interceptAddToCart) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }

      if (Extractor.isProductPage()) {
        await saveCurrentProduct();
      } else {
        const cardProduct = Extractor.extractProductFromElement(btn);
        if (cardProduct) {
          const res = await Storage.saveItem(cardProduct);
          notifyBadgeUpdate();
          showToast(
            res.status === "added"
              ? "Sačuvano u Wishlistu (umjesto korpe)!"
              : "Artikal je već u vašoj Wishlisti."
          );
        }
      }
    },
    true
  );

  // Listen for messages from popup or background service worker
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (msg.type === "EXTRACT_CURRENT_PRODUCT") {
      const product = Extractor.extractProductFromPage();
      sendResponse({ product, isProductPage: Extractor.isProductPage() });
      return true;
    }

    if (msg.type === "SAVE_CONTEXT_TARGET") {
      (async () => {
        let product = null;
        if (lastRightClickedEl) {
          product = Extractor.extractProductFromElement(lastRightClickedEl);
        }
        if (!product && Extractor.isProductPage()) {
          product = Extractor.extractProductFromPage();
        }
        if (!product) {
          showToast("Desnim klikom kliknite na artikal ili otvorite stranicu artikla.");
          sendResponse({ ok: false });
          return;
        }
        const res = await Storage.saveItem(product);
        notifyBadgeUpdate();
        await refreshButtonState();
        showToast(
          res.status === "added"
            ? "Sačuvano u Wishlistu!"
            : "Artikal je već u vašoj Wishlisti."
        );
        sendResponse({ ok: true, result: res });
      })();
      return true;
    }

    if (msg.type === "REFRESH_UI") {
      renderFloatingBar();
      sendResponse({ ok: true });
      return true;
    }
  });

  // Watch SPA navigation on Temu
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(renderFloatingBar, 600);
    }
  }, 800);

  // Initial render
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderFloatingBar);
  } else {
    renderFloatingBar();
  }
})();
