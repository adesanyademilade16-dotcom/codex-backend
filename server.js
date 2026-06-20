import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "5mb" }));

// ─────────────────────────────
// CORS
// ─────────────────────────────
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
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3
].filter(Boolean);

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

// Groq llama-3.1-8b-instant has ~8000 token context window.
// ~1 token ≈ 4 chars, so we cap system+messages at ~24 000 chars to stay safe.
const GROQ_MAX_CHARS = 24000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function truncateForGroq(messages) {
  let total = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  if (total <= GROQ_MAX_CHARS) return messages;

  // Truncate system message first (it usually holds the big PDF context)
  return messages.map(m => {
    if (m.role === "system" && m.content.length > 8000) {
      const trimmed = m.content.slice(0, 8000);
      return { ...m, content: trimmed + "\n\n[...document truncated for model context limit...]" };
    }
    // Also trim oversized user messages
    if (m.role === "user" && m.content.length > 6000) {
      const trimmed = m.content.slice(0, 6000);
      return { ...m, content: trimmed + "\n\n[...truncated...]" };
    }
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
    gemini: !!GEMINI_KEY,
    gemini_model: GEMINI_MODEL
  });
});

// ─────────────────────────────
// GROQ CALL
// ─────────────────────────────
async function callGroq(key, fullMessages) {
  const safeMessages = truncateForGroq(fullMessages);
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
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
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

// ─────────────────────────────
// MAIN CHAT ENDPOINT
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
      const key = GROQ_KEYS[i];
      try {
        console.log(`Trying Groq key ${i + 1}/${GROQ_KEYS.length}`);
        const response = await callGroq(key, fullMessages);
        console.log("Groq status:", response.status);

        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }

        if (response.status === 429) {
          lastError = "groq_429";
          continue; // try next key
        }

        if (response.status === 413) {
          // Payload too large even after truncation — skip Groq entirely, go Gemini
          console.log("Groq 413 — payload too large even after trim, using Gemini");
          lastError = "groq_413";
          allGroqRateLimited = false;
          break;
        }

        // Other hard error
        lastError = await response.text();
        allGroqRateLimited = false;
        break;
      } catch (err) {
        console.log("Groq request failed:", err.message);
        lastError = err.message;
        allGroqRateLimited = false;
      }
    }

    // ── PASS 2: all rate-limited → wait once, retry rotation ──
    if (allGroqRateLimited && GROQ_KEYS.length > 0) {
      console.log("All Groq keys rate-limited — waiting 4s before retry pass");
      await sleep(4000);
      for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
          const response = await callGroq(GROQ_KEYS[i], fullMessages);
          console.log(`Retry pass key ${i + 1} status:`, response.status);
          if (response.ok) {
            const data = await response.json();
            return res.json(data);
          }
          if (response.status === 413) break; // go to Gemini
        } catch (_) { /* fall through */ }
      }
    }

    // ── GEMINI FALLBACK ──
    if (GEMINI_KEY) {
      console.log("Using Gemini fallback:", GEMINI_MODEL);
      try {
        const geminiResponse = await callGemini(fullMessages);

        if (geminiResponse.ok) {
          const data = await geminiResponse.json();
          const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response";

          return res.json({
            choices: [{ message: { content: text } }]
          });
        }

        const err = await geminiResponse.text();
        console.log("Gemini error:", err);
        lastError = err;
      } catch (err) {
        console.log("Gemini request failed:", err.message);
        lastError = err.message;
      }
    }

    // ── FINAL SAFE RESPONSE ──
    return res.json({
      choices: [
        {
          message: {
            content: "AI is currently busy. Please try again in a moment."
          }
        }
      ],
      debug: lastError
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.json({
      choices: [
        { message: { content: "Server error but AI is still running." } }
      ]
    });
  }
});

// ─────────────────────────────
// START SERVER
// ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📌 Groq keys: ${GROQ_KEYS.length}`);
  console.log(`📌 Gemini enabled: ${!!GEMINI_KEY} (${GEMINI_MODEL})`);
});
