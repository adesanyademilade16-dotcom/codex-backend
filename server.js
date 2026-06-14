import express from "express";
import cors from "cors";

const app = express();

// ── CORS: only accept requests from your GitHub Pages domain ──────────────
const ALLOWED_ORIGINS = [
  "https://adesanyademilade16-dotcom.github.io",
  "http://localhost:3000",
  "http://localhost:8080", 
  "http://127.0.0.1:5500"  // VS Code Live Server for local dev
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (health checks, curl during dev)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json({ limit: "512kb" })); // prevent huge payload attacks

const PORT = process.env.PORT || 10000;
const GROQ_KEY = process.env.GROQ_API_KEY;

// ── Simple in-memory rate limiter (resets on server restart) ──────────────
// For production, use a Redis-backed store instead
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_REQUESTS = 20;     // 20 AI requests per minute per IP

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
  res.send("Codex Backend is running 🚀");
});

// ── Chat route ────────────────────────────────────────────────────────────
app.post("/chat", rateLimit, async (req, res) => {
  try {
    const { messages } = req.body;

    // Basic validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }
    if (messages.length > 25) {
      return res.status(400).json({ error: "Too many messages in context" });
    }

    if (!GROQ_KEY) {
      console.error("GROQ_API_KEY not set in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `Groq error (${response.status})`;
      console.error("Groq API error:", msg);
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Chat handler error:", error.message);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Codex Backend running on port ${PORT}`);
});
