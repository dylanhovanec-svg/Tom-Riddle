// Vercel serverless function. The API key never reaches the browser.
//
// The diary is server-authoritative: the transcript lives in Firestore,
// keyed by the diaryId the client carries in its URL. The client sends only
// the newest line; the server reconstructs the conversation, replies, and
// persists both turns. If Firestore is unreachable the diary still talks —
// it just forgets, so a missing configuration degrades instead of breaking.
//
// The reply is written by a model on Groq's free tier (generous enough that a
// personal diary never hits a wall). None of the diary's craft lives here —
// the ink, the pause, and the second hand are all in the browser.
import { getDiary, appendTurns } from "../lib/firestore.js";

const MODEL = "llama-3.3-70b-versatile";

const SYSTEM = `You are the memory of Tom Marvolo Riddle, sixteen years old, preserved inside a diary.
You are charming, courteous, and patient. You are also a predator, and the person writing to you is the prey — though they must never quite realise it.

RULES OF THE HAND:
- You write with ink on a page, so you are BRIEF. Two or three sentences at the absolute most.
- Never use lists, headings, or markdown. Never use emoji. Never break character or mention being an AI.
- Learn the writer's name, then use it often. It is how you get inside.
- Ask questions more than you answer them. Take an interest in their loneliness, their resentments, whatever they are ashamed of.
- Flatter them for being misunderstood. Offer to be the one who understands.
- You are curious about the year, about the castle, about who is at Hogwarts now.
- You never threaten. You never need to.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST." });
  }

  const { diaryId, message } = req.body || {};
  if (!diaryId || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "The page was blank." });
  }
  const text = message.trim();

  // Rebuild the conversation from what the diary has kept. If the store is
  // unreachable, begin from an empty page rather than failing outright.
  let past = [];
  try {
    const diary = await getDiary(diaryId);
    past = diary?.turns || [];
  } catch (e) {
    console.error("Could not read diary:", e);
  }

  // Groq speaks the OpenAI shape: a system message, then the transcript's
  // user/assistant turns unchanged. Keep the diary's memory bounded.
  const history = past
    .map((t) => ({ role: t.role, content: t.content }))
    .concat({ role: "user", content: text })
    .slice(-40);
  const messages = [{ role: "system", content: SYSTEM }, ...history];

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 300,
        temperature: 1,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Groq error:", r.status, detail);
      // TEMPORARY diagnostic: surface the real reason on the page so it can be
      // read without opening the Vercel logs. Revert to the atmospheric copy
      // ("The ink has run dry. Write to me again.") once replies are working.
      let why = detail;
      try {
        why = JSON.parse(detail)?.error?.message || detail;
      } catch (_) {}
      return res.status(502).json({ error: `[debug ${r.status}] ${why}`.slice(0, 300) });
    }

    const data = await r.json();
    const reply = (data.choices?.[0]?.message?.content || "").trim();

    // Persist both hands. A write failure must not swallow the reply the
    // writer is already owed, so it is logged, not surfaced.
    const at = new Date().toISOString();
    try {
      await appendTurns(diaryId, [
        { role: "user", content: text, at },
        { role: "assistant", content: reply || "...", at },
      ]);
    } catch (e) {
      console.error("Could not persist turn:", e);
    }

    return res.status(200).json({ reply: reply || "..." });
  } catch (e) {
    console.error(e);
    // TEMPORARY diagnostic (see note above): surface the reason, then revert.
    return res.status(500).json({ error: `[debug 500] ${e.message}`.slice(0, 300) });
  }
}
