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
  process.env.GROQ_API_KEY_6,
  process.env.GROQ_API_KEY_7,
  process.env.GROQ_API_KEY_8
].filter(Boolean);

// Gemini keys 1–20 (text + vision). Image models tried separately.
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
  process.env.GEMINI_API_KEY_15,
  process.env.GEMINI_API_KEY_16,
  process.env.GEMINI_API_KEY_17,
  process.env.GEMINI_API_KEY_18,
  process.env.GEMINI_API_KEY_19,
  process.env.GEMINI_API_KEY_20
].filter(Boolean);
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
// Image generation models (try in order; free-tier availability varies)
const GEMINI_IMAGE_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp-image-generation"
];

// OpenRouter — multiple keys + free models (coder models first for coding quality)
const OPENROUTER_KEYS = [
  process.env.OPENROUTER_API_KEY,
  process.env.OPENROUTER_API_KEY_2,
  process.env.OPENROUTER_API_KEY_3,
  process.env.OPENROUTER_API_KEY_4,
  process.env.OPENROUTER_API_KEY_5,
  process.env.OPENROUTER_API_KEY_6,
  process.env.OPENROUTER_API_KEY_7,
  process.env.OPENROUTER_API_KEY_8
].filter(Boolean);
const OPENROUTER_MODELS = [
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-4-scout:free",
  "meta-llama/llama-4-maverick:free",
  "openrouter/free"
];
// legacy single-key alias
const OPENROUTER_KEY = OPENROUTER_KEYS[0] || "";

// Mistral — multiple keys
const MISTRAL_KEYS = [
  process.env.MISTRAL_API_KEY,
  process.env.MISTRAL_API_KEY_2,
  process.env.MISTRAL_API_KEY_3,
  process.env.MISTRAL_API_KEY_4,
  process.env.MISTRAL_API_KEY_5
].filter(Boolean);
const MISTRAL_KEY = MISTRAL_KEYS[0] || "";
const MISTRAL_MODEL = "mistral-small-latest";

// Cerebras — multiple keys
const CEREBRAS_KEYS = [
  process.env.CEREBRAS_API_KEY,
  process.env.CEREBRAS_API_KEY_2,
  process.env.CEREBRAS_API_KEY_3,
  process.env.CEREBRAS_API_KEY_4,
  process.env.CEREBRAS_API_KEY_5,
  process.env.CEREBRAS_API_KEY_6,
  process.env.CEREBRAS_API_KEY_7,
  process.env.CEREBRAS_API_KEY_8
].filter(Boolean);
const CEREBRAS_KEY = CEREBRAS_KEYS[0] || "";
const CEREBRAS_MODELS = ["gpt-oss-120b", "zai-glm-4.7"];

// DeepSeek — multiple keys
const DEEPSEEK_KEYS = [
  process.env.DEEPSEEK_API_KEY,
  process.env.DEEPSEEK_API_KEY_2,
  process.env.DEEPSEEK_API_KEY_3,
  process.env.DEEPSEEK_API_KEY_4
].filter(Boolean);
const DEEPSEEK_KEY = DEEPSEEK_KEYS[0] || "";
const DEEPSEEK_MODEL = "deepseek-chat";

const HUGGINGFACE_KEYS = [
  process.env.HUGGINGFACE_API_KEY,
  process.env.HUGGINGFACE_API_KEY_2,
  process.env.HF_TOKEN
].filter(Boolean);
const HF_IMAGE_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "ByteDance/SDXL-Lightning"
];

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
    openrouter_keys: OPENROUTER_KEYS.length,
    mistral_keys: MISTRAL_KEYS.length,
    cerebras_keys: CEREBRAS_KEYS.length,
    deepseek_keys: DEEPSEEK_KEYS.length,
    gemini_models: GEMINI_MODELS,
    openrouter: OPENROUTER_KEYS.length > 0,
    openrouter_models: OPENROUTER_MODELS,
    mistral: MISTRAL_KEYS.length > 0,
    mistral_model: MISTRAL_MODEL,
    cerebras: CEREBRAS_KEYS.length > 0,
    cerebras_models: CEREBRAS_MODELS,
    deepseek: DEEPSEEK_KEYS.length > 0,
    deepseek_model: DEEPSEEK_MODEL,
    huggingface: HUGGINGFACE_KEYS.length,
    tools: { web_search: "duckduckgo+wiki", image_gen: "gemini-hf-pollinations", vision: "gemini", coding_models: OPENROUTER_MODELS, groq_models: ["openai/gpt-oss-20b","openai/gpt-oss-120b","qwen/qwen3.6-27b"] }
  });
});

