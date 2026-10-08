 import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "5mb" }));

const ALLOWED_ORIGINS = [
  "https://adesanyademilade16-dotcom.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0l",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
 "https://codex-hub-prime.vercel.app"
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / some mobile webviews
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.log("CORS blocked origin:", origin);
    return callback(new Error("CORS blocked: " + origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: false
}));

// Explicit preflight so mobile browsers never hang on OPTIONS
app.options("*", (req, res) => {
  const origin = req.headers.origin || "";
  if (isAllowedOrigin(origin) || !origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    return res.status(204).end();
  }
  return res.status(403).end();
});

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
// Current Gemini image model. The Interactions API is used below.
// Keep this list small: older/preview image model IDs should not create
// unnecessary 404/429 traffic when the stable model is available.
const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image"
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

// Premium search APIs (free tiers) — tried before DDG/SearXNG
const SERPER_KEYS = [
  process.env.SERPER_API_KEY,
  process.env.SERPER_API_KEY_2,
  process.env.SERPER_API_KEY_3,
  process.env.SEPER_API_KEY_3 // typo-tolerant
].filter(Boolean);

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3
].filter(Boolean);

const PARALLEL_KEYS = [
  process.env.PARALLEL_API_KEY,
  process.env.PARALLEL_API_KEY_2
].filter(Boolean);

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
    serper_keys: SERPER_KEYS.length,
    firecrawl_keys: FIRECRAWL_KEYS.length,
    parallel_keys: PARALLEL_KEYS.length,
    tools: {
      web_search: "serper+firecrawl+parallel+searxng+ddg+wiki+cache",
      image_search: "serper-images+wikimedia",
      image_gen: "gemini→hf-sd3→hf-sdxl→pollinations",
      vision: "gemini",
      coding_models: OPENROUTER_MODELS,
      groq_models: ["openai/gpt-oss-20b","openai/gpt-oss-120b","qwen/qwen3.6-27b"]
    }
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

async function hydrateVisionImages(images) {
  const out = [];
  for (const img of (images || []).slice(0, 4)) {
    if (!img) continue;
    if (img.data && img.mimeType) {
      out.push({ mimeType: img.mimeType, data: img.data, name: img.name });
      continue;
    }
    const url = typeof img === "string" ? img : (img.url || img.imageUrl || "");
    if (!url || !/^https?:\/\//i.test(url)) continue;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = r.headers.get("content-type") || "image/jpeg";
      out.push({ mimeType: mime.split(";")[0], data: buf.toString("base64"), name: img.name || "image" });
    } catch (e) {
      console.log("hydrate vision url fail", e.message);
    }
  }
  return out;
}

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
function needsWebSearch(text, force) {
  if (force) return true;
  const q = String(text || "").toLowerCase();
  if (q.length < 4) return false;
  if (/^(write|code|html|css|python|explain simply|define|quiz me|flashcard|generate an image|draw)\b/i.test(q.trim()) && !/\b(202[4-9]|movie|news|latest)\b/i.test(q)) return false;
  const triggers = [
    /\b(today|tonight|this week|this month|yesterday|breaking|latest|current|recent|now|2024|2025|2026|2027|2028)\b/i,
    /\b(who is|who won|who are the|president of|prime minister|governor of)\b/i,
    /\b(top \d+|richest|wealthiest|ranking|leaderboard of|list of)\b/i,
    /\b(news|headline|score|match result|exchange rate|price of|stock)\b/i,
    /\b(when is|what time is|schedule for|jamb|waec|neco|post.?utme)\b/i,
    /\b(weather in|temperature in)\b/i,
    /\b(search (the )?(web|online|internet)|online search|do an online|live search|google it)\b/i,
    /\blook up\b/i,
    /\b(movie|film|trailer|box office|cast of|released|premiere|doomsday)\b/i,
    /\b(marvel|spider-?man|avengers|disney|mcu|dr\.?\s*doom|tony stark)\b/i,
    /\b(summarise|summarize).{0,40}\b(movie|film|news)\b/i
  ];
  return triggers.some((re) => re.test(q));
}


function imageProfileForPrompt(prompt) {
  const q = String(prompt || '').toLowerCase();
  const editing = /\b(edit|editing|modify|change|replace|remove|add|fix|retouch|recolor|restyle|transform|turn this|use this image|based on this image|from this image)\b/i.test(q);
  const poster = /\b(poster|flyer|flier|banner|advert|advertisement|promo|promotional|event graphic|social media graphic|cover design)\b/i.test(q);
  const diagram = /\b(diagram|flowchart|flow chart|schematic|infographic|labelled? diagram|labeled? diagram|chart|process map|mind map)\b/i.test(q);
  const scientific = /\b(scientific|biology|biolog(y|ical)|anatom(y|ical)|anatomical|cell|organ|organism|species|dinosaur|fossil|neuron|mitosis|meiosis|chemistry|molecule|atom|physics|laboratory|lab equipment|medical|microscopic|textbook)\b/i.test(q);
  const educational = /\b(educational|school|assignment|homework|lecture|lesson|study|student|academic|exam|revision|teaching|classroom|textbook|figure|illustration for)\b/i.test(q);
  const character = /\b(character|hero|villain|mascot|avatar|person|people|portrait|cosplay|anime|cartoon|superhero|power ranger|spider-?man|batman|goku|naruto)\b/i.test(q);

  let aspectRatio = '1:1';
  let width = 1024;
  let height = 1024;
  if (/\b(16:9|landscape|wide|desktop|youtube|thumbnail|cinematic frame)\b/i.test(q)) { aspectRatio = '16:9'; width = 1344; height = 768; }
  else if (/\b(9:16|portrait|vertical|story|reel|tiktok|phone screen)\b/i.test(q)) { aspectRatio = '9:16'; width = 768; height = 1344; }
  else if (poster) { aspectRatio = '4:5'; width = 1024; height = 1280; }
  else if (/\b(4:3|slide|presentation)\b/i.test(q)) { aspectRatio = '4:3'; width = 1152; height = 864; }
  else if (/\b(3:2)\b/i.test(q)) { aspectRatio = '3:2'; width = 1152; height = 768; }

  let size = (poster || diagram || scientific || educational) ? '2K' : '1K';
  if (process.env.NOVA_IMAGE_SIZE) size = String(process.env.NOVA_IMAGE_SIZE).trim() || size;

  return { editing, poster, diagram, scientific, educational, character, aspectRatio, width, height, size };
}

function enhanceImagePrompt(prompt, referenceProvided = false) {
  const raw = String(prompt || '').trim().replace(/\s+/g, ' ').slice(0, 1600);
  const p = imageProfileForPrompt(raw);
  const additions = [];

  if (p.editing || referenceProvided) {
    additions.push('Use the provided reference image as the source image. Preserve the subject identity, important facial/body features, clothing, pose, and overall composition unless the request explicitly asks to change them. Make only the requested changes.');
  }
  if (p.poster) {
    additions.push('Professional poster/flyer design, strong visual hierarchy, clean composition, readable typography, accurate spelling, balanced margins, polished commercial design, no random extra text, no watermark.');
  } else if (p.diagram) {
    additions.push('Precise educational diagram, clean geometry, uncluttered layout, clear hierarchy, accurate relationships between parts, crisp lines, legible labels only when requested, white or neutral background, no decorative clutter.');
  } else if (p.scientific || p.educational) {
    additions.push('Scientifically plausible educational figure, accurate proportions and structures, textbook-quality clarity, clean neutral background, precise details, no fantasy anatomy, no random labels, no watermark.');
  } else if (p.character) {
    additions.push('Strong subject identity and consistent anatomy, clear silhouette, expressive but natural pose, detailed clothing/materials, polished character illustration or cinematic character render as appropriate.');
  } else {
    additions.push('High-quality polished image, coherent composition, natural anatomy, detailed materials and lighting, strong subject clarity, no watermark.');
  }

  additions.push('Do not add text, labels, logos, signatures, watermarks, or extra objects unless the user explicitly requested them.');
  return (raw + ' ' + additions.join(' ')).slice(0, 3000);
}

