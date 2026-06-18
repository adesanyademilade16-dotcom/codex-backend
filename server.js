import express from "express";
import cors from "cors";

const app = express();

// ── CORS: only accept requests from your GitHub Pages domain ──────────────
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

app.use(express.json({ limit: "512kb" }));

const PORT = process.env.PORT || 10000;
const GROQ_KEY = process.env.GROQ_API_KEY;

// ── Rate Limiter (per IP) ───────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 1000; 
const RATE_MAX_REQUESTS = 30;     // Increased a bit

function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }

  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Too many requests. Please wait a moment before trying again."
    });
  }
  next();
}

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🚀 Codex Backend is running - Powered by Groq + Llama 3.1 8B");
});

// ── Main Chat Route (Upgraded) ────────────────────────────────────────────
app.post("/chat", rateLimit, async (req, res) => {
  try {
    const { messages, mode } = req.body;   // Accept mode from frontend if sent

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }
    if (messages.length > 30) {
      return res.status(400).json({ error: "Too many messages in context" });
    }

    if (!GROQ_KEY) {
      console.error("GROQ_API_KEY not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // ── Powerful model settings for education + large outputs ─────────────
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",           // ← Switched to higher limit model
        messages,
        temperature: 0.65,                       // Good balance for education
        max_tokens: 2048,                        // Increased for longer responses (30+ questions)
        top_p: 0.9,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `Groq error (${response.status})`;
      console.error("Groq API error:", msg);
      
      return res.status(response.status).json({ 
        error: msg,
        suggestion: "Try again in a few minutes or use a shorter question."
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Chat handler error:", error.message);
    res.status(500).json({ 
      error: "Internal server error. Please try again.",
      suggestion: "Check your internet connection."
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Codex Backend running on port ${PORT}`);
  console.log(`📌 Using model: llama-3.1-8b-instant (Higher free limits)`);
});
