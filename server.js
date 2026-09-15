 import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "5mb" }));

const ALLOWED_ORIGINS = [
  "https://adesanyademilade16-dotcom.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://localhost:5500"  // if you serve locally with Live Server
    
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS blocked"));
    }
  }
}));

// ─────────────────────────────
// KEYS
// ─────────────────────────────
// 6 Groq keys — 14,400 req/day each = 86,400 req/day total
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
  process.env.GROQ_API_KEY_6
].filter(Boolean);

// 15 Gemini keys × 2 models = 30 combos before falling through
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10,
  process.env.GEMINI_API_KEY_11,
  process.env.GEMINI_API_KEY_12,
  process.env.GEMINI_API_KEY_13,
  process.env.GEMINI_API_KEY_14,
  process.env.GEMINI_API_KEY_15
].filter(Boolean);
// Try gemini-2.0-flash first (highest free quota), then 2.5-flash
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];

// OpenRouter — OpenAI-compatible, free ":free" models, 20 RPM
// Updated June 2026: deepseek/deepseek-r1:free REMOVED (404, no longer free)
// New additions: llama-4-scout, llama-4-maverick, openrouter/free auto-router
const OPENROUTER_KEY    = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",  // 128k ctx, fast & reliable
  "meta-llama/llama-4-scout:free",            // 128k ctx, fast Llama 4
  "meta-llama/llama-4-maverick:free",         // 128k ctx, stronger Llama 4
  "qwen/qwen3-coder:free",                    // 1M ctx, excellent general use
  "openrouter/free"                            // auto-picks best available free model
];

// Mistral — free "Experiment" plan (~1B tokens/month, no card needed)
const MISTRAL_KEY   = process.env.MISTRAL_API_KEY;
const MISTRAL_MODEL = "mistral-small-latest";

// Cerebras — ultra-fast inference
// llama-3.3-70b was DEPRECATED Feb 2026. Current models as of June 2026:
const CEREBRAS_KEY    = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODELS = ["gpt-oss-120b", "zai-glm-4.7"];

// DeepSeek — last-resort fallback
const DEEPSEEK_KEY   = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = "deepseek-chat";

const GROQ_MAX_CHARS = 24000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function truncateForGroq(messages) {
  let total = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  if (total <= GROQ_MAX_CHARS) return messages;
  return messages.map(m => {
    if (m.role === "system" && m.content.length > 8000)
      return { ...m, content: m.content.slice(0, 8000) + "\n\n[...truncated for model context limit...]" };
    if (m.role === "user" && m.content.length > 6000)
      return { ...m, content: m.content.slice(0, 6000) + "\n\n[...truncated...]" };
    return m;
  });
}

// ─────────────────────────────
// HEALTH
// ─────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ONLINE",
    groq_keys: GROQ_KEYS.length,
    gemini_keys: GEMINI_KEYS.length,
    gemini_models: GEMINI_MODELS,
    openrouter: !!OPENROUTER_KEY,
    openrouter_models: OPENROUTER_MODELS,
    mistral: !!MISTRAL_KEY,
    mistral_model: MISTRAL_MODEL,
    cerebras: !!CEREBRAS_KEY,
    cerebras_models: CEREBRAS_MODELS,
    deepseek: !!DEEPSEEK_KEY,
    deepseek_model: DEEPSEEK_MODEL,
    tools: { web_search: "duckduckgo", image_gen: "pollinations", vision: "gemini" }
  });
});