async function callGeminiImage(prompt, referenceImages = []) {
  const text = String(prompt || '').trim().slice(0, 2800);
  if (!text || !GEMINI_KEYS.length) {
    console.log('Gemini image skipped: no prompt or Gemini keys');
    return null;
  }

  const profile = imageProfileForPrompt(text);
  const models = GEMINI_IMAGE_MODELS;

  for (const model of models) {
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const key = GEMINI_KEYS[i];
      try {
        const input = [
          {
            type: 'text',
            text: 'Generate or edit the image exactly as requested. Prioritize visual accuracy, subject consistency, readable requested text, and professional composition. Request:\n\n' + text
          }
        ];

        // Gemini 3.1 Flash Image supports image inputs for editing/reference workflows.
        for (const ref of (Array.isArray(referenceImages) ? referenceImages.slice(0, 3) : [])) {
          if (ref?.data && ref?.mimeType && /^image\//i.test(ref.mimeType)) {
            input.push({ type: 'image', mime_type: ref.mimeType, data: String(ref.data).slice(0, 5_500_000) });
          }
        }

        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/interactions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key
            },
            body: JSON.stringify({
              model,
              input,
              response_format: {
                type: 'image',
                mime_type: 'image/jpeg',
                aspect_ratio: profile.aspectRatio,
                image_size: profile.size
              }
            }),
            signal: AbortSignal.timeout(120000)
          }
        );

        const raw = await response.text().catch(() => '');

        if (!response.ok) {
          console.log(`Gemini image key ${i + 1}/${GEMINI_KEYS.length} ${model} -> ${response.status}: ${raw.slice(0, 700)}`);
          if (response.status === 429) {
            const quotaZero = /limit:\s*0\s+(?:requests per day|input tokens per minute)|project has exceeded a quota|too_many_requests/i.test(raw);
            if (quotaZero) {
              console.log('Gemini image quota is exhausted for this request/project; stopping Gemini image retries and moving to HF.');
              break;
            }
          }
          continue;
        }

        let data;
        try { data = JSON.parse(raw); } catch {
          console.log(`Gemini image key ${i + 1}: invalid JSON response`);
          continue;
        }

        const outputImage = data?.output_image;
        if (outputImage?.data) {
          const mime = outputImage.mime_type || outputImage.mimeType || 'image/jpeg';
          console.log(`Gemini image SUCCESS — key ${i + 1}/${GEMINI_KEYS.length}, model: ${model}, ${profile.aspectRatio}, ${profile.size}`);
          return { dataUrl: `data:${mime};base64,${outputImage.data}`, model, provider: 'gemini', aspectRatio: profile.aspectRatio, imageSize: profile.size };
        }

        const steps = Array.isArray(data?.steps) ? data.steps : [];
        for (const step of steps) {
          const blocks = Array.isArray(step?.content) ? step.content : [];
          for (const block of blocks) {
            if (block?.type === 'image' && block?.data) {
              const mime = block.mime_type || block.mimeType || 'image/jpeg';
              console.log(`Gemini image SUCCESS (step) — key ${i + 1}/${GEMINI_KEYS.length}, model: ${model}`);
              return { dataUrl: `data:${mime};base64,${block.data}`, model, provider: 'gemini', aspectRatio: profile.aspectRatio, imageSize: profile.size };
            }
          }
        }

        console.log(`Gemini image key ${i + 1}: HTTP 200 but no image output`);
      } catch (err) {
        console.log(`Gemini image key ${i + 1} threw:`, err?.message || String(err));
      }
    }
  }

  console.log('Gemini image: all configured keys/models failed; moving to Hugging Face fallback');
  return null;
}


async function callHuggingFaceImage(prompt) {
  if (!HUGGINGFACE_KEYS.length) return null;
  const text = String(prompt || '').trim().slice(0, 3000);
  if (!text) return null;
  const profile = imageProfileForPrompt(text);
  // Keep HF dimensions inside the common 1024px generation envelope while
  // preserving the requested aspect ratio. This avoids provider-specific
  // size rejection on portrait/poster/landscape requests.
  const hfScale = Math.min(1, 1024 / profile.width, 1024 / profile.height);
  const hfWidth = Math.max(512, Math.floor((profile.width * hfScale) / 64) * 64);
  const hfHeight = Math.max(512, Math.floor((profile.height * hfScale) / 64) * 64);

  // IMPORTANT: the previous V2 route forced newer models through the
  // "hf-inference" provider even though those models are not served by that
  // provider. That produced HTTP 400 "Model not supported by provider".
  // Use models that are actually supported by the hf-inference text-to-image
  // route. We keep this list conservative so a model/provider change upstream
  // cannot break the whole fallback chain.
  const models = [
    {
      id: 'stabilityai/stable-diffusion-3-medium-diffusers',
      steps: 32,
      guidance: 6.5
    },
    {
      id: 'stabilityai/stable-diffusion-xl-base-1.0',
      steps: 28,
      guidance: 7.0
    }
  ];

  const negativePrompt = [
    'blurry', 'low quality', 'low resolution', 'poor detail',
    'distorted anatomy', 'deformed anatomy', 'bad proportions',
    'extra limbs', 'duplicate objects', 'extra fingers',
    'cropped subject', 'out of frame', 'random text',
    'misspelled text', 'watermark', 'logo', 'signature',
    'artifacts', 'jpeg artifacts'
  ].join(', ');

  async function tryUrl(url, key, label, settings) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Accept: 'image/png'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          num_inference_steps: settings.steps,
          guidance_scale: settings.guidance,
          negative_prompt: negativePrompt,
          width: hfWidth,
          height: hfHeight
        }
      }),
      signal: AbortSignal.timeout(150000)
    });

    const raw = await response.arrayBuffer();
    const ctype = response.headers.get('content-type') || '';

    if (!response.ok) {
      const errText = Buffer.from(raw).toString('utf8');
      console.log(`HF image ${label} -> ${response.status}: ${errText.slice(0, 900)}`);
      return null;
    }

    // Successful text-to-image responses are normally raw image bytes.
    if (!ctype.includes('application/json')) {
      const buf = Buffer.from(raw);
      if (buf.length < 5000) {
        console.log(`HF image ${label}: image response too small (${buf.length} bytes)`);
        return null;
      }
      const mime = ctype.split(';')[0] || 'image/png';
      if (!/^image\//i.test(mime)) {
        console.log(`HF image ${label}: unexpected success content-type ${mime}`);
        return null;
      }
      return {
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
        model: label,
        provider: 'huggingface',
        aspectRatio: profile.aspectRatio
      };
    }

    // Error/queue responses can be JSON. Do not accidentally treat arbitrary
    // JSON as an image. Some providers may return a data URL or image field.
    const jsonText = Buffer.from(raw).toString('utf8');
    let j = null;
    try { j = JSON.parse(jsonText); } catch (_) {}

    if (j?.image && typeof j.image === 'string') {
      const b = j.image.replace(/^data:image\/[^;]+;base64,/, '');
      return {
        dataUrl: 'data:image/png;base64,' + b,
        model: label,
        provider: 'huggingface',
        aspectRatio: profile.aspectRatio
      };
    }
    if (Array.isArray(j?.images) && typeof j.images[0] === 'string') {
      const b = j.images[0].replace(/^data:image\/[^;]+;base64,/, '');
      return {
        dataUrl: 'data:image/png;base64,' + b,
        model: label,
        provider: 'huggingface',
        aspectRatio: profile.aspectRatio
      };
    }

    console.log(`HF image ${label}: successful HTTP response contained no image`);
    return null;
  }

  for (let k = 0; k < HUGGINGFACE_KEYS.length; k++) {
    const key = HUGGINGFACE_KEYS[k];
    for (const spec of models) {
      try {
        const hit = await tryUrl(
          'https://router.huggingface.co/hf-inference/models/' + spec.id,
          key,
          `key ${k + 1}/${HUGGINGFACE_KEYS.length} ${spec.id}`,
          spec
        );
        if (hit) {
          console.log(`HF image SUCCESS — key ${k + 1}/${HUGGINGFACE_KEYS.length}, model: ${spec.id}, ${profile.aspectRatio}`);
          return hit;
        }
      } catch (err) {
        console.log(`HF image ${spec.id} threw:`, err?.message || String(err));
      }
    }
  }

  console.log('Hugging Face image: all supported hf-inference models/keys failed; moving to Pollinations fallback');
  return null;
}

