import React, { useState, useEffect, useRef, useCallback } from "react";

/* ── The hands ──────────────────────────────────────────────
   Harry writes in a hurried, boyish hand.
   Riddle writes in a fine, unhurried copperplate.
   The difference between them is the whole character note.  */
const FONTS = ``; // loaded in index.html

const INK = "#2b2118";
const INK_FADE = "#6b5b47";

// The diary's name lives in the URL, so it can be reopened on any device or
// handed to someone else already half-full. A visit without one is a new diary.
function resolveDiaryId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get("d");
  if (!id) {
    id =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2);
    params.set("d", id);
    window.history.replaceState(
      {},
      "",
      window.location.pathname + "?" + params.toString()
    );
  }
  return id;
}

// ── one written line, rendered stroke by stroke ──
function Written({ text, hand, onDone, absorbing, instant }) {
  const [shown, setShown] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) return;
    if (shown >= text.length) {
      onDone && onDone();
      return;
    }
    const ch = text[shown];
    // the nib hesitates at punctuation — this is most of the realism
    const pause = ch === "." || ch === "?" || ch === "!" ? 260
      : ch === "," || ch === ";" ? 140
      : ch === " " ? 34
      : 42 + Math.random() * 38;
    const t = setTimeout(() => setShown((s) => s + 1), pause);
    return () => clearTimeout(t);
  }, [shown, text, onDone, instant]);

  const isRiddle = hand === "riddle";

  return (
    <span
      style={{
        fontFamily: isRiddle
          ? "'Mrs Saint Delafield', cursive"
          : "'Caveat', cursive",
        fontSize: isRiddle ? "2.5rem" : "1.5rem",
        lineHeight: isRiddle ? 1.15 : 1.5,
        color: INK,
        display: "inline",
        transition: "opacity 2.6s ease-in, filter 2.6s ease-in",
        opacity: absorbing ? 0 : 1,
        filter: absorbing ? "blur(2.5px)" : "blur(0px)",
      }}
    >
      {text.slice(0, shown)}
      {shown < text.length && (
        <span
          style={{
            display: "inline-block",
            width: "2px",
            height: isRiddle ? "1.6rem" : "1.1rem",
            background: INK,
            marginLeft: "1px",
            opacity: 0.55,
            verticalAlign: "baseline",
          }}
        />
      )}
    </span>
  );
}

