# 🧭 Life Coach — your personal AI career coach

An app that gets to know you (12 onboarding questions + an AI level test), scores you,
builds a 12-week roadmap, plans your tasks every day, checks in with you every night,
talks to you like a friend/teacher/mentor, and writes you a weekly report.

**Sign in with just your email** (no password; a 6-digit email code can be switched on later with
`AUTH_MODE=otp`). The 12 questions are asked only the first time; after that the app opens straight away until you sign out. Every time you open it you
get a different funny hello ("Hii bro, ela unnav? 😄"), and the daily notifications talk like a
friend ("Smooth start chesava master uu?", "Rey Kamal Haasan, what's the update?"), in Tenglish,
Hinglish or English depending on the language you pick.

**Study buddies 🤝:** find students with the same goal (opt-in, match %), add friends by code,
chat, poke, and **duel every day** ⚔️ (same 5 questions for both + your tasks + check-in), plus a
**weekly 10-question quiz** and a head-to-head record.

**Stack:** React (Vite) + Motion animations · Node.js + Express · **Supabase** (Postgres database + email OTP sign-in) · OpenRouter, OpenAI, Gemini or Claude API · Web Push · node-cron

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

## 3. Set up Supabase (database + sign-in) — one time, ~10 minutes

Your Supabase project **life-coach** (Mumbai region) is already created, and all 13 tables are already in it.
Dashboard: https://supabase.com/dashboard/project/wkamdfylxzaiyggvrqsh

### 3a. Get the database password line (`DATABASE_URL`)
1. In the dashboard, click **Connect** (top of the page).
2. Choose **Session pooler** (works on every Wi-Fi; the "Direct" one needs IPv6) and copy the URI. It looks like
   `postgresql://postgres.wkamdfylxzaiyggvrqsh:[YOUR-PASSWORD]@aws-…-ap-south-1.pooler.supabase.com:5432/postgres`
3. Replace `[YOUR-PASSWORD]` (including the brackets) with your database password.
   Forgot it? **Project Settings → Database → Reset database password.**
   If the password has symbols like `@ # / ?`, reset it to one with only letters and numbers (symbols break the URI).

### 3b + 3c are only for LATER, when you turn on email codes (`AUTH_MODE=otp`)
Right now `AUTH_MODE=email`: you sign in by typing your email, no code, no emails sent, so you can skip
these two steps. When you want codes: do 3b + 3c, set `AUTH_MODE=otp` in `server/.env`, restart.
Same email = same account in both modes, so nobody loses their data.

> ⚠️ In email mode anyone who types your email opens your account. Fine for you + friends while
> testing; turn on codes before sharing the app widely.

### 3b. Make the email show a CODE (not just a link)
**Authentication → Emails → Templates.** Edit **both** of these templates so the body includes `{{ .Token }}`:
- **Magic Link** (returning users)
- **Confirm signup** (brand-new users)

For example:
```html
<h2>Your Life Coach code</h2>
<p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
<p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
```

### 3c. Let it email your friends: Gmail SMTP
Without this, Supabase only emails **your own** account (others get *"Email address not authorized"*),
and only a few emails an hour.
1. Turn on **2-Step Verification** on your Google account: https://myaccount.google.com/security
2. Create an **App password**: https://myaccount.google.com/apppasswords → name it "Life Coach" → copy the 16 letters.
3. Supabase → **Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**:

   | Field | Value |
   |---|---|
   | Sender email | your Gmail address |
   | Sender name | `Life Coach` |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | your Gmail address |
   | Password | the 16-letter app password (no spaces) |
4. Optional: **Authentication → Rate Limits** → raise "emails per hour" (starts at 30). Gmail itself allows about 500 emails a day.

> The app password is a secret. It lives only in the Supabase dashboard, never in your code.

## 4. Set up the project

Open a terminal **inside the `life-coach` folder**, then:

```bash
npm install
```
This installs everything (root, `server/`, `client/`).

Create your secrets file by copying `server/.env.example` to `server/.env`:

