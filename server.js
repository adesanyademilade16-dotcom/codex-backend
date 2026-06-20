 import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "5mb" }));

const ALLOWED_ORIGINS = [
  "https://adesanyademilade16-dotcom.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500"
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

// 8 Gemini keys × 2 models = 16 combos before falling through
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8
].filter(Boolean);
// Try gemini-2.0-flash first (highest free quota), then 2.5-flash
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];

// OpenRouter — OpenAI-compatible, free ":free" models, 20 RPM
// Best free models as of June 2026 (large context, high quality)
const OPENROUTER_KEY    = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",   // 128k ctx, fast & reliable
  "deepseek/deepseek-r1:free",                  // 164k ctx, strong reasoning
  "qwen/qwen3-coder:free"                       // 1M ctx, excellent general use
];

// Mistral — free "Experiment" plan (~1B tokens/month, no card needed)
// mistral-small-latest = Mistral Small 4 (256k context)
const MISTRAL_KEY   = process.env.MISTRAL_API_KEY;
const MISTRAL_MODEL = "mistral-small-latest";  // 256k context, OpenAI-compatible

// Cerebras — ultra-fast inference (~3000 tokens/s on WSE hardware)
// llama-3.3-70b was DEPRECATED Feb 2026. Current models as of June 2026:
//   gpt-oss-120b  → production, 120B MoE, ~3000 t/s, 128k ctx
//   zai-glm-4.7   → preview,    355B,     ~1000 t/s, 128k ctx (fallback)
const CEREBRAS_KEY    = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODELS = ["gpt-oss-120b", "zai-glm-4.7"];

// DeepSeek — 64k context, last-resort fallback
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
    deepseek_model: DEEPSEEK_MODEL
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
// Cycles through both API keys × both models (4 combos total).
// gemini-2.0-flash has the highest free quota.
// ─────────────────────────────
async function callGemini(fullMessages) {
  const systemMsg = fullMessages.find(m => m.role === "system");
  const turns = fullMessages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const body = {
    contents: turns.length ? turns : [{ role: "user", parts: [{ text: "Hello" }] }]
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  // Try every key × every model combination until one works
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
// OpenAI-compatible. Tries each free model in turn.
// Free tier: 20 RPM, no daily hard cap on tokens.
// Model IDs use ":free" suffix — $0/M tokens.
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

      // 429 / 503 → try next model; any other error → bail out
      if (status !== 429 && status !== 503) {
        return { response: new Response(errText, { status }), model };
      }
    } catch (err) {
      console.log(`OpenRouter ${model} threw: ${err.message}`);
    }
  }
  return null; // all models failed
}

// ─────────────────────────────
// MISTRAL CALL
// OpenAI-compatible endpoint.
// mistral-small-latest → Mistral Small 4 (256k context, free Experiment plan).
// ~1B tokens/month free, 1 RPS rate limit.
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
// Tries gpt-oss-120b (production, ~3000 t/s) first,
// then zai-glm-4.7 (preview, 355B) as secondary.
// llama-3.3-70b was deprecated Feb 2026.
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
//   1. Groq (3 keys × retry after 4s if all 429)
//   2. Gemini (2 keys × 2 models = 4 combos)
//   3. OpenRouter (3 free models: Llama 3.3 70B → DeepSeek R1 → Qwen3 Coder)
//   4. Mistral (mistral-small-latest, 256k context)
//   5. Cerebras (gpt-oss-120b → zai-glm-4.7)
//   6. DeepSeek (deepseek-chat)
// ─────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages required" });
    }

    const fullMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    let lastError = null;
    let allGroqRateLimited = GROQ_KEYS.length > 0;

    // ── PASS 1: try every Groq key once ──
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

    // ── GEMINI FALLBACK (2 keys × 2 models) ──
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
        lastError = `openrouter_all_failed`;
      } catch (err) {
        console.log("OpenRouter threw:", err.message);
        lastError = err.message;
      }
    }

    // ── MISTRAL FALLBACK (mistral-small-latest, 256k ctx) ──
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
        console.log("Cerebras status:", cerebrasResponse.status);
        if (cerebrasResponse.ok) {
          const data = await cerebrasResponse.json();
          const text = data?.choices?.[0]?.message?.content || "No response";
          return res.json({ choices: [{ message: { content: text } }] });
        }
        const err = await cerebrasResponse.text();
        console.log("Cerebras error:", err.slice(0, 120));
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
