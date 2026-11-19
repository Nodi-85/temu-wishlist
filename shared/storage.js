(function (root) {
  "use strict";

  const STORAGE_KEYS = {
    ITEMS: "temu_wishlist_items",
    SETTINGS: "temu_wishlist_settings"
  };

  const DEFAULT_CATEGORIES = [
    "Ostalo",
    "Odjeća i obuća",
    "Tehnika",
    "Kuća i bašta",
    "Ljepota i zdravlje",
    "Alati",
    "Pokloni",
    "Auto i moto"
  ];

  const DEFAULT_SETTINGS = {
    showFloatingButton: true,
    interceptAddToCart: false,
    defaultCategory: "Ostalo"
  };

  function hasChromeStorage() {
    return (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    );
  }

  function storageGet(keys) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      });
    }
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      try {
        const raw = localStorage.getItem(k);
        result[k] = raw ? JSON.parse(raw) : undefined;
      } catch {
        result[k] = undefined;
      }
    }
    return Promise.resolve(result);
  }

  function storageSet(obj) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.set(obj, () => resolve());
      });
    }
    for (const [k, v] of Object.entries(obj)) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        // Ignore quota errors in fallback mode
      }
    }
    return Promise.resolve();
  }

  function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "tw_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function extractGoodsId(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const qId = parsed.searchParams.get("goods_id");
      if (qId) return qId.trim();
      const match = parsed.pathname.match(/-g-(\d+)(?:\.html)?/i);
      if (match && match[1]) return match[1];
    } catch {
      const match = String(url).match(/(?:goods_id=|-g-)(\d+)/i);
      if (match && match[1]) return match[1];
    }
    return "";
  }

  function cleanTemuUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const goodsId = parsed.searchParams.get("goods_id");
      const clean = new URL(parsed.origin + parsed.pathname);
      if (goodsId) {
        clean.searchParams.set("goods_id", goodsId);
      }
      return clean.toString();
    } catch {
      return String(url).split("#")[0];
    }
  }

  function parsePrice(rawText) {
    if (!rawText) {
      return { priceText: "", priceValue: 0, currency: "" };
    }
    const text = String(rawText).replace(/\s+/g, " ").trim();

    let currency = "";
    const currMatch = text.match(/(KM|BAM|RSD|din|EUR|USD|CHF|GBP|€|\$|£)/i);
    if (currMatch) {
      currency = currMatch[1];
      if (currency.toUpperCase() === "EUR") currency = "€";
      if (currency.toUpperCase() === "USD") currency = "$";
      if (currency.toUpperCase() === "GBP") currency = "£";
    }

    const numMatch = text.match(/\d[\d.,\s]*/);
    let priceValue = 0;
    if (numMatch) {
      let numStr = numMatch[0].replace(/\s+/g, "");
      const hasComma = numStr.includes(",");
      const hasDot = numStr.includes(".");

      if (hasComma && hasDot) {
        if (numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
          // 1.234,56 -> 1234.56
          numStr = numStr.replace(/\./g, "").replace(",", ".");
        } else {
          // 1,234.56 -> 1234.56
          numStr = numStr.replace(/,/g, "");
        }
      } else if (hasComma) {
        // 12,99 -> 12.99
        const parts = numStr.split(",");
        if (parts[parts.length - 1].length <= 2) {
          numStr = numStr.replace(",", ".");
        } else {
          numStr = numStr.replace(/,/g, "");
        }
      }
      const parsed = parseFloat(numStr);
      if (!Number.isNaN(parsed)) {
        priceValue = parsed;
      }
    }

    return {
      priceText: text,
      priceValue,
      currency: currency || "€"
    };
  }

  async function getItems() {
    const res = await storageGet([STORAGE_KEYS.ITEMS]);
    const items = res[STORAGE_KEYS.ITEMS];
    return Array.isArray(items) ? items : [];
  }

  async function saveItemsList(items) {
    await storageSet({ [STORAGE_KEYS.ITEMS]: items });
  }

  async function getSettings() {
    const res = await storageGet([STORAGE_KEYS.SETTINGS]);
    return Object.assign({}, DEFAULT_SETTINGS, res[STORAGE_KEYS.SETTINGS] || {});
  }

  async function saveSettings(patch) {
    const current = await getSettings();
    const updated = Object.assign({}, current, patch);
    await storageSet({ [STORAGE_KEYS.SETTINGS]: updated });
    return updated;
  }

  async function saveItem(rawItem, options = {}) {
    const items = await getItems();
    const settings = await getSettings();

    const cleanUrl = cleanTemuUrl(rawItem.url);
    const goodsId = rawItem.goodsId || extractGoodsId(cleanUrl || rawItem.url);
    const parsedPrice =
      typeof rawItem.priceValue === "number" && rawItem.priceValue > 0
        ? {
            priceText: rawItem.priceText || `${rawItem.priceValue.toFixed(2)} ${rawItem.currency || "€"}`,
            priceValue: rawItem.priceValue,
            currency: rawItem.currency || "€"
          }
        : parsePrice(rawItem.priceText || rawItem.price || "");

    const existingIdx = items.findIndex((it) => {
      if (goodsId && it.goodsId && it.goodsId === goodsId) return true;
      if (cleanUrl && it.url && cleanTemuUrl(it.url) === cleanUrl) return true;
      return false;
    });

    const now = Date.now();

    if (existingIdx !== -1 && !options.allowDuplicate) {
      const existing = items[existingIdx];
      if (options.updateIfExists) {
        const updated = Object.assign({}, existing, {
          title: rawItem.title || existing.title,
          priceText: parsedPrice.priceText || existing.priceText,
          priceValue: parsedPrice.priceValue || existing.priceValue,
          currency: parsedPrice.currency || existing.currency,
          image: rawItem.image || existing.image,
          status: "wishlist",
          updatedAt: now
        });
        items[existingIdx] = updated;
        await saveItemsList(items);
        return { status: "updated", item: updated };
      }
      return { status: "duplicate", item: existing };
    }

    const newItem = {
      id: generateId(),
      goodsId,
      title: (rawItem.title || "Temu artikal").trim(),
      priceText: parsedPrice.priceText || "Cijena nepoznata",
      priceValue: parsedPrice.priceValue || 0,
      currency: parsedPrice.currency || "€",
      image: rawItem.image || "",
      url: cleanUrl || rawItem.url || "",
      category: rawItem.category || settings.defaultCategory || "Ostalo",
      priority: rawItem.priority || "medium",
      note: rawItem.note || "",
      status: rawItem.status || "wishlist",
      createdAt: now,
      updatedAt: now
    };

    items.unshift(newItem);
    await saveItemsList(items);
    return { status: "added", item: newItem };
  }

  async function updateItem(id, patch) {
    const items = await getItems();
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return null;

    const updated = Object.assign({}, items[idx], patch, {
      updatedAt: Date.now()
    });
    if (patch.priceText !== undefined && patch.priceValue === undefined) {
      const parsed = parsePrice(patch.priceText);
      updated.priceValue = parsed.priceValue;
      updated.currency = parsed.currency;
    }
    items[idx] = updated;
    await saveItemsList(items);
    return updated;
  }

  async function deleteItem(id) {
    const items = await getItems();
    const filtered = items.filter((it) => it.id !== id);
    await saveItemsList(filtered);
    return filtered;
  }

  async function clearPurchased() {
    const items = await getItems();
    const filtered = items.filter((it) => it.status !== "purchased");
    await saveItemsList(filtered);
    return filtered;
  }

  async function exportJSON() {
    const items = await getItems();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        items
      },
      null,
      2
    );
  }

  async function importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    const incoming = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(incoming)) {
      throw new Error("Neispravan format JSON fajla.");
    }
    let added = 0;
    let skipped = 0;
    for (const raw of incoming) {
      if (!raw || (!raw.title && !raw.url)) {
        skipped++;
        continue;
      }
      const res = await saveItem(raw);
      if (res.status === "added") added++;
      else skipped++;
    }
    return { added, skipped };
  }

  async function exportCSV() {
    const items = await getItems();
    const escapeCell = (val) => {
      const s = String(val == null ? "" : val).replace(/"/g, '""');
      return `"${s}"`;
    };
    const headers = ["Naziv", "Cijena", "Vrijednost", "Valuta", "Kategorija", "Prioritet", "Status", "Bilješka", "Link", "Dodano"];
    const rows = items.map((it) => [
      it.title,
      it.priceText,
      it.priceValue,
      it.currency,
      it.category,
      it.priority,
      it.status,
      it.note,
      it.url,
      new Date(it.createdAt).toISOString()
    ]);
    return [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
  }

  root.TemuWishlistStorage = {
    STORAGE_KEYS,
    DEFAULT_CATEGORIES,
    DEFAULT_SETTINGS,
    extractGoodsId,
    cleanTemuUrl,
    parsePrice,
    getItems,
    getSettings,
    saveSettings,
    saveItem,
    updateItem,
    deleteItem,
    clearPurchased,
    exportJSON,
    importJSON,
    exportCSV
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
