/**
 * Codex Hub — Paystack (server-side)
 * Same Paystack business as Prep; Hub-only metadata/refs (CHUB_ / app:codex-hub)
 *
 * Env on Render (Hub service):
 *   PAYSTACK_SECRET_KEY
 *   HUB_FRONTEND_URL=https://codex-hub-prime.vercel.app
 *   FIREBASE_SERVICE_ACCOUNT (already used by Brevo)
 *
 * Routes:
 *   GET  /paystack/status
 *   POST /paystack/initialize   (Bearer token)
 *   POST /paystack/verify       (Bearer token + reference)
 *   POST /paystack/webhook      (Paystack signature; optional until router)
 */
import crypto from "crypto";
import admin from "firebase-admin";

const PLANS = {
  regular: { label: "Regular", amountNaira: 2000, durationDays: 120 },
  pro: { label: "Pro", amountNaira: 5000, durationDays: 120 }
};

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

async function grantPlan({ uid, plan, reference, amountKobo }) {
  const planConfig = PLANS[plan];
  if (!planConfig) throw new Error("Invalid plan");
  const db = getAdmin().firestore();
  const txRef = db.collection("hub_transactions").doc(reference);
  const userRef = db.collection("users").doc(uid);
  const DAY = 24 * 60 * 60 * 1000;

  // Transaction = two parallel verify calls (or verify + webhook) can never
  // both grant; and a reference can only ever be used once.
  return db.runTransaction(async (t) => {
    const existing = await t.get(txRef);
    if (existing.exists) {
      const ex = existing.data() || {};
      if (ex.uid && ex.uid !== uid) {
        const err = new Error("Reference already used by another account");
        err.status = 409;
        throw err;
      }
      return { already: true, expiresAt: ex.expiresAt || null, plan: ex.plan || plan };
    }
    const userSnap = await t.get(userRef);
    const u = userSnap.exists ? userSnap.data() || {} : {};
    const now = Date.now();
    const curExp = Number(u.planExpiresAt) || 0;
    const curPlan = String(u.plan || u.subscriptionTier || "free").toLowerCase();
    const stillActive = curExp > now;

    // Never downgrade an active Pro by buying Regular; extend instead.
    let finalPlan = plan;
    if (stillActive && curPlan === "pro" && plan === "regular") finalPlan = "pro";
    // Same plan renewed early → stack remaining days on top.
    const base = stillActive && curPlan === finalPlan ? curExp : now;
    const expiresAt = base + planConfig.durationDays * DAY;

    t.set(txRef, {
      uid,
      plan,
      grantedPlan: finalPlan,
      app: "codex-hub",
      amountNaira: planConfig.amountNaira,
      amountKobo: amountKobo || planConfig.amountNaira * 100,
      reference,
      status: "success",
      expiresAt,
      createdAt: now
    });
    t.set(
      userRef,
      {
        plan: finalPlan,
        subscriptionTier: finalPlan,
        isPro: finalPlan === "pro",
        isRegular: finalPlan === "regular",
        planExpiresAt: expiresAt,
        subscriptionExpires: expiresAt,
        proUntil: finalPlan === "pro" ? expiresAt : null,
        regularUntil: finalPlan === "regular" ? expiresAt : null,
        lastPaymentRef: reference,
        lastPaymentAt: now,
        updatedAt: now
      },
      { merge: true }
    );
    return { already: false, expiresAt, plan: finalPlan };
  });
}