/** Reference / search images (carousel) — NOT AI generation */
function needsReferenceImages(text) {
  const q = String(text || "").toLowerCase();
  if (/\b(generate|create|draw|paint|illustrate|make me)\b.*\b(image|picture|art|logo)\b/i.test(q) &&
      !/\b(search|online|web|google|reference|find|look\s*up)\b/i.test(q)) {
    return false;
  }
  return (
    /\b(show|find|search|look\s*up|bring|reference)\b.{0,50}\b(image|images|picture|pictures|photo|photos|diagram|diagrams)\b/i.test(q) ||
    (/\b(image|images|picture|pictures|photo|photos)\b.{0,40}\b(of|for|about)\b/i.test(q) &&
      /\b(search|online|web|google|reference|find|look\s*up)\b/i.test(q)) ||
    /\blabelled?\s+diagram\b|\banatomy\s+diagram\b|\btextbook\s+figure\b/i.test(q) ||
    (/\b(sea\s+animals?|animals?|species)\b/i.test(q) && /\b(image|images|picture|pictures|photo|photos)\b/i.test(q))
  );
}

function extractReferenceQuery(text) {
  const t = String(text || "").trim();
  let m = t.match(/(?:images?|pictures?|photos?|diagrams?|references?)\s+(?:of|for|about|on)\s+(.+)$/i);
  if (m) return m[1].replace(/[?.!].*$/, "").trim().slice(0, 100);
  m = t.match(/(?:search|look\s*up|find|show)\s+(?:online\s+)?(?:for\s+)?(.+?)(?:\s+and\s+bring|\s+with\s+images?|\s+images?|\s+pictures?)?$/i);
  if (m) return m[1].replace(/[?.!].*$/, "").trim().slice(0, 100);
  return t.replace(/\b(please|online|search|images?|pictures?|photos?|reference|bring|show|me|and)\b/gi, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function needsImageGen(text, hasVision = false) {
  const q = String(text || '').toLowerCase();
  // Reference / web image search is handled separately — do not treat as generation.
  if (needsReferenceImages(text)) return false;
  if (hasVision && /\b(edit|modify|change|replace|remove|add|fix|retouch|recolor|restyle|transform|use this|based on this|from this|make this)\b/i.test(q)) return true;
  return /\b(generate|create|draw|make|design|paint|illustrate|render)\b.*\b(image|picture|photo|illustration|logo|icon|art|diagram|poster|flyer|banner|character|figure|graphic)\b/i.test(q)
    || /\b(image|picture|illustration|diagram|poster|flyer|banner|character|figure)\s+of\b/i.test(q)
    || /\bdraw me\b/i.test(q)
    || /\bdraw and label\b/i.test(q)
    || /\b(educational|scientific|anatomical|biology|medical)\s+(image|figure|illustration|diagram)\b/i.test(q)
    || /\b(create|make|design)\b.{0,60}\b(poster|flyer|banner|character|illustration|infographic)\b/i.test(q)
    || /\bgenerate.{0,50}\b(diagram|labelled?|labeled?|structure|figure|poster|flyer)\b/i.test(q);
}

function extractImagePrompt(text) {
  let raw = String(text || '').trim();

  const chunks = raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length > 1) {
    const imgChunks = chunks.filter((c) =>
      /\b(generate|create|draw|make|design|paint|illustrate|render|image|picture|illustration|poster|flyer|character|diagram|spider|ranger)\b/i.test(c)
    );
    if (imgChunks.length) raw = imgChunks[imgChunks.length - 1];
  }

  raw = raw
    .replace(/^(hey|hi|hello|okay|ok|please|now)[,\s!]*/i, '')
    .replace(/^(i want you to|can you|could you|please)\s+/i, '')
    .trim();

  const lower = raw.toLowerCase();
  const isAssignmentEdu =
    (/\b(assignment|homework|biology|labelled? diagram|labeled? diagram|draw and label|structure of|label the|scientific|anatomical|textbook|educational)\b/i.test(lower) ||
      /\b(amoeba|paramecium|euglena|neuron|organelle|mitosis|meiosis|dinosaur|t-?rex|tyrannosaurus|heart|leaf|flower|cell)\b/i.test(lower)) &&
    !/\b(spider-?man|power\s*ranger|marvel|disney|pixar|superhero|batman|iron\s*man)\b/i.test(lower);

  if (isAssignmentEdu) {
    const subj =
      (raw.match(/(?:structure of|diagram of|image of|picture of|illustration of|label(?:led|ed)?(?: diagram of)?|draw and label)\s+(?:an?\s+)?([^.,\n]{3,90})/i) || [])[1] ||
      raw.replace(/^(generate|create|draw|make|design|show)\s+/i, '').slice(0, 90) || 'specimen';
    const subject = String(subj).replace(/\b(so i can|for my|assignment|homework|please|with labels?).*$/i, '').trim();
    if (/\b(poster|flyer|banner|infographic)\b/i.test(lower)) {
      return enhanceImagePrompt(raw, false);
    }
    return enhanceImagePrompt(
      'Educational subject: ' + subject + '. Create the requested educational/scientific visual with accurate structures and proportions.',
      false
    );
  }

  const subjectHints = [];
  const subjectPatterns = [
    /\b(red\s+power\s+ranger|power\s+rangers?|spider-?man|batman|superman|iron\s*man|wonder\s*woman|avatar\s*aang|goku|naruto)\b/gi,
    /\b(a\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:standing|swinging|fighting|wearing|in\s+a)\b/g,
  ];
  for (const re of subjectPatterns) {
    let m;
    const r2 = new RegExp(re.source, re.flags);
    while ((m = r2.exec(raw)) !== null) {
      const hit = (m[0] || '').replace(/^(a|an|the)\s+/i, '').trim();
      if (hit.length > 3 && hit.length < 60 && !subjectHints.includes(hit)) subjectHints.push(hit);
      if (subjectHints.length >= 3) break;
    }
  }
  const ofMatch = raw.match(/\b(?:image|picture|illustration|drawing|poster|flyer)\s+of\s+([^.,\n]{3,100})/i);
  if (ofMatch) {
    const s = ofMatch[1].trim();
    if (s && !subjectHints.some((h) => h.toLowerCase() === s.toLowerCase())) subjectHints.unshift(s);
  }

  let body = raw.slice(0, 1600);
  if (subjectHints.length) {
    const head = subjectHints.slice(0, 2).join(', ');
    if (!body.toLowerCase().startsWith(head.toLowerCase().slice(0, 12))) body = head + '. ' + body;
  }
  return enhanceImagePrompt(body, false);
}

function pollinationsUrl(prompt) {
  const profile = imageProfileForPrompt(prompt);
  const p = encodeURIComponent(String(prompt || '').slice(0, 1600));
  const seed = Math.floor(Math.random() * 1e9);
  return `https://image.pollinations.ai/prompt/${p}?width=${profile.width}&height=${profile.height}&nologo=true&enhance=true&model=flux&seed=${seed}`;
}


/** Detect if user is asking about a previously generated image */
function isImageFollowUp(text) {
  const q = String(text || "").toLowerCase();
  return /\b(this|that|the)\s+(image|picture|photo|one|drawing|illustration)\b/.test(q)
    || /\b(does it look|look like|resemble|is that|was that|you generated|you created|previous image|last image)\b/.test(q)
    || /\b(which one|between (these|this)|compare.*(image|picture))\b/.test(q)
    || /\b(what did you (draw|generate|create)|describe (the|this|that) image)\b/.test(q);
}

/** Fetch a remote image URL into Gemini vision payload { mimeType, data } */
async function fetchImageAsVision(url) {
  try {
    const u = String(url || "").trim();
    if (!u || !/^https?:\/\//i.test(u)) return null;
    // data URLs
    if (u.startsWith("data:image/")) {
      const mm = u.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (mm) return { mimeType: mm[1], data: mm[2].slice(0, 4_000_000) };
      return null;
    }
    const resp = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) {
      console.log("fetchImageAsVision status", resp.status, u.slice(0, 80));
      return null;
    }
    const ctype = (resp.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!ctype.startsWith("image/")) {
      console.log("fetchImageAsVision not image", ctype);
      return null;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 200 || buf.length > 6_000_000) return null;
    return { mimeType: ctype, data: buf.toString("base64") };
  } catch (e) {
    console.log("fetchImageAsVision error", e.message);
    return null;
  }
}

/** Collect image URLs from recent assistant messages (markdown or plain) */
function collectPastImageUrls(messages, limit) {
  const urls = [];
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0 && urls.length < (limit || 3); i--) {
    const m = list[i];
    if (!m || m.role !== "assistant") continue;
    const c = String(m.content || "");
    const md = c.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|data:image\/[^)\s]+)\)/g);
    for (const hit of md) {
      if (hit[1] && !urls.includes(hit[1])) urls.push(hit[1]);
    }
    const pol = c.matchAll(/(https?:\/\/image\.pollinations\.ai\/[^\s)\]"']+)/g);
    for (const hit of pol) {
      if (hit[1] && !urls.includes(hit[1])) urls.push(hit[1]);
    }
    if (m.imageUrl && !urls.includes(m.imageUrl)) urls.push(m.imageUrl);
  }
  return urls;
}



