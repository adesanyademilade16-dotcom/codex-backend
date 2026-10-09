/**
 * Codex Hub — Brevo email verification (6-digit code)
 *
 * Env on Render:
 *   BREVO_API_KEY
 *   BREVO_SENDER_EMAIL
 *   BREVO_SENDER_NAME=Codex Hub
 *   FIREBASE_SERVICE_ACCOUNT  (full JSON string of service account)
 *
 * Mount:
 *   import { mountBrevoVerify } from "./brevo-verify-routes.js";
 *   mountBrevoVerify(app);
 *
 * package.json dependencies:
 *   "firebase-admin": "^12.0.0"
 */
import admin from "firebase-admin";

const CODE_TTL_MS = 3 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw || !String(raw).trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT missing on server");
  }
  let cred;
  try {
    cred = typeof raw === "object" ? raw : JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (cred.private_key && typeof cred.private_key === "string") {
    cred.private_key = cred.private_key.replace(/\\n/g, "\n");
  }
  admin.initializeApp({
    credential: admin.credential.cert(cred)
  });
  return admin;
}

async function verifyIdToken(req) {
  const h = req.headers.authorization || "";
  let token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  // Fallback: some mobile browsers strip Authorization on cross-origin POST
  if (!token && req.body && typeof req.body.idToken === "string") {
    token = req.body.idToken.trim();
  }
  if (!token && req.body && typeof req.body.token === "string") {
    token = req.body.token.trim();
  }
  if (!token) {
    const err = new Error("Not signed in — open Login, then return and press Resend");
    err.status = 401;
    throw err;
  }
  const a = getAdmin();
  try {
    return await a.auth().verifyIdToken(token);
  } catch (e) {
    console.error("verifyIdToken failed:", e.code || e.message);
    const err = new Error("Session expired or invalid. Log in again, then Resend code.");
    err.status = 401;
    throw err;
  }
}

function sixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendBrevoEmail({ to, code }) {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  const name = process.env.BREVO_SENDER_NAME || "Codex Hub";
  if (!key) throw Object.assign(new Error("BREVO_API_KEY not configured"), { status: 500 });
  if (!sender) throw Object.assign(new Error("BREVO_SENDER_EMAIL not configured"), { status: 500 });

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": key
    },
    body: JSON.stringify({
      sender: { name, email: sender },
      to: [{ email: to }],
      subject: "Your Codex Hub verification code",
      htmlContent:
        `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">` +
        `<h2 style="color:#4F46E5">Codex Hub</h2>` +
        `<p>Your verification code is:</p>` +
        `<p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#0f172a">${code}</p>` +
        `<p style="color:#64748b">Expires in 3 minutes. If you did not sign up, ignore this email.</p>` +
        `</div>`
    })
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.error("Brevo error", r.status, body.slice(0, 300));
    throw Object.assign(new Error("Could not send email (" + r.status + ")"), { status: 502 });
  }
  return true;
}

/**
 * @param {import('express').Express} app
 */
export function mountBrevoVerify(app) {
  // Health for this feature
  app.get("/auth/brevo-status", (req, res) => {
    res.json({
      ok: true,
      brevoKey: Boolean(process.env.BREVO_API_KEY),
      sender: Boolean(process.env.BREVO_SENDER_EMAIL),
      firebaseAdmin: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    });
  });

  app.post("/auth/send-verify-code", async (req, res) => {
    try {
      const decoded = await verifyIdToken(req);
      const uid = decoded.uid;
      const email = (decoded.email || (req.body && req.body.email) || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "No email on account" });

      // Google / already verified
      if (decoded.email_verified) {
        return res.json({ ok: true, alreadyVerified: true });
      }

      const a = getAdmin();
      const db = a.firestore();
      const ref = db.collection("email_codes").doc(uid);
      const prev = await ref.get();
      const now = Date.now();
      if (prev.exists) {
        const d = prev.data() || {};
        if (d.sentAt && now - Number(d.sentAt) < RESEND_COOLDOWN_MS) {
          return res.status(429).json({ error: "Wait a minute before resending", retryAfterSec: 60 });
        }
        const hourStart = now - 60 * 60 * 1000;
        const sends = Array.isArray(d.sendLog) ? d.sendLog.filter((t) => t > hourStart) : [];
        if (sends.length >= MAX_SENDS_PER_HOUR) {
          return res.status(429).json({ error: "Too many codes this hour. Try later." });
        }
      }

      const code = sixDigit();
      const sendLog = prev.exists && Array.isArray(prev.data().sendLog)
        ? prev.data().sendLog.filter((t) => t > now - 60 * 60 * 1000).concat([now])
        : [now];

      await ref.set({
        code,
        email,
        expiresAt: now + CODE_TTL_MS,
        sentAt: now,
        sendLog,
        attempts: 0
      });

      await sendBrevoEmail({ to: email, code });
      console.log("Brevo code sent to", email.replace(/(.{2}).+(@.+)/, "$1***$2"));
      return res.json({ ok: true, expiresInSec: 180, email });
    } catch (e) {
      console.error("send-verify-code", e.message || e);
      return res.status(e.status || 500).json({ error: e.message || "Failed to send code" });
    }
  });

  app.post("/auth/check-verify-code", async (req, res) => {
    try {
      const decoded = await verifyIdToken(req);
      const uid = decoded.uid;
      const code = String((req.body && req.body.code) || "").replace(/\s/g, "");
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: "Enter the 6-digit code" });
      }

      if (decoded.email_verified) {
        return res.json({ ok: true, alreadyVerified: true });
      }

      const a = getAdmin();
      const db = a.firestore();
      const ref = db.collection("email_codes").doc(uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(400).json({ error: "No code found. Request a new one." });
      }
      const d = snap.data() || {};
      const attempts = Number(d.attempts || 0);
      if (attempts >= 8) {
        return res.status(429).json({ error: "Too many attempts. Request a new code." });
      }
      if (Date.now() > Number(d.expiresAt || 0)) {
        return res.status(400).json({ error: "Code expired. Request a new one." });
      }
      if (String(d.code) !== code) {
        await ref.set({ attempts: attempts + 1 }, { merge: true });
        return res.status(400).json({ error: "Wrong code. Try again." });
      }

      await a.auth().updateUser(uid, { emailVerified: true });
      try {
        await db.collection("users").doc(uid).set(
          { emailVerified: true, verifiedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      } catch (e2) {
        console.warn("users emailVerified merge", e2.message);
      }
      await ref.delete().catch(() => {});
      return res.json({ ok: true, verified: true });
    } catch (e) {
      console.error("check-verify-code", e.message || e);
      return res.status(e.status || 500).json({ error: e.message || "Verification failed" });
    }
  });

  console.log("Brevo verify routes: /auth/send-verify-code, /auth/check-verify-code, /auth/brevo-status");
}
