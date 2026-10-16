/**
 * Codex Hub — FCM push (WhatsApp-style when app is closed)
 *
 * Env on Render (Hub backend — already has FIREBASE_SERVICE_ACCOUNT):
 *   (none extra required for send — uses Admin SDK)
 *
 * Client needs Web Push certificate (VAPID) public key from:
 *   Firebase Console → Project settings → Cloud Messaging → Web Push certificates
 *   Set on frontend as window.CODEX_FCM_VAPID = "B...."
 *
 * Routes:
 *   GET  /push/status
 *   POST /push/notify   Bearer required  body: { toUid, title, body, url?, tag?, type? }
 *   POST /push/test     Bearer required  sends a test to the caller's own tokens
 */
import admin from "firebase-admin";

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw || !String(raw).trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT missing on server");
  }
  let cred = typeof raw === "object" ? raw : JSON.parse(raw);
  if (cred.private_key && typeof cred.private_key === "string") {
    cred.private_key = cred.private_key.replace(/\\n/g, "\n");
  }
  admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin;
}

async function verifyBearer(req) {
  const h = req.headers.authorization || "";
  let token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token && req.body && typeof req.body.idToken === "string") {
    token = req.body.idToken.trim();
  }
  if (!token) {
    const err = new Error("Sign in required");
    err.status = 401;
    throw err;
  }
  try {
    return await getAdmin().auth().verifyIdToken(token);
  } catch (e) {
    const err = new Error("Session expired. Sign in again.");
    err.status = 401;
    throw err;
  }
}

async function tokensForUid(uid) {
  const db = getAdmin().firestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return [];
  const d = snap.data() || {};
  let tokens = d.fcmTokens || d.pushTokens || [];
  if (!Array.isArray(tokens)) tokens = [];
  // unique, non-empty strings
  return [...new Set(tokens.map((t) => String(t || "").trim()).filter(Boolean))];
}

async function sendToTokens(tokens, { title, body, url, tag, type, data }) {
  if (!tokens.length) return { sent: 0, failed: 0, reason: "no_tokens" };
  const messaging = getAdmin().messaging();
  const payload = {
    tokens,
    notification: {
      title: String(title || "Codex Hub").slice(0, 100),
      body: String(body || "").slice(0, 250)
    },
    data: {
      url: safeUrl(url),
      tag: String(tag || "codex"),
      type: String(type || "generic"),
      ...(data || {})
    },
    webpush: {
      fcmOptions: {
        link: safeUrl(url)
      },
      notification: {
        icon: "https://codex-hub-prime.vercel.app/assets/icons/icon-192.png",
        badge: "https://codex-hub-prime.vercel.app/assets/icons/icon-192.png",
        tag: String(tag || "codex"),
        renotify: true
      },
      headers: { Urgency: "high", TTL: "86400" }
    }
  };

  const res = await messaging.sendEachForMulticast(payload);
  // drop invalid tokens
  const invalid = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalid.push(tokens[i]);
      }
    }
  });
  return {
    sent: res.successCount,
    failed: res.failureCount,
    invalid
  };
}

async function pruneInvalid(uid, invalid) {
  if (!invalid || !invalid.length) return;
  const db = getAdmin().firestore();
  const ref = db.collection("users").doc(uid);
  const FieldValue = getAdmin().firestore.FieldValue;
  await ref.set(
    { fcmTokens: FieldValue.arrayRemove(...invalid) },
    { merge: true }
  );
}


const HUB_ORIGIN = "https://codex-hub-prime.vercel.app";
/** Only allow notification links inside Codex Hub (stops phishing links in pushes) */
function safeUrl(u, fallback) {
  const fb = fallback || HUB_ORIGIN + "/chats";
  try {
    const s = String(u || "").trim();
    if (!s) return fb;
    if (s.startsWith("/")) return HUB_ORIGIN + s;
    const parsed = new URL(s);
    if (parsed.origin === HUB_ORIGIN) return parsed.toString();
  } catch (e) {}
  return fb;
}

