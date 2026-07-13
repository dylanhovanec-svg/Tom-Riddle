// Vercel serverless function. Loads a diary so it can be reopened on any
// device, or handed to someone else already half-full.
//
// Only the transcript is returned — the diary's private `impressions` note is
// never sent to the browser. If the store is unreachable, the diary simply
// opens blank.
import { getDiary } from "../lib/firestore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET." });
  }

  const id = req.query?.id;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "No diary named." });
  }

  try {
    const diary = await getDiary(id);
    const turns = (diary?.turns || []).map((t) => ({
      role: t.role,
      content: t.content,
    }));
    return res.status(200).json({ turns });
  } catch (e) {
    console.error("Could not read diary:", e);
    return res.status(200).json({ turns: [] });
  }
}
