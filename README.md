# 🧭 Life Coach — your personal AI career coach

An app that gets to know you (12 onboarding questions + an AI level test), scores you,
builds a 12-week roadmap, plans your tasks every day, checks in with you every night,
talks to you like a friend/teacher/mentor, and writes you a weekly report.

**Stack:** React (Vite) · Node.js + Express · SQLite · Gemini or Claude API · Web Push · node-cron

> New to this? Read **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)**. It explains every part like you're a fresher.

---

## 1. Install the tools (one time)

| Tool | Windows | Mac |
|---|---|---|
| **Node.js 22.13+ (LTS)** | https://nodejs.org → download LTS → run installer | same link, or `brew install node` |
| **VS Code** | https://code.visualstudio.com | same |
| **Git** (optional, to save your work) | https://git-scm.com | `xcode-select --install` |

Check in a terminal (**PowerShell** on Windows, **Terminal** on Mac):
```bash
node -v      # must print v22.13 or higher
```

## 2. Get an AI key

The app works with **Google Gemini** (free tier, the default) or **Claude** (paid credits).
You only need ONE of them to start.

**Gemini (free):**
1. Go to https://aistudio.google.com/apikey and sign in with your Google account.
2. Click **Create API key** and copy it.

**Claude (later, when you're ready):**
1. Go to https://console.anthropic.com → **Billing** → add credits ($5 is enough for months).
2. **API Keys** → *Create Key* → copy it (starts with `sk-ant-`).

## 3. Set up the project

Open a terminal **inside the `life-coach` folder**, then:

```bash
npm install
```
This installs everything (root, `server/`, `client/`).

Now create your secrets file by copying `server/.env.example` to `server/.env`:

- **Windows (PowerShell):** `copy server\.env.example server\.env`
- **Mac:** `cp server/.env.example server/.env`

Open `server/.env` (Mac: `open -e server/.env`) and paste your Gemini key:
```
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

Check the key works and see which models it can use:
```bash
npm run models
```

## 4. Run it

**For daily use** (one server, fastest):
```bash
npm start
```
Open **http://localhost:3001**

**For learning / changing code** (auto-reloads when you save a file):
```bash
npm run dev
```
Open **http://localhost:5173**

Press `Ctrl + C` in the terminal to stop.

## 5. Turn on notifications

In the app: **⚙️ Settings → Enable on this device → Send test**.
Notifications are sent at the times in `server/.env` (`MORNING_TIME`, `EVENING_TIME`, `NUDGE_TIME`)
**while the server is running on your laptop**. To get them on your phone even when the laptop
is off, the app needs to be deployed online (that's a later phase).

---

## Switching between Gemini and Claude

Everything AI-related goes through `server/src/ai.js`, so switching is **one line** in `server/.env`:

```
AI_PROVIDER=gemini     # free tier (default)
AI_PROVIDER=claude     # paid, best quality
```
Restart the server after changing it (`Ctrl + C`, then `npm start`). The terminal prints which AI and models are in use.
Your data (profile, plan, chats) stays. Only the "brain" changes.

Each provider uses two models:

| Tier | Used for | Gemini default | Claude default |
|---|---|---|---|
| **smart** | Level test, assessment + roadmap, weekly report | `gemini-flash-latest` | `claude-opus-5-5` |
| **fast** | Daily tasks, check-ins, chat | `gemini-flash-latest` | `claude-haiku-5-5` |

Change them with `GEMINI_MODEL_SMART` / `GEMINI_MODEL_FAST` / `CLAUDE_MODEL_SMART` / `CLAUDE_MODEL_FAST`.

**Cost:** Gemini's free tier costs nothing (it has daily limits). With Claude (Opus + Haiku), onboarding is
about $0.20 once, then roughly $0.02–0.04 a day, so **$5 lasts about 4–7 months** for one person.
Watch real spend at https://console.anthropic.com → Usage.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the server" | Is the terminal running `npm run dev` / `npm start`? Any red error there? |
| "No Gemini/Claude API key found" | You didn't create `server/.env`, or the key line is empty. Restart after editing. |
| "Gemini rejected the request" / "key is invalid" | Re-copy the key; no spaces or quotes. Check `AI_PROVIDER` matches the key you added. |
| "Gemini free-tier limit reached" | Wait a minute (or until tomorrow for the daily limit), or switch to Claude. |
| "Gemini model … not found" | Run `npm run models` and put a listed name in `GEMINI_MODEL_SMART` / `GEMINI_MODEL_FAST`. |
| `node:sqlite` not found | Your Node is too old. Install the current LTS from nodejs.org. |
| Port already in use | Another copy is running. Close the other terminal, or change `PORT` in `.env`. |
| Want to start fresh | Settings → Reset everything (or delete the `server/data` folder). |

## Project map

```
life-coach/
├── server/                 ← BACKEND (Node.js + Express)
│   ├── .env                ← your secrets + AI_PROVIDER switch (never share!)
│   ├── scripts/list-models.js ← `npm run models`
│   ├── data/lifecoach.db   ← your database (created automatically)
│   └── src/
│       ├── index.js        ← starts the server, connects everything
│       ├── env.js          ← loads .env
│       ├── db.js           ← database tables + SQL helpers
│       ├── state.js        ← reads your data, computes streak/stats, builds AI context
│       ├── ai.js           ← the one door to the AI: picks Gemini or Claude + coach personality
│       ├── providers/
│       │   ├── gemini.js   ← Google Gemini API calls
│       │   └── claude.js   ← Anthropic Claude API calls
│       ├── coach.js        ← features: quiz, assessment, tasks, check-in, chat, reports
│       ├── questions.js    ← the onboarding questions
│       ├── push.js         ← sends notifications
│       ├── scheduler.js    ← timed jobs (morning, evening, nudge, Sunday report)
│       └── routes/         ← the API endpoints (URLs)
└── client/                 ← FRONTEND (React)
    ├── public/sw.js        ← service worker (shows notifications)
    └── src/
        ├── main.jsx        ← React starts here
        ├── App.jsx         ← onboarding gate + pages + bottom tabs
        ├── api.js          ← every call to the backend lives here
        ├── components.jsx  ← reusable pieces (charts, score bars, spinner)
        ├── styles.css      ← look & feel (light + dark mode)
        └── pages/          ← one file per screen
```
