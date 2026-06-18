import express from "express";
import cors from "cors";

const app = express();

const ALLOWED_ORIGINS = [
  "https://adesanyademilade16-dotcom.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500"
];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "512kb" }));

const PORT = process.env.PORT || 10000;

// ── Groq Keys Rotation ─────────────────────
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3
].filter(Boolean);

let keyIndex = 0;

function getGroqKey() {
  if (GROQ_KEYS.length === 0) return null;
  const key = GROQ_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % GROQ_KEYS.length;
  return key;
}

// ── Gemini Key ─────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Health Check
app.get("/", (req, res) => {
  res.send("🚀 Codex Backend v3 - Groq Rotation + Gemini Fallback");
});

// Main Chat Endpoint
app.post("/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const fullMessages = system 
      ? [{ role: "system", content: system }, ...messages] 
      : messages;

    let response = null;

    // Try Groq with rotation
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const groqKey = getGroqKey();
      console.log(`Trying Groq key \( {i+1}/ \){GROQ_KEYS.length}`);

      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: fullMessages,
          temperature: 0.65,
          max_tokens: 2048
        })
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    }

    // Gemini Fallback
    if (GEMINI_API_KEY) {
      console.log("All Groq keys failed → Using Gemini fallback");
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullMessages.map(m => m.content).join("\n\n") }] }]
          })
        }
      );

      if (response.ok) {
        const geminiData = await response.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
        return res.json({
          choices: [{ message: { content: text } }]
        });
      }
    }

    return res.status(500).json({ error: "All AI providers are currently unavailable. Please try again later." });

  } catch (error) {
    console.error("Backend error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Codex Backend running on port ${PORT}`);
  console.log(`📌 Groq keys loaded: ${GROQ_KEYS.length}`);
  console.log(`📌 Gemini enabled: ${!!GEMINI_API_KEY}`);
});