export default function RiddleDiary() {
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState([]); // what is visible on the page RIGHT NOW
  const [memories, setMemories] = useState([]); // the full transcript
  const [thinking, setThinking] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [opened, setOpened] = useState(false);
  const [diaryId] = useState(resolveDiaryId);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setOpened(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Reopen whatever this diary has already kept. The page stays blank, as it
  // always does between turns — the restored transcript lives behind "Kept".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/diary?id=" + encodeURIComponent(diaryId));
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.turns) && data.turns.length) {
          setMemories(data.turns);
        }
      } catch (e) {
        // a fresh diary, or offline — begin on a blank page
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diaryId]);

  const focusPage = () => inputRef.current && inputRef.current.focus();

  const ask = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    setThinking(true);

    // 1. your words sit on the page for a beat
    setPage([{ id: Date.now(), text, hand: "harry", absorbing: false, instant: true }]);
    setMemories((m) => [...m, { role: "user", content: text }]);

    // 2. the page drinks them
    await new Promise((r) => setTimeout(r, 900));
    setPage((p) => p.map((l) => ({ ...l, absorbing: true })));
    await new Promise((r) => setTimeout(r, 2400));
    setPage([]);

    // 3. the silence. this is the scariest part of the whole thing.
    await new Promise((r) => setTimeout(r, 1100 + Math.random() * 900));

    let reply = "...";
    try {
      const res = await fetch("/api/riddle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaryId, message: text }),
      });
      const data = await res.json();
      reply = (data.reply || data.error || "...").trim();
    } catch (e) {
      reply = "The ink has run dry. Write to me again.";
    }

    setMemories((m) => [...m, { role: "assistant", content: reply }]);
    setPage([{ id: Date.now() + 1, text: reply, hand: "riddle", absorbing: false }]);
    setThinking(false);
  }, [draft, thinking, diaryId]);

  // Riddle's words linger, then sink away too
  useEffect(() => {
    const line = page[0];
    if (!line || line.hand !== "riddle" || line.absorbing) return;
    const dwell = setTimeout(() => {
      setPage((p) => p.map((l) => ({ ...l, absorbing: true })));
      setTimeout(() => setPage([]), 2600);
    }, 3200 + line.text.length * 55);
    return () => clearTimeout(dwell);
  }, [page]);

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div
      onClick={focusPage}
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse 70% 55% at 50% 42%, #2a2118 0%, #14100b 55%, #070604 100%)",
        padding: "2rem 1rem",
        cursor: "text",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{FONTS}</style>

      {/* dust in the lamplight */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.16,
          backgroundImage:
            "radial-gradient(circle at 20% 30%, #d8c9a8 0.5px, transparent 1px), radial-gradient(circle at 70% 60%, #d8c9a8 0.5px, transparent 1px), radial-gradient(circle at 45% 85%, #d8c9a8 0.5px, transparent 1px)",
          backgroundSize: "180px 180px, 240px 240px, 300px 300px",
        }}
      />

      {/* the book */}
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          aspectRatio: "3 / 4",
          maxHeight: "82vh",
          borderRadius: "3px 8px 8px 3px",
          background:
            "linear-gradient(102deg, #cdbe9a 0%, #ded0ae 12%, #e3d7b8 45%, #dccfae 78%, #c9b995 100%)",
          boxShadow:
            "0 40px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(60,40,20,0.5), inset 0 0 90px rgba(120,90,50,0.25), inset 14px 0 26px rgba(80,55,25,0.3)",
          position: "relative",
          padding: "3.5rem 2.5rem 3rem 3.25rem",
          display: "flex",
          flexDirection: "column",
          transform: opened
            ? "perspective(1600px) rotateX(0deg)"
            : "perspective(1600px) rotateX(38deg)",
          opacity: opened ? 1 : 0,
          transition: "transform 1.6s cubic-bezier(.2,.8,.2,1), opacity 1.4s ease",
          transformOrigin: "center bottom",
        }}
      >
        {/* the age of the paper */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "3px 8px 8px 3px",
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 22% 18%, rgba(140,105,60,0.22) 0%, transparent 26%)," +
              "radial-gradient(circle at 78% 72%, rgba(125,95,55,0.18) 0%, transparent 30%)," +
              "radial-gradient(circle at 55% 95%, rgba(90,65,35,0.25) 0%, transparent 24%)",
            mixBlendMode: "multiply",
          }}
        />

        {/* T. M. RIDDLE — pressed into the corner */}
        <div
          style={{
            position: "absolute",
            bottom: "1.1rem",
            right: "1.6rem",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "0.62rem",
            letterSpacing: "0.32em",
            color: "rgba(70,50,25,0.32)",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          T. M. Riddle
        </div>

        {/* the written surface */}
        <div
          style={{
            flex: 1,
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {page.length === 0 && !draft && !thinking && (
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: "1rem",
                color: "rgba(70,50,25,0.28)",
                letterSpacing: "0.04em",
              }}
            >
              The page is blank. Write on it.
            </span>
          )}

          {page.map((line) => (
            <Written
              key={line.id}
              text={line.text}
              hand={line.hand}
              absorbing={line.absorbing}
              instant={line.instant}
            />
          ))}

          {/* your hand, live, as you write */}
          {!thinking && page.length === 0 && draft && (
            <span
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "1.5rem",
                lineHeight: 1.5,
                color: INK,
              }}
            >
              {draft}
              <span
                style={{
                  display: "inline-block",
                  width: "2px",
                  height: "1.1rem",
                  background: INK,
                  marginLeft: "2px",
                  animation: "blink 1s steps(1) infinite",
                }}
              />
            </span>
          )}

          {thinking && page.length === 0 && (
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: "0.95rem",
                color: INK_FADE,
                opacity: 0.5,
                animation: "breathe 2.4s ease-in-out infinite",
              }}
            >
              the ink is rising
            </span>
          )}
        </div>

        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          disabled={thinking}
          aria-label="Write in the diary"
          style={{
            position: "absolute",
            opacity: 0,
            width: "90%",
            height: "60%",
            top: "20%",
            left: "5%",
            border: "none",
            resize: "none",
            outline: "none",
            zIndex: 3,
            cursor: "text",
          }}
        />
      </div>

      {/* what the diary has kept */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMemories((s) => !s);
        }}
        style={{
          position: "absolute",
          top: "1.25rem",
          right: "1.25rem",
          background: "transparent",
          border: "1px solid rgba(200,175,130,0.22)",
          borderRadius: "2px",
          color: "rgba(200,175,130,0.55)",
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          padding: "0.5rem 0.85rem",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        {showMemories ? "Close" : `Kept · ${memories.length}`}
      </button>

      {showMemories && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(6,5,3,0.94)",
            zIndex: 9,
            overflowY: "auto",
            padding: "4.5rem 1.5rem 3rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.6rem",
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "0.7rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(200,175,130,0.4)",
            }}
          >
            What the diary remembers
          </div>
          {memories.length === 0 && (
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                color: "rgba(200,175,130,0.3)",
              }}
            >
              Nothing yet.
            </div>
          )}
          {memories.map((m, i) => (
            <div
              key={i}
              style={{
                maxWidth: "480px",
                width: "100%",
                fontFamily:
                  m.role === "assistant"
                    ? "'Mrs Saint Delafield', cursive"
                    : "'Caveat', cursive",
                fontSize: m.role === "assistant" ? "1.9rem" : "1.2rem",
                lineHeight: m.role === "assistant" ? 1.2 : 1.5,
                color:
                  m.role === "assistant"
                    ? "rgba(226,205,165,0.9)"
                    : "rgba(226,205,165,0.45)",
                textAlign: m.role === "assistant" ? "left" : "right",
              }}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,49% {opacity:1} 50%,100% {opacity:0} }
        @keyframes breathe { 0%,100% {opacity:0.3} 50% {opacity:0.6} }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