// ─────────────────────────────
// GROQ CALL
// ─────────────────────────────
async function callGroq(key, fullMessages) {
  const safeMessages = truncateForGroq(fullMessages);
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: safeMessages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

// ─────────────────────────────
// GEMINI CALL
// 15 keys × 2 models = 30 combos — never bails early on any error
// ─────────────────────────────
async function callGemini(fullMessages, images = []) {
  const systemMsg = fullMessages.find(m => m.role === "system");
  const turns = fullMessages
    .filter(m => m.role !== "system")
    .map((m, idx, arr) => {
      const parts = [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }];
      // Attach vision images to the last user turn
      if (images && images.length && m.role === "user" && idx === arr.length - 1) {
        for (const img of images.slice(0, 4)) {
          if (img && img.data && img.mimeType) {
            parts.push({
              inline_data: {
                mime_type: img.mimeType,
                data: img.data
              }
            });
          }
        }
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts
      };
    });

  const body = {
    contents: turns.length ? turns : [{ role: "user", parts: [{ text: "Hello" }] }]
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  // ANY error (429, 400, 403, 503) tries the next combo — never bail early
  let lastErrText = "", lastStatus = 500;
  for (let ki = 0; ki < GEMINI_KEYS.length; ki++) {
    const key = GEMINI_KEYS[ki];
    for (let mi = 0; mi < GEMINI_MODELS.length; mi++) {
      const model = GEMINI_MODELS[mi];
      const isLast = ki === GEMINI_KEYS.length - 1 && mi === GEMINI_MODELS.length - 1;
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );
        if (response.ok) {
          console.log(`Gemini success — key index ${ki + 1}, model: ${model}`);
          return response;
        }
        lastStatus = response.status;
        lastErrText = await response.text();
        console.log(`Gemini key${ki + 1}/${model} failed (${lastStatus}), trying next combo...`);
        if (isLast) return new Response(lastErrText, { status: lastStatus });
      } catch (err) {
        console.log(`Gemini key${ki + 1}/${model} threw: ${err.message}`);
        lastErrText = err.message;
        if (isLast) return new Response(lastErrText, { status: 500 });
      }
    }
  }
}

