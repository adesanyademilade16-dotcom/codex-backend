/**
 * Codex Hub — Tavily search (text + images)
 * Env: TAVILY_API_KEY, TAVILY_API_KEY_2
 *
 * Usage from server.js (ESM):
 *   import {
 *     TAVILY_KEYS,
 *     tavilyWebSearchLines,
 *     tavilyImageSearch,
 *     searchReferenceImagesWithTavily,
 *     needsReferenceImagesSmart
 *   } from "./tavily-search.js";
 *
 * Then:
 *   - Prefer tavilyWebSearchLines before/with serperSearch for news/research
 *   - Replace searchReferenceImages body with searchReferenceImagesWithTavily
 *   - Replace needsReferenceImages with needsReferenceImagesSmart
 */
const fetchFn = globalThis.fetch;

export const TAVILY_KEYS = [
  process.env.TAVILY_API_KEY,
  process.env.TAVILY_API_KEY_2
].filter(Boolean);

async function tavilyRequest(body) {
  let lastErr = null;
  for (const key of TAVILY_KEYS) {
    try {
      const r = await fetchFn("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(18000)
      });
      if (!r.ok) {
        const tx = await r.text().catch(() => "");
        lastErr = new Error("tavily_" + r.status + " " + tx.slice(0, 120));
        continue;
      }
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("no_tavily_keys");
}

/** Probe URL quickly — filter hotlink-blocked / dead images */
export async function probeImageUrl(url, timeoutMs = 4500) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const r = await fetchFn(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "CodexHubImageProbe/1.0" }
    });
    if (r.ok) {
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (ct && !ct.includes("image") && !ct.includes("octet-stream")) {
        // some CDNs omit type on HEAD — still allow
      }
      return true;
    }
    // Some hosts block HEAD → try ranged GET
    const r2 = await fetchFn(url, {
      method: "GET",
      headers: { Range: "bytes=0-1023", "User-Agent": "CodexHubImageProbe/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow"
    });
    return r2.ok || r2.status === 206;
  } catch (e) {
    return false;
  }
}

/**
 * Web/news/research lines compatible with existing serperSearch() consumers.
 */
export async function tavilyWebSearchLines(query, opts = {}) {
  const lines = [];
  if (!TAVILY_KEYS.length) return lines;
  try {
    const data = await tavilyRequest({
      query: String(query || "").slice(0, 400),
      search_depth: opts.depth || "advanced",
      max_results: opts.max || 8,
      include_answer: true,
      include_images: false,
      topic: opts.topic || "general"
    });
    if (data.answer) lines.push("Direct: " + String(data.answer).slice(0, 600));
    for (const item of data.results || []) {
      const title = (item.title || "").trim();
      const snip = (item.content || item.snippet || "").trim();
      const link = item.url || "";
      if (title) {
        lines.push(
          "• " + title + (snip ? " — " + snip.slice(0, 220) : "") + (link ? " [" + link + "]" : "")
        );
      }
    }
    if (lines.length) console.log("Tavily web HIT:", lines.length);
  } catch (e) {
    console.log("Tavily web error:", e.message || e);
  }
  return lines;
}

/**
 * Image search via Tavily (include_images + descriptions).
 * Returns same shape as serperImageSearch: { url, full, title, source, link }
 */
export async function tavilyImageSearch(query, limit = 6) {
  const out = [];
  if (!TAVILY_KEYS.length) return out;
  try {
    const data = await tavilyRequest({
      query: String(query || "").slice(0, 300),
      search_depth: "basic",
      max_results: Math.min(10, Math.max(5, limit)),
      include_images: true,
      include_image_descriptions: true
    });

    const pushImg = (url, title, link) => {
      if (!url || out.length >= limit) return;
      if (out.some((x) => (x.full || x.url) === url)) return;
      out.push({
        url,
        full: url,
        title: title || query,
        source: "tavily",
        link: link || ""
      });
    };

    // Top-level images array
    for (const im of data.images || []) {
      if (typeof im === "string") pushImg(im, query, "");
      else if (im && im.url) pushImg(im.url, im.description || query, "");
    }

    // Per-result page images (often more on-topic)
    for (const item of data.results || []) {
      const pageTitle = item.title || query;
      const pageUrl = item.url || "";
      for (const im of item.images || []) {
        if (typeof im === "string") pushImg(im, pageTitle, pageUrl);
        else if (im && im.url) pushImg(im.url, im.description || pageTitle, pageUrl);
      }
    }

    // Probe filter
    const live = [];
    for (const im of out) {
      if (live.length >= limit) break;
      const ok = await probeImageUrl(im.full || im.url);
      if (ok) live.push(im);
      else console.log("Tavily image dead:", (im.full || "").slice(0, 80));
    }
    console.log("Tavily images HIT (live):", live.length, "raw:", out.length);
    return live.length ? live : out.slice(0, limit); // if all probes fail (network), still return candidates
  } catch (e) {
    console.log("Tavily images error:", e.message || e);
    return out;
  }
}

