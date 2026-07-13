# Riddle Diary — Handoff

## What this is

A digital enchanted diary. The user writes on a page; their words absorb into the paper;
after a deliberate pause, a reply surfaces in a different hand. Vite + React front end,
one Vercel serverless function talking to the Anthropic API.

## CURRENT BUG — fix this first

Vercel build fails:

```
vite v5.4.21 building for production...
✓ 2 modules transformed.
x Build failed in 47ms
error during build:
[vite]: Rollup failed to resolve import "/src/main.jsx"
Error: Command "npm run build" exited with 1
```

**Cause:** the `src/` directory is missing from the repo. It was uploaded via the GitHub
web UI from a phone, which silently drops folders. `index.html` references
`/src/main.jsx`, Rollup can't find it, build dies. Only 2 modules transformed — that's
`index.html` and nothing else.

**Fix:** verify `src/main.jsx` and `src/RiddleDiary.jsx` exist and are committed. Their
canonical contents are in the zip that produced this repo; `main.jsx` should be exactly:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import RiddleDiary from "./RiddleDiary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RiddleDiary />
  </React.StrictMode>
);
```

`src/RiddleDiary.jsx` is ~425 lines, default-exports `RiddleDiary`, and POSTs to
`/api/riddle` with `{ messages: [...] }`. If it's missing entirely, rebuild it from the
design notes below rather than inventing a new look.

Then run `npm run build` locally to confirm before pushing. Do not push a red build.

## Expected file tree

```
.
├── api/riddle.js          # Vercel serverless fn — holds the API key
├── src/
│   ├── main.jsx           # React entry
│   └── RiddleDiary.jsx    # the entire diary, one component
├── index.html             # loads Google Fonts, mounts #root
├── package.json           # react 18, vite 5, @vitejs/plugin-react
├── vite.config.js
├── vercel.json            # framework: vite
├── .env.example
└── .gitignore
```

## Environment

- `ANTHROPIC_API_KEY` — set in Vercel dashboard (Settings → Environment Variables).
  Never in the repo, never in client code. `api/riddle.js` reads it from `process.env`.
- Local dev: `npx vercel dev` — NOT `npm run dev`. Plain Vite doesn't serve `/api/*` and
  the diary will 404 on every message.

## Design constraints — do not "improve" these

These are load-bearing. They look like arbitrary magic numbers; they are the product.

1. **The pause.** After the user's text absorbs, there is 1.0–2.0s of empty page before
   the reply begins. This silence is the single most effective part of the illusion.
   Do not reduce it, do not add a spinner, do not stream the reply instantly.
2. **Two hands.** The user writes in `Caveat` (hurried, boyish). The reply is written in
   `Mrs Saint Delafield` (fine copperplate, unhurried, older). The typeface contrast is
   doing more characterisation than the prompt is.
3. **Character-by-character reveal** with variable delay — the nib hesitates longer at
   `.` `?` `!` (260ms) and `,` `;` (140ms) than at letters (~42–80ms). Uniform typing
   speed instantly reads as a chatbot.
4. **Absorption**, not deletion. Text leaves via a 2.6s opacity→0 + blur(2.5px)
   transition. It sinks into the paper. It never just disappears.
5. **The page clears** between turns, as in the source material. The transcript is
   preserved behind a "Kept · N" toggle in the corner.
6. **Replies are 2–3 sentences, maximum.** Long replies destroy the handwriting illusion
   and the pacing. This is enforced in the system prompt in `api/riddle.js` and by
   `max_tokens: 300`. Keep both.
7. `prefers-reduced-motion` is respected. Keep it that way.

## Roadmap

### 1. Persistence (do this next)

Currently the diary forgets on tab close. Move to Firestore:

- `diaries/{diaryId}` → `{ createdAt, turns: [{ role, content, at }], impressions: string }`
- Diary ID in the URL so a diary can be reopened on any device, or handed to someone else
  already half-full.

### 2. The `impressions` field (this is the whole point)

A hidden, running note of what the diary believes it has learned about the writer — their
name, their loneliness, their resentments, who they distrust. After each turn, make a
second cheap model call that updates `impressions` given the new exchange. Inject the
current `impressions` into the system prompt on every request.

Effect: three sessions later, unprompted, it references something you mentioned once.
That's the feature people will tell other people about.

### 3. Reskin before any public deployment

The current copy uses the Harry Potter name and the T. M. Riddle monogram. That is fine
for a private/portfolio build and is a takedown risk if shipped publicly under that name.
Strip the Potter-specific strings (`T. M. Riddle` monogram, the character name in the
system prompt) and rename to a generic haunted-journal identity. The mechanic — ink,
pause, second hand, a thing that remembers you — survives the reskin completely intact.
None of the craft is in the trademark.

## House rules (Dylan's)

- Complete replacement files. Never partial snippets or "// ... rest unchanged".
- One feature at a time.
- Code first, explanation after — and keep the explanation short.
