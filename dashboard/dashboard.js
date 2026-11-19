(function () {
  "use strict";

  const Storage = window.TemuWishlistStorage;

  const statActive = document.getElementById("stat-active");
  const statTotal = document.getElementById("stat-total");
  const statPurchased = document.getElementById("stat-purchased");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const searchInput = document.getElementById("search-input");
  const filterCategory = document.getElementById("filter-category");
  const filterPriority = document.getElementById("filter-priority");
  const sortSelect = document.getElementById("sort-select");
  const itemsGrid = document.getElementById("items-grid");
  const emptyState = document.getElementById("empty-state");

  const addManualBtn = document.getElementById("add-manual-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const exportJsonBtn = document.getElementById("export-json-btn");
  const importJsonInput = document.getElementById("import-json-input");

  const modal = document.getElementById("item-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const itemForm = document.getElementById("item-form");

  const formItemId = document.getElementById("form-item-id");
  const formUrl = document.getElementById("form-url");
  const formTitle = document.getElementById("form-title");
  const formPrice = document.getElementById("form-price");
  const formCategory = document.getElementById("form-category");
  const formPriority = document.getElementById("form-priority");
  const formImage = document.getElementById("form-image");
  const formNote = document.getElementById("form-note");
  const dashToast = document.getElementById("dash-toast");

  let currentStatusFilter = "wishlist";
  let toastTimer = null;

  const PRIORITY_LABELS = {
    high: "Visok",
    medium: "Srednji",
    low: "Nizak"
  };

  const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

  function showToast(msg) {
    dashToast.textContent = msg;
    dashToast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dashToast.classList.remove("visible"), 2600);
  }

  function populateCategorySelects() {
    filterCategory.innerHTML = '<option value="all">Sve kategorije</option>';
    formCategory.innerHTML = "";
    for (const cat of Storage.DEFAULT_CATEGORIES) {
      const opt1 = document.createElement("option");
      opt1.value = cat;
      opt1.textContent = cat;
      filterCategory.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = cat;
      opt2.textContent = cat;
      formCategory.appendChild(opt2);
    }
  }

  function formatTotalByCurrency(items) {
    const active = items.filter((it) => it.status !== "purchased" && it.priceValue > 0);
    if (active.length === 0) return "0.00 €";

    const totals = {};
    for (const it of active) {
      const curr = it.currency || "€";
      totals[curr] = (totals[curr] || 0) + Number(it.priceValue || 0);
    }
    return Object.entries(totals)
      .map(([curr, sum]) => `${sum.toFixed(2)} ${curr}`)
      .join(" + ");
  }

  function updateStats(items) {
    const activeCount = items.filter((it) => it.status !== "purchased").length;
    const purchasedCount = items.filter((it) => it.status === "purchased").length;
    statActive.textContent = String(activeCount);
    statPurchased.textContent = String(purchasedCount);
    statTotal.textContent = formatTotalByCurrency(items);
  }

  function filterAndSort(items) {
    const q = searchInput.value.trim().toLowerCase();
    const cat = filterCategory.value;
    const prio = filterPriority.value;
    const sortBy = sortSelect.value;

    const filtered = items.filter((it) => {
      if (currentStatusFilter !== "all" && it.status !== currentStatusFilter) return false;
      if (cat !== "all" && it.category !== cat) return false;
      if (prio !== "all" && it.priority !== prio) return false;
      if (q) {
        const hay = `${it.title} ${it.note} ${it.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === "price-asc") return (a.priceValue || 0) - (b.priceValue || 0);
      if (sortBy === "price-desc") return (b.priceValue || 0) - (a.priceValue || 0);
      if (sortBy === "priority") {
        return (PRIORITY_RANK[b.priority] || 2) - (PRIORITY_RANK[a.priority] || 2);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return filtered;
  }

  function openModalForItem(item) {
    if (item) {
      modalTitle.textContent = "Uredi artikal";
      formItemId.value = item.id;
      formUrl.value = item.url || "";
      formTitle.value = item.title || "";
      formPrice.value = item.priceText === "Cijena nepoznata" ? "" : item.priceText || "";
      formCategory.value = item.category || "Ostalo";
      formPriority.value = item.priority || "medium";
      formImage.value = item.image || "";
      formNote.value = item.note || "";
    } else {
      modalTitle.textContent = "Dodaj artikal ručno";
      itemForm.reset();
      formItemId.value = "";
      formCategory.value = "Ostalo";
      formPriority.value = "medium";
    }
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  async function render() {
    const items = await Storage.getItems();
    updateStats(items);

    const visible = filterAndSort(items);
    itemsGrid.innerHTML = "";

    if (visible.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    for (const item of visible) {
      const card = document.createElement("article");
      card.className = "item-card" + (item.status === "purchased" ? " is-purchased" : "");

      const media = document.createElement("div");
      media.className = "card-media";

      const img = document.createElement("img");
      img.src = item.image || "../icons/icon128.png";
      img.alt = item.title;
      img.loading = "lazy";
      media.appendChild(img);

      const badges = document.createElement("div");
      badges.className = "badges";

      const catBadge = document.createElement("span");
      catBadge.className = "badge";
      catBadge.textContent = item.category || "Ostalo";

      const prioBadge = document.createElement("span");
      prioBadge.className = `badge priority-${item.priority || "medium"}`;
      prioBadge.textContent = PRIORITY_LABELS[item.priority] || "Srednji";

      badges.appendChild(catBadge);
      badges.appendChild(prioBadge);
      media.appendChild(badges);

      const body = document.createElement("div");
      body.className = "card-body";

      const titleLink = document.createElement("a");
      titleLink.className = "card-title";
      titleLink.href = item.url || "#";
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.textContent = item.title;

      const price = document.createElement("div");
      price.className = "card-price";
      price.textContent = item.priceText || "Cijena nepoznata";

      body.appendChild(titleLink);
      body.appendChild(price);

      if (item.note) {
        const note = document.createElement("div");
        note.className = "card-note";
        note.textContent = item.note;
        body.appendChild(note);
      }

      const dateEl = document.createElement("div");
      dateEl.className = "card-date";
      dateEl.textContent =
        "Dodano: " + new Date(item.createdAt || Date.now()).toLocaleDateString("bs-BA");
      body.appendChild(dateEl);

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const openLink = document.createElement("a");
      openLink.className = "card-btn primary";
      openLink.href = item.url || "#";
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.textContent = "Otvori Temu";

      const editBtn = document.createElement("button");
      editBtn.className = "card-btn";
      editBtn.type = "button";
      editBtn.title = "Uredi";
      editBtn.textContent = "Uredi";
      editBtn.addEventListener("click", () => openModalForItem(item));

      const toggleStatusBtn = document.createElement("button");
      toggleStatusBtn.className = "card-btn";
      toggleStatusBtn.type = "button";
      toggleStatusBtn.title =
        item.status === "purchased" ? "Vrati na listu želja" : "Označi kao kupljeno";
      toggleStatusBtn.textContent = item.status === "purchased" ? "Vrati" : "Kupljeno";
      toggleStatusBtn.addEventListener("click", async () => {
        const nextStatus = item.status === "purchased" ? "wishlist" : "purchased";
        await Storage.updateItem(item.id, { status: nextStatus });
        showToast(
          nextStatus === "purchased" ? "Označeno kao kupljeno." : "Vraćeno na listu želja."
        );
        render();
      });

      const delBtn = document.createElement("button");
      delBtn.className = "card-btn danger";
      delBtn.type = "button";
      delBtn.title = "Obriši";
      delBtn.innerHTML = "&times;";
      delBtn.addEventListener("click", async () => {
        await Storage.deleteItem(item.id);
        showToast("Artikal obrisan.");
        render();
      });

      actions.appendChild(openLink);
      actions.appendChild(editBtn);
      actions.appendChild(toggleStatusBtn);
      actions.appendChild(delBtn);

      card.appendChild(media);
      card.appendChild(body);
      card.appendChild(actions);
      itemsGrid.appendChild(card);
    }
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatusFilter = btn.dataset.status;
      render();
    });
  });

  searchInput.addEventListener("input", render);
  filterCategory.addEventListener("change", render);
  filterPriority.addEventListener("change", render);
  sortSelect.addEventListener("change", render);

  addManualBtn.addEventListener("click", () => openModalForItem(null));
  modalCloseBtn.addEventListener("click", closeModal);
  modalCancelBtn.addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

  itemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = formItemId.value;
    const payload = {
      url: formUrl.value.trim(),
      title: formTitle.value.trim(),
      priceText: formPrice.value.trim(),
      category: formCategory.value,
      priority: formPriority.value,
      image: formImage.value.trim(),
      note: formNote.value.trim()
    };

    if (id) {
      await Storage.updateItem(id, payload);
      showToast("Izmjene sačuvane!");
    } else {
      const res = await Storage.saveItem(payload, { allowDuplicate: true });
      if (res.status === "added") {
        showToast("Artikal dodan u Wishlistu!");
      }
    }
    closeModal();
    render();
  });

  exportJsonBtn.addEventListener("click", async () => {
    const json = await Storage.exportJSON();
    downloadFile("temu-wishlist.json", json, "application/json;charset=utf-8");
    showToast("JSON lista izvezena.");
  });

  exportCsvBtn.addEventListener("click", async () => {
    const csv = await Storage.exportCSV();
    downloadFile("temu-wishlist.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
    showToast("CSV tabela izvezena.");
  });

  importJsonInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await Storage.importJSON(text);
      showToast(`Uvezeno: ${res.added}, preskočeno (duplikati): ${res.skipped}.`);
      render();
    } catch (err) {
      showToast("Greška pri uvozu JSON fajla.");
    } finally {
      importJsonInput.value = "";
    }
  });

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[Storage.STORAGE_KEYS.ITEMS]) {
        render();
      }
    });
  }

  populateCategorySelects();
  render();
})();
