/**
 * Codex Hub — Paystack (Phase 1)
 * Mount on codex-backend-new:
 *   import { mountPaystack } from "./paystack-routes.js";
 *   mountPaystack(app);
 *
 * Env:
 *   PAYSTACK_SECRET_KEY
 *   PAYSTACK_PUBLIC_KEY (optional)
 *   HUB_FRONTEND_URL=https://codex-hub-prime.vercel.app
 *   FIREBASE_SERVICE_ACCOUNT (already used by Brevo)
 *
 * Plans: regular ₦2000 / pro ₦5000 — 120 days unlimited CBT while active
 * Metadata always includes app: "codex-hub" so Prep webhook can ignore or route later.
 */
const crypto = require("crypto");

const PLANS = {
  regular: { label: "Regular", amountNaira: 2000, durationDays: 120 },
  pro: { label: "Pro", amountNaira: 5000, durationDays: 120 }
};

function getAdmin() {
  // reuse firebase-admin already initialized by brevo routes if present
  const admin = require("firebase-admin");
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
  let cred = typeof raw === "object" ? raw : JSON.parse(raw);
  if (cred.private_key) cred.private_key = String(cred.private_key).replace(/\\n/g, "\n");
  admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin;
}

async function verifyBearer(req) {
  const h = req.headers.authorization || "";
  let token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token && req.body && req.body.idToken) token = String(req.body.idToken);
  if (!token) {
    const e = new Error("Sign in required");
    e.status = 401;
    throw e;
  }
  return getAdmin().auth().verifyIdToken(token);
}

async function grantPlan({ uid, plan, reference, amountKobo }) {
  const planConfig = PLANS[plan];
  if (!planConfig) throw new Error("Invalid plan");
  const admin = getAdmin();
  const db = admin.firestore();
  const txRef = db.collection("hub_transactions").doc(reference);
  const existing = await txRef.get();
  if (existing.exists) return { already: true };

  const now = Date.now();
  const expiresAt = now + planConfig.durationDays * 24 * 60 * 60 * 1000;

  const batch = db.batch();
  batch.set(txRef, {
    uid,
    plan,
    app: "codex-hub",
    amountNaira: planConfig.amountNaira,
    amountKobo: amountKobo || planConfig.amountNaira * 100,
    reference,
    status: "success",
    createdAt: now
  });
  batch.set(
    db.collection("users").doc(uid),
    {
      plan,
      subscriptionTier: plan,
      isPro: plan === "pro",
      isRegular: plan === "regular",
      planExpiresAt: expiresAt,
      subscriptionExpires: expiresAt,
      proUntil: plan === "pro" ? expiresAt : null,
      regularUntil: plan === "regular" ? expiresAt : null,
      lastPaymentRef: reference,
      updatedAt: now
    },
    { merge: true }
  );
  await batch.commit();
  return { already: false, expiresAt, plan };
}