// ═══════════════════════════════════════════════════════════
// FREE WEB SEARCH: cache + SearXNG multi-instance + DDG + Wiki
// (No API keys. LLM keys do NOT multiply search capacity.)
// ═══════════════════════════════════════════════════════════

const SEARCH_CACHE = new Map(); // key -> { text, at }
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SEARCH_CACHE_MAX = 200;

const KNOWLEDGE_CACHE = new Map(); // normalized topic -> { snippet, at, hits }
const KNOWLEDGE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const KNOWLEDGE_MAX = 150;

/** Public SearXNG instances (rotate on failure). Community-run; may go offline. */
const SEARX_INSTANCES = [
  "https://searx.be",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searx.work",
  "https://search.bus-hit.me",
  "https://searx.fmac.xyz"
];

function normSearchKey(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function getCachedSearch(q) {
  const key = normSearchKey(q);
  const hit = SEARCH_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return hit.text;
}

function setCachedSearch(q, text) {
  if (!text || text.length < 40) return;
  const key = normSearchKey(q);
  if (SEARCH_CACHE.size >= SEARCH_CACHE_MAX) {
    // drop oldest
    let oldest = null, oldestAt = Infinity;
    for (const [k, v] of SEARCH_CACHE) {
      if (v.at < oldestAt) { oldestAt = v.at; oldest = k; }
    }
    if (oldest) SEARCH_CACHE.delete(oldest);
  }
  SEARCH_CACHE.set(key, { text, at: Date.now() });
}

function getKnowledge(q) {
  const key = normSearchKey(q);
  // exact
  let hit = KNOWLEDGE_CACHE.get(key);
  if (hit && Date.now() - hit.at <= KNOWLEDGE_TTL_MS) {
    hit.hits = (hit.hits || 0) + 1;
    return hit.snippet;
  }
  // fuzzy: shared keywords (min 3 significant tokens)
  const tokens = key.split(" ").filter((w) => w.length > 3);
  if (tokens.length < 2) return null;
  let best = null, bestScore = 0;
  for (const [k, v] of KNOWLEDGE_CACHE) {
    if (Date.now() - v.at > KNOWLEDGE_TTL_MS) continue;
    let score = 0;
    for (const w of tokens) if (k.includes(w)) score++;
    if (score >= Math.min(3, tokens.length) && score > bestScore) {
      bestScore = score;
      best = v.snippet;
    }
  }
  return best;
}

function setKnowledge(q, snippet) {
  if (!snippet || snippet.length < 80) return;
  const key = normSearchKey(q);
  if (KNOWLEDGE_CACHE.size >= KNOWLEDGE_MAX) {
    let oldest = null, oldestAt = Infinity;
    for (const [k, v] of KNOWLEDGE_CACHE) {
      if (v.at < oldestAt) { oldestAt = v.at; oldest = k; }
    }
    if (oldest) KNOWLEDGE_CACHE.delete(oldest);
  }
  KNOWLEDGE_CACHE.set(key, { snippet: String(snippet).slice(0, 2500), at: Date.now(), hits: 1 });
}

async function searxSearch(query) {
  const lines = [];
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; CodexHubNova/2.0)" };
  // shuffle order slightly so one dead instance is not always first
  const order = SEARX_INSTANCES.slice().sort(() => Math.random() - 0.5);
  for (const base of order) {
    try {
      const url =
        base.replace(/\/$/, "") +
        "/search?q=" + encodeURIComponent(query) +
        "&format=json&categories=general&language=en-US";
      const r = await fetch(url, { headers: ua, signal: AbortSignal.timeout(9000) });
      if (!r.ok) {
        console.log("SearXNG", base, r.status);
        continue;
      }
      const data = await r.json();
      const results = data.results || [];
      if (!results.length) continue;
      console.log("SearXNG hit:", base, "results:", results.length);
      for (const item of results.slice(0, 8)) {
        const title = (item.title || "").replace(/\s+/g, " ").trim();
        const content = (item.content || item.snippet || "").replace(/\s+/g, " ").trim();
        const link = item.url || item.href || "";
        if (title) {
          lines.push(
            "• " + title +
            (content ? " — " + content.slice(0, 200) : "") +
            (link ? " [" + String(link).slice(0, 140) + "]" : "")
          );
        }
      }
      if (lines.length) return lines;
    } catch (err) {
      console.log("SearXNG error", base, err.message);
    }
  }
  return lines;
}


