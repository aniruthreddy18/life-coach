// =============================================================
// Friends.jsx — STUDY BUDDIES: your friends, find people, requests
// -------------------------------------------------------------
// Three tabs:
//   Friends  -> everyone you're connected with (unread, duel status, record)
//   Find     -> your friend code, add by code, and matches (opt-in)
//   Requests -> people who want to connect, and requests you sent
// Tapping a friend opens FriendRoom.jsx (duel, chat, weekly quiz, record).
// =============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  UsersThreeIcon, MagnifyingGlassIcon, CopyIcon, CheckIcon, UserPlusIcon, SwordIcon, EyeIcon, EyeSlashIcon, TrayIcon,
} from "@phosphor-icons/react";
import { api } from "../api.js";
import { Page, Reveal, Card, Button, Segmented, Avatar, Empty, Skeleton, itemVariants } from "../components.jsx";

// Named states (not plain objects), so the cards inside cascade in with them
const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

const TAB_KEY = "friends-tab";

export default function Friends() {
  const [tab, setTabState] = useState(() => {
    try {
      return sessionStorage.getItem(TAB_KEY) || "friends";
    } catch {
      return "friends";
    }
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const setTab = (t) => {
    setTabState(t);
    try {
      sessionStorage.setItem(TAB_KEY, t);
    } catch {}
  };
  const load = () => api("/friends").then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <Page>
      <Reveal className="page-head">
        <span className="label">Study buddies</span>
        <h1 className="display">Friends</h1>
      </Reveal>

      <Reveal>
        <Segmented
          id="friends-tabs"
          className="wide-seg"
          value={tab}
          onChange={setTab}
          options={[
            { value: "friends", label: "Friends", badge: data?.friends.reduce((n, f) => n + f.unread, 0) },
            { value: "find", label: "Find" },
            { value: "requests", label: "Requests", badge: data?.incoming },
          ]}
        />
      </Reveal>

      {error && <p className="error">{error}</p>}
      {!data && !error && <Skeleton height={220} />}

      {data && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} className="tab-body" variants={tabVariants} initial="hidden" animate="show" exit="exit">
            {tab === "friends" && <FriendsTab friends={data.friends} onFind={() => setTab("find")} />}
            {tab === "find" && <FindTab settings={data} onChange={load} />}
            {tab === "requests" && <RequestsTab onChange={load} />}
          </motion.div>
        </AnimatePresence>
      )}
    </Page>
  );
}