function mountPaystack(app) {
  const SECRET = process.env.PAYSTACK_SECRET_KEY || "";
  const FRONTEND = (process.env.HUB_FRONTEND_URL || "https://codex-hub-prime.vercel.app").replace(/\/$/, "");

  app.get("/paystack/status", (req, res) => {
    res.json({
      ok: true,
      secret: Boolean(SECRET),
      plans: PLANS,
      frontend: FRONTEND
    });
  });

  app.post("/paystack/initialize", async (req, res) => {
    try {
      if (!SECRET) return res.status(500).json({ error: "PAYSTACK_SECRET_KEY not set on server" });
      const decoded = await verifyBearer(req);
      const plan = String((req.body && req.body.plan) || "").toLowerCase();
      const planConfig = PLANS[plan];
      if (!planConfig) return res.status(400).json({ error: "Invalid plan. Use regular or pro." });
      const email = decoded.email;
      if (!email) return res.status(400).json({ error: "Account has no email" });

      const amountKobo = planConfig.amountNaira * 100;
      const reference = "CHUB_" + plan.toUpperCase() + "_" + decoded.uid.slice(0, 8) + "_" + Date.now();

      const payRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + SECRET,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          currency: "NGN",
          reference,
          callback_url: FRONTEND + "/app/pricing.html?payment=callback",
          metadata: {
            app: "codex-hub",
            uid: decoded.uid,
            plan,
            custom_fields: [
              { display_name: "App", variable_name: "app", value: "codex-hub" },
              { display_name: "Plan", variable_name: "plan", value: plan }
            ]
          }
        })
      });
      const data = await payRes.json();
      if (!payRes.ok || !data.status) {
        console.error("Paystack init fail", data);
        return res.status(502).json({ error: "Could not start payment" });
      }
      return res.json({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
        access_code: data.data.access_code
      });
    } catch (e) {
      console.error("initialize", e.message || e);
      return res.status(e.status || 500).json({ error: e.message || "Initialize failed" });
    }
  });

  // Browser return + manual confirm — never trust client for amount
  app.post("/paystack/verify", async (req, res) => {
    try {
      if (!SECRET) return res.status(500).json({ error: "PAYSTACK_SECRET_KEY not set" });
      const decoded = await verifyBearer(req);
      const reference = String((req.body && req.body.reference) || "").trim();
      if (!reference) return res.status(400).json({ error: "Missing reference" });

      const verifyRes = await fetch(
        "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
        { headers: { Authorization: "Bearer " + SECRET } }
      );
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.status || verifyData.data.status !== "success") {
        return res.status(400).json({ error: "Payment not successful yet" });
      }

      const meta = verifyData.data.metadata || {};
      const plan = String(meta.plan || "").toLowerCase();
      const uid = meta.uid || decoded.uid;
      if (uid !== decoded.uid && decoded.email !== "codexhub16@gmail.com") {
        return res.status(403).json({ error: "Reference does not belong to this account" });
      }
      const planConfig = PLANS[plan];
      if (!planConfig) return res.status(400).json({ error: "Unknown plan in payment" });
      if (verifyData.data.amount < planConfig.amountNaira * 100) {
        return res.status(400).json({ error: "Amount too low" });
      }
      // Only accept Hub refs
      if (meta.app && meta.app !== "codex-hub") {
        return res.status(400).json({ error: "Not a Codex Hub payment" });
      }

      const result = await grantPlan({
        uid: decoded.uid,
        plan,
        reference,
        amountKobo: verifyData.data.amount
      });
      return res.json({ ok: true, plan, expiresAt: result.expiresAt, already: result.already });
    } catch (e) {
      console.error("verify", e.message || e);
      return res.status(e.status || 500).json({ error: e.message || "Verify failed" });
    }
  });

  // Optional Hub webhook (Phase 2: Prep router can forward here)
  // Must be mounted with express.raw for signature if used as primary webhook
  app.post("/paystack/webhook", async (req, res) => {
    try {
      if (!SECRET) return res.status(200).send("no secret");
      const signature = req.headers["x-paystack-signature"];
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
      const expected = crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
      if (!signature || expected.length !== signature.length ||
          !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return res.status(401).send("bad sig");
      }
      const event = JSON.parse(rawBody.toString("utf8"));
      if (event.event !== "charge.success") return res.status(200).send("ignored");
      const reference = event.data.reference;
      const verifyRes = await fetch(
        "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
        { headers: { Authorization: "Bearer " + SECRET } }
      );
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || verifyData.data.status !== "success") return res.status(200).send("not verified");
      const meta = verifyData.data.metadata || {};
      if (meta.app && meta.app !== "codex-hub") return res.status(200).send("not hub");
      const plan = String(meta.plan || "").toLowerCase();
      const uid = meta.uid;
      if (!uid || !PLANS[plan]) return res.status(200).send("bad meta");
      if (verifyData.data.amount < PLANS[plan].amountNaira * 100) return res.status(200).send("low amount");
      await grantPlan({ uid, plan, reference, amountKobo: verifyData.data.amount });
      return res.status(200).send("ok");
    } catch (e) {
      console.error("hub webhook", e);
      return res.status(200).send("error logged");
    }
  });

  console.log("Paystack Hub routes: /paystack/initialize, /paystack/verify, /paystack/webhook, /paystack/status");
}

module.exports = { mountPaystack, PLANS };