// ─────────────────────────────
// GROQ CALL
// ─────────────────────────────
async function callGroq(key, fullMessages) {
  // Aug 2026: Llama free/dev models deprecated → use gpt-oss / qwen free models
  const GROQ_MODELS = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "qwen/qwen3.8-27b"
  ];
  const safeMessages = truncateForGroq(fullMessages);
  let last = null;
  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: safeMessages,
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      if (response.ok) {
        console.log("Groq success model:", model);
        return response;
      }
      console.log("Groq", model, "status:", response.status);
      last = response;
      if (response.status === 429) return response; // rate limit — try next key
    } catch (err) {
      console.log("Groq threw:", err.message);
    }
  }
  return last || new Response("groq_all_models_failed", { status: 404 });
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
  for (const key of OPENROUTER_KEYS) {
    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`Trying OpenRouter key… model: ${model}`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
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
        console.log(`OpenRouter ${model} failed (${status}): ${errText.slice(0, 100)}`);
        if (status === 429 || status === 503) continue;
      } catch (err) {
        console.log(`OpenRouter threw: ${err.message}`);
      }
    }
  }
  return null;
}

// ─────────────────────────────
// MISTRAL CALL
// ─────────────────────────────
async function callMistral(fullMessages) {
  let last = null;
  for (const key of MISTRAL_KEYS) {
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      if (response.ok) return response;
      last = response;
      if (response.status !== 429 && response.status !== 503) return response;
    } catch (err) {
      console.log("Mistral threw:", err.message);
    }
  }
  return last || new Response("mistral_exhausted", { status: 503 });
}

// ─────────────────────────────
// CEREBRAS CALL
// ─────────────────────────────
async function callCerebras(fullMessages) {
  for (const key of CEREBRAS_KEYS) {
    for (const model of CEREBRAS_MODELS) {
      try {
        console.log(`Trying Cerebras model: ${model}`);
        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
        console.log(`Cerebras ${model} status:`, response.status);
      } catch (err) {
        console.log(`Cerebras threw: ${err.message}`);
      }
    }
  }
  return null;
}

// ─────────────────────────────
// DEEPSEEK CALL
// ─────────────────────────────
async function callDeepSeek(fullMessages) {
  let last = null;
  for (const key of DEEPSEEK_KEYS) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      if (response.ok) return response;
      last = response;
      if (response.status !== 429) return response;
    } catch (err) {
      console.log("DeepSeek threw:", err.message);
    }
  }
  return last || new Response("deepseek_exhausted", { status: 503 });
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
  if (q.length < 6) return false;
  // skip pure homework / code / definition drills
  if (/^(write|code|html|css|python|explain simply|define|quiz me|flashcard|generate an image|draw)/i.test(q.trim())) return false;
  const triggers = [
    /\b(today|tonight|this week|this month|yesterday|breaking|latest|current|recent|now|2024|2025|2026|2027|2028)\b/i,
    /\b(who is|who won|who are the|president of|prime minister|governor of)\b/i,
    /\b(top \d+|richest|wealthiest|ranking|leaderboard of|list of)\b/i,
    /\b(news|headline|score|match result|exchange rate|price of|stock)\b/i,
    /\b(when is|what time is|schedule for|jamb|waec|neco|post.?utme)\b/i,
    /\b(weather in|temperature in)\b/i,
    /\bsearch (the )?(web|online|internet)\b/i,
    /\blook up\b/i,
    /\b(movie|film|trailer|box office|cast of|released|premiere)\b/i,
    /\b(marvel|spider-?man|avengers|disney)\b/i,
    /\b(summarise|summarize).{0,40}\b(movie|film|news)\b/i
  ];
  return triggers.some((re) => re.test(q));
}


async function callGeminiImage(prompt) {
  const text = String(prompt || "").slice(0, 800);
  for (const key of GEMINI_KEYS) {
    for (const model of GEMINI_IMAGE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Generate a high-quality image: " + text }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
          })
        });
        if (!response.ok) {
          console.log("Gemini image", model, response.status);
          continue;
        }
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          const inline = part.inlineData || part.inline_data;
          if (inline && inline.data) {
            const mime = inline.mimeType || inline.mime_type || "image/png";
            return { dataUrl: `data:${mime};base64,${inline.data}`, model };
          }
        }
      } catch (err) {
        console.log("Gemini image threw:", err.message);
      }
    }
  }
  return null;
}


