# 🧭 Life Coach — your personal AI career coach

An app that gets to know you (12 onboarding questions + an AI level test), scores you,
builds a 12-week roadmap, plans your tasks every day, checks in with you every night,
talks to you like a friend/teacher/mentor, and writes you a weekly report.

**Stack:** React (Vite) · Node.js + Express · SQLite · OpenRouter, OpenAI, Gemini or Claude API · Web Push · node-cron

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

The app works with **OpenRouter** (the default), **OpenAI**, **Google Gemini** (free tier) or **Claude**.
You only need ONE of them.

**OpenRouter (default):** one key that reaches GPT, Claude, Gemini and more.
1. Go to https://openrouter.ai/keys and sign in.
2. Add a few dollars at https://openrouter.ai/credits.
3. **Create Key** and copy it (starts with `sk-or-`).

**OpenAI (direct):**
1. Go to https://platform.openai.com/api-keys and sign in.
2. Make sure your account has billing/credits, then **Create new secret key** and copy it (starts with `sk-`).

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

Open `server/.env` (Mac: `open -e server/.env`) and paste your OpenRouter key:
```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
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

## 💰 Cost control (built for a student budget)

The app is designed so AI is a small extra, not the engine. Every feature follows the same order:

```
1. LIBRARY  → already saved? reuse it            (free)
2. AI       → only where understanding is needed (cheap "fast" model)
3. RULES    → AI off / over budget / offline?    (free, app never breaks)
```

| Feature | How it saves money |
|---|---|
| Level test | 56 built-in questions (DSA, Java, JavaScript, Python, SQL, React, aptitude). AI only writes questions for other subjects, **once**, then they're saved for reuse |
| 12-week roadmap | Saved by subject + level + hours. The next student with the same goal gets it free |
| Daily tasks | **One** AI call plans the whole week; rules carry over unfinished tasks |
| Scores | Calculated by rules from what you actually do (free, updates live) |
| Check-in reply | Template reply if you write nothing; AI only when you write wins/blockers |
| Chat | Short memory summary + last 8 messages only; "explain X" answers are saved and reused |
| Weekly report | Numbers, grade, wins and problems by SQL; AI writes only the headline + letter |
| Daily budget | `DAILY_BUDGET_USD` (default $0.05 ≈ ₹4/day). When reached: free model (if set) → rules mode |

Settings in `server/.env`:
```
DAILY_BUDGET_USD=0.05          # max AI spend per day (0 = no limit)
OPENROUTER_MODEL_FREE=         # optional ":free" model used after the budget is reached
AI_PROVIDER=none               # no AI at all: 100% free, rules + templates only
```
**⚙️ Settings → AI usage & budget** in the app shows today's spend in ₹, cost per feature,
and how much the library is reusing.

## Switching AI providers

Everything AI-related goes through `server/src/ai.js`, so switching is **one line** in `server/.env`:

```
AI_PROVIDER=openrouter # GPT Sol + Luna via OpenRouter (default)
AI_PROVIDER=openai     # GPT, direct from OpenAI
AI_PROVIDER=gemini     # free tier
AI_PROVIDER=claude     # Opus + Haiku
```
Restart the server after changing it (`Ctrl + C`, then `npm start`). The terminal prints which AI and models are in use.
Your data (profile, plan, chats) stays. Only the "brain" changes.

Each provider uses two models:

| Tier | Used for | OpenRouter default | OpenAI default | Gemini default | Claude default |
|---|---|---|---|---|---|
| **smart** | Level test, assessment + roadmap, weekly report | `openai/gpt-6-sol` | `gpt-6-luna` | `gemini-flash-latest` | `claude-opus-5-5` |
| **fast** | Daily tasks, check-ins, chat | `openai/gpt-6-luna` | `gpt-6-luna` | `gemini-flash-latest` | `claude-haiku-5-5` |

Change them with `OPENROUTER_MODEL_SMART` / `OPENROUTER_MODEL_FAST` (and the `OPENAI_…` / `GEMINI_…` / `CLAUDE_…` equivalents).
On OpenRouter, model names include the company: `openai/…`, `anthropic/…`, `google/…`.

**Cost (rough estimates for one person):**
- **OpenRouter (Sol + Luna, the default):** onboarding ≈ $0.05–0.10 once, then ≈ $0.02–0.03 a day → **$5 ≈ 5–8 months**. Same model prices as OpenAI direct. Spend: https://openrouter.ai/activity
- **OpenAI (Luna for everything, the default):** onboarding ≈ $0.01 once, then ≈ $0.01–0.02 a day → **$5 lasts many months, likely close to a year**.
  For better roadmaps and reports, set `OPENAI_MODEL_SMART=gpt-6.1-sol` (adds roughly $0.10 once plus a few cents a week). Spend: https://platform.openai.com/usage
- **Claude (Opus + Haiku):** onboarding ≈ $0.20 once, then ≈ $0.02–0.04 a day → **$5 ≈ 4–7 months**. Spend: https://console.anthropic.com → Usage
- **Gemini:** free tier, with daily limits.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the server" | Is the terminal running `npm run dev` / `npm start`? Any red error there? |
| "No OpenRouter/OpenAI/Gemini/Claude API key found" | You didn't create `server/.env`, or the key line is empty. Restart after editing. |
| "Gemini rejected the request" / "key is invalid" | Re-copy the key; no spaces or quotes. Check `AI_PROVIDER` matches the key you added. |
| "Your OpenRouter account is out of credits" | Add credits at openrouter.ai/credits. |
| "OpenRouter couldn't use model …" | Run `npm run models` and copy an exact name into `OPENROUTER_MODEL_SMART` / `OPENROUTER_MODEL_FAST`. |
| "Your OpenAI account has no credits left" | Add billing at platform.openai.com → Billing. |
| "OpenAI model … isn't available to your key" | Run `npm run models` and put a listed name in `OPENAI_MODEL_SMART` / `OPENAI_MODEL_FAST`. |
| Yellow "offline mode" banner on Today | The AI couldn't be used (reason shown). The app keeps working on rules; check your key/credits in Settings → AI usage. |
| "Today's AI budget is used up" | Working as designed. Raise `DAILY_BUDGET_USD`, set `OPENROUTER_MODEL_FREE`, or wait until tomorrow. |
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
│       ├── ai.js           ← the one door to the AI: picks OpenRouter, OpenAI, Gemini or Claude + coach personality
│       ├── providers/
│       │   ├── openrouter.js ← OpenRouter API calls (default)
│       │   ├── openai.js   ← OpenAI (GPT) API calls
│       │   ├── gemini.js   ← Google Gemini API calls
│       │   └── claude.js   ← Anthropic Claude API calls
│       ├── coach.js        ← features: quiz, assessment, tasks, check-in, chat, reports
│       │                     (each one: library → AI → rules)
│       ├── rules.js        ← the FREE brain: live scores, grades, templates, plans without AI
│       ├── library.js      ← shared content library: question bank, saved roadmaps, saved explanations
│       ├── data/questionBank.js ← 56 built-in level-test questions
│       ├── usage.js        ← token + cost tracking, daily budget
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
