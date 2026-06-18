import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "1mb" }));

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

// gemini-1.5-* and gemini-1.0-* models were fully shut down by Google.
// gemini-2.5-flash is the current GA, cost-efficient model that works on v1beta.
const GEMINI_MODEL = "gemini-2.5-flash";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

// ─────────────────────────────
// GEMINI CALL (fixed model + proper system instruction)
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

        // Hard error (not a rate limit) — stop trying Groq, don't waste the retry pass on it
        lastError = await response.text();
        allGroqRateLimited = false;
        break;
      } catch (err) {
        console.log("Groq request failed:", err.message);
        lastError = err.message;
        allGroqRateLimited = false;
      }
    }

    // ── PASS 2: every key was rate-limited → wait once, then retry the rotation ──
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
        } catch (_) { /* ignore, fall through to Gemini */ }
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

    // ── FINAL SAFE RESPONSE (NO 500 CRASH) ──
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
