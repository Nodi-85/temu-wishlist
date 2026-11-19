(function () {
  "use strict";

  const Storage = window.TemuWishlistStorage;

  const itemCountLabel = document.getElementById("item-count-label");
  const openDashboardBtn = document.getElementById("open-dashboard-btn");
  const viewAllLink = document.getElementById("view-all-link");
  const currentProductSection = document.getElementById("current-product-section");
  const notTemuHint = document.getElementById("not-temu-hint");
  const cpImg = document.getElementById("cp-img");
  const cpTitle = document.getElementById("cp-title");
  const cpPrice = document.getElementById("cp-price");
  const cpCategory = document.getElementById("cp-category");
  const cpSaveBtn = document.getElementById("cp-save-btn");
  const cpFeedback = document.getElementById("cp-feedback");
  const toggleFloating = document.getElementById("toggle-floating");
  const toggleIntercept = document.getElementById("toggle-intercept");
  const recentList = document.getElementById("recent-list");

  let extractedProduct = null;
  let activeTabId = null;

  function openDashboard() {
    const url = chrome.runtime.getURL("dashboard/dashboard.html");
    chrome.tabs.create({ url });
  }

  openDashboardBtn.addEventListener("click", openDashboard);
  viewAllLink.addEventListener("click", (e) => {
    e.preventDefault();
    openDashboard();
  });

  function populateCategories(defaultCat) {
    cpCategory.innerHTML = "";
    for (const cat of Storage.DEFAULT_CATEGORIES) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if (cat === defaultCat) opt.selected = true;
      cpCategory.appendChild(opt);
    }
  }

  async function renderRecent() {
    const items = await Storage.getItems();
    const activeItems = items.filter((it) => it.status !== "purchased");
    itemCountLabel.textContent =
      activeItems.length === 1 ? "1 artikal" : `${activeItems.length} artikala`;

    recentList.innerHTML = "";
    const recent = activeItems.slice(0, 5);
    if (recent.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-recent";
      empty.textContent = "Vaša wishlista je još uvijek prazna.";
      recentList.appendChild(empty);
      return;
    }

    for (const item of recent) {
      const row = document.createElement("div");
      row.className = "recent-item";

      const img = document.createElement("img");
      img.src = item.image || "../icons/icon48.png";
      img.alt = "";

      const info = document.createElement("div");
      info.className = "ri-info";

      const title = document.createElement("div");
      title.className = "ri-title";
      title.textContent = item.title;

      const meta = document.createElement("div");
      meta.className = "ri-meta";
      meta.textContent = `${item.priceText || "Cijena nepoznata"} • ${item.category}`;

      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "ri-actions";

      const openBtn = document.createElement("button");
      openBtn.className = "icon-btn";
      openBtn.title = "Otvori na Temuu";
      openBtn.innerHTML = "&#8599;";
      openBtn.addEventListener("click", () => {
        if (item.url) chrome.tabs.create({ url: item.url });
      });

      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn del";
      delBtn.title = "Obriši";
      delBtn.innerHTML = "&times;";
      delBtn.addEventListener("click", async () => {
        await Storage.deleteItem(item.id);
        chrome.runtime.sendMessage({ type: "UPDATE_BADGE" });
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { type: "REFRESH_UI" }, () => {
            void chrome.runtime.lastError;
          });
        }
        renderRecent();
      });

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(actions);
      recentList.appendChild(row);
    }
  }

  async function initSettings() {
    const settings = await Storage.getSettings();
    populateCategories(settings.defaultCategory);
    toggleFloating.checked = settings.showFloatingButton;
    toggleIntercept.checked = settings.interceptAddToCart;

    toggleFloating.addEventListener("change", async () => {
      await Storage.saveSettings({ showFloatingButton: toggleFloating.checked });
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: "REFRESH_UI" }, () => {
          void chrome.runtime.lastError;
        });
      }
    });

    toggleIntercept.addEventListener("change", async () => {
      await Storage.saveSettings({ interceptAddToCart: toggleIntercept.checked });
    });
  }

  async function inspectActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url || !/temu\.com/i.test(tab.url)) {
      notTemuHint.classList.remove("hidden");
      return;
    }
    activeTabId = tab.id;

    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CURRENT_PRODUCT" }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.product || !resp.isProductPage) {
        notTemuHint.classList.remove("hidden");
        return;
      }
      extractedProduct = resp.product;
      cpImg.src = extractedProduct.image || "../icons/icon48.png";
      cpTitle.textContent = extractedProduct.title || "Temu artikal";
      cpPrice.textContent = extractedProduct.priceText || "Cijena nepoznata";
      currentProductSection.classList.remove("hidden");
    });
  }

  cpSaveBtn.addEventListener("click", async () => {
    if (!extractedProduct) return;
    const payload = Object.assign({}, extractedProduct, {
      category: cpCategory.value
    });
    const res = await Storage.saveItem(payload);
    chrome.runtime.sendMessage({ type: "UPDATE_BADGE" });
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: "REFRESH_UI" }, () => {
        void chrome.runtime.lastError;
      });
    }

    cpFeedback.classList.remove("hidden");
    if (res.status === "added") {
      cpFeedback.textContent = "Artikal je sačuvan u Wishlistu!";
    } else {
      cpFeedback.textContent = "Artikal je već u vašoj Wishlisti.";
    }
    renderRecent();
  });

  initSettings();
  renderRecent();
  inspectActiveTab();
})();
