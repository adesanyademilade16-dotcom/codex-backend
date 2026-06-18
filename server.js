import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 10000;

// ───────────────────────────────────────────────────────────
// CORS
// ───────────────────────────────────────────────────────────

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
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json({ limit: "1mb" }));

// ───────────────────────────────────────────────────────────
// API KEYS
// ───────────────────────────────────────────────────────────

const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3
].filter(Boolean);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let keyIndex = 0;

function getNextGroqKey() {
  if (GROQ_KEYS.length === 0) return null;

  const key = GROQ_KEYS[keyIndex];

  keyIndex = (keyIndex + 1) % GROQ_KEYS.length;

  return key;
}

// ───────────────────────────────────────────────────────────
// SIMPLE RATE LIMITER
// ───────────────────────────────────────────────────────────

const requests = new Map();

function rateLimit(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.ip;

  const now = Date.now();

  let entry = requests.get(ip);

  if (!entry) {
    entry = {
      count: 0,
      reset: now + 60000
    };
  }

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 60000;
  }

  entry.count++;

  requests.set(ip, entry);

  if (entry.count > 60) {
    return res.status(429).json({
      error: "Too many requests. Please wait."
    });
  }

  next();
}

// ───────────────────────────────────────────────────────────
// HEALTH CHECK
// ───────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "online",
    groqKeys: GROQ_KEYS.length,
    gemini: !!GEMINI_API_KEY
  });
});

// ───────────────────────────────────────────────────────────
// CHAT ENDPOINT
// ───────────────────────────────────────────────────────────

app.post("/chat", rateLimit, async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages array required"
      });
    }

    let response = null;

    // Try every Groq key
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const groqKey = getNextGroqKey();

      console.log(`Trying Groq key ${i + 1}/${GROQ_KEYS.length}`);

      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: system
              ? [
                  {
                    role: "system",
                    content: system
                  },
                  ...messages
                ]
              : messages,
            temperature: 0.7,
            max_tokens: 4096
          })
        }
      );

      console.log("Groq status:", response.status);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    }

    // Gemini fallback
    if (GEMINI_API_KEY) {
      console.log("All Groq keys failed. Using Gemini...");

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
                    text: messages
                      .map(m => `${m.role}: ${m.content}`)
                      .join("\n\n")
                  }
                ]
              }
            ]
          })
        }
      );

      if (!geminiResponse.ok) {
        const err = await geminiResponse.text();

        console.error("Gemini error:", err);

        return res.status(500).json({
          error: "All AI providers failed."
        });
      }

      const geminiData = await geminiResponse.json();

      const text =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response generated.";

      return res.json({
        choices: [
          {
            message: {
              content: text
            }
          }
        ]
      });
    }

    return res.status(500).json({
      error: "No available AI provider."
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    res.status(500).json({
      error: "Internal server error"
    });
  }
});

// ───────────────────────────────────────────────────────────
// START SERVER
// ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Codex Backend running on port ${PORT}`);
  console.log(`📌 Groq keys loaded: ${GROQ_KEYS.length}`);
  console.log(`📌 Gemini enabled: ${!!GEMINI_API_KEY}`);
});