async function serperSearch(query) {
  const lines = [];
  for (const key of SERPER_KEYS) {
    try {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 8 }),
        signal: AbortSignal.timeout(12000)
      });
      if (!r.ok) {
        console.log("Serper status", r.status);
        continue;
      }
      const data = await r.json();
      if (data.answerBox) {
        const ab = data.answerBox;
        if (ab.answer) lines.push("Direct: " + ab.answer);
        if (ab.snippet) lines.push("AnswerBox: " + ab.snippet);
        if (ab.title) lines.push("AnswerBox title: " + ab.title);
      }
      if (data.knowledgeGraph) {
        const kg = data.knowledgeGraph;
        if (kg.title) lines.push("KG: " + kg.title + (kg.description ? " — " + kg.description : ""));
      }
      for (const item of (data.organic || []).slice(0, 8)) {
        const title = (item.title || "").trim();
        const snip = (item.snippet || "").trim();
        const link = item.link || "";
        if (title) lines.push("• " + title + (snip ? " — " + snip.slice(0, 220) : "") + (link ? " [" + link + "]" : ""));
      }
      if (lines.length) {
        console.log("Serper HIT, results:", lines.length);
        return lines;
      }
    } catch (err) {
      console.log("Serper error:", err.message);
    }
  }
  return lines;
}

/** Serper Images API → real reference photos for carousel */
function isJunkImageResult(title, url) {
  const s = ((title || "") + " " + (url || "")).toLowerCase();
  const junk = [
    "carousel", "mockup", "template", "ui kit", "figma", "framer", "dribbble",
    "behance", "wallpaper pack", "stock mock", "phone mockup", "screenshot",
    "landing page", "web design", "app design", "ux design", "ui design",
    "presentation", "powerpoint", "canva", "pinterest board", "swipeable",
    "component library", "bootstrap", "tailwind ui", "movie poster", "box office",
    "netflix", "watch the best movies", "iphone mock", "device frame",
    "mavi", "interactive component", "how to create a", "account colours"
  ];
  return junk.some((k) => s.includes(k));
}

/** Prefer real wildlife / photo results over UI mockups */
function refineImageQuery(query) {
  let q = String(query || "").trim();
  if (/\b(animal|animals|wildlife|fish|shark|dolphin|whale|octopus|coral|sea|ocean|bird|mammal|species)\b/i.test(q)) {
    q = q + " wildlife nature animal photograph";
  } else if (/\b(diagram|anatomy|labelled|labeled|structure)\b/i.test(q)) {
    q = q + " educational diagram textbook";
  } else if (!/\b(photo|photograph|biology)\b/i.test(q)) {
    q = q + " photograph";
  }
  // Negative keywords as plain text (Serper supports -term)
  q = q + " -mockup -carousel -template -figma -dribbble -behance -ui -ux";
  return q.slice(0, 160);
}

async function serperImageSearch(query, limit = 6) {
  const out = [];
  const q = refineImageQuery(query);
  for (const key of SERPER_KEYS) {
    try {
      const r = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: Math.min(20, limit * 3) }),
        signal: AbortSignal.timeout(12000)
      });
      if (!r.ok) {
        console.log("Serper images status", r.status);
        continue;
      }
      const data = await r.json();
      for (const img of (data.images || [])) {
        if (out.length >= limit) break;
        const url = img.imageUrl || img.thumbnailUrl || img.link;
        if (!url) continue;
        const title = img.title || query;
        if (isJunkImageResult(title, url) || isJunkImageResult(title, img.link || "")) continue;
        out.push({
          url,
          full: img.imageUrl || img.link || url,
          title,
          source: "serper",
          link: img.link || ""
        });
      }
      if (out.length) {
        console.log("Serper images HIT (filtered):", out.length, "q=", q.slice(0, 60));
        return out;
      }
    } catch (err) {
      console.log("Serper images error:", err.message);
    }
  }
  return out;
}

/** Wikimedia Commons — free fallback when Serper has no keys / fails */
async function wikimediaImageSearch(query, limit = 6) {
  const out = [];
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6" +
      "&gsrsearch=" + encodeURIComponent(query) +
      "&gsrlimit=" + limit +
      "&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=640&format=json&origin=*";
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("wikimedia_" + r.status);
    const data = await r.json();
    const pages = data?.query?.pages || {};
    for (const id of Object.keys(pages)) {
      const p = pages[id];
      const info = (p.imageinfo && p.imageinfo[0]) || null;
      if (!info) continue;
      if (info.mime && !/^image\//i.test(info.mime)) continue;
      const src = info.thumburl || info.url;
      if (!src) continue;
      out.push({
        url: src,
        full: info.url || src,
        title: String(p.title || "").replace(/^File:/i, ""),
        source: "wikimedia"
      });
    }
  } catch (err) {
    console.log("Wikimedia images error:", err.message);
  }
  return out;
}

/** Actually probe a candidate image URL rather than trusting search metadata.
 *  Many hotlinked results 404, sit behind hotlink-protection, or have expired —
 *  those render as a broken-image icon client-side. We check that before
 *  ever handing the URL to the student. */
async function urlLooksAlive(url, timeoutMs = 3500) {
  if (!url) return false;
  try {
    let r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CodexHubBot/1.0)" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    // Some CDNs/hosts reject HEAD (405/403) but serve the same URL fine via GET —
    // retry with a small ranged GET before giving up on it.
    if (!r.ok || r.status === 405) {
      r = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { Range: "bytes=0-4096", "User-Agent": "Mozilla/5.0 (compatible; CodexHubBot/1.0)" },
        signal: AbortSignal.timeout(timeoutMs)
      });
    }
    if (!r.ok) return false;
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    // Some hosts omit content-type on HEAD/partial responses — don't punish those,
    // only reject when the header is present and clearly not an image.
    return ct === "" || ct.startsWith("image/");
  } catch (e) {
    return false;
  }
}

/** Filter a candidate list down to real, loadable images, keeping original order. */
async function filterAliveImages(images, limit) {
  const pool = images.slice(0, Math.max(limit * 3, limit));
  const checks = await Promise.allSettled(
    pool.map(async (im) => ({ im, ok: await urlLooksAlive(im.url || im.full) }))
  );
  const alive = [];
  for (const c of checks) {
    if (c.status === "fulfilled" && c.value.ok) alive.push(c.value.im);
  }
  return alive.slice(0, limit);
}

async function searchReferenceImages(query, limit = 6) {
  // Prefer Serper photos, fill gaps from Wikimedia (great for wildlife/educational)
  let images = await serperImageSearch(query, limit * 2);
  let provider = images.length ? "serper" : "none";
  if (images.length < limit * 2) {
    const wiki = await wikimediaImageSearch(query, limit * 2);
    const seen = new Set(images.map((x) => x.full || x.url));
    for (const w of wiki) {
      const key = w.full || w.url;
      if (key && !seen.has(key)) {
        images.push(w);
        seen.add(key);
      }
    }
    if (wiki.length && provider === "none") provider = "wikimedia";
    else if (wiki.length && provider === "serper") provider = "serper+wikimedia";
  }
  // Probe every candidate and only keep ones that actually load — this is what
  // stops broken-image icons from ever reaching the student.
  let alive = await filterAliveImages(images, limit);
  // Still short (e.g. a very narrow query)? Pull a second, wider Wikimedia batch
  // before giving up, so the student still gets something real instead of a gap.
  if (alive.length < Math.min(2, limit)) {
    const more = await wikimediaImageSearch(query + " diagram", limit * 2);
    const seen = new Set(images.map((x) => x.full || x.url));
    const fresh = more.filter((w) => !seen.has(w.full || w.url));
    const aliveMore = await filterAliveImages(fresh, limit - alive.length);
    if (aliveMore.length) {
      alive = alive.concat(aliveMore);
      if (provider.indexOf("wikimedia") === -1) provider += "+wikimedia";
    }
  }
  return { query, provider, images: alive };
}