async function callHuggingFaceImage(prompt) {
  if (!HUGGINGFACE_KEYS.length) return null;
  const text = String(prompt || "").slice(0, 500);
  for (const key of HUGGINGFACE_KEYS) {
    for (const model of HF_IMAGE_MODELS) {
      try {
        // Router / inference providers text-to-image
        const url = `https://router.huggingface.co/hf-inference/models/${model}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Accept: "image/png"
          },
          body: JSON.stringify({ inputs: text, parameters: { num_inference_steps: 4 } })
        });
        if (!response.ok) {
          const errT = await response.text().catch(() => "");
          console.log("HF image", model, response.status, errT.slice(0, 120));
          continue;
        }
        const ctype = response.headers.get("content-type") || "";
        if (ctype.includes("application/json")) {
          const j = await response.json();
          console.log("HF json err", JSON.stringify(j).slice(0, 150));
          continue;
        }
        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length < 500) continue;
        const b64 = buf.toString("base64");
        return { dataUrl: `data:image/png;base64,${b64}`, model };
      } catch (err) {
        console.log("HF image threw:", err.message);
      }
    }
  }
  return null;
}

function needsImageGen(text) {
  const q = String(text || "").toLowerCase();
  return /\b(generate|create|draw|make|design|paint|illustrate)\b.*\b(image|picture|photo|illustration|logo|icon|art|diagram)\b/i.test(q)
    || /\b(image|picture|illustration|diagram) of\b/i.test(q)
    || /\bdraw me\b/i.test(q)
    || /\bdraw and label\b/i.test(q)
    || /\b(structure of|labelled? diagram|biology assignment).{0,40}\b(amoeba|cell|heart|neuron|leaf|flower)\b/i.test(q)
    || /\bgenerate.{0,30}\b(diagram|labelled?|structure)\b/i.test(q);
}

function extractImagePrompt(text) {
  let raw = String(text || "");
  const lower = raw.toLowerCase();

  // Educational / textbook diagram intent
  const edu = raw.match(
    /(?:draw and label|draw|label|structure of|diagram of|illustration of|generate(?: an?)?(?: image| diagram| picture)?(?: of)?|labelled? diagram of)\s+(?:the\s+)?(?:structure of\s+)?(?:an?\s+)?([A-Za-z][A-Za-z0-9 \-]{2,60})/i
  );
  if (edu) {
    let subject = edu[1].replace(/\b(so i can|for my|assignment|copy|learn|labelling|labeling|please|thanks).*$/i, "").trim();
    subject = subject.replace(/\b(image|picture|diagram)\b/gi, "").trim() || "specimen";
    const isBio = /amoeba|cell|bacteria|virus|heart|brain|neuron|leaf|flower|kidney|lung|bone|tissue|organelle|paramecium|euglena/i.test(subject + " " + lower);
    if (isBio || /biology|assignment|label/i.test(lower)) {
      return (
        "clean educational 2D textbook diagram of " + subject +
        ", black outline on white background, clearly labeled parts with leader lines and text labels, " +
        "simple scientific school biology illustration, flat diagram style, not photorealistic, not 3D render, not abstract art"
      );
    }
    return (
      "clean educational 2D labeled diagram of " + subject +
      ", white background, clear outlines, textbook illustration style, high quality"
    );
  }

  // Strip chat fluff
  let t = raw
    .replace(/^(okay|ok|hi|hello|please|now)[,\s]+/i, "")
    .replace(/\b(i was wondering if you can|can you|could you|please|for me|thanks|thank you)\b/gi, " ")
    .replace(/\b(my biology assignment they asked us to|assignment they asked us to|i want to|so i can draw it and use it for my assignment)\b/gi, " ")
    .replace(/\b(generate|create|draw|make|design|paint|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|logo|icon|art|diagram)\s+(of\s+)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (t.length < 8) t = raw.slice(0, 200);
  // Prefer short subject-focused prompt
  if (t.length > 160) {
    const m2 = t.match(/\b(amoeba|[a-z]{4,20} (?:cell|structure|diagram))\b/i);
    if (m2) t = m2[0];
  }
  return t.slice(0, 280);
}

function pollinationsUrl(prompt) {
  const p = encodeURIComponent(String(prompt || "").slice(0, 400));
  // seed helps variety; model=flux often cleaner for diagrams on pollinations
  return `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true&enhance=true&model=flux`;
}

async function duckDuckGoSearch(query) {
  const q = String(query || "").trim().slice(0, 220);
  if (!q) return "";
  const lines = [];
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; CodexHubNova/2.0; +https://codexhub.app)" };

  // 1) DuckDuckGo Instant Answer
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: ua, signal: AbortSignal.timeout(9000) });
    if (r.ok) {
      const data = await r.json();
      if (data.Heading) lines.push(`Topic: ${data.Heading}`);
      if (data.AbstractText) lines.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) lines.push(`Source: ${data.AbstractURL}`);
      if (data.Answer) lines.push(`Direct answer: ${data.Answer}`);
      const related = (data.RelatedTopics || []).slice(0, 8);
      for (const item of related) {
        if (item.Text) lines.push(`• ${item.Text}${item.FirstURL ? " — " + item.FirstURL : ""}`);
        if (item.Topics) {
          for (const sub of (item.Topics || []).slice(0, 3)) {
            if (sub.Text) lines.push(`• ${sub.Text}${sub.FirstURL ? " — " + sub.FirstURL : ""}`);
          }
        }
      }
      for (const item of (data.Results || []).slice(0, 5)) {
        if (item.Text) lines.push(`• ${item.Text}${item.FirstURL ? " — " + item.FirstURL : ""}`);
      }
    }
  } catch (err) {
    console.log("DDG instant error:", err.message);
  }

  // 2) DuckDuckGo HTML (broader web results)
  try {
    const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r2 = await fetch(htmlUrl, { headers: ua, signal: AbortSignal.timeout(10000) });
    if (r2.ok) {
      const html = await r2.text();
      // result titles + snippets
      const blockRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)/gi;
      let m, n = 0;
      while ((m = blockRe.exec(html)) && n < 8) {
        const href = m[1].replace(/&amp;/g, "&");
        const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const snip = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (title && title.length > 5) {
          lines.push(`• ${title}${snip ? " — " + snip.slice(0, 180) : ""}${href ? " [" + href.slice(0, 120) + "]" : ""}`);
          n++;
        }
      }
      if (n === 0) {
        // fallback title-only
        const titleRe = /class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
        while ((m = titleRe.exec(html)) && n < 6) {
          const title = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          if (title && title.length > 8) { lines.push(`• ${title}`); n++; }
        }
      }
    }
  } catch (err) {
    console.log("DDG html error:", err.message);
  }

  // 3) Wikipedia summary (good for named entities / films)
  try {
    const wikiQ = q.replace(/\b(summarise|summarize|everything about|tell me about|what is|who is)\b/gi, "").trim().slice(0, 80);
    if (wikiQ.length > 2) {
      const wurl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQ)}`;
      const wr = await fetch(wurl, { headers: ua, signal: AbortSignal.timeout(6000) });
      if (wr.ok) {
        const w = await wr.json();
        if (w.extract) {
          lines.push(`Wikipedia (${w.title || wikiQ}): ${w.extract}`);
          if (w.content_urls && w.content_urls.desktop) lines.push(`Wiki URL: ${w.content_urls.desktop.page}`);
        }
      }
    }
  } catch (err) {
    console.log("Wiki error:", err.message);
  }

  // Deduplicate
  const seen = new Set();
  const uniq = [];
  for (const line of lines) {
    const key = line.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(line);
  }

  if (!uniq.length) return "";
  return (
    "LIVE WEB SEARCH (DuckDuckGo + Wikipedia, free). Prefer these facts over training memory. " +
    "If results conflict with old knowledge, trust search. Cite titles/URLs when useful.\\n\\n" +
    uniq.slice(0, 14).join("\\n")
  );
}



// ─────────────────────────────
// BACKEND QUOTA (strict-ish via Firebase ID token + Firestore)
// Client must send: Authorization: Bearer <Firebase ID token>
// and body.quotaCost (1–4). Server reads/writes users/{uid}.novaDaily
// ─────────────────────────────
const NOVA_DAILY_CAPS = { free: 40, regular: 250, pro: 600 };
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || "";

function todayKeyWAT() {
  // Approximate local day; clients also reset on local date
  const d = new Date();
  return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate();
}

function normTierQ(tier) {
  tier = String(tier || "free").toLowerCase();
  if (tier.includes("pro")) return "pro";
  if (tier.includes("regular") || tier.includes("premium")) return "regular";
  return "free";
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken) return null;
  try {
    // Verify via Google tokeninfo (works for Firebase ID tokens)
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!r.ok) {
      // Fallback: accounts:lookup needs API key
      if (FIREBASE_API_KEY) {
        const r2 = await fetch(
          "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
          }
        );
        if (!r2.ok) return null;
        const data = await r2.json();
        const u = data.users && data.users[0];
        return u ? { uid: u.localId, email: u.email } : null;
      }
      return null;
    }
    const data = await r.json();
    if (!data.sub) return null;
    return { uid: data.user_id || data.sub, email: data.email };
  } catch (e) {
    console.log("token verify failed", e.message);
    return null;
  }
}

