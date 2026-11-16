/**
 * Admin-only, ONE-TIME tool: create missing public_profiles/{uid} documents so every student appears in Chats search.
 *   POST /admin/backfill-public-profiles   Authorization: Bearer <Firebase ID token>   body: { "apply": false|true }
 * Only the owner email or an active admins/{uid} account may call it. Dry run unless apply === true.
 * Never overwrites an existing public profile; copies ONLY public fields (no email/tokens/plan/credits/admin flags).
 * Delete this file (and its 2 lines in server.js) once you've run it.
 */
import admin from "firebase-admin";

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw || !String(raw).trim()) throw new Error("FIREBASE_SERVICE_ACCOUNT missing on server");
  const cred = typeof raw === "object" ? raw : JSON.parse(raw);
  if (cred.private_key && typeof cred.private_key === "string") cred.private_key = cred.private_key.replace(/\\n/g, "\n");
  admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin;
}

export function buildPublic(u) {
  const name = String(u.fullName || u.displayName || u.name || "").trim();
  const username = String(u.username || "").trim();
  if (!name && !username) return null;
  const out = {
    displayName: name || username,
    username,
    photoURL: u.photoURL || "",
    university: u.university || "",
    faculty: u.faculty || "",
    department: u.department || "",
    level: u.level == null ? "" : u.level,
    bio: u.bio || "",
    avatarKey: u.avatarKey || "",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (u.semester != null) out.semester = u.semester;
  if (u.novaCharacter) out.novaCharacter = u.novaCharacter;
  return out;
}

async function isHubAdmin(decoded) {
  if (String(decoded.email || "").toLowerCase() === "codexhub16@gmail.com" && decoded.email_verified !== false) return true;
  try {
    const a = await getAdmin().firestore().collection("admins").doc(decoded.uid).get();
    return a.exists && (a.data() || {}).active !== false;
  } catch (e) { return false; }
}

export function mountAdminBackfill(app) {
  app.post("/admin/backfill-public-profiles", async (req, res) => {
    try {
      const h = req.headers.authorization || "";
      const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
      if (!token) return res.status(401).json({ ok: false, error: "missing token" });
      let decoded;
      try { decoded = await getAdmin().auth().verifyIdToken(token); }
      catch (e) { return res.status(401).json({ ok: false, error: "invalid token" }); }
      if (!(await isHubAdmin(decoded))) return res.status(403).json({ ok: false, error: "admin only" });

      const apply = !!(req.body && req.body.apply === true);
      const db = getAdmin().firestore();
      const stats = { users: 0, hadProfile: 0, missing: 0, skippedNoName: 0, created: 0, errors: 0 };
      const examples = [];
      let last = null;
      for (;;) {
        let q = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        const refs = snap.docs.map((d) => db.collection("public_profiles").doc(d.id));
        const existing = await db.getAll(...refs);
        for (let i = 0; i < snap.docs.length; i++) {
          stats.users++;
          if (existing[i].exists) { stats.hadProfile++; continue; }
          stats.missing++;
          const pub = buildPublic(snap.docs[i].data() || {});
          if (!pub) { stats.skippedNoName++; continue; }
          if (examples.length < 5) examples.push({ username: pub.username, name: pub.displayName });
          if (apply) {
            try { await refs[i].create(pub); stats.created++; }
            catch (e) {
              if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) stats.hadProfile++;
              else { stats.errors++; console.error("[backfill] failed for a user:", e.message); }
            }
          }
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 300) break;
      }
      console.log("[backfill]", apply ? "APPLIED" : "DRY RUN", JSON.stringify(stats));
      return res.json({ ok: true, applied: apply, stats, examples });
    } catch (e) {
      console.error("[backfill] error", e && e.message);
      return res.status(500).json({ ok: false, error: "server error" });
    }
  });
}
