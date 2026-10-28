// =============================================================
// Chat.jsx — talk to your coach.
// The reply streams in: we add an empty "assistant" message,
// then keep appending text to it as pieces arrive.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PaperPlaneRightIcon, SparkleIcon } from "@phosphor-icons/react";
import { api, streamChat } from "../api.js";
import { Page, Reveal, RichText, spring } from "../components.jsx";

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
  const inputRef = useRef(null);

  useEffect(() => {
    api("/chat/messages").then(setMessages).catch(() => {});
  }, []);

  // Scroll to the newest message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Grow the text box with its content (up to a limit set in CSS)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

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
      appendToLast(`Couldn't reach your coach: ${e.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <Page className="chat">
      <Reveal className="chat-head">
        <div className="avatar" aria-hidden><SparkleIcon size={22} weight="fill" /></div>
        <div>
          <h1 style={{ fontSize: "1.15rem" }}>Coach</h1>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <span className="status-dot" aria-hidden />Friend · teacher · mentor
          </p>
        </div>
      </Reveal>

      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <Reveal className="empty">
            <h3 className="display" style={{ fontSize: "1.5rem" }}>Say hi to your coach.</h3>
            <p className="muted">Ask for a plan, an explanation, a quiz, or just tell it how today went.</p>
          </Reveal>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            return (
              <motion.div
                key={m.id ?? `new-${i}`}
                className={`msg ${m.role}`}
                layout="position"
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={spring}
                style={{ transformOrigin: m.role === "user" ? "bottom right" : "bottom left" }}
              >
                {m.content ? (
                  <>
                    <RichText text={m.content} />
                    {isLast && sending && m.role === "assistant" && <Caret />}
                  </>
                ) : (
                  <Typing />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {messages.length < 3 && (
        <motion.div
          className="suggestions"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } }}
        >
          {SUGGESTIONS.map((s) => (
            <motion.button
              key={s}
              className="chip"
              onClick={() => send(s)}
              variants={{ hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0 } }}
              whileTap={{ scale: 0.96 }}
            >
              {s}
            </motion.button>
          ))}
        </motion.div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Message your coach</label>
        <textarea
          id="chat-input"
          ref={inputRef}
          className="input"
          rows={1}
          placeholder="Message your coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <motion.button
          className="btn primary send-btn"
          disabled={sending || !input.trim()}
          aria-label="Send"
          whileTap={{ scale: 0.9 }}
        >
          <PaperPlaneRightIcon size={18} weight="fill" />
        </motion.button>
      </form>
    </Page>
  );
}

// Three dots bouncing in a wave while the coach "thinks"
function Typing() {
  return (
    <span className="typing" aria-label="Coach is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

// Blinking cursor at the end of a reply that's still streaming
function Caret() {
  return (
    <motion.span
      aria-hidden
      style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent)", marginLeft: 2, verticalAlign: "-2px" }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity }}
    />
  );
}
