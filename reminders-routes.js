/**
 * Codex Hub Prime — daily reminder scheduler (Phase 4)
 * ESM mount style matching fcm-routes.js / paystack-routes.js
 *
 * Routes:
 *   POST /reminders/sync   Bearer required — mirror client schedules
 *   POST /reminders/run    x-cron-key required — send due reminders
 *   GET  /reminders/status
 *
 * Env:
 *   REMINDER_CRON_KEY          long random string for cron
 *   REMINDER_CRON_INPROCESS=1  optional in-process 60s ticker
 *   FIREBASE_SERVICE_ACCOUNT   already used by FCM/Paystack
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

function bearer(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

async function requireUser(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ ok: false, error: "missing token" });
  try {
    req.decoded = await getAdmin().auth().verifyIdToken(token);
    req.uid = req.decoded.uid;
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "invalid token" });
  }
}

function requireCron(req, res, next) {
  const expected = process.env.REMINDER_CRON_KEY || "";
  if (!expected) return res.status(503).json({ ok: false, error: "cron key not configured" });
  if (req.get("x-cron-key") !== expected) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  return next();
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

/** Absolute ms of the next local occurrence of HH:MM on the allowed weekdays. */
function nextAfter(nowMs, time, days, offsetMinutes) {
  const parts = String(time || "19:00").split(":");
  const hh = parseInt(parts[0], 10) || 0;
  const mm = parseInt(parts[1], 10) || 0;
  const allowed = Array.isArray(days) && days.length ? days : [0, 1, 2, 3, 4, 5, 6];
  const localNow = new Date(nowMs - offsetMinutes * 60000);
  for (let i = 0; i < 8; i++) {
    const wall = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate() + i,
        hh,
        mm,
        0,
        0
      )
    );
    const utcMs = wall.getTime() + offsetMinutes * 60000;
    if (utcMs <= nowMs + 1000) continue;
    if (allowed.indexOf(wall.getUTCDay()) > -1) return utcMs;
  }
  return 0;
}

function dayKey(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}

async function runDueReminders() {
  const adm = getAdmin();
  const db = adm.firestore();
  const now = Date.now();
  const report = { scanned: 0, sent: 0, skipped: 0, failed: 0 };

  const snap = await db
    .collectionGroup("reminders")
    .where("enabled", "==", true)
    .where("nextAtMs", "<=", now)
    .limit(200)
    .get();

  report.scanned = snap.size;

  for (const doc of snap.docs) {
    const r = doc.data() || {};
    const uid = doc.ref.parent.parent && doc.ref.parent.parent.id;
    if (!uid) {
      report.skipped++;
      continue;
    }

    const dueKey = dayKey(Number(r.nextAtMs) || now);
    if (r.lastFiredKey === dueKey) {
      report.skipped++;
      continue;
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    const tokens = Array.isArray(user.fcmTokens)
      ? user.fcmTokens.filter(Boolean).slice(0, 20)
      : [];

    const offset = Number(r.timezoneOffset) || 0;
    const nextMs = nextAfter(now, r.time, r.days, offset);

    if (!tokens.length || user.pushEnabled === false) {
      await doc.ref.set(
        {
          lastFiredKey: dueKey,
          nextAtMs: nextMs,
          lastAttemptAt: adm.firestore.FieldValue.serverTimestamp(),
          lastResult: "no-token"
        },
        { merge: true }
      );
      report.skipped++;
      continue;
    }

    const titles = {
      study: "Study session",
      revision: "Revision session",
      deadline: "Assignment deadline",
      task: "Task reminder"
    };
    const custom = String(r.title || r.label || "").trim().slice(0, 80);
    const title = "Codex Hub | " + (custom || titles[r.type] || "Reminder");
    const body = custom
      ? "Time for: " + custom + (r.time ? " · " + r.time : "") + ". Open Study Planner in Codex Hub."
      : "It's " +
        (r.time || "") +
        " — " +
        (titles[r.type] || "reminder").toLowerCase() +
        ". Open Codex Hub to start.";
    const openUrl = r.source === "study_plan" || r.type === "task" ? "/todo" : "/settings";

    let result;
    try {
      result = await adm.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: {
          type: "reminder",
          reminderId: doc.id,
          url: openUrl
        },
        webpush: {
          headers: { Urgency: "high", TTL: "900" },
          notification: {
            icon: "/assets/icons/icon-192.png",
            badge: "/assets/icons/icon-192.png",
            tag: "reminder-" + doc.id,
            renotify: true
          },
          fcmOptions: { link: openUrl }
        }
      });
    } catch (e) {
      console.error("[reminders/run] send failed", e.message || e);
      await doc.ref.set(
        {
          lastAttemptAt: adm.firestore.FieldValue.serverTimestamp(),
          lastResult: "send-error",
          lastError: String(e.message || e).slice(0, 300)
        },
        { merge: true }
      );
      report.failed++;
      continue;
    }

    const dead = [];
    result.responses.forEach((resp, i) => {
      if (resp.success) return;
      const code = resp.error && resp.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-argument" ||
        code === "messaging/invalid-registration-token"
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      try {
        await db.collection("users").doc(uid).set(
          { fcmTokens: adm.firestore.FieldValue.arrayRemove(...dead) },
          { merge: true }
        );
      } catch (e) {
        /* ignore prune errors */
      }
    }

    await doc.ref.set(
      {
        lastFiredKey: dueKey,
        nextAtMs: nextMs,
        lastSentAt: adm.firestore.FieldValue.serverTimestamp(),
        lastAttemptAt: adm.firestore.FieldValue.serverTimestamp(),
        lastResult: "sent:" + result.successCount
      },
      { merge: true }
    );

    if (result.successCount > 0) report.sent++;
    else report.failed++;
  }

  return report;
}

