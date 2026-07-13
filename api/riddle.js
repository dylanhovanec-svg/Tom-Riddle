// Vercel serverless function. The API key never reaches the browser.
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

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "The page was blank." });
  }

  // Keep the diary's memory bounded so old pages don't bloat the request.
  const recent = messages.slice(-40);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: SYSTEM,
        messages: recent,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Anthropic error:", r.status, detail);
      return res.status(502).json({ error: "The ink has run dry. Write to me again." });
    }

    const data = await r.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return res.status(200).json({ reply: reply || "..." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "The ink has run dry. Write to me again." });
  }
}