/**
 * Smart detector: when should Nova attach reference photos?
 * Broader than "show me images of X" — people, products, labelled diagrams, wildlife, landmarks…
 */
export function needsReferenceImagesSmart(text) {
  const q = String(text || "").toLowerCase();

  // Explicit generate/draw → image GEN, not search
  if (
    /\b(generate|create|draw|paint|illustrate|make me)\b.{0,40}\b(image|picture|art|logo|avatar)\b/i.test(q) &&
    !/\b(search|online|web|google|reference|find|look\s*up|labelled|diagram)\b/i.test(q)
  ) {
    return false;
  }

  // Explicit image search intent
  if (
    /\b(show|find|search|look\s*up|bring|reference|pictures?\s+of|photos?\s+of|images?\s+of)\b/i.test(q) &&
    /\b(image|images|picture|pictures|photo|photos|diagram|diagrams|figure)\b/i.test(q)
  ) {
    return true;
  }

  // Labelled academic diagrams
  if (/\blabelled?\s+diagram\b|\banatomy\s+(of|diagram)\b|\btextbook\s+figure\b|\bschematic\s+of\b/i.test(q)) {
    return true;
  }

  // Who / what is [person, product, animal, place] — visual help
  if (
    /\b(who\s+is|who'?s|what\s+does\s+.+look\s+like|show\s+me)\b/i.test(q) ||
    /\b(celebrity|wrestler|actor|actress|footballer|player|singer|rapper)\b/i.test(q)
  ) {
    return true;
  }

  // Devices / products often need a photo
  if (
    /\b(tecno|infinix|samsung|iphone|redmi|pixel|laptop|elitebook|iphone|phone\s+model)\b/i.test(q) &&
    !/\b(price\s+only|code|program)\b/i.test(q)
  ) {
    return true;
  }

  // Nature / creatures / anatomy subjects
  if (
    /\b(sea\s+animals?|underwater|whale|shark|amoeba|cell\s+structure|mitochondria|flower\s+parts|insect)\b/i.test(q)
  ) {
    return true;
  }

  // "diagram of X" / "structure of X"
  if (/\b(diagram|structure|anatomy|labelled?\s+parts?)\s+of\b/i.test(q)) {
    return true;
  }

  return false;
}

export function extractReferenceQuerySmart(text) {
  const t = String(text || "").trim();
  let m = t.match(/(?:images?|pictures?|photos?|diagrams?|references?)\s+(?:of|for|about|on)\s+(.+)$/i);
  if (m) return m[1].replace(/[?.!].*$/, "").trim().slice(0, 120);
  m = t.match(/(?:who(?:'s| is)|what is)\s+(.+)$/i);
  if (m) return m[1].replace(/[?.!].*$/, "").trim().slice(0, 120);
  m = t.match(/(?:diagram|structure|anatomy|labelled?\s+parts?)\s+of\s+(.+)$/i);
  if (m) return m[1].replace(/[?.!].*$/, "").trim().slice(0, 120);
  m = t.match(/(?:search|look\s*up|find|show)\s+(?:online\s+)?(?:for\s+)?(.+?)(?:\s+and\s+bring|\s+with\s+images?|\s+images?|\s+pictures?)?$/i);
  if (m) return m[1].replace(/[?.!].*$/, "").trim().slice(0, 120);
  return t
    .replace(/\b(please|online|search|images?|pictures?|photos?|reference|bring|show|me|and|who(?:'s| is)|what is)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Full pipeline: Tavily → (caller fills Serper/Wikimedia) 
 * This helper only does Tavily; server wraps with existing fallbacks.
 */
export async function searchReferenceImagesWithTavily(query, limit = 6) {
  const images = await tavilyImageSearch(query, limit);
  return {
    query,
    provider: images.length ? "tavily" : "none",
    images
  };
}
