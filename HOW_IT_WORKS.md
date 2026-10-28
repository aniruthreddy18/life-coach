# How Life Coach works — explained for a fresher

Read this with the code open next to you. Every concept points to the exact file where it's used.

---

## 1. The big picture: a restaurant 🍽️

| Restaurant | Our app | Files |
|---|---|---|
| **Menu & waiter**: what you see and touch | **Frontend** (React): screens, buttons, forms | `client/src/` |
| **Order slip** passed to the kitchen | **API request** (HTTP + JSON) | `client/src/api.js` |
| **Kitchen**: does the real work | **Backend** (Node.js + Express) | `server/src/` |
| **Storeroom + register**: remembers everything | **Database** (SQLite) | `server/src/db.js` |
| **Expert consultant** the kitchen phones | **AI** (via OpenRouter, OpenAI, Gemini or Claude) | `server/src/ai.js` + `providers/` |
| **Alarm clock** in the kitchen | **Scheduler** (cron jobs) | `server/src/scheduler.js` |

```
 ┌───────────── YOUR BROWSER / PHONE ─────────────┐
 │  React app (pages, buttons)                    │
 │  Service worker (shows notifications)          │
 └───────┬────────────────────────────▲───────────┘
         │ HTTP request               │ JSON response
         │ e.g. PATCH /api/tasks/4    │ e.g. {"id":4,"done":1}
 ┌───────▼────────────────────────────┴───────────┐
 │  Express server (Node.js)          :3001       │
 │   routes/ → coach.js → state.js / ai.js        │
 │   scheduler.js (runs on a clock) → push.js     │
 └───────┬──────────────────────┬─────────────────┘
         │ SQL                  │ HTTPS
   ┌─────▼──────┐        ┌──────▼──────┐
   │  SQLite DB │        │ OpenAI /    │
   │            │        │ Gemini /    │
   │            │        │ Claude API  │
   │ (one file) │        │ (Anthropic) │
   └────────────┘        └─────────────┘
```

**The golden rule:** the frontend NEVER talks to the database or the AI directly.
It always asks the backend. Why?
- **Security.** Your API key stays on the server. Anything in frontend code can be seen by anyone.
- **Control.** The backend validates data before saving it.

---

## 2. Follow ONE click through the whole app

You tick ✅ "Solve 3 array problems" on the Today screen. Here's everything that happens:

**① React notices the click** (`client/src/pages/Dashboard.jsx`, function `toggle`)
```js
setData(...)   // tick the box on screen immediately ("optimistic update")
await api(`/tasks/${task.id}`, { method: "PATCH", body: { done: true } });
```

**② `api.js` sends an HTTP request**
```
PATCH /api/tasks/4
Content-Type: application/json

{"done": true}
```
- `PATCH` = "update part of something". (`GET` = read, `POST` = create, `DELETE` = remove.)
- In dev mode, Vite forwards `/api/...` from port 5173 to the backend on 3001 (`client/vite.config.js`, the `proxy` setting).

**③ Express receives it** (`server/src/index.js`)
- `express.json()` middleware turns the JSON text into a JS object → `req.body.done === true`
- Our logger middleware prints `PATCH /api/tasks/4` in your terminal. Watch for it!
- Express finds the matching route.

**④ The route validates and updates** (`server/src/routes/daily.js`)
```js
router.patch("/tasks/:id", (req, res) => {
  if (typeof req.body.done !== "boolean") return res.status(400)...  // reject bad input
  run("UPDATE tasks SET done = ?, done_at = ? WHERE id = ?", 1, now, 4);
  ...
  res.json(updatedTask);   // send back the result
});
```

**⑤ SQLite saves it to disk** in `server/data/lifecoach.db`.

**⑥ The response travels back.** Status `200 OK` with the updated task as JSON.

**⑦ React reloads the dashboard.** The completion % and the chart update.

If anything fails, the error flows back the same way and React shows it in red.
**That's full-stack development**: UI → HTTP → route → database → response → UI.

---

## 3. Frontend concepts (React) — `client/src/`

