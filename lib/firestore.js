// Firestore access for the diary, server-side only.
// The service-account credentials never reach the browser — they live in
// process.env on the Vercel function, exactly like the Anthropic key.
//
// A diary document looks like:
//   diaries/{diaryId} -> {
//     createdAt,                       // server timestamp, set once
//     updatedAt,                       // server timestamp, bumped each turn
//     turns:       [{ role, content, at }],   // the full transcript
//     impressions: string             // what the diary believes it has learned
//   }                                   // (impressions is written by a later feature)

import admin from "firebase-admin";

let _db = null;

// Lazily initialise the Admin SDK once per warm function instance.
function db() {
  if (_db) return _db;
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not set.");
    }
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw)),
    });
  }
  _db = admin.firestore();
  return _db;
}

// Read a diary. Returns null if it has never been written to.
export async function getDiary(diaryId) {
  const snap = await db().collection("diaries").doc(diaryId).get();
  return snap.exists ? snap.data() : null;
}

// Append turns to a diary, creating it on first write. Done in a transaction
// so concurrent writes can't clobber each other, and so createdAt and the
// impressions field are preserved across appends.
export async function appendTurns(diaryId, newTurns) {
  const ref = db().collection("diaries").doc(diaryId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? snap.data() : null;
    const turns = (existing?.turns || []).concat(newTurns);

    const data = {
      turns,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!existing) {
      data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    tx.set(ref, data, { merge: true });
  });
}
