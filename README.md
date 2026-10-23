# 🧭 Life Coach — your personal AI career coach

An app that gets to know you (12 onboarding questions + an AI level test), scores you,
builds a 12-week roadmap, plans your tasks every day, checks in with you every night,
talks to you like a friend/teacher/mentor, and writes you a weekly report.

**Stack:** React (Vite) · Node.js + Express · SQLite · Claude API · Web Push · node-cron

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

## 2. Get a Claude API key

1. Go to https://console.anthropic.com and sign up.
2. **Billing** → add a few dollars of credit.
3. **API Keys** → *Create Key* → copy it (starts with `sk-ant-`).

## 3. Set up the project

Open a terminal **inside the `life-coach` folder**, then:

```bash
npm install
```
This installs everything (root, `server/`, `client/`).

Now create your secrets file by copying `server/.env.example` to `server/.env`:

- **Windows (PowerShell):** `copy server\.env.example server\.env`
- **Mac:** `cp server/.env.example server/.env`

Open `server/.env` in VS Code and paste your key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
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

## Cost & model

The default model is `claude-opus-5-5` (the smartest). To spend less, change `CLAUDE_MODEL`
in `server/.env` to `claude-sonnet-5-5` (cheaper) or `claude-haiku-5-5` (much cheaper).
You can watch your exact spend at https://console.anthropic.com.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the server" | Is the terminal running `npm run dev` / `npm start`? Any red error there? |
| "No Claude API key found" | You didn't create `server/.env`, or the key line is empty. Restart after editing. |
| "Your Claude API key is invalid" | Re-copy the key from the console; no spaces or quotes. |
| `node:sqlite` not found | Your Node is too old. Install the current LTS from nodejs.org. |
| Port already in use | Another copy is running. Close the other terminal, or change `PORT` in `.env`. |
| Want to start fresh | Settings → Reset everything (or delete the `server/data` folder). |

## Project map

```
life-coach/
├── server/                 ← BACKEND (Node.js + Express)
│   ├── .env                ← your secrets (never share!)
│   ├── data/lifecoach.db   ← your database (created automatically)
│   └── src/
│       ├── index.js        ← starts the server, connects everything
│       ├── env.js          ← loads .env
│       ├── db.js           ← database tables + SQL helpers
│       ├── state.js        ← reads your data, computes streak/stats, builds AI context
│       ├── ai.js           ← talks to Claude + the coach's personality
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
