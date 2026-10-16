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
    // Try Authorization Bearer first, then api_key in body (both valid per Tavily docs)
    const attempts = [
      {
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: { ...body }
      },
      {
        headers: { "Content-Type": "application/json" },
        body: { ...body, api_key: key }
      }
    ];
    for (const att of attempts) {
      try {
        const r = await fetchFn("https://api.tavily.com/search", {
          method: "POST",
          headers: att.headers,
          body: JSON.stringify(att.body),
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
  }
  if (lastErr) throw lastErr;
  throw new Error("no_tavily_keys");
}

const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

/** Probe URL quickly — must really be an image (not an HTML page / tiny pixel / dead link) */
export async function probeImageUrl(url, timeoutMs = 4500) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const r = await fetchFn(url, {
      method: "GET",
      redirect: "follow",
      headers: { Range: "bytes=0-4095", "User-Agent": BROWSER_UA, Accept: "image/*" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!(r.ok || r.status === 206)) return false;
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.startsWith("image/") || ct.includes("svg")) return false;
    const len = Number(r.headers.get("content-length") || 0);
    const range = r.headers.get("content-range") || "";
    const total = Number((range.split("/")[1]) || len || 0);
    if (total && total < 3000) return false; // tracking pixels / placeholders
    try { r.body && r.body.cancel && r.body.cancel(); } catch (e) {}
    return true;
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
      topic: opts.topic || (/\b(news|today|latest|this week|yesterday|breaking|current events|headlines)\b/i.test(String(query)) ? "news" : "general"),
      ...(/\b(news|today|latest|this week|yesterday|breaking)\b/i.test(String(query)) ? { days: 7 } : {}),
      include_raw_content: false
    });
    if (data.answer) lines.push("Direct: " + String(data.answer).slice(0, 600));
    for (const item of data.results || []) {
      const title = (item.title || "").trim();
      const snip = (item.content || item.snippet || "").trim();
      const link = item.url || "";
      if (title) {
        lines.push(
          "• " + title + (snip ? " — " + snip.replace(/\s+/g, " ").slice(0, 420) : "") + (link ? " (source: " + link + ")" : "")
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
    // Enrich short/ambiguous queries so Tavily does not return film posters etc.
    let q = String(query || "").trim().slice(0, 280);
    if (q && !/\b(photo|image|picture|portrait)\b/i.test(q)) {
      q = q + " official photo portrait";
    }
    const data = await tavilyRequest({
      query: q,
      max_results: Math.min(10, Math.max(6, limit + 2)),
      search_depth: "advanced",
      include_images: true,
      include_image_descriptions: true
    });

    const pushImg = (url, title, link) => {
      if (!url || out.length >= limit * 3) return;
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

    // Probe ALL candidates in parallel; only return images that really load
    const checks = await Promise.all(out.map((im) => probeImageUrl(im.full || im.url).then((ok) => (ok ? im : null))));
    const live = checks.filter(Boolean).slice(0, limit);
    console.log("Tavily images HIT (live):", live.length, "raw:", out.length);
    return live;
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