export function mountReminders(app) {
  app.get("/reminders/status", (_req, res) => {
    res.json({
      ok: true,
      cronKey: Boolean(process.env.REMINDER_CRON_KEY),
      inProcess: process.env.REMINDER_CRON_INPROCESS === "1",
      firebaseAdmin: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ),
      routes: ["/reminders/status", "/reminders/sync", "/reminders/run"]
    });
  });

  /**
   * POST /reminders/sync
   * Client mirrors its local schedule. uid always from verified ID token.
   */
  app.post("/reminders/sync", requireUser, async (req, res) => {
    try {
      const adm = getAdmin();
      const items = Array.isArray(req.body && req.body.reminders) ? req.body.reminders : [];
      const offset = Number.isFinite(req.body && req.body.timezoneOffset)
        ? req.body.timezoneOffset
        : 0;
      const batch = adm.firestore().batch();
      const col = adm.firestore().collection("users").doc(req.uid).collection("reminders");

      items.slice(0, 40).forEach((r) => {
        if (!r || !r.id) return;
        const ref = col.doc(String(r.id).replace(/[^A-Za-z0-9_-]/g, ""));
        batch.set(
          ref,
          {
            type: String(r.type || "study").slice(0, 24),
            time: String(r.time || "19:00").slice(0, 5),
            days: Array.isArray(r.days) ? r.days.slice(0, 7) : [],
            enabled: r.enabled !== false,
            timezoneOffset: offset,
            nextAtMs: Number(r.nextAtMs) || 0,
            serverSyncedAt: adm.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });

      await batch.commit();
      return res.json({ ok: true, count: items.length });
    } catch (e) {
      console.error("[reminders/sync]", e.message || e);
      return res.status(500).json({ ok: false, error: "sync failed" });
    }
  });

  /**
   * POST /reminders/run — cron every minute
   * Idempotent via lastFiredKey.
   */
  app.post("/reminders/run", requireCron, async (req, res) => {
    try {
      const report = await runDueReminders();
      return res.json({ ok: true, ...report });
    } catch (e) {
      console.error("[reminders/run]", e.message || e);
      return res.status(500).json({ ok: false, error: "run failed" });
    }
  });

  if (process.env.REMINDER_CRON_INPROCESS === "1") {
    setInterval(() => {
      runDueReminders()
        .then((r) => {
          if (r.sent || r.failed) console.log("[reminders/inprocess]", r);
        })
        .catch((e) => console.error("[reminders/inprocess]", e.message || e));
    }, 60000);
    console.log("📌 Reminder in-process cron enabled (60s)");
  }

  console.log("📌 Reminders routes: /reminders/sync, /reminders/run, /reminders/status");
}
