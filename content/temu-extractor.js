(function (root) {
  "use strict";

  const PRICE_REGEX = /(?:(?:KM|BAM|RSD|EUR|USD|CHF|GBP|€|\$|£)\s*\d[\d.,]*|\d[\d.,]*\s*(?:KM|BAM|RSD|din|EUR|USD|CHF|GBP|€|\$|£))/i;

  function isProductPage() {
    const href = window.location.href;
    if (/goods\.html/i.test(href) || /goods_id=\d+/i.test(href) || /-g-\d+\.html/i.test(href)) {
      return true;
    }
    const ogType = document.querySelector('meta[property="og:type"]')?.content || "";
    if (/product/i.test(ogType)) return true;
    return false;
  }

  function readJsonLdProduct() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        const list = Array.isArray(data) ? data : [data];
        for (const entry of list) {
          if (entry && (entry["@type"] === "Product" || entry.offers || entry.name)) {
            if (entry["@type"] === "Product") return entry;
          }
        }
      } catch {
        // Ignore malformed JSON-LD
      }
    }
    return null;
  }

  function cleanTitle(raw) {
    if (!raw) return "";
    return raw
      .replace(/\s*[\|\-–—]\s*Temu.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractTitle(jsonLd) {
    if (jsonLd?.name) return cleanTitle(jsonLd.name);

    const h1s = Array.from(document.querySelectorAll("h1"));
    for (const h1 of h1s) {
      const txt = cleanTitle(h1.innerText || h1.textContent);
      if (txt.length >= 6 && txt.length <= 240) {
        return txt;
      }
    }

    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (ogTitle && cleanTitle(ogTitle).length >= 4) {
      return cleanTitle(ogTitle);
    }

    return cleanTitle(document.title) || "Temu artikal";
  }

  function extractImage(jsonLd) {
    if (jsonLd?.image) {
      if (typeof jsonLd.image === "string") return jsonLd.image;
      if (Array.isArray(jsonLd.image) && jsonLd.image[0]) return jsonLd.image[0];
      if (jsonLd.image.url) return jsonLd.image.url;
    }

    const ogImg = document.querySelector('meta[property="og:image"]')?.content;
    if (ogImg && ogImg.startsWith("http")) return ogImg;

    let bestImg = "";
    let bestScore = 0;
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      const src = img.currentSrc || img.src || "";
      if (!src.startsWith("http")) continue;
      if (/avatar|logo|icon|badge|flag|sprite/i.test(src)) continue;

      const rect = img.getBoundingClientRect();
      if (rect.width < 150 || rect.height < 150) continue;

      let score = rect.width * rect.height;
      if (/kwcdn\.com|temu\.com/i.test(src)) score *= 1.5;
      if (rect.top >= 0 && rect.top < window.innerHeight) score *= 1.3;

      if (score > bestScore) {
        bestScore = score;
        bestImg = src;
      }
    }
    return bestImg;
  }

  function extractPrice(jsonLd) {
    if (jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      if (offer && offer.price) {
        const curr = offer.priceCurrency || "€";
        return `${offer.price} ${curr}`;
      }
    }

    const metaAmount = document.querySelector('meta[property="product:price:amount"]')?.content;
    const metaCurr = document.querySelector('meta[property="product:price:currency"]')?.content;
    if (metaAmount) {
      return `${metaAmount} ${metaCurr || "€"}`;
    }

    // Scan visible leaf/small elements in the upper portion of the page for price text
    let bestPrice = "";
    let bestScore = -1;

    const candidates = document.querySelectorAll("span, div, strong, b, p");
    const limit = Math.min(candidates.length, 1500);
    for (let i = 0; i < limit; i++) {
      const el = candidates[i];
      if (el.children.length > 3) continue;
      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 32) continue;

      const match = text.match(PRICE_REGEX);
      if (!match) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.top < 0 || rect.top > window.innerHeight * 1.2) continue;

      const style = window.getComputedStyle(el);
      if (style.textDecorationLine && style.textDecorationLine.includes("line-through")) {
        continue; // Skip crossed-out original prices
      }

      const fontSize = parseFloat(style.fontSize) || 12;
      let score = fontSize * 10;
      if (rect.left > window.innerWidth * 0.35) score += 40; // Main product info is usually right of gallery
      if (rect.top < 650) score += 30;

      if (score > bestScore) {
        bestScore = score;
        bestPrice = match[0].trim();
      }
    }

    return bestPrice;
  }

  function extractProductFromPage() {
    const jsonLd = readJsonLdProduct();
    const rawUrl = window.location.href;
    const cleanUrl = root.TemuWishlistStorage
      ? root.TemuWishlistStorage.cleanTemuUrl(rawUrl)
      : rawUrl;

    return {
      url: cleanUrl,
      goodsId: root.TemuWishlistStorage
        ? root.TemuWishlistStorage.extractGoodsId(cleanUrl)
        : "",
      title: extractTitle(jsonLd),
      priceText: extractPrice(jsonLd),
      image: extractImage(jsonLd)
    };
  }

  function extractProductFromElement(targetEl) {
    if (!targetEl || typeof targetEl.closest !== "function") return null;

    // Find nearest link pointing to a Temu product
    let linkEl = targetEl.closest('a[href*="goods"], a[href*="-g-"]');
    let container = linkEl;

    if (!linkEl) {
      // Walk up a few levels to find a card container that contains a product link
      let cur = targetEl;
      for (let depth = 0; depth < 6 && cur; depth++) {
        const foundLink = cur.querySelector?.('a[href*="goods"], a[href*="-g-"]');
        if (foundLink) {
          linkEl = foundLink;
          container = cur;
          break;
        }
        cur = cur.parentElement;
      }
    }

    if (!linkEl || !linkEl.href) return null;

    const cleanUrl = root.TemuWishlistStorage
      ? root.TemuWishlistStorage.cleanTemuUrl(linkEl.href)
      : linkEl.href;

    const imgEl = container.querySelector("img");
    const image = imgEl ? (imgEl.currentSrc || imgEl.src || "") : "";

    // Find price inside card
    let priceText = "";
    const textNodes = container.querySelectorAll("span, div, strong");
    for (const node of textNodes) {
      const txt = (node.innerText || "").replace(/\s+/g, " ").trim();
      if (txt.length > 0 && txt.length <= 28) {
        const m = txt.match(PRICE_REGEX);
        if (m) {
          const style = window.getComputedStyle(node);
          if (!style.textDecorationLine?.includes("line-through")) {
            priceText = m[0].trim();
            break;
          }
        }
      }
    }

    // Find title inside card
    let title = imgEl?.alt || linkEl.getAttribute("aria-label") || linkEl.title || "";
    if (!title || title.length < 5) {
      for (const node of textNodes) {
        const txt = (node.innerText || "").replace(/\s+/g, " ").trim();
        if (txt.length >= 10 && txt.length <= 180 && !PRICE_REGEX.test(txt)) {
          title = txt;
          break;
        }
      }
    }

    return {
      url: cleanUrl,
      goodsId: root.TemuWishlistStorage
        ? root.TemuWishlistStorage.extractGoodsId(cleanUrl)
        : "",
      title: cleanTitle(title) || "Temu artikal",
      priceText,
      image
    };
  }

  root.TemuExtractor = {
    isProductPage,
    extractProductFromPage,
    extractProductFromElement
  };
})(window);
