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
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ─────────────────────────────
// SIMPLE IN-MEMORY CACHE (IMPORTANT)
// ─────────────────────────────
const cache = new Map();

function getCacheKey(messages) {
  return JSON.stringify(messages).slice(0, 300);
}

// ─────────────────────────────
// RATE LIMIT (SMART)
// ─────────────────────────────
const rateMap = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();

  const user = rateMap.get(ip) || { count: 0, time: now };

  if (now - user.time > 60000) {
    user.count = 0;
    user.time = now;
  }

  user.count++;

  rateMap.set(ip, user);

  if (user.count > 30) {
    return res.status(429).json({
      error: "Too many requests. Slow down."
    });
  }

  next();
}

// ─────────────────────────────
// HEALTH
// ─────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "PRO AI ONLINE",
    groq: !!GROQ_KEY,
    gemini: !!GEMINI_KEY
  });
});

// ─────────────────────────────
// MAIN CHAT
// ─────────────────────────────
app.post("/chat", rateLimit, async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!messages) {
      return res.status(400).json({ error: "messages required" });
    }

    const cacheKey = getCacheKey(messages);

    // ── CACHE HIT ──
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    const fullMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    let response;

    // ─────────────────────────────
    // GROQ FIRST
    // ─────────────────────────────
    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: fullMessages,
            temperature: 0.7,
            max_tokens: 4096
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        cache.set(cacheKey, data);
        return res.json(data);
      }
    } catch (e) {
      console.log("Groq failed:", e.message);
    }

    // ─────────────────────────────
    // GEMINI FALLBACK
    // ─────────────────────────────
    if (GEMINI_KEY) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: fullMessages
                      .map(m => m.content)
                      .join("\n\n")
                  }
                ]
              }
            ]
          })
        }
      );

      if (response.ok) {
        const data = await response.json();

        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No response";

        const output = {
          choices: [
            {
              message: {
                content: text
              }
            }
          ]
        };

        cache.set(cacheKey, output);
        return res.json(output);
      }
    }

    // ─────────────────────────────
    // SAFE FAIL (NO 500 CRASH)
    // ─────────────────────────────
    return res.json({
      choices: [
        {
          message: {
            content: "AI is busy right now. Try again in a moment."
          }
        }
      ]
    });

  } catch (err) {
    console.error(err);

    return res.json({
      choices: [
        {
          message: {
            content: "Server error but AI is recovering."
          }
        }
      ]
    });
  }
});

// ─────────────────────────────
// START
// ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PRO AI Backend running on ${PORT}`);
  console.log(`📌 Groq active: ${!!GROQ_KEY}`);
  console.log(`📌 Gemini active: ${!!GEMINI_KEY}`);
});
