import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

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
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json({ limit: "1mb" }));

// ─────────────────────────────
// KEYS
// ─────────────────────────────
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

// ─────────────────────────────
// HEALTH CHECK
// ─────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "online",
    groqKeys: GROQ_KEYS.length,
    gemini: !!GEMINI_API_KEY
  });
});

// ─────────────────────────────
// CHAT ENDPOINT
// ─────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages array is required"
      });
    }

    const fullMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    // ─────────────────────────────
    // TRY GROQ FIRST (ALL KEYS)
    // ─────────────────────────────
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const groqKey = getNextGroqKey();

      console.log(`Trying Groq key ${i + 1}/${GROQ_KEYS.length}`);

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
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

      console.log("Groq status:", response.status);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }

      // if not rate limit, still try next key
    }

    // ─────────────────────────────
    // GEMINI FALLBACK (FIXED MODEL)
    // ─────────────────────────────
    if (GEMINI_API_KEY) {
      console.log("Using Gemini fallback...");

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
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
                      .map(m => `${m.role}: ${m.content}`)
                      .join("\n\n")
                  }
                ]
              }
            ]
          })
        }
      );

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();

        const text =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No response generated";

        // IMPORTANT: normalize output for frontend
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

      const errText = await geminiResponse.text();
      console.error("Gemini failed:", errText);
    }

    // ─────────────────────────────
    // FINAL FAILURE
    // ─────────────────────────────
    return res.status(500).json({
      error: "All AI providers failed. Try again later."
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      error: "Internal server error"
    });
  }
});

// ─────────────────────────────
// START SERVER
// ─────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`📌 Groq keys loaded: ${GROQ_KEYS.length}`);
  console.log(`📌 Gemini enabled: ${!!GEMINI_API_KEY}`);
});