| Concept | What it means | Where to see it |
|---|---|---|
| **Component** | A function that returns UI. Reusable like LEGO. | `StatTile`, `ScoreBars` in `components.jsx` |
| **Props** | Inputs you pass to a component | `<StatTile label="Day streak" value={...} />` |
| **State** (`useState`) | Data that, when changed, redraws the screen | `const [input, setInput] = useState("")` in `Chat.jsx` |
| **Effect** (`useEffect`) | Run code when the component appears or when something changes | Loading the dashboard on open in `Dashboard.jsx` |
| **Routing** | Different URL → different page, without reloading | `<Routes>` in `App.jsx` |
| **Controlled inputs** | Each form field's value lives in state | The check-in form in `CheckIn.jsx` |
| **Conditional rendering** | Show different UI depending on state | `if (phase === "quiz") return ...` in `Onboarding.jsx` |
| **Lists & keys** | Draw arrays with `.map()`; each item needs a unique `key` | Tasks list in `Dashboard.jsx` |
| **Optimistic update** | Update the screen first, then confirm with the server | `toggle()` in `Dashboard.jsx` |
| **Streaming** | Show the AI's answer word by word | `streamChat()` in `api.js` + `send()` in `Chat.jsx` |
| **PWA** | Website that installs like an app and gets notifications | `public/manifest.webmanifest`, `public/sw.js` |
| **Design tokens** | Colours, radii and shadows defined once as CSS variables; dark mode just swaps the values | top of `styles.css` |
| **Spring animations** | Things move like real objects (Motion library). Only `transform`/`opacity` are animated, so it stays smooth on cheap phones | `components.jsx` (`spring`, `Page`, `Ring`, `Check`) |
| **Variants + stagger** | Name animation states once; a page's cards cascade in one after another | `pageVariants` / `itemVariants` in `components.jsx` |
| **Shared layout animation** | One element (`layoutId`) that glides between positions: the dock's highlight pill, the theme picker | `Dock` in `App.jsx`, `ThemePicker` in `Settings.jsx` |
| **AnimatePresence** | Lets an element animate OUT before it's removed: page transitions, onboarding slides | `App.jsx`, `Onboarding.jsx` |
| **Reduced motion** | Users who turn on "reduce motion" on their phone get a calm, still app | `<MotionConfig reducedMotion="user">` in `App.jsx` |
| **Code splitting** | Each page is a separate file downloaded only when first opened (`React.lazy`) | top of `App.jsx` |

---

## 4. Backend concepts (Node.js + Express) — `server/src/`

**Express**: a library that listens for HTTP requests and decides which function handles each one.

**Routes = your API.** Every URL the frontend can call:

| Method | URL | Does |
|---|---|---|
| GET | `/api/onboarding/questions` | Returns the 12 questions |
| POST | `/api/onboarding/quiz` | AI creates a 5-question level test |
| POST | `/api/onboarding/complete` | AI scores you + builds a 12-week roadmap |
| GET | `/api/profile` | Your profile + roadmap |
| DELETE | `/api/profile` | Wipe everything |
| GET | `/api/dashboard` | Everything for the Today screen |
| GET | `/api/tasks/today` | Today's tasks (AI generates them if missing) |
| PATCH | `/api/tasks/:id` | Mark a task done/undone |
| GET/POST | `/api/checkins/today`, `/api/checkins` | Evening check-in |
| GET/POST | `/api/chat/messages`, `/api/chat` | Chat history / send a message (streamed) |
| GET/POST | `/api/reports` | Weekly reports |
| GET/POST | `/api/push/key`, `/api/push/subscribe`, `/api/push/test` | Notifications |

**Try it yourself:** with the server running, open http://localhost:3001/api/dashboard in your browser. That raw JSON is exactly what React receives.

**Status codes** we use:
`200` OK · `201` Created · `204` No content · `400` Your input is wrong · `404` Not found · `429` Too many requests · `500` Server broke · `502` A service we depend on (the AI) broke

**Middleware** runs on every request before your route: `express.json()` parses the body, and our logger prints each request. The **error handler** (last `app.use` in `index.js`) catches any error thrown anywhere and turns it into a clean JSON message.

**Validation**: never trust the client. See `validateAnswers()` in `routes/onboarding.js` and the mood range check in `routes/daily.js`.