async function firecrawlSearch(query) {
  const lines = [];
  for (const key of FIRECRAWL_KEYS) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 6 }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) {
        console.log("Firecrawl status", r.status);
        continue;
      }
      const data = await r.json();
      const results = data.data || data.results || [];
      for (const item of results.slice(0, 6)) {
        const title = (item.title || "").trim();
        const desc = (item.description || item.snippet || item.markdown || "").toString().replace(/\s+/g, " ").trim();
        const link = item.url || item.link || "";
        if (title || desc) {
          lines.push("• " + (title || link) + (desc ? " — " + desc.slice(0, 240) : "") + (link ? " [" + link + "]" : ""));
        }
      }
      if (lines.length) {
        console.log("Firecrawl HIT, results:", lines.length);
        return lines;
      }
    } catch (err) {
      console.log("Firecrawl error:", err.message);
    }
  }
  return lines;
}

async function parallelSearch(query) {
  const lines = [];
  for (const key of PARALLEL_KEYS) {
    try {
      const r = await fetch("https://api.parallel.ai/v1/search", {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: query,
          search_queries: [query.slice(0, 80)],
          mode: "fast"
        }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) {
        console.log("Parallel status", r.status, await r.text().catch(() => ""));
        continue;
      }
      const data = await r.json();
      const results = data.results || data.output || data.data || [];
      const arr = Array.isArray(results) ? results : [];
      for (const item of arr.slice(0, 8)) {
        const title = (item.title || item.name || "").trim();
        const snip = (item.excerpts || item.excerpt || item.snippet || item.content || item.text || "").toString();
        const snipFlat = Array.isArray(snip) ? snip.join(" ") : snip;
        const link = item.url || item.link || "";
        if (title || snipFlat) {
          lines.push("• " + (title || "Result") + (snipFlat ? " — " + String(snipFlat).replace(/\s+/g, " ").slice(0, 240) : "") + (link ? " [" + link + "]" : ""));
        }
      }
      // some responses put text at top level
      if (!arr.length && data.answer) lines.push(String(data.answer).slice(0, 500));
      if (lines.length) {
        console.log("Parallel HIT, results:", lines.length);
        return lines;
      }
    } catch (err) {
      console.log("Parallel error:", err.message);
    }
  }
  return lines;
}

/** Full free search pipeline: cache → knowledge → SearXNG → DDG → Wiki */
async function freeWebSearch(query) {
  const q = String(query || "").trim().slice(0, 220);
  if (!q) return "";

  // 0) In-memory cache (helps when many students ask the same thing)
  const cached = getCachedSearch(q);
  if (cached) {
    console.log("Search cache HIT:", q.slice(0, 60));
    return cached + "\n\n_(served from Codex search cache · same query asked recently)_";
  }

  const lines = [];
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; CodexHubNova/2.0; +https://codexhub.app)" };

  // Prior shared knowledge (anonymized public facts from earlier successful searches)
  const prior = getKnowledge(q);
  if (prior) {
    lines.push("PRIOR CODEX KNOWLEDGE (from recent successful searches on this server, not private chats):");
    lines.push(prior);
  }

  // A) Serper (Google results) — best free-tier ranking data
  try {
    const ser = await serperSearch(q);
    if (ser.length) {
      lines.push("Serper (Google) results:");
      lines.push(...ser);
    }
  } catch (err) {
    console.log("Serper pipeline error:", err.message);
  }

  // B) Firecrawl search
  try {
    const fc = await firecrawlSearch(q);
    if (fc.length) {
      lines.push("Firecrawl results:");
      lines.push(...fc);
    }
  } catch (err) {
    console.log("Firecrawl pipeline error:", err.message);
  }

  // C) Parallel AI search
  try {
    const par = await parallelSearch(q);
    if (par.length) {
      lines.push("Parallel AI results:");
      lines.push(...par);
    }
  } catch (err) {
    console.log("Parallel pipeline error:", err.message);
  }

  // If premium search already gave solid results, we can still add free sources as extras
  // 1) SearXNG multi-instance
  try {
    const sx = await searxSearch(q);
    if (sx.length) {
      lines.push("SearXNG web results:");
      lines.push(...sx);
    }
  } catch (err) {
    console.log("SearXNG pipeline error:", err.message);
  }

  // 2) DuckDuckGo Instant
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: ua, signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const data = await r.json();
      if (data.Heading) lines.push(`Topic: ${data.Heading}`);
      if (data.AbstractText) lines.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) lines.push(`Source: ${data.AbstractURL}`);
      if (data.Answer) lines.push(`Direct answer: ${data.Answer}`);
      const related = (data.RelatedTopics || []).slice(0, 6);
      for (const item of related) {
        if (item.Text) lines.push(`• ${item.Text}${item.FirstURL ? " — " + item.FirstURL : ""}`);
        if (item.Topics) {
          for (const sub of (item.Topics || []).slice(0, 2)) {
            if (sub.Text) lines.push(`• ${sub.Text}${sub.FirstURL ? " — " + sub.FirstURL : ""}`);
          }
        }
      }
    }
  } catch (err) {
    console.log("DDG instant error:", err.message);
  }

  // 3) DuckDuckGo HTML
  try {
    const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r2 = await fetch(htmlUrl, { headers: ua, signal: AbortSignal.timeout(12000) });
    if (r2.ok) {
      const html = await r2.text();
      const blockRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)/gi;
      let m, n = 0;
      while ((m = blockRe.exec(html)) && n < 6) {
        const href = m[1].replace(/&amp;/g, "&");
        const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const snip = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (title && title.length > 5) {
          lines.push(`• ${title}${snip ? " — " + snip.slice(0, 180) : ""}${href ? " [" + href.slice(0, 120) + "]" : ""}`);
          n++;
        }
      }
    }
  } catch (err) {
    console.log("DDG html error:", err.message);
  }

  // 4) Wikipedia summary
  try {
    let wikiQ = q.replace(/\b(summarise|summarize|everything about|tell me about|what is|who is|search|online|detail|box office)\b/gi, "").trim().slice(0, 80);
    if (wikiQ.length > 2) {
      const wurl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQ)}`;
      const wr = await fetch(wurl, { headers: ua, signal: AbortSignal.timeout(10000) });
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

  // 5) Wikipedia search
  try {
    const sUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q.slice(0, 120))}&utf8=1&format=json&origin=*`;
    const sr = await fetch(sUrl, { headers: ua, signal: AbortSignal.timeout(10000) });
    if (sr.ok) {
      const sj = await sr.json();
      const hits = (sj.query && sj.query.search) || [];
      hits.slice(0, 5).forEach((h) => {
        lines.push(`Wikipedia hit: ${h.title} — ${(h.snippet || "").replace(/<[^>]+>/g, "")}`);
      });
    }
  } catch (err) {
    console.log("Wiki search error:", err.message);
  }

  // Deduplicate
  const seen = new Set();
  const uniq = [];
  for (const line of lines) {
    const key = line.slice(0, 90);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(line);
  }

  if (!uniq.length) return "";

  const block =
    "LIVE WEB SEARCH (Serper + Firecrawl + Parallel + SearXNG + DDG + Wikipedia). Prefer these facts over training memory. " +
    "If results conflict with old knowledge, trust search. Cite titles/URLs when useful.\\n\\n" +
    uniq.slice(0, 16).join("\\n");

  setCachedSearch(q, block);
  // Store a compact knowledge snippet for similar future questions (public facts only)
  setKnowledge(q, uniq.slice(0, 8).join("\\n"));
  return block;
}

