-- =============================================================
-- schema.sql — the Life Coach database (PostgreSQL on Supabase)
-- -------------------------------------------------------------
-- Two kinds of tables:
--
--   PER-USER tables: every row has a user_id that points to the
--   signed-in person (Supabase's auth.users). Deleting a user
--   deletes all their rows too (ON DELETE CASCADE).
--
--   SHARED tables: the content library (questions, roadmaps,
--   explanations) that every student reuses for free.
--
-- SECURITY: Row Level Security (RLS) is ON for every table and
-- there are NO policies. That means the browser (which only has the
-- public "publishable" key) can't read or write ANY table directly.
-- Only our Express server can, because it connects with the database
-- password and checks each user's sign-in token before every query.
-- =============================================================

-- ---------- Per-user tables ----------

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text not null,
  answers        jsonb not null,           -- onboarding answers
  quiz_score     integer,
  assessment     jsonb not null,           -- summary, level, scores, strengths...
  coach_style    text not null,            -- gentle | balanced | strict
  language       text not null,            -- English / English + Telugu / English + Hindi
  start_date     date not null,            -- the day the 12-week plan begins
  memory_summary text not null default '', -- coach's short running summary of you
  ai_status      jsonb,                    -- did the last AI call work? why not?
  app_opens      integer not null default 0, -- for the rotating funny greeting
  created_at     timestamptz not null default now()
);

create table if not exists public.milestones (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_number integer not null,
  title       text not null,
  focus       text not null,
  goals       jsonb not null,               -- array of strings
  unique (user_id, week_number)
);

create table if not exists public.tasks (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null,
  title        text not null,
  details      text,
  minutes      integer not null default 30,
  milestone_id bigint references public.milestones (id) on delete set null,
  done         boolean not null default false,
  done_at      timestamptz,
  carried      boolean not null default false -- already copied to the next day?
);
create index if not exists tasks_user_date on public.tasks (user_id, date);

create table if not exists public.checkins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  mood        integer not null check (mood between 1 and 10),
  energy      integer not null check (energy between 1 and 10),
  wins        text,
  blockers    text,
  coach_reply text,
  created_at  timestamptz not null default now(),
  unique (user_id, date)                      -- one check-in per day
);

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_user on public.messages (user_id, id);

create table if not exists public.memories (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  fact       text not null,
  created_at timestamptz not null default now()
);
create index if not exists memories_user on public.memories (user_id, id);

create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  content    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists reports_user on public.reports (user_id, id);

create table if not exists public.push_subscriptions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null
);
create index if not exists push_user on public.push_subscriptions (user_id);

create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  day           date not null,
  feature       text not null,
  model         text not null,
  input_tokens  integer not null,
  output_tokens integer not null,
  cost_usd      numeric(12, 6) not null,
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_user_day on public.ai_usage (user_id, day);

-- ---------- Shared tables (the free content library) ----------

create table if not exists public.question_bank (
  id            bigint generated always as identity primary key,
  topic         text not null,
  question      text not null,
  options       jsonb not null,
  correct_index integer not null,
  difficulty    text not null check (difficulty in ('easy', 'medium', 'hard')),
  source        text not null check (source in ('builtin', 'ai')),
  unique (topic, question)
);

create table if not exists public.roadmap_templates (
  key        text primary key,
  roadmap    jsonb not null,
  uses       integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.explanations (
  key        text primary key,
  question   text not null,
  answer     text not null,
  hits       integer not null default 0,
  created_at timestamptz not null default now()
);

-- App-wide settings (e.g. the push-notification keys)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

-- ---------- Security: RLS on, no policies = browser gets nothing ----------
alter table public.profiles           enable row level security;
alter table public.milestones         enable row level security;
alter table public.tasks              enable row level security;
alter table public.checkins           enable row level security;
alter table public.messages           enable row level security;
alter table public.memories           enable row level security;
alter table public.reports            enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ai_usage           enable row level security;
alter table public.question_bank      enable row level security;
alter table public.roadmap_templates  enable row level security;
alter table public.explanations       enable row level security;
alter table public.app_settings       enable row level security;