// ─────────────────────────────
// OPENROUTER CALL
// ─────────────────────────────
async function callOpenRouter(fullMessages) {
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`Trying OpenRouter model: ${model}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://adesanyademilade16-dotcom.github.io",
          "X-Title": "Codex Study Hub"
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      if (response.ok) {
        console.log(`OpenRouter success: ${model}`);
        return { response, model };
      }
      const status = response.status;
      const errText = await response.text();
      console.log(`OpenRouter ${model} failed (${status}): ${errText.slice(0, 120)}`);
      if (status !== 429 && status !== 503) {
        return { response: new Response(errText, { status }), model };
      }
    } catch (err) {
      console.log(`OpenRouter ${model} threw: ${err.message}`);
    }
  }
  return null;
}

// ─────────────────────────────
// MISTRAL CALL
// ─────────────────────────────
async function callMistral(fullMessages) {
  return fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

// ─────────────────────────────
// CEREBRAS CALL
// ─────────────────────────────
async function callCerebras(fullMessages) {
  for (const model of CEREBRAS_MODELS) {
    try {
      console.log(`Trying Cerebras model: ${model}`);
      const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${CEREBRAS_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      if (response.ok) {
        console.log(`Cerebras success: ${model}`);
        return response;
      }
      const status = response.status;
      const errText = await response.text();
      console.log(`Cerebras ${model} failed (${status}): ${errText.slice(0, 120)}`);
      if (status !== 429 && status !== 503) return new Response(errText, { status });
    } catch (err) {
      console.log(`Cerebras ${model} threw: ${err.message}`);
    }
  }
  return null;
}

// ─────────────────────────────
// DEEPSEEK CALL
// ─────────────────────────────
async function callDeepSeek(fullMessages) {
  return fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

// ─────────────────────────────
// MAIN CHAT ENDPOINT
//
// Fallback chain (in order):
//   1. Groq (6 keys × retry after 4s if all 429)
//   2. Gemini (15 keys × 2 models = 30 combos)
//   3. OpenRouter (3 free models: Llama 3.3 70B → DeepSeek R1 → Qwen3 Coder)
//   4. Mistral (mistral-small-latest, 256k context)
//   5. Cerebras (gpt-oss-120b → zai-glm-4.7)
//   6. DeepSeek (deepseek-chat)
// ─────────────────────────────

// ─────────────────────────────
// FREE WEB SEARCH (DuckDuckGo — no API key)
// ─────────────────────────────
function needsWebSearch(text) {
  const q = String(text || "").toLowerCase();
  if (q.length < 8) return false;
  // skip pure homework / code / definition drills
  if (/^(write|code|html|css|python|explain simply|define|quiz me|flashcard)/i.test(q.trim())) return false;
  const triggers = [
    /\b(today|tonight|this week|this month|yesterday|breaking|latest|current|recent|now|2024|2025|2026|2027)\b/i,
    /\b(who is|who won|who are the|president of|prime minister|governor of)\b/i,
    /\b(top \d+|richest|wealthiest|ranking|leaderboard of|list of)\b/i,
    /\b(news|headline|score|match result|exchange rate|price of|stock)\b/i,
    /\b(when is|what time is|schedule for|jamb|waec|neco|post.?utme)\b/i,
    /\b(weather in|temperature in)\b/i,
    /\bsearch (the )?(web|online|internet)\b/i,
    /\blook up\b/i
  ];
  return triggers.some((re) => re.test(q));
}

function needsImageGen(text) {
  const q = String(text || "").toLowerCase();
  return /\b(generate|create|draw|make|design|paint|illustrate)\b.*\b(image|picture|photo|illustration|logo|icon|art)\b/i.test(q)
    || /\b(image|picture|illustration) of\b/i.test(q)
    || /\bdraw me\b/i.test(q);
}

function extractImagePrompt(text) {
  let t = String(text || "");
  t = t.replace(/^(please\s+)?(can you\s+)?(generate|create|draw|make|design|paint|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|logo|icon|art)\s+(of\s+)?/i, "");
  t = t.replace(/\b(for me|please|thanks)\b/gi, "").trim();
  return t.slice(0, 300) || String(text).slice(0, 300);
}

function pollinationsUrl(prompt) {
  const p = encodeURIComponent(prompt).replace(/%20/g, "%20");
  return `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true&enhance=true`;
}

async function duckDuckGoSearch(query) {
  const q = String(query || "").trim().slice(0, 200);
  if (!q) return "";
  const lines = [];
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "CodexHubNova/2.0 (study assistant)" },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const data = await r.json();
      if (data.Heading) lines.push(`Topic: ${data.Heading}`);
      if (data.AbstractText) lines.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) lines.push(`Source: ${data.AbstractURL}`);
      if (data.Answer) lines.push(`Answer: ${data.Answer}`);
      const related = (data.RelatedTopics || []).slice(0, 6);
      for (const item of related) {
        if (item.Text) lines.push(`• ${item.Text}${item.FirstURL ? " (" + item.FirstURL + ")" : ""}`);
        if (item.Topics) {
          for (const sub of item.Topics.slice(0, 2)) {
            if (sub.Text) lines.push(`• ${sub.Text}`);
          }
        }
      }
      const results = (data.Results || []).slice(0, 5);
      for (const item of results) {
        if (item.Text) lines.push(`• ${item.Text}${item.FirstURL ? " (" + item.FirstURL + ")" : ""}`);
      }
    }
  } catch (err) {
    console.log("DDG instant error:", err.message);
  }

  // Fallback: DuckDuckGo lite HTML (best-effort, still free)
  if (lines.length < 2) {
    try {
      const lite = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;
      const r2 = await fetch(lite, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CodexHub/2.0)" },
        signal: AbortSignal.timeout(8000)
      });
      if (r2.ok) {
        const html = await r2.text();
        const re = /<a[^>]+rel="nofollow"[^>]*>([^<]{10,120})<\/a>/gi;
        let m, n = 0;
        while ((m = re.exec(html)) && n < 6) {
          const title = m[1].replace(/\s+/g, " ").trim();
          if (title && !/^\d+$/.test(title)) {
            lines.push(`• ${title}`);
            n++;
          }
        }
      }
    } catch (err) {
      console.log("DDG lite error:", err.message);
    }
  }

  if (!lines.length) return "";
  return (
    "LIVE WEB SEARCH RESULTS (DuckDuckGo, free). Use these facts. Cite sources when possible. If results are thin, say so.\n" +
    lines.join("\n")
  );
}


app.post("/chat", async (req, res) => {
  try {
    const { messages, system, images } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages required" });
    }

    let fullMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    const visionImages = Array.isArray(images) ? images.filter(x => x && x.data && x.mimeType).slice(0, 4) : [];
    const hasVision = visionImages.length > 0;

    // Latest user text
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const lastUserText = lastUser ? String(lastUser.content || "") : "";

    // ── FREE IMAGE GENERATION (Pollinations — no key) ──
    if (needsImageGen(lastUserText) && !hasVision) {
      const prompt = extractImagePrompt(lastUserText);
      const url = pollinationsUrl(prompt);
      console.log("Image gen via Pollinations:", prompt.slice(0, 80));
      return res.json({
        choices: [{
          message: {
            content:
              `Here is a generated image for: **${prompt}**\n\n` +
              `![Generated image](${url})\n\n` +
              `Image URL: ${url}\n\n_(Free via Pollinations.ai — no API key.)_`
          }
        }],
        image_url: url,
        tool: "pollinations"
      });
    }

    // ── FREE WEB SEARCH (DuckDuckGo) when query looks time-sensitive ──
    if (needsWebSearch(lastUserText) && !hasVision) {
      try {
        console.log("Web search triggered for:", lastUserText.slice(0, 100));
        const searchBlock = await duckDuckGoSearch(lastUserText);
        if (searchBlock) {
          const searchSystem =
            (system ? system + "\n\n" : "") +
            searchBlock +
            "\n\nAnswer using the search results above when relevant. Prefer current facts from results over training memory.";
          fullMessages = [{ role: "system", content: searchSystem }, ...messages];
        }
      } catch (err) {
        console.log("Search inject failed:", err.message);
      }
    }

    let lastError = null;
    let allGroqRateLimited = GROQ_KEYS.length > 0;

    // ── VISION: prefer Gemini when images are attached ──
    if (hasVision && GEMINI_KEYS.length) {
      try {
        console.log("Vision request — routing to Gemini first");
        const response = await callGemini(fullMessages, visionImages);
        console.log("Gemini vision status:", response.status);
        if (response.ok) {
          const data = await response.json();
          const text =
            data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("\n") ||
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I received the image but could not form a reply.";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        lastError = await response.text();
        console.log("Gemini vision failed, continuing providers…");
      } catch (err) {
        console.log("Gemini vision threw:", err.message);
        lastError = err.message;
      }
    }

    // ── PASS 1: try every Groq key once (text only — skip if pure vision with no text path needed) ──
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        console.log(`Trying Groq key ${i + 1}/${GROQ_KEYS.length}`);
        const response = await callGroq(GROQ_KEYS[i], fullMessages);
        console.log("Groq status:", response.status);
        if (response.ok) return res.json(await response.json());
        if (response.status === 429) { lastError = "groq_429"; continue; }
        if (response.status === 413) {
          console.log("Groq 413 — skipping to fallbacks");
          lastError = "groq_413"; allGroqRateLimited = false; break;
        }
        lastError = await response.text();
        allGroqRateLimited = false;
        break;
      } catch (err) {
        console.log("Groq request failed:", err.message);
        lastError = err.message;
        allGroqRateLimited = false;
      }
    }

    // ── PASS 2: all rate-limited → wait 4s, retry Groq ──
    if (allGroqRateLimited && GROQ_KEYS.length > 0) {
      console.log("All Groq keys rate-limited — waiting 4s then retrying");
      await sleep(4000);
      for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
          const response = await callGroq(GROQ_KEYS[i], fullMessages);
          console.log(`Groq retry key ${i + 1} status:`, response.status);
          if (response.ok) return res.json(await response.json());
          if (response.status === 413) break;
        } catch (_) { /* fall through */ }
      }
    }

    // ── GEMINI FALLBACK (15 keys × 2 models = 30 combos) ──
    if (GEMINI_KEYS.length > 0) {
      console.log("Trying Gemini fallback...");
      try {
        const geminiResponse = await callGemini(fullMessages);
        if (geminiResponse && geminiResponse.ok) {
          const data = await geminiResponse.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        const err = await geminiResponse?.text().catch(() => "unknown");
        console.log("All Gemini combos failed:", err?.slice(0, 120));
        lastError = err;
      } catch (err) {
        console.log("Gemini threw:", err.message);
        lastError = err.message;
      }
    }

    // ── OPENROUTER FALLBACK (3 free models) ──
    if (OPENROUTER_KEY) {
      console.log("Trying OpenRouter fallback...");
      try {
        const result = await callOpenRouter(fullMessages);
        if (result && result.response.ok) {
          const data = await result.response.json();
          const text = data?.choices?.[0]?.message?.content || "No response";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        lastError = "openrouter_all_failed";
      } catch (err) {
        console.log("OpenRouter threw:", err.message);
        lastError = err.message;
      }
    }

    // ── MISTRAL FALLBACK ──
    if (MISTRAL_KEY) {
      console.log("Trying Mistral fallback:", MISTRAL_MODEL);
      try {
        const mistralResponse = await callMistral(fullMessages);
        console.log("Mistral status:", mistralResponse.status);
        if (mistralResponse.ok) {
          const data = await mistralResponse.json();
          const text = data?.choices?.[0]?.message?.content || "No response";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        const err = await mistralResponse.text();
        console.log("Mistral error:", err.slice(0, 120));
        lastError = err;
      } catch (err) {
        console.log("Mistral threw:", err.message);
        lastError = err.message;
      }
    }

    // ── CEREBRAS FALLBACK ──
    if (CEREBRAS_KEY) {
      console.log("Trying Cerebras fallback (models:", CEREBRAS_MODELS.join(", "), ")");
      try {
        const cerebrasResponse = await callCerebras(fullMessages);
        if (cerebrasResponse && cerebrasResponse.ok) {
          const data = await cerebrasResponse.json();
          const text = data?.choices?.[0]?.message?.content || "No response";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        const err = await cerebrasResponse?.text().catch(() => "unknown");
        console.log("Cerebras error:", err?.slice(0, 120));
        lastError = err;
      } catch (err) {
        console.log("Cerebras threw:", err.message);
        lastError = err.message;
      }
    }

    // ── DEEPSEEK FALLBACK ──
    if (DEEPSEEK_KEY) {
      console.log("Trying DeepSeek fallback:", DEEPSEEK_MODEL);
      try {
        const deepseekResponse = await callDeepSeek(fullMessages);
        console.log("DeepSeek status:", deepseekResponse.status);
        if (deepseekResponse.ok) {
          const data = await deepseekResponse.json();
          const text = data?.choices?.[0]?.message?.content || "No response";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        const err = await deepseekResponse.text();
        console.log("DeepSeek error:", err.slice(0, 120));
        lastError = err;
      } catch (err) {
        console.log("DeepSeek threw:", err.message);
        lastError = err.message;
      }
    }

    // ── ALL PROVIDERS EXHAUSTED ──
    return res.json({
      choices: [{ message: { content: "AI is currently busy. Please try again in a moment." } }],
      debug: lastError
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.json({
      choices: [{ message: { content: "Server error but AI is still running." } }]
    });
  }
});

// ─────────────────────────────
// START SERVER
// ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📌 Groq keys: ${GROQ_KEYS.length}`);
  console.log(`📌 Gemini keys: ${GEMINI_KEYS.length} — models: ${GEMINI_MODELS.join(" → ")}`);
  console.log(`📌 OpenRouter enabled: ${!!OPENROUTER_KEY} — models: ${OPENROUTER_MODELS.join(", ")}`);
  console.log(`📌 Mistral enabled: ${!!MISTRAL_KEY} — model: ${MISTRAL_MODEL} (256k ctx)`);
  console.log(`📌 Cerebras enabled: ${!!CEREBRAS_KEY} — models: ${CEREBRAS_MODELS.join(" → ")}`);
  console.log(`📌 DeepSeek enabled: ${!!DEEPSEEK_KEY} — model: ${DEEPSEEK_MODEL}`);
});