**Environment variables** (`.env` → `env.js`): secrets and settings live outside the code, so you can share code without sharing secrets.

**Layers** keep code organized:
```
routes/   → "what URL, what input, what status code"   (HTTP stuff only)
coach.js  → "what the feature does"                     (business logic)
state.js  → "read & compute data"                       (queries)
ai.js     → "talk to the AI" (picks a provider)         (external service)
providers/→ "how to talk to OpenRouter / OpenAI / Gemini / Claude specifically"
db.js     → "the database connection + tables"          (storage)
```

---

## 5. Database concepts (SQL) — `server/src/db.js`

A database = tables (like Excel sheets) with strict columns.

```
profile (1 row)        milestones (12 rows)          tasks (many rows)
┌────────────┐         ┌──────────────────┐          ┌─────────────────────┐
│ id = 1     │         │ id  (PK)         │◄─────────│ milestone_id (FK)   │
│ name       │         │ week_number      │  one     │ id  (PK)            │
│ answers    │         │ title, focus     │  week →  │ date, title, done   │
│ assessment │         │ goals            │  many    └─────────────────────┘
└────────────┘         └──────────────────┘  tasks
checkins (one per day: UNIQUE date) · messages (chat) · memories (facts about you)
reports (weekly) · push_subscriptions (devices) · settings (key/value)
```

| Concept | Meaning | Example in our code |
|---|---|---|
| **Primary key (PK)** | Unique ID of each row | `id INTEGER PRIMARY KEY AUTOINCREMENT` |
| **Foreign key (FK)** | A column pointing at another table's PK | `tasks.milestone_id REFERENCES milestones(id)` |
| **One-to-many** | One week has many tasks | milestones → tasks |
| **Constraints** | Rules the DB enforces | `UNIQUE` date on checkins, `CHECK (role IN (...))` |
| **Index** | Makes lookups fast (like a book index) | `idx_tasks_date` |
| **CRUD** | Create/Read/Update/Delete = INSERT/SELECT/UPDATE/DELETE | everywhere |
| **Aggregation** | Summarize many rows | `COUNT(*)`, `SUM(done)`, `GROUP BY date` in `getDailyStats()` |
| **Upsert** | Insert, or update if it exists | `ON CONFLICT(date) DO UPDATE` in check-ins |
| **Transaction** | Several changes that ALL succeed or ALL fail | `BEGIN … COMMIT / ROLLBACK` in `completeOnboarding()` |
| **SQL injection prevention** | Never glue user text into SQL; use `?` placeholders | every `run(...)` / `all(...)` call |

**Look inside your database:** install the VS Code extension **"SQLite Viewer"** and open `server/data/lifecoach.db`. You'll see your rows grow as you use the app.

> SQLite vs PostgreSQL: same SQL, same concepts. SQLite is one file, which is perfect for one person.
> When you deploy for many users, you switch to PostgreSQL and the queries barely change.

---

## 6. AI concepts — `server/src/ai.js` and `coach.js`