// ---- Friends -----------------------------------------------------------------
function FriendsTab({ friends, onFind }) {
  if (!friends.length) {
    return (
      <Card>
        <Empty icon={UsersThreeIcon} title="No study buddies yet">
          Find people preparing for the same goal, or add a friend with their code. Then duel every day ⚔️
        </Empty>
        <Button variant="primary" className="wide" onClick={onFind}>
          <MagnifyingGlassIcon size={18} weight="bold" /> Find study buddies
        </Button>
      </Card>
    );
  }
  return (
    <motion.ul className="friend-list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
      {friends.map((f) => (
        <motion.li key={f.friendshipId} variants={itemVariants}>
          <Link to={`/friends/${f.friendshipId}`} className="friend-row card">
            <Avatar name={f.name} />
            <div className="friend-main">
              <div className="friend-top">
                <strong>{f.name}</strong>
                {f.streak > 0 && <span className="faint">🔥 {f.streak}</span>}
              </div>
              <span className="friend-sub">
                {f.lastMessage ? `${f.lastMessage.mine ? "You: " : ""}${f.lastMessage.text}` : `${f.subjects.join(" + ")} · ${f.level}`}
              </span>
            </div>
            <div className="friend-side">
              {f.unread > 0 ? <span className="badge">{f.unread}</span> : <span className="faint num">{f.record.wins}–{f.record.losses}</span>}
              <span className={`tag ${f.duelDone ? "good" : ""}`}>{f.duelDone ? <><CheckIcon size={12} weight="bold" /> Played</> : <><SwordIcon size={12} weight="bold" /> Duel</>}</span>
            </div>
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  );
}

// ---- Find ---------------------------------------------------------------------
function FindTab({ settings, onChange }) {
  const [matches, setMatches] = useState(null);
  const [requested, setRequested] = useState({});
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings.discoverable) api("/friends/matches").then(setMatches).catch(() => setMatches([]));
  }, [settings.discoverable]);

  async function toggle(on) {
    setBusy(true);
    try {
      await api("/friends/settings", { method: "PATCH", body: { discoverable: on } });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function addByCode(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeMsg(null);
    try {
      const r = await api("/friends/requests", { method: "POST", body: { code: code.trim() } });
      setCodeMsg({ ok: true, text: r.status === "accepted" ? `You and ${r.name ?? "your friend"} are now friends! 🎉` : `Request sent to ${r.name} 🤝` });
      setCode("");
      onChange();
    } catch (err) {
      setCodeMsg({ ok: false, text: err.message });
    }
  }

  async function add(m) {
    setRequested((r) => ({ ...r, [m.id]: "sending" }));
    try {
      await api("/friends/requests", { method: "POST", body: { userId: m.id } });
      setRequested((r) => ({ ...r, [m.id]: "sent" }));
      onChange();
    } catch (err) {
      setRequested((r) => ({ ...r, [m.id]: err.message }));
    }
  }

  function copy() {
    navigator.clipboard?.writeText(settings.friendCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="stack">
      <Card>
        <div className="card-head">
          <span className="card-title"><UserPlusIcon size={18} weight="bold" /> Add a friend you know</span>
        </div>
        <div className="code-row">
          <div>
            <span className="label">Your friend code</span>
            <div className="code-box num">{settings.friendCode}</div>
          </div>
          <Button onClick={copy} aria-label="Copy your friend code">
            {copied ? <><CheckIcon size={16} weight="bold" /> Copied</> : <><CopyIcon size={16} /> Copy</>}
          </Button>
        </div>
        <form className="row" style={{ marginTop: 14 }} onSubmit={addByCode}>
          <label htmlFor="friend-code" className="sr-only">Friend's code</label>
          <input id="friend-code" className="input" style={{ flex: 1, minWidth: 0, textTransform: "uppercase" }} placeholder="Their code, e.g. AE6F546" value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} />
          <Button variant="primary" type="submit" disabled={!code.trim()}>Add</Button>
        </form>
        {codeMsg && <p className={codeMsg.ok ? "good-text" : "error"} style={{ marginTop: 10 }}>{codeMsg.text}</p>}
      </Card>

      {!settings.discoverable ? (
        <Card className="optin">
          <div className="optin-icon"><MagnifyingGlassIcon size={26} weight="duotone" /></div>
          <h3>Find people with the same goal</h3>
          <p className="muted">
            Turn this on to see students preparing for the same thing as you, and to let them find you.
            They'll see your <strong>name, goal, subjects, level, daily time and language</strong>. Never your email.
          </p>
          <Button variant="primary" className="wide" onClick={() => toggle(true)} disabled={busy}>
            <EyeIcon size={18} weight="bold" /> Show me in Find study buddies
          </Button>
        </Card>
      ) : (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted"><EyeIcon size={16} style={{ verticalAlign: "-3px" }} /> You're visible to matches</span>
            <Button variant="ghost" onClick={() => toggle(false)} disabled={busy}><EyeSlashIcon size={16} /> Hide me</Button>
          </div>
          {!matches && <Skeleton height={160} />}
          {matches?.length === 0 && (
            <Card>
              <Empty icon={UsersThreeIcon} title="No matches yet">
                Nobody else has turned this on yet. Share your friend code with classmates so they can join you!
              </Empty>
            </Card>
          )}
          {matches?.map((m) => (
            <Card key={m.id} className="match-card">
              <div className="match-top">
                <Avatar name={m.name} />
                <div className="friend-main">
                  <strong>{m.name}</strong>
                  <span className="friend-sub">{m.subjects.join(" + ")} · {m.level}</span>
                </div>
                <div className="match-score">
                  <span className="num">{m.score}%</span>
                  <span className="label">match</span>
                </div>
              </div>
              {m.goal && <p className="match-goal">“{m.goal}”</p>}
              <div className="chips-sm">
                {m.reasons.map((r) => <span key={r} className="tag neutral">{r}</span>)}
              </div>
              <Button
                variant={requested[m.id] === "sent" ? "" : "primary"}
                className="wide"
                onClick={() => add(m)}
                disabled={Boolean(requested[m.id])}
              >
                {requested[m.id] === "sent" ? <><CheckIcon size={16} weight="bold" /> Request sent</> : requested[m.id] === "sending" ? "Sending…" : <><UserPlusIcon size={16} weight="bold" /> Add study buddy</>}
              </Button>
              {requested[m.id] && !["sent", "sending"].includes(requested[m.id]) && <p className="error">{requested[m.id]}</p>}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

// ---- Requests -------------------------------------------------------------------
function RequestsTab({ onChange }) {
  const [data, setData] = useState(null);
  const load = () => api("/friends/requests").then(setData);
  useEffect(() => {
    load();
  }, []);

  async function act(path, method = "POST") {
    await api(path, { method });
    await Promise.all([load(), onChange()]);
  }

  if (!data) return <Skeleton height={160} />;
  if (!data.incoming.length && !data.outgoing.length) {
    return (
      <Card>
        <Empty icon={TrayIcon} title="No requests">When someone wants to be your study buddy, it shows up here.</Empty>
      </Card>
    );
  }
  return (
    <div className="stack">
      {data.incoming.length > 0 && <span className="label">Want to connect with you</span>}
      {data.incoming.map((r) => (
        <Card key={r.friendshipId} className="match-card">
          <div className="match-top">
            <Avatar name={r.name} />
            <div className="friend-main">
              <strong>{r.name}</strong>
              <span className="friend-sub">{r.subjects.join(" + ")} · {r.level}</span>
            </div>
            <div className="match-score"><span className="num">{r.score}%</span><span className="label">match</span></div>
          </div>
          {r.goal && <p className="match-goal">“{r.goal}”</p>}
          <div className="row">
            <Button variant="primary" style={{ flex: 1 }} onClick={() => act(`/friends/requests/${r.friendshipId}/accept`)}>
              <CheckIcon size={16} weight="bold" /> Accept
            </Button>
            <Button variant="ghost" onClick={() => act(`/friends/requests/${r.friendshipId}/decline`)}>Decline</Button>
          </div>
        </Card>
      ))}
      {data.outgoing.length > 0 && <span className="label" style={{ marginTop: 6 }}>Sent by you</span>}
      {data.outgoing.map((r) => (
        <Card key={r.friendshipId} className="friend-row">
          <Avatar name={r.name} size={38} />
          <div className="friend-main">
            <strong>{r.name}</strong>
            <span className="friend-sub">Waiting for them to accept</span>
          </div>
          <Button variant="ghost" onClick={() => act(`/friends/${r.friendshipId}`, "DELETE")}>Cancel</Button>
        </Card>
      ))}
    </div>
  );
}