- **Mac:** `cp server/.env.example server/.env`
- **Windows (PowerShell):** `copy server\.env.example server\.env`

Open `server/.env` (Mac: `open -e server/.env`) and fill in:
```
SUPABASE_URL=https://wkamdfylxzaiyggvrqsh.supabase.co        # already filled in
SUPABASE_PUBLISHABLE_KEY=sb_publishable_JjLb…                # already filled in
DATABASE_URL=postgresql://postgres.wkamdfylxzaiyggvrqsh:…    # from step 3a
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-…                                # your OpenRouter key
```
Already have a `server/.env` with your OpenRouter key? Keep it, and just add the three `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` and `DATABASE_URL` lines from `.env.example`.

**Now check everything with one command:**
```bash
npm run doctor
```
It checks your `.env`, that your OpenRouter key is valid and has credits, that both models exist, makes a tiny
real AI call (a fraction of a cent), checks Supabase sign-in and the database, and tells you exactly what to
fix for every ❌. Run it again until you see 🎉 **All good!**

## 5. Run it

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

**What you'll see:** the sign-in screen → type your email → **Continue** → first time only: the 12 questions + level test → your app. Next time you open it, you go
straight in (with a new funny hello) until you press **Settings → Sign out**.

## 6. Turn on notifications

In the app: **⚙️ Settings → Turn on → Send a test**. Each person turns them on on their own phone/laptop,
and only gets their OWN plan and reminders, in their own language:

| When | Example (English + Telugu) |
|---|---|
| Morning (`MORNING_TIME`) | "Good morning Aniruth ☀️ Smooth start chesava master uu? First: …" / "Kastapadu pani chey, lekapothe MG ayithav bida 😂" / "Gym ki vellu maya 🏋️ …" |
| Evening (`EVENING_TIME`) | "Em sangathi Aniruth, entha varaku chesinav? 2/3 done 👀" / "Rey Kamal Haasan, what's the update? 🎬" |
| Late nudge, only if no check-in (`NUDGE_TIME`) | "Inka check-in cheyaledu ra 😑 2 nimishalu chalu" |
| Sunday 8 PM | "Weekly report ready ra! Grade B 👀 Chudu" |

Add your own lines in `server/src/messages.js`. Just add to the lists; no other code changes.
Notifications are sent at the times in `server/.env` (`MORNING_TIME`, `EVENING_TIME`, `NUDGE_TIME`)
**while the server is running on your laptop**. To get them on your phone even when the laptop
is off, the app needs to be deployed online (that's a later phase).

---

## 🌍 Put it online (everyone's phones)

The app is ONE Node server (API + the built React app). Put it on **Render** (free) and everyone uses one link.
The database is already online (Supabase), so nothing else moves.

1. **Code on GitHub** (private repo is fine). Render deploys from GitHub; every push = a new version.
2. **Render:** https://render.com → sign in with GitHub → **New → Blueprint** → pick the `life-coach` repo.
   It reads `render.yaml` (build, start, India time zone…) and asks for two secrets:
   `DATABASE_URL` (same Session pooler link as in your `.env`) and `OPENROUTER_API_KEY`. → **Apply**.
3. After ~3 minutes you get a link like `https://life-coach-xxxx.onrender.com`. Open it on any phone.
4. **Install it like an app:**
   - **iPhone (Safari):** Share button → **Add to Home Screen**. Open it from the Home Screen icon
     (needed for notifications on iPhone, iOS 16.4+), then Settings → Notifications → Turn on.
   - **Android (Chrome):** ⋮ menu → **Install app** (or *Add to Home screen*), then turn on notifications.
5. **Keep it awake (free plan):** Render's free server sleeps after 15 minutes with no visitors (the next
   visit takes ~50 s, and sleeping servers send no notifications). Fix: a free monitor at
   https://uptimerobot.com → *New monitor* → HTTP(s) → `https://<your-app>.onrender.com/api/health`
   → every 5 minutes. One always-on free service fits in Render's monthly free hours.

