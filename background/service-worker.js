const ITEMS_KEY = "temu_wishlist_items";

async function updateBadge() {
  try {
    const res = await chrome.storage.local.get([ITEMS_KEY]);
    const items = Array.isArray(res[ITEMS_KEY]) ? res[ITEMS_KEY] : [];
    const activeCount = items.filter((it) => it.status !== "purchased").length;
    await chrome.action.setBadgeText({
      text: activeCount > 0 ? String(activeCount) : ""
    });
    await chrome.action.setBadgeBackgroundColor({ color: "#fb7701" });
  } catch {
    // Ignore badge errors
  }
}

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "temu-wishlist-save",
      title: "Sačuvaj u Temu Wishlistu",
      contexts: ["page", "link", "image"],
      documentUrlPatterns: ["*://*.temu.com/*"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[ITEMS_KEY]) {
    updateBadge();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "temu-wishlist-save" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "SAVE_CONTEXT_TARGET" }, () => {
      void chrome.runtime.lastError;
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "UPDATE_BADGE") {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "OPEN_DASHBOARD") {
    const url = chrome.runtime.getURL("dashboard/dashboard.html");
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return true;
  }
});
