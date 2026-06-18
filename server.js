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
// KEYS (2 GROQ ACCOUNTS NOW)
// ─────────────────────────────
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2
].filter(Boolean);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─────────────────────────────
// HEALTH CHECK
// ─────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ONLINE",
    groq_keys: GROQ_KEYS.length,
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
      return res.status(400).json({ error: "messages required" });
    }

    const fullMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    let lastError = null;

    // ─────────────────────────────
    // GROQ ROTATION (CLEAN + SAFE)
    // ─────────────────────────────
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const key = GROQ_KEYS[i];

      console.log(`Trying Groq key ${i + 1}/${GROQ_KEYS.length}`);

      try {
        const response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
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
          }
        );

        console.log("Groq status:", response.status);

        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }

        if (response.status !== 429) {
          const err = await response.text();
          console.log("Groq hard error:", err);
          lastError = err;
          break;
        }

      } catch (err) {
        console.log("Groq request failed:", err.message);
        lastError = err.message;
      }
    }

    // ─────────────────────────────
    // GEMINI FALLBACK (FIXED MODEL)
    // ─────────────────────────────
    if (GEMINI_API_KEY) {
      console.log("Using Gemini fallback...");

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`,
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
        const data = await geminiResponse.json();

        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No response";

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

      const err = await geminiResponse.text();
      console.log("Gemini error:", err);
    }

    // ─────────────────────────────
    // FINAL SAFE RESPONSE (NO 500 CRASH)
    // ─────────────────────────────
    return res.json({
      choices: [
        {
          message: {
            content:
              "AI is currently busy. Please try again in a moment."
          }
        }
      ],
      debug: lastError
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.json({
      choices: [
        {
          message: {
            content: "Server error but AI is still running."
          }
        }
      ]
    });
  }
});

// ─────────────────────────────
// START SERVER
// ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📌 Groq accounts: ${GROQ_KEYS.length}`);
  console.log(`📌 Gemini enabled: ${!!GEMINI_API_KEY}`);
});