**Before sharing widely:** with `AUTH_MODE=email` anyone who types your email can open your account.
For friends you trust that's fine; for strangers, set up codes (step 3b + 3c) and change `AUTH_MODE`
to `otp` in Render → Environment.

**Cost with many users:** each student can use at most `DAILY_BUDGET_USD` of AI a day (default $0.05).
10 very active students ≈ $0.50/day worst case; most days far less thanks to the library + rules.
Set a credit limit on your key at openrouter.ai/keys so a surprise can never cost more than you chose.

## 📅 Daily plan (India time)

- **A new day starts at 12:01 AM IST** for every student (`NEW_DAY_TIME`, `APP_TIMEZONE=Asia/Kolkata`).
  The server's own clock doesn't matter. If the server was asleep, the plan is made when the app is opened.
- **Missed work is never lost:** every unfinished task moves to the next day, tagged "Backlog · from <date>",
  on top of today's new tasks, so skipping a day means more work today. The morning message says so
  ("Ninna 2 pending unnayi ra, so ivala total 4 tasks 😤").
- **Too much backlog?** New topics slow down (backlog over one day's study time) or pause (over two days),
  so the student catches up first. They are delayed, never skipped.
- **DSA students follow a fixed 12-week curriculum** of the 150 most-asked interview problems (the NeetCode 150),
  in `server/src/data/dsaCurriculum.js`:
  - every topic starts with a short "Learn" task, then its problems, easy to hard;
  - each week's problems are spread over 6 study days, and day 7 is revision (re-solve 3 problems from the week);
  - every problem has a **Solve on LeetCode** button and a **Stuck? Watch solution** video link;
  - the 7 LeetCode Premium problems link to the same problem free on LintCode;
  - the Plan page shows the same 12 weeks, so the roadmap and the daily tasks always match.
- Other subjects keep the AI weekly plan (one AI call per week), with the same backlog rule.

## 🤝 Study buddies (Friends tab)

| Feature | How it works |
|---|---|
| **Find study buddies** | Opt-in: Friends → Find → *Show me*. You see others who opted in, ranked by a match % (same subject 45, level 20, goal 15, daily time 10, language 10) with the reasons shown. Others see your name, goal, subjects, level, daily time and language. **Never your email.** |
| **Friend code** | Everyone gets a 7-character code (Friends → Find). Share it and a friend can add you directly, even if you're hidden. |
| **Requests** | Send → they accept → you're friends. If they had already asked you, sending back = instant accept. |
| **Chat + Poke** | 1:1 messages (checked every 4 s). 👉 Poke sends a funny push ("Rey, chaduvu ra! 📚"), once an hour. |
| **Daily Duel ⚔️** | Same 5 questions for both, one try. Points: quiz 10 each (50) + your tasks done (30) + check-in (20). Answers stay hidden until you submit. Winner at `DUEL_END_TIME` (23:55) with a funny notification. Tie → whoever finished the quiz first. |
| **Weekly Quiz 📝** | 10 questions, same for both, Monday–Sunday. |
| **Record 🏆** | Wins / losses / ties, current streak, last 10 duels. |
| **Safety** | ⋮ menu in a chat: Unfriend, **Block** (you disappear for each other everywhere), **Report** (saved in the `user_reports` table for you to review in Supabase). |

Questions come from the free question bank first, skipping ones the pair has already seen. When a subject
runs out, the AI writes a new batch **once** and saves it for everyone (cost-smart, like the rest of the app).

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
| Daily budget | `DAILY_BUDGET_USD` per student (default $0.05 ≈ ₹4/day). When reached: free model (if set) → rules mode |
| Funny hellos + notifications | Templates in `messages.js`: free, no AI |

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
Run `npm run doctor` to test the new key. Your data (profile, plan, chats) stays. Only the "brain" changes.

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
| **Anything at all** | Run `npm run doctor` (in the `server` folder: `cd server && npm run doctor`). It names the problem and the fix. |
| Code emails (only with `AUTH_MODE=otp`): | |
| "Email address not authorized" on the sign-in screen | Gmail SMTP isn't set up yet (step 3c). Until then only your own Supabase account email gets codes. |
| The code email has only a link, no code | Edit the **Magic Link** and **Confirm signup** templates to include `{{ .Token }}` (step 3b). |
| No email arrives | Check Spam / Promotions. Wait 60 s before **Resend** (one code per minute). Check the Gmail app password in SMTP Settings. |
| "That code is wrong or expired" | Use the code from the NEWEST email; each new email cancels the old code. Codes expire after 1 hour. |
| "Too many codes requested" | Rate limit. Wait a minute, or raise it in **Authentication → Rate Limits**. |
| Server says "DATABASE_URL is missing" / "Can't use the database" | Step 3a. Wrong password → reset it; "Tenant or user not found" → copy the Session pooler URI again. |
| "Missing tables" in doctor | `cd server && npm run db:setup` |
| `getaddrinfo ENOTFOUND db.….supabase.co` | You used the **Direct** connection. Use **Connect → Session pooler** instead (step 3a). |
| "Sign-in isn't set up yet" page | `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` missing from `server/.env`. |
| Project paused (free plan, after ~7 days unused) | Open the Supabase dashboard and click **Restore**. |
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
| Port already in use | Another copy is running. Close the other terminal, or change `PORT` in `.env`. |
| Want to start fresh | Settings → Reset everything (deletes only YOUR plan, tasks, chats and reports). |

## Project map

```
life-coach/
├── render.yaml             ← how Render runs the app online
├── server/                 ← BACKEND (Node.js + Express)
│   ├── .env                ← your secrets + AI_PROVIDER switch (never share!)
│   ├── db/schema.sql       ← the main tables (already in Supabase; `npm run db:setup` re-creates them)
│   ├── db/friends.sql      ← study-buddy tables (friendships, chat, duels, weekly quizzes)
│   ├── db/curriculum.sql   ← task links, difficulty, backlog date; profile plan settings
│   ├── scripts/
│   │   ├── doctor.js       ← `npm run doctor`: checks .env, AI key, Supabase, database
│   │   ├── db-setup.js     ← `npm run db:setup`
│   │   └── list-models.js  ← `npm run models`
│   └── src/
│       ├── index.js        ← starts the server, public routes, then the sign-in check
│       ├── env.js          ← loads .env
│       ├── auth.js         ← sign-in (email or code) + checks your token on every request (req.user)
│       ├── db.js           ← Postgres connection pool + SQL helpers
│       ├── messages.js     ← the funny hellos + notifications (Tenglish / Hinglish / English)
│       ├── friends.js      ← study buddies: matching, requests, chat, poke, block/report
│       ├── duels.js        ← daily duel + weekly quiz + scoring + rivalry
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
│       ├── data/dsaCurriculum.js ← 12-week DSA plan: 150 LeetCode problems + 18 "Learn" topics
│       ├── usage.js        ← token + cost tracking, daily budget
│       ├── questions.js    ← the onboarding questions
│       ├── push.js         ← sends notifications to each student's devices
│       ├── scheduler.js    ← timed jobs for every student (morning, evening, nudge, Sunday report)
│       └── routes/         ← the API endpoints (URLs)
└── client/                 ← FRONTEND (React)
    ├── public/sw.js        ← service worker (shows notifications)
    └── src/
        ├── main.jsx        ← React starts here
        ├── App.jsx         ← sign-in → first-time onboarding → pages + dock + hello card
        ├── auth.js         ← sign-in in the browser (email mode or code mode), stay signed in
        ├── supabase.js     ← code sign-in client (only used when AUTH_MODE=otp)
        ├── api.js          ← every call to the backend lives here (adds your token)
        ├── components.jsx  ← reusable ANIMATED pieces (cards, ring, checkbox, charts, counters)
        ├── theme.js        ← System / Light / Dark switch
        ├── styles.css      ← the design system: navy #0A4174 + white, Inter font, light + dark
        └── pages/          ← one file per screen (Friends.jsx + FriendRoom.jsx = study buddies)
```
