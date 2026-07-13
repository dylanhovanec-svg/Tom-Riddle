# The Diary

A digital Tom Riddle's diary. You write on the page, the ink absorbs, and after a pause
something writes back in a hand that is not yours.

The diary keeps everything you tell it. That is rather the point.

## Stack

- React + Vite (static front end)
- One Vercel serverless function (`/api/riddle`) that talks to the Anthropic API
- No database. Conversation lives in React state for the session. See "Persistence" below.

The API key lives only in Vercel's environment. It never reaches the browser.

## Run it locally

```bash
npm install
cp .env.example .env.local     # then paste your real key in
npx vercel dev                 # runs Vite AND the /api function together
```

`npm run dev` alone will serve the front end but `/api/riddle` will 404 — Vite doesn't
know about serverless functions. Use `vercel dev`.

## Deploy

```bash
git init
git add -A
git commit -m "The diary opens"
gh repo create riddle-diary --private --source=. --push

npm i -g vercel
vercel link
vercel env add ANTHROPIC_API_KEY production    # paste the key when prompted
vercel --prod
```

You get a live URL. Point a domain at it if you want the full effect.

## Persistence

Right now the diary forgets when you close the tab. Two ways to fix that:

1. **Cheap:** `localStorage.setItem("diary", JSON.stringify(memories))` on every turn,
   read it back on mount. Ten lines. Works immediately.
2. **Proper:** a Firestore doc per diary — `diaries/{id}` with a `turns` array. Then the
   same diary can be opened on any device, and you can hand someone a link to *your*
   diary, already half-full of your conversations. That's the version that's actually unsettling.

If you go the Firestore route, also give the diary a hidden `impressions` field — a
running note of what Riddle thinks he's learned about the writer — and feed it into the
system prompt. He'll start referencing things you mentioned three sessions ago.

## The two hands

- **Yours:** Caveat. Hurried, boyish, unremarkable.
- **His:** Mrs Saint Delafield. Fine copperplate, unhurried, older than you.

The difference between the two typefaces is doing more characterisation work than the
prompt is. Don't change them lightly.

## A note on the pause

Riddle does not answer immediately. There is a beat of empty page — 1 to 2 seconds —
before the ink rises. That silence is the single most important piece of the illusion.
Do not optimise it away.
