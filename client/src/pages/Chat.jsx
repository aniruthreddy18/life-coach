// =============================================================
// Chat.jsx — talk to your coach.
// The reply streams in: we add an empty "assistant" message,
// then keep appending text to it as pieces arrive.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { api, streamChat } from "../api.js";

const SUGGESTIONS = [
  "What should I focus on right now?",
  "Explain today's topic like I'm a beginner",
  "Quiz me on what I studied this week",
  "I don't feel like studying today",
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api("/chat/messages").then(setMessages).catch(() => {});
  }, []);

  // Scroll to the newest message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text) {
    text = text.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);

    const appendToLast = (piece) =>
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: last.content + piece };
        return copy;
      });

    try {
      await streamChat(text, appendToLast);
    } catch (e) {
      appendToLast(`⚠️ ${e.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
      <header className="page-head">
        <div>
          <p className="eyebrow">Friend · Teacher · Mentor</p>
          <h1>Coach</h1>
        </div>
      </header>

      <div className="messages">
        {messages.length === 0 && <p className="muted center-text">Say hi to your coach 👋</p>}
        {messages.map((m, i) => (
          <div key={m.id ?? `new-${i}`} className={`msg ${m.role}`}>
            {m.content || <span className="typing">●●●</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {messages.length < 3 && (
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea
          className="input"
          rows={1}
          placeholder="Message your coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
        />
        <button className="btn primary" disabled={sending || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