// Back-compat alias
async function duckDuckGoSearch(query) {
  return freeWebSearch(query);
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

  // SECURITY: this endpoint burns paid/rate-limited Groq/Gemini/HF quota per
  // call. The backend URL is public (it's right there in the client JS), so
  // "soft allow" on a missing/invalid token used to mean anyone could call
  // /chat directly with curl and drain the shared API keys for free, with no
  // record of who did it. Every real caller already sends a Firebase ID
  // token (see student-tools-core.js / nova.html) — this now hard-rejects
  // anyone who doesn't.
  if (!idToken) {
    console.log("quota: no id token — rejected");
    return { ok: false, status: 401, body: { error: "auth_required", message: "Sign in to use Nova." } };
  }

  const identity = await verifyFirebaseIdToken(idToken);
  if (!identity || !identity.uid) {
    console.log("quota: invalid token — rejected");
    return { ok: false, status: 401, body: { error: "auth_invalid", message: "Your session expired — please sign in again." } };
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

    let visionImages = await hydrateVisionImages(Array.isArray(images) ? images : []);
    let hasVision = visionImages.length > 0;

    // Latest user text
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const lastUserText = lastUser ? String(lastUser.content || "") : "";

    // ── REFERENCE IMAGE SEARCH (carousel) — real photos, not AI gen ──
    if (needsReferenceImages(lastUserText) && !hasVision) {
      try {
        const q = extractReferenceQuery(lastUserText);
        console.log("Reference image search for:", q);
        const { images, provider } = await searchReferenceImages(q, 6);
        if (images && images.length) {
          const list = images.map((im, i) => `${i + 1}. ${im.title || "Image"} — ${im.full || im.url}`).join("\n");
          const searchSystem =
            (system ? system + "\n\n" : "") +
            "REFERENCE IMAGES (already fetched via " + provider + "). " +
            "Write a short educational description for the student. Do NOT invent Pollinations or fake image URLs. " +
            "The app will display a swipeable carousel of these real images.\n" +
            list;
          fullMessages = [{ role: "system", content: searchSystem }, ...messages.filter((m) => m.role !== "system")];
          // Continue into normal chat so the model describes the animals, then return images for the client
          // We stash images on res for the final response wrapper below via a flag
          req._refImages = images;
          req._refProvider = provider;
        }
      } catch (e) {
        console.log("Reference image search failed:", e.message);
      }
    }

    // ── IMAGE GENERATION ──
    // Order by quality: Gemini → Hugging Face FLUX → Pollinations (last). Puter is client-side fallback.
    if (needsImageGen(lastUserText, hasVision)) {
      // Use only the latest user text; strip any leaked assistant headers
      const cleanUser = String(lastUserText || "")
        .replace(/Here is a generated image[\s\S]*/gi, "")
        .replace(/!\[Generated image\][\s\S]*/gi, "")
        .trim();
      let prompt = extractImagePrompt(cleanUser || lastUserText);
      const referenceRequested = hasVision || /\b(edit|editing|modify|change|replace|remove|add|retouch|recolor|restyle|transform|based on this image|use this image|from this image)\b/i.test(cleanUser || lastUserText);
      prompt = enhanceImagePrompt(prompt, referenceRequested);
      console.log("Enhanced image prompt (" + prompt.length + " chars):", prompt.slice(0, 260));

      // If a reference image is attached, Gemini gets the actual pixels for true
      // edit/reference generation. HF/Pollinations remain text-only fallbacks.
      let fallbackPrompt = prompt;
      if (hasVision) {
        try {
          const descMsgs = [
            { role: "system", content: "Describe the attached reference image for an image generator. Focus on identity, pose, composition, clothing, colors, lighting, and important visual details. Do not describe the chat UI. Do not invent details that are not visible." },
            { role: "user", content: "Describe this reference image for recreation/editing according to this request: " + lastUserText }
          ];
          const gr = await callGemini(descMsgs, visionImages.slice(0, 3));
          if (gr && gr.ok) {
            const gd = await gr.json();
            const desc = gd?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join(" ") || "";
            if (desc && desc.length > 20) fallbackPrompt = enhanceImagePrompt((prompt + ", reference details: " + desc).slice(0, 2500), true);
          }
        } catch (e) {
          console.log("vision fallback description failed", e.message);
        }
      }

      // 1) Gemini image (primary image generator; may be unavailable on free-tier quota)
      try {
        const gemImg = await callGeminiImage(prompt, hasVision ? visionImages : []);
        if (gemImg && gemImg.dataUrl) {
          console.log("Image gen via Gemini:", gemImg.model);
          const content = "Here is the image I generated based on your request.";
          return res.json({
            choices: [{ message: { content } }],
            reply: content,
            image_url: gemImg.dataUrl,
            image_mime_type: gemImg.dataUrl.split(';')[0].replace('data:', ''),
            prompt_used: prompt,
            tool: "gemini-image",
            image_profile: imageProfileForPrompt(prompt)
          });
        }
      } catch (e) {
        console.log("Gemini image path failed:", e.message);
      }

      // 2) Hugging Face Inference (supported hf-inference image models)
      try {
        const hfImg = await callHuggingFaceImage(fallbackPrompt);
        if (hfImg && hfImg.dataUrl) {
          console.log("Image gen via HuggingFace:", hfImg.model);
          const content = "Here is the image I generated based on your request.";
          return res.json({
            choices: [{ message: { content } }],
            reply: content,
            image_url: hfImg.dataUrl,
            image_mime_type: hfImg.dataUrl.split(';')[0].replace('data:', ''),
            prompt_used: fallbackPrompt,
            tool: "huggingface",
            image_profile: imageProfileForPrompt(fallbackPrompt)
          });
        }
      } catch (e) {
        console.log("HF image path failed:", e.message);
      }

      // 3) Pollinations last fallback
      const url = pollinationsUrl(prompt);
      console.log("Image gen via Pollinations:", prompt.slice(0, 120));
      const content = "Here is the image I generated based on your request.";
      return res.json({
        choices: [{ message: { content } }],
        reply: content,
        image_url: url,
        image_mime_type: "image/jpeg",
        prompt_used: fallbackPrompt,
        tool: "pollinations",
        image_profile: imageProfileForPrompt(fallbackPrompt)
      });
    }

    // ── IMAGE MEMORY: if user asks about a past image, load it into vision ──
    const bodyPast = Array.isArray(req.body.pastImageUrls) ? req.body.pastImageUrls : [];
    let pastUrls = bodyPast.filter((u) => typeof u === "string" && u.length > 8).slice(0, 3);
    if (!pastUrls.length && isImageFollowUp(lastUserText)) {
      pastUrls = collectPastImageUrls(messages, 3);
    }
    if (pastUrls.length && !hasVision) {
      console.log("Image memory: loading", pastUrls.length, "past image(s) for vision");
      for (const u of pastUrls) {
        const vis = await fetchImageAsVision(u);
        if (vis) visionImages.push(vis);
      }
      if (visionImages.length) {
        hasVision = true;
        const memSys =
          (system ? system + "\n\n" : "") +
          "IMAGE MEMORY (mandatory):\n" +
          "The user is asking about image(s) attached from this chat. You CAN see the pixel content via vision.\n" +
          "Describe what is ACTUALLY in the image (colors, clothing, face/helmet, pose). " +
          "If it does NOT match what was requested earlier (e.g. user asked for Red Power Ranger but image shows a different person), say so clearly and honestly.\n" +
          "Never claim the image is a specific character unless the visible details support it.\n" +
          "Past image prompt(s) may appear in earlier assistant messages — use them only as context, trust the pixels more.";
        fullMessages = [{ role: "system", content: memSys }, ...messages.filter((m) => m.role !== "system")];
      }
    }


// ── FREE WEB SEARCH when query looks time-sensitive ──
    const forceSearch = !!(req.body && (req.body.forceSearch || req.body.force_search));
    if ((needsWebSearch(lastUserText, forceSearch) || forceSearch) && !hasVision) {
      const antiHallucinate =
        "ANTI-HALLUCINATION RULES (mandatory):\n" +
        "1) Do NOT invent ranked lists, box-office tables, or exact dollar figures unless those numbers appear in the LIVE SEARCH text below.\n" +
        "2) Do NOT invent film titles (e.g. 'Oppenheimer 2', 'Avatar: Way of Water II', 'Barbie Dreamhouse') to fill a top-10 list.\n" +
        "3) If search results are empty, thin, or conflicting: say live search did not return a reliable ranking, list only titles that search actually mentioned, and point the user to Box Office Mojo / The Numbers / Wikipedia for verified charts.\n" +
        "4) Never invent URLs or claim Screen Rant / Box Office Mojo published a table you made up.\n" +
        "5) Prefer admitting uncertainty over a polished fake table. Students need truth, not confidence theater.\n" +
        "6) If the user corrects you, accept the correction and re-check search facts — do not double down on earlier wrong claims from this chat.";

      try {
        console.log("Web search triggered for:", lastUserText.slice(0, 100));
        const searchBlock = await duckDuckGoSearch(lastUserText);
        if (searchBlock && searchBlock.length > 80) {
          const searchSystem =
            (system ? system + "\n\n" : "") +
            searchBlock +
            "\n\n" + antiHallucinate +
            "\nCRITICAL: Answer using the LIVE SEARCH RESULTS above. You DO have web search on Codex Hub when results are present. " +
            "If the user asks about a 2025/2026 movie or current event, use only titles and numbers that appear in search (or clearly label anything else as uncertain).";
          fullMessages = [{ role: "system", content: searchSystem }, ...messages];
        } else {
          console.log("Search returned thin/empty block");
          const sysThin =
            (system ? system + "\n\n" : "") +
            antiHallucinate +
            "\nLIVE SEARCH returned little or no usable data for this query. " +
            "Do NOT invent a top-10 box-office table. Say search was thin, mention only well-known confirmed facts if any, " +
            "and give these links for the student to verify: https://www.boxofficemojo.com/year/world/ https://www.the-numbers.com/ https://en.wikipedia.org/wiki/2026_in_film";
          fullMessages = [{ role: "system", content: sysThin }, ...messages];
        }
      } catch (err) {
        console.log("Search inject failed:", err.message);
        const sys2 =
          (system ? system + "\n\n" : "") +
          antiHallucinate +
          "\nWEB SEARCH timed out or failed. Do NOT invent rankings or dollar amounts. " +
          "Say live search is temporarily unavailable and point to Box Office Mojo / The Numbers. " +
          "You may mention only widely reported film titles without fake grosses.";
        fullMessages = [{ role: "system", content: sys2 }, ...messages];
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
// ─────────────────────────────
// IMAGE SEARCH (carousel for Nova reference photos / diagrams)
// ─────────────────────────────

// ─────────────────────────────
// IMAGE GENERATION (Nova + Student Tools)
// Same chain: Gemini (if quota) → HF SD3 → HF SDXL → Pollinations
// ─────────────────────────────
app.post("/image-gen", async (req, res) => {
  try {
    // Same auth gate as /chat — prevent anonymous quota burn
    try {
      const quotaResult = await enforceNovaQuota(req, res);
      if (quotaResult && quotaResult.ok === false) {
        return res.status(quotaResult.status || 401).json(quotaResult.body);
      }
      if (quotaResult && quotaResult.used != null) {
        res.setHeader("X-Nova-Quota-Used", String(quotaResult.used));
        res.setHeader("X-Nova-Quota-Cap", String(quotaResult.cap || ""));
      }
    } catch (qe) {
      console.log("image-gen quota error", qe.message);
      return res.status(401).json({ error: "auth_required", message: "Sign in to generate images." });
    }

    const promptRaw = String(req.body?.prompt || req.body?.q || req.body?.text || "").trim();
    if (!promptRaw || promptRaw.length < 2) {
      return res.status(400).json({ error: "prompt required" });
    }
    let prompt = extractImagePrompt(promptRaw);
    prompt = enhanceImagePrompt(prompt, false);
    console.log("image-gen:", prompt.slice(0, 160));

    // 1) Gemini (skip quickly on free-tier 0 quota)
    try {
      const gemImg = await callGeminiImage(prompt, []);
      if (gemImg && gemImg.dataUrl) {
        return res.json({
          ok: true,
          image_url: gemImg.dataUrl,
          image_mime_type: (gemImg.dataUrl.split(";")[0] || "").replace("data:", "") || "image/png",
          prompt_used: prompt,
          tool: "gemini-image",
          image_profile: imageProfileForPrompt(prompt)
        });
      }
    } catch (e) {
      console.log("image-gen Gemini failed:", e.message);
    }

    // 2) Hugging Face SD3 / SDXL
    try {
      const hfImg = await callHuggingFaceImage(prompt);
      if (hfImg && hfImg.dataUrl) {
        return res.json({
          ok: true,
          image_url: hfImg.dataUrl,
          image_mime_type: (hfImg.dataUrl.split(";")[0] || "").replace("data:", "") || "image/png",
          prompt_used: prompt,
          tool: "huggingface",
          model: hfImg.model || null,
          image_profile: imageProfileForPrompt(prompt)
        });
      }
    } catch (e) {
      console.log("image-gen HF failed:", e.message);
    }

    // 3) Pollinations
    const url = pollinationsUrl(prompt);
    return res.json({
      ok: true,
      image_url: url,
      image_mime_type: "image/jpeg",
      prompt_used: prompt,
      tool: "pollinations",
      image_profile: imageProfileForPrompt(prompt)
    });
  } catch (error) {
    console.error("image-gen", error);
    return res.status(500).json({ error: "image_gen_failed", message: error.message });
  }
});

app.get("/image-search", async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || "").trim().slice(0, 120);
    const limit = Math.min(10, Math.max(2, Number(req.query.limit) || 6));
    if (!q) return res.status(400).json({ error: "q required", images: [] });
    const result = await searchReferenceImages(q, limit);
    return res.json(result);
  } catch (error) {
    console.error("image-search GET", error);
    return res.status(500).json({ error: "search_failed", images: [] });
  }
});

app.post("/image-search", async (req, res) => {
  try {
    const q = String(req.body?.q || req.body?.query || "").trim().slice(0, 120);
    const limit = Math.min(10, Math.max(2, Number(req.body?.limit) || 6));
    if (!q) return res.status(400).json({ error: "q required", images: [] });
    const result = await searchReferenceImages(q, limit);
    return res.json(result);
  } catch (error) {
    console.error("image-search POST", error);
    return res.status(500).json({ error: "search_failed", images: [] });
  }
});

console.log("📌 Serper keys:", SERPER_KEYS.length, "| Firecrawl:", FIRECRAWL_KEYS.length, "| Parallel:", PARALLEL_KEYS.length);
console.log("📌 Image gen order: Gemini 3.1 Flash Image → HF SD3 Medium → HF SDXL → Pollinations");
console.log("📌 Image search: Serper Images + Wikimedia fallback");
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


/* Nova usage logging (optional Firebase Admin):
 * After a successful Nova reply, increment:
 *   admin.firestore().collection("nova_usage").doc(yyyy-mm-dd).set({
 *     count: admin.firestore.FieldValue.increment(1),
 *     updatedAt: admin.firestore.FieldValue.serverTimestamp()
 *   }, { merge: true });
 * Requires FIREBASE_SERVICE_ACCOUNT on Render.
 */
