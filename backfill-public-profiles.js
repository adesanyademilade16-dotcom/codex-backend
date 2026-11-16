/**
 * One-off: create missing public_profiles/{uid} documents so every student shows up in Chats search.
 * Students only appear in search if public_profiles/{uid} exists (it is the public projection of users/{uid}).
 * It is only created at onboarding (chooseFaculty) or when a profile is saved, so older / partly-onboarded
 * accounts are invisible.
 *
 * SAFE BY DEFAULT: dry run. Never overwrites an existing public profile (uses create()).
 * Copies ONLY public fields (no email, tokens, plan, credits, admin flags).
 *
 * Run (from the backend folder, with FIREBASE_SERVICE_ACCOUNT set, e.g. in Render Shell):
 *   node backfill-public-profiles.js            # dry run: prints counts + a few examples
 *   node backfill-public-profiles.js --apply    # actually creates the missing docs
 */
import admin from "firebase-admin";
import { pathToFileURL } from "node:url";

export function buildPublic(u) {
  const name = String(u.fullName || u.displayName || u.name || "").trim();
  const username = String(u.username || "").trim();
  if (!name && !username) return null;                 // nothing meaningful to show
  const out = {
    displayName: name || username,
    username: username,
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

async function main() {
  const apply = process.argv.includes("--apply");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw) { console.error("FIREBASE_SERVICE_ACCOUNT is not set"); process.exit(1); }
  const cred = JSON.parse(raw);
  if (cred.private_key) cred.private_key = String(cred.private_key).replace(/\\n/g, "\n");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) });
  const db = admin.firestore();

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
      if (examples.length < 5) examples.push({ uid: snap.docs[i].id, username: pub.username, name: pub.displayName });
      if (apply) {
        try { await refs[i].create(pub); stats.created++; }
        catch (e) { if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) stats.hadProfile++; else { stats.errors++; console.error("failed", snap.docs[i].id, e.message); } }
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }
  console.log(apply ? "APPLIED" : "DRY RUN (nothing written) — add --apply to write", JSON.stringify(stats));
  console.log("examples:", JSON.stringify(examples));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