**1. The API forgets everything between calls (it's stateless).**
The AI doesn't "remember" you. So every call, we send:
- a **system prompt**: who the AI should be (`coachPersona()` in `ai.js`: friend/teacher/mentor, your chosen strictness and language)
- your **context**: `buildContext()` in `state.js` builds a text summary of your profile, scores, this week's plan, today's tasks, last 7 days, recent check-ins and saved memories
- the **conversation** (for chat: the last 30 messages)

**This is how the AI is "personalized" without fine-tuning.** The right information goes in every time.
And it gets *better* as you use the app, because the context grows.

**2. Long-term memory.** After each check-in, the AI also returns `new_memories`
(e.g. "Gets distracted by Instagram at night"). We save them in the `memories` table and
include them in every future conversation.

**3. Structured output (JSON).** When we need *data*, not prose (scores, a roadmap, tasks),
we give the AI a **JSON Schema** and it must reply in exactly that shape:
```js
askJSON({ prompt, schema: obj({ tasks: [...], morning_message: str }) })
// → { tasks: [{title, details, minutes}, ...], morning_message: "..." }
```
That's why we can save AI answers straight into database tables.

**4. Streaming.** Chat replies are sent piece by piece (`streamText()` → `res.write()` → `reader.read()` in the browser). It feels alive instead of making you wait.

**5. One interface, many providers (switch with one line).**
The app never calls Google or Anthropic directly. It calls two functions from `ai.js`:
`askJSON()` and `streamText()`. Behind them:

```
coach.js ──► ai.js ──┬──► providers/openrouter.js ──► OpenRouter ──► GPT / Claude / Gemini…
                     ├──► providers/openai.js ──► OpenAI API (GPT)
 (features)  (switch)├──► providers/gemini.js ──► Google Gemini API
                     └──► providers/claude.js ──► Anthropic Claude API
```

`ai.js` reads `AI_PROVIDER` from `.env` and forwards the call. Each provider file translates our
request into that company's format. For example, Gemini calls the assistant role `"model"` while
OpenAI and Claude call it `"assistant"`; OpenAI puts the system prompt in `instructions`, Claude in `system`,
Gemini in `systemInstruction`. Each provider also turns its own
errors into friendly messages ("free-tier limit reached", "key invalid").
**This is a real-world pattern called an adapter.** It's why switching AI later is a one-line change.

**6. Two tiers of model: "smart" and "fast".**
Not every job needs the most expensive model. In `coach.js`, the level test, the assessment + roadmap and the
weekly report pass `tier: "smart"`. They're rare and quality matters. Daily tasks, check-ins and chat use
`"fast"`. With OpenAI that's Sol vs Luna, and with Claude it's Opus vs Haiku. The fast models are about 20–40× cheaper per token. This is how real apps control cost.

**7. Prompt engineering.** Look at the prompts in `coach.js`. Notice how they:
- give the AI a clear job and rules ("2 to 4 tasks", "under 100 words")
- give examples of good output ("not 'study DSA' but 'Solve 3 easy array problems…'")
- pass real data (yesterday's unfinished tasks, mood, blockers)

Change them and see how the coach's behaviour changes. That's the fastest way to learn prompting.

---

## 7. Background jobs & notifications

Normally code only runs when a request comes in. **Cron jobs** run on a clock (`scheduler.js`):

| When | Job |
|---|---|
| `MORNING_TIME` (07:30) | AI plans your day → notification with your tasks |
| `EVENING_TIME` (21:00) | "Check-in time — you finished X/Y tasks" |
| `NUDGE_TIME` (22:30) | If no check-in yet: a nudge (strict mode is… strict) |
| Sunday 20:00 | Weekly report → notification with your grade |

**How a notification reaches you** (`push.js` + `client/public/sw.js`):
1. You click "Enable" → the browser asks permission.
2. The browser gives a **subscription** (a unique address) → saved in `push_subscriptions`.
3. At 07:30 the server sends a message to that address, signed with **VAPID keys**.
4. Your browser's **service worker** wakes up and shows the notification, even if the tab is closed.

---

## 8. Saving money: the cost-smart design 💰

AI APIs charge per **token** (≈ ¾ of a word), for what you send AND what you get back.
So the cheapest AI call is the one you don't make. The app uses five techniques — the same ones
companies use to keep their AI bills down:

**1. Library → AI → Rules** (`coach.js`, function `aiOrRules`)
```
generateQuiz():  question bank has 5 for "DSA"?  ──yes──► use them (free)
                         │ no
                         ▼
                 ask the AI once ──► SAVE to question_bank ──► next student: free
                         │ AI unavailable?
                         ▼
                 aptitude questions from the bank (free)
```
This pattern is called **caching**: store the result of expensive work so you never pay for it twice.

**2. Rules for anything that's just math** (`rules.js`)
Scores, grades, streaks and report numbers are SQL + if/else. They're free, instant and always the same.

**3. Batching** (`planWeek()` in `coach.js`)
One request that plans 7 days costs much less than 7 requests, because the long context
(who you are, your roadmap) is sent once instead of 7 times.

**4. Smaller context** (`buildContext()` in `state.js`)
Instead of all your answers and 30 past messages, the AI gets a ~100-word **running summary**
(rewritten every week by the weekly report call), this week's plan, and the last 8 messages.

**5. A budget guard + graceful fallback** (`usage.js`, `ai.js`)
Every AI call is logged in `ai_usage` with its tokens and cost. Before each call:
```
spent today >= DAILY_BUDGET_USD ?  → free model (if set) → else AIUnavailable → rules
```
`AIUnavailable` is a custom error class. Throwing it doesn't crash anything; `aiOrRules()`
catches it and runs the rules version instead. That's **graceful degradation**: when something
fails, the app gets simpler instead of breaking.

**Try it:** set `AI_PROVIDER=none` in `.env`, restart, and use the app. Everything still works.
Then open Settings → AI usage to see what the AI would have cost.

## 9. Onboarding, step by step

```
You answer 12 questions          (state in Onboarding.jsx, nothing saved yet)
      │ POST /api/onboarding/quiz
      ▼
AI writes 5 MCQs for YOUR topic  (generateQuiz in coach.js)
      │ you answer them
      │ POST /api/onboarding/complete  {answers, quiz with your choices}
      ▼
Server grades the quiz            (trust the quiz over self-rating!)
AI returns: summary, level, 6 scores, strengths, weaknesses,
            12-week roadmap, first message
      ▼
ONE transaction saves profile + 12 milestones + first chat message
      ▼
Results screen → Dashboard → AI plans your first day
```

---

## 10. Learn by changing it — exercises (easy → hard)

Run `npm run dev`. Each change shows up instantly when you save.

0. **Easy, AI:** run `npm run models`, pick a different model and set it in `server/.env`. Compare the coach's answers.
1. **Easy, frontend:** change the accent colour `--accent` in `styles.css`.
2. **Easy, data:** add a question to `questions.js` (e.g. "What's your dream company?"). Notice the AI automatically uses it, because all answers go into the prompt.
3. **Easy, prompting:** make the strict coach stricter in `STYLES` in `ai.js`.
4. **Medium, full-stack:** add a "Delete task" button: a `DELETE /api/tasks/:id` route in `routes/daily.js` + a button in `Dashboard.jsx`.
5. **Medium, SQL:** add "Best streak ever" to the dashboard (compute it in `state.js`).
6. **Medium, full-stack:** let you **add your own task** (form → `POST /api/tasks` → `INSERT`).
7. **Medium, frontend:** a mood line chart for the last 14 days on the Reports page (data is already in `/api/dashboard` → `stats`).
8. **Hard, AI:** a "Quiz me" button that asks the AI for 5 MCQs on this week's topic and saves the score in a new `quiz_results` table.
9. **Hard, backend:** add login (username + hashed password with `bcrypt`, sessions or JWT) so it can be deployed safely.
10. **Hard, DevOps:** deploy it (e.g. Render/Railway) with PostgreSQL, so notifications reach your phone 24/7.

Stuck? Ask me. Bring the error message and the file you changed.

---

## 11. Glossary

- **API**: a set of URLs a program exposes so other programs can use it
- **HTTP**: the protocol browsers and servers use to talk (methods + URLs + status codes)
- **JSON**: text format for data: `{"name": "Aniruth", "streak": 3}`
- **Endpoint / route**: one URL + method, e.g. `PATCH /api/tasks/:id`
- **Middleware**: code that runs on every request before the route
- **ORM**: a library that writes SQL for you (we write raw SQL to learn it properly)
- **Schema**: the structure of data (DB tables, or the JSON shape we ask the AI for)
- **Env variable**: a setting/secret given to the program from outside the code
- **Cron**: a schedule format for repeating jobs
- **Service worker**: a background script in the browser
- **LLM**: Large Language Model, the AI (GPT, Gemini, Claude)
- **Provider**: the company whose AI you call (OpenAI, Google, Anthropic)
- **Router / gateway**: a service like OpenRouter that gives you ONE key and ONE API format for many providers' models
- **Interface**: the functions the rest of the code relies on (`askJSON`, `streamText`). Any provider that implements them can be plugged in
- **System prompt**: instructions that define how the AI behaves
- **Context**: all the text you send the AI in one request
- **Token**: the unit AI companies charge by (about ¾ of a word)
- **Caching**: saving the result of expensive work so you never pay for it twice
- **Graceful degradation**: when a part fails, the app gets simpler instead of crashing
- **Streaming**: sending a response in pieces as it's produced