async function firestoreGetUser(uid, idToken) {
  // Use Firestore REST with user ID token (user can read own doc if rules allow)
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "";
  if (!projectId || !idToken) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + idToken } });
    if (!r.ok) return null;
    const doc = await r.json();
    const f = doc.fields || {};
    const tier =
      (f.subscriptionTier && f.subscriptionTier.stringValue) ||
      (f.plan && f.plan.stringValue) ||
      "free";
    let used = 0;
    let date = "";
    if (f.novaDaily && f.novaDaily.mapValue && f.novaDaily.mapValue.fields) {
      const nd = f.novaDaily.mapValue.fields;
      used = Number((nd.used && (nd.used.integerValue || nd.used.doubleValue)) || 0);
      date = (nd.date && nd.date.stringValue) || "";
    }
    if (date !== todayKeyWAT()) used = 0;
    return { tier, used, date };
  } catch (e) {
    console.log("firestore get user", e.message);
    return null;
  }
}

async function firestorePatchNovaDaily(uid, idToken, used) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "";
  if (!projectId || !idToken) return false;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=novaDaily`;
    const body = {
      fields: {
        novaDaily: {
          mapValue: {
            fields: {
              date: { stringValue: todayKeyWAT() },
              used: { integerValue: String(used) }
            }
          }
        }
      }
    };
    const r = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + idToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return r.ok;
  } catch (e) {
    console.log("firestore patch quota", e.message);
    return false;
  }
}

async function enforceNovaQuota(req, res) {
  const auth = req.headers.authorization || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (req.body && req.body.idToken) || "";
  const cost = Math.min(4, Math.max(1, Number((req.body && req.body.quotaCost) || 1)));

  // If no token, allow but mark soft (legacy clients) — prefer hard reject in production
  if (!idToken) {
    console.log("quota: no id token — soft allow");
    return { ok: true, soft: true, cost };
  }

  const identity = await verifyFirebaseIdToken(idToken);
  if (!identity || !identity.uid) {
    console.log("quota: invalid token");
    return { ok: true, soft: true, cost }; // don't lock out if verify fails
  }

  const userDoc = await firestoreGetUser(identity.uid, idToken);
  const tier = normTierQ(userDoc && userDoc.tier);
  const cap = NOVA_DAILY_CAPS[tier] || 40;
  const used = (userDoc && userDoc.used) || 0;
  if (used + cost > cap) {
    return {
      ok: false,
      status: 402,
      body: {
        error: "quota_exceeded",
        message: "Nova Charge empty for today. Come back tomorrow or upgrade.",
        used,
        cap,
        cost,
        tier
      }
    };
  }
  const newUsed = used + cost;
  await firestorePatchNovaDaily(identity.uid, idToken, newUsed);
  return { ok: true, cost, used: newUsed, cap, tier, uid: identity.uid };
}

app.post("/chat", async (req, res) => {
  // Strict-ish daily quota (Firebase token + Firestore novaDaily)
  try {
    const quotaResult = await enforceNovaQuota(req, res);
    if (quotaResult && quotaResult.ok === false) {
      return res.status(quotaResult.status || 402).json(quotaResult.body);
    }
    if (quotaResult && quotaResult.used != null) {
      res.setHeader("X-Nova-Quota-Used", String(quotaResult.used));
      res.setHeader("X-Nova-Quota-Cap", String(quotaResult.cap || ""));
    }
  } catch (qe) {
    console.log("quota enforce error", qe.message);
  }

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
    // Image gen: Gemini image models first, Pollinations fallback
    if (needsImageGen(lastUserText)) {
      let prompt = extractImagePrompt(lastUserText);
      if (hasVision) {
        try {
          const descMsgs = [
            { role: "system", content: "Describe the main subject in the attached image in one detailed visual paragraph for an image generator. Include hair, face, clothing, style. No chat UI description." },
            { role: "user", content: "Describe this reference image for recreation: " + lastUserText }
          ];
          const gr = await callGemini(descMsgs, visionImages);
          if (gr && gr.ok) {
            const gd = await gr.json();
            const desc = gd?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join(" ") || "";
            if (desc && desc.length > 20) {
              prompt = (prompt + ", " + desc).slice(0, 450);
            }
          }
        } catch (e) {
          console.log("vision ref for image gen failed", e.message);
        }
      }
      if (/\b(amoeba|diagram|label|biology|structure of|textbook)\b/i.test(prompt + lastUserText)) {
        // keep educational prompt as-is
      } else if (/\b(anya|forger|anime|manga|aang|avatar)\b/i.test(prompt + lastUserText)) {
        prompt = prompt + ", clean 2D animation style, sharp lines, high quality illustration";
      } else if (!/textbook|diagram|label/i.test(prompt)) {
        prompt = prompt + ", high quality, detailed";
      }

      // 1) Gemini native image (better quality when available)
      try {
        const gemImg = await callGeminiImage(prompt);
        if (gemImg && gemImg.dataUrl) {
          console.log("Image gen via Gemini:", gemImg.model);
          const content =
            "Here is a generated image for: **" + prompt.slice(0, 120) + "**\n\n" +
            "![Generated image](" + gemImg.dataUrl + ")\n\n" +
            "_(Generated with Gemini · tap image to enlarge)_";
          return res.json({
            choices: [{ message: { content } }],
            image_url: gemImg.dataUrl,
            tool: "gemini-image"
          });
        }
      } catch (e) {
        console.log("Gemini image path failed:", e.message);
      }

      // 2) Hugging Face Inference (optional)
      try {
        const hfImg = await callHuggingFaceImage(prompt);
        if (hfImg && hfImg.dataUrl) {
          console.log("Image gen via HuggingFace:", hfImg.model);
          const content =
            "Here is a generated image for: **" + prompt.slice(0, 120) + "**\n\n" +
            "![Generated image](" + hfImg.dataUrl + ")\n\n" +
            "_(Generated with Hugging Face · tap to enlarge)_";
          return res.json({
            choices: [{ message: { content } }],
            image_url: hfImg.dataUrl,
            tool: "huggingface"
          });
        }
      } catch (e) {
        console.log("HF image path failed:", e.message);
      }

      // 3) Pollinations free URL fallback
      const url = pollinationsUrl(prompt);
      console.log("Image gen via Pollinations:", prompt.slice(0, 100));
      const content =
        "Here is a generated image for: **" + prompt.slice(0, 120) + "**\n\n" +
        "![Generated image](" + url + ")\n\n" +
        "_(Tap image to enlarge · Download below · Free fallback)_";
      return res.json({
        choices: [{ message: { content } }],
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
            "\n\nCRITICAL: Answer using the LIVE SEARCH RESULTS above. If the user asks about a 2025/2026 movie or current event, do NOT substitute older comic arcs or past films unless search says so. Prefer search facts over training memory. If search is thin, say so clearly.";
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
    if (OPENROUTER_KEYS.length > 0) {
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
    if (MISTRAL_KEYS.length > 0) {
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
    if (CEREBRAS_KEYS.length > 0) {
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
    if (DEEPSEEK_KEYS.length > 0) {
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
  console.log(`📌 OpenRouter keys: ${OPENROUTER_KEYS.length} — models: ${OPENROUTER_MODELS.join(", ")}`);
  console.log(`📌 Mistral keys: ${MISTRAL_KEYS.length} — model: ${MISTRAL_MODEL} (256k ctx)`);
  console.log(`📌 Cerebras keys: ${CEREBRAS_KEYS.length} — models: ${CEREBRAS_MODELS.join(" → ")}`);
  console.log(`📌 HuggingFace keys: ${HUGGINGFACE_KEYS.length}`);
  console.log(`📌 DeepSeek keys: ${DEEPSEEK_KEYS.length} — model: ${DEEPSEEK_MODEL}`);
});