async function isHubAdmin(decoded) {
  if (String(decoded.email || "").toLowerCase() === "codexhub16@gmail.com" && decoded.email_verified !== false) return true;
  try {
    const a = await getAdmin().firestore().collection("admins").doc(decoded.uid).get();
    return a.exists && (a.data() || {}).active !== false;
  } catch (e) {
    return false;
  }
}

/** Sender may only ping someone they share a conversation / friendship with */
async function canPing(fromUid, toUid) {
  const db = getAdmin().firestore();
  try {
    const f = await db.collection("friendships").doc(fromUid).collection("friends").doc(toUid).get();
    if (f.exists) return true;
  } catch (e) {}
  try {
    const q = await db.collection("conversations").where("participants", "array-contains", fromUid).limit(200).get();
    return q.docs.some((d) => ((d.data() || {}).participants || []).includes(toUid));
  } catch (e) {
    return false;
  }
}

// simple per-sender rate limit (memory) — 30 pushes / minute
const _pushHits = new Map();
function rateOk(uid, max = 30) {
  const now = Date.now();
  const arr = (_pushHits.get(uid) || []).filter((t) => now - t < 60000);
  if (arr.length >= max) return false;
  arr.push(now);
  _pushHits.set(uid, arr);
  return true;
}

export function mountFcm(app) {
  app.get("/push/status", (_req, res) => {
    res.json({
      ok: true,
      firebaseAdmin: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ),
      routes: ["/push/status", "/push/notify", "/push/test", "/push/on-chat-message", "/push/broadcast"]
    });
  });

  app.post("/push/notify", async (req, res) => {
    try {
      const decoded = await verifyBearer(req);
      const body = req.body || {};
      const toUid = String(body.toUid || "").trim();
      if (!toUid) return res.status(400).json({ ok: false, error: "toUid required" });
      // basic guard: cannot spam arbitrary mass — one recipient per call
      if (toUid === decoded.uid && body.type !== "test") {
        // allow self only for test route
      }

      if (!rateOk(decoded.uid)) return res.status(429).json({ ok: false, error: "slow down" });
      const admin = await isHubAdmin(decoded);
      if (toUid !== decoded.uid && !admin && !(await canPing(decoded.uid, toUid))) {
        return res.status(403).json({ ok: false, error: "You can only notify your chats/friends" });
      }
      const title = String(body.title || "Codex Hub").slice(0, 100);
      const msgBody = String(body.body || "New notification").slice(0, 250);
      const url = body.url || "https://codex-hub-prime.vercel.app/app/chats.html";
      const tag = body.tag || body.type || "codex";
      const type = body.type || "generic";

      const tokens = await tokensForUid(toUid);
      if (!tokens.length) {
        return res.json({ ok: true, sent: 0, reason: "recipient_has_no_token" });
      }

      const result = await sendToTokens(tokens, {
        title,
        body: msgBody,
        url,
        tag,
        type
      });
      if (result.invalid && result.invalid.length) {
        try {
          await pruneInvalid(toUid, result.invalid);
        } catch (e) {
          console.warn("prune tokens", e.message || e);
        }
      }
      res.json({ ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      console.error("push/notify", e.message || e);
      res.status(status).json({ ok: false, error: e.message || "push failed" });
    }
  });

  app.post("/push/test", async (req, res) => {
    try {
      const decoded = await verifyBearer(req);
      const tokens = await tokensForUid(decoded.uid);
      if (!tokens.length) {
        return res.json({
          ok: true,
          sent: 0,
          reason: "no_token_on_your_account",
          hint: "Enable push in Settings and allow notifications first"
        });
      }
      const result = await sendToTokens(tokens, {
        title: "Codex Hub",
        body: "Push is working on this device ✓",
        url: "https://codex-hub-prime.vercel.app/app/home.html",
        tag: "push-test",
        type: "test"
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      res.status(status).json({ ok: false, error: e.message || "test failed" });
    }
  });

  
  // Reliable chat notify: server resolves participants + tokens
  app.post("/push/on-chat-message", async (req, res) => {
    try {
      const decoded = await verifyBearer(req);
      const body = req.body || {};
      const convId = String(body.convId || "").trim();
      if (!convId) return res.status(400).json({ ok: false, error: "convId required" });

      const db = getAdmin().firestore();
      const conv = await db.collection("conversations").doc(convId).get();
      if (!conv.exists) return res.status(404).json({ ok: false, error: "conversation not found" });
      const parts = (conv.data() && conv.data().participants) || [];
      if (!Array.isArray(parts) || !parts.includes(decoded.uid)) {
        return res.status(403).json({ ok: false, error: "not a participant" });
      }

      if (!rateOk(decoded.uid, 60)) return res.status(429).json({ ok: false, error: "slow down" });
      const title = String(body.title || "New message").slice(0, 100);
      const msgBody = String(body.body || body.preview || "Open Codex Hub to read").slice(0, 250);
      const url =
        body.url ||
        "https://codex-hub-prime.vercel.app/app/chats.html";

      let totalSent = 0;
      let totalFailed = 0;
      const recipients = parts.filter((u) => u && u !== decoded.uid);

      for (const toUid of recipients) {
        const tokens = await tokensForUid(toUid);
        if (!tokens.length) continue;
        // Respect recipient preference when set
        try {
          const u = await db.collection("users").doc(toUid).get();
          if (u.exists && u.data().pushEnabled === false) continue;
        } catch (e) {}
        const result = await sendToTokens(tokens, {
          title,
          body: msgBody,
          url,
          tag: "chat-" + convId,
          type: "chat_message"
        });
        totalSent += result.sent || 0;
        totalFailed += result.failed || 0;
        if (result.invalid && result.invalid.length) {
          try {
            await pruneInvalid(toUid, result.invalid);
          } catch (e) {}
        }
      }

      res.json({
        ok: true,
        recipients: recipients.length,
        sent: totalSent,
        failed: totalFailed
      });
    } catch (e) {
      const status = e.status || 500;
      console.error("push/on-chat-message", e.message || e);
      res.status(status).json({ ok: false, error: e.message || "push failed" });
    }
  });

  
  // Admin/system broadcast (announcements, updates) — requires auth; optional admin claim soft-check
  app.post("/push/broadcast", async (req, res) => {
    try {
      const decoded = await verifyBearer(req);
      const body = req.body || {};
      const title = String(body.title || "Codex Hub").slice(0, 100);
      const msgBody = String(body.body || "").slice(0, 250);
      const url = body.url || "https://codex-hub-prime.vercel.app/app/home.html";
      const type = String(body.type || "announcement");
      const db = getAdmin().firestore();

      // Admin = admins/{uid} (rules-protected) or owner email. users.isAdmin is NOT trusted.
      const isAdmin = await isHubAdmin(decoded);
      if (!isAdmin) {
        return res.status(403).json({ ok: false, error: "admin only" });
      }

      // Collect tokens (cap for safety on free tier)
      const snap = await db.collection("users").where("pushEnabled", "==", true).limit(500).get();
      let sent = 0, failed = 0, targets = 0;
      for (const doc of snap.docs) {
        const tokens = await tokensForUid(doc.id);
        if (!tokens.length) continue;
        targets++;
        const result = await sendToTokens(tokens, {
          title,
          body: msgBody,
          url,
          tag: type,
          type
        });
        sent += result.sent || 0;
        failed += result.failed || 0;
      }
      res.json({ ok: true, targets, sent, failed });
    } catch (e) {
      const status = e.status || 500;
      console.error("push/broadcast", e.message || e);
      res.status(status).json({ ok: false, error: e.message || "broadcast failed" });
    }
  });

  console.log("FCM push routes: /push/status, /push/notify, /push/test, /push/on-chat-message");
}