/** Strict checks shared by /verify and /webhook. Returns {uid, plan} or throws. */
function validateHubPayment(data, expectUid) {
  const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
  if (!data || data.status !== "success") fail("Payment not successful yet");
  const reference = String(data.reference || "");
  // Same Paystack business as Prep → only CHUB_ references count for Hub.
  if (!reference.startsWith("CHUB_")) fail("Not a Codex Hub payment");
  const meta = data.metadata || {};
  if (meta.app !== "codex-hub") fail("Not a Codex Hub payment");
  if (String(data.currency || "NGN").toUpperCase() !== "NGN") fail("Wrong currency");
  const plan = String(meta.plan || "").toLowerCase();
  const planConfig = PLANS[plan];
  if (!planConfig) fail("Unknown plan in payment");
  // Plan inside reference must match metadata (stops editing metadata after init)
  if (!reference.startsWith("CHUB_" + plan.toUpperCase() + "_")) fail("Plan mismatch");
  if (Number(data.amount) < planConfig.amountNaira * 100) fail("Amount too low");
  const uid = String(meta.uid || "");
  if (!uid) fail("Payment has no account attached");
  if (!reference.includes("_" + uid.slice(0, 8) + "_")) fail("Reference/account mismatch", 403);
  if (expectUid && uid !== expectUid) fail("Reference does not belong to this account", 403);
  return { uid, plan };
}

export function mountPaystack(app) {
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
      const reference =
        "CHUB_" + plan.toUpperCase() + "_" + decoded.uid.slice(0, 8) + "_" + Date.now() + crypto.randomBytes(3).toString("hex");

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
      console.error("paystack initialize", e.message || e);
      return res.status(e.status || 500).json({ error: e.message || "Initialize failed" });
    }
  });

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
      if (!verifyRes.ok || !verifyData.status || !verifyData.data || verifyData.data.status !== "success") {
        return res.status(400).json({ error: "Payment not successful yet" });
      }

      const { uid, plan } = validateHubPayment(verifyData.data, decoded.uid);
      const result = await grantPlan({
        uid,
        plan,
        reference: verifyData.data.reference,
        amountKobo: verifyData.data.amount
      });
      return res.json({ ok: true, plan: result.plan, expiresAt: result.expiresAt, already: result.already });
    } catch (e) {
      console.error("paystack verify", e.message || e);
      return res.status(e.status || 500).json({ error: e.message || "Verify failed" });
    }
  });

  // Optional direct Hub webhook (Phase 2: Prep can forward CHUB_ here)
  app.post("/paystack/webhook", async (req, res) => {
    try {
      if (!SECRET) return res.status(200).send("no secret");
      const signature = req.headers["x-paystack-signature"];
      // Prefer raw Buffer (express.raw on /paystack/webhook). Fallback if JSON middleware ate body.
      let rawBody;
      if (Buffer.isBuffer(req.body)) rawBody = req.body;
      else if (typeof req.body === "string") rawBody = Buffer.from(req.body);
      else if (req.body && typeof req.body === "object") {
        // Signature cannot be verified reliably after JSON parse — re-verify via API only.
        rawBody = null;
      } else {
        rawBody = Buffer.from("");
      }

      let event;
      if (rawBody) {
        const expected = crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
        if (
          !signature ||
          expected.length !== String(signature).length ||
          !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)))
        ) {
          console.warn("Hub webhook bad signature");
          return res.status(401).send("bad sig");
        }
        event = JSON.parse(rawBody.toString("utf8"));
      } else {
        // Forwarded body already parsed — still safe because we re-verify with Paystack API below.
        event = req.body;
        if (!event || typeof event !== "object") {
          return res.status(200).send("no body");
        }
      }
      if (event.event !== "charge.success") return res.status(200).send("ignored");

      const reference = String((event.data && event.data.reference) || "");
      if (!reference.startsWith("CHUB_")) return res.status(200).send("not hub");
      const verifyRes = await fetch(
        "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
        { headers: { Authorization: "Bearer " + SECRET } }
      );
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.data || verifyData.data.status !== "success") {
        return res.status(200).send("not verified");
      }

      let uid, plan;
      try {
        ({ uid, plan } = validateHubPayment(verifyData.data, null));
      } catch (vErr) {
        return res.status(200).send("ignored: " + vErr.message);
      }
      await grantPlan({ uid, plan, reference, amountKobo: verifyData.data.amount });
      return res.status(200).send("ok");
    } catch (e) {
      console.error("hub paystack webhook", e);
      return res.status(200).send("error logged");
    }
  });

  console.log(
    "Paystack Hub routes: /paystack/initialize, /paystack/verify, /paystack/webhook, /paystack/status"
  );
}

export { PLANS };
