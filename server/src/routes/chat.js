// =============================================================
// routes/chat.js
//   GET  /api/chat/messages  -> chat history
//   POST /api/chat           -> send a message, get a STREAMED reply
//
// Streaming: instead of res.json() at the end, we res.write()
// small pieces of text as soon as the AI produces them, and
// res.end() when finished. The browser reads them as they arrive.
// req.user.id is set by the sign-in check (auth.js).
// =============================================================
import { Router } from "express";
import { all } from "../db.js";
import { chat } from "../coach.js";

export const router = Router();

router.get("/chat/messages", async (req, res) => {
  const rows = await all(
    "SELECT id, role, content, created_at FROM messages WHERE user_id = $1 ORDER BY id DESC LIMIT 100",
    req.user.id,
  );
  res.json(rows.reverse());
});

router.post("/chat", async (req, res) => {
  const text = String(req.body.message ?? "").trim();
  if (!text) return res.status(400).json({ error: "message is required" });
  if (text.length > 4000) return res.status(400).json({ error: "message is too long" });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  try {
    await chat(req.user.id, text, (piece) => res.write(piece));
  } catch (err) {
    console.error("Chat failed:", err);
    // Headers are already sent, so we can't change the status code now.
    // We tell the user in the text instead.
    res.write(`\n\n⚠️ ${err.status ? err.message : "Something went wrong talking to the AI. Try again."}`);
  }
  res.end();
});
