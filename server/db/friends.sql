-- =============================================================
-- friends.sql — STUDY BUDDIES: matching, friends, chat, duels
-- (db:setup runs schema.sql first, then this file. Safe to re-run.)
-- =============================================================

-- Opt-in: you appear in "Find study buddies" only if discoverable = true.
-- friend_code: a short code you can share so a friend can add you directly.
alter table public.profiles add column if not exists discoverable boolean not null default false;
alter table public.profiles add column if not exists friend_code text
  default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
create unique index if not exists profiles_friend_code on public.profiles (friend_code);

-- A friend request, and later the friendship itself (status = accepted).
-- least()/greatest() make A→B and B→A the SAME pair, so there's only one row per pair.
create table if not exists public.friendships (
  id           bigint generated always as identity primary key,
  requester_id uuid not null references public.app_users (id) on delete cascade,
  addressee_id uuid not null references public.app_users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee on public.friendships (addressee_id);

-- Chat between two friends ("poke" = a nudge button message)
create table if not exists public.friend_messages (
  id            bigint generated always as identity primary key,
  friendship_id bigint not null references public.friendships (id) on delete cascade,
  sender_id     uuid not null references public.app_users (id) on delete cascade,
  kind          text not null default 'text' check (kind in ('text', 'poke')),
  content       text not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
create index if not exists friend_messages_thread on public.friend_messages (friendship_id, id);

-- Safety: blocked people can't find you, message you or send requests
create table if not exists public.blocks (
  blocker_id uuid not null references public.app_users (id) on delete cascade,
  blocked_id uuid not null references public.app_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create table if not exists public.user_reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.app_users (id) on delete cascade,
  reported_id uuid not null references public.app_users (id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- Daily Duel: the SAME 5 questions for both friends, one per pair per day
create table if not exists public.duels (
  id            bigint generated always as identity primary key,
  friendship_id bigint not null references public.friendships (id) on delete cascade,
  date          date not null,
  topic         text not null,
  questions     jsonb not null,               -- includes the answers: never sent before you submit
  winner_id     uuid references public.app_users (id) on delete set null,
  finalized     boolean not null default false,
  unique (friendship_id, date)
);
-- One row per player: quiz answers now, task/check-in points frozen at night
create table if not exists public.duel_entries (
  duel_id      bigint not null references public.duels (id) on delete cascade,
  user_id      uuid not null references public.app_users (id) on delete cascade,
  answers      jsonb,
  quiz_correct integer not null default 0,
  submitted_at timestamptz,
  tasks_done   integer,
  tasks_total  integer,
  checked_in   boolean,
  points       integer,
  primary key (duel_id, user_id)
);

-- Weekly Quiz: 10 questions per pair per week (week starts Monday)
create table if not exists public.weekly_quizzes (
  id            bigint generated always as identity primary key,
  friendship_id bigint not null references public.friendships (id) on delete cascade,
  week_start    date not null,
  topic         text not null,
  questions     jsonb not null,
  unique (friendship_id, week_start)
);
create table if not exists public.weekly_quiz_entries (
  quiz_id      bigint not null references public.weekly_quizzes (id) on delete cascade,
  user_id      uuid not null references public.app_users (id) on delete cascade,
  answers      jsonb not null,
  correct      integer not null,
  submitted_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

-- Same security as everything else: RLS on, no policies = only our server can read these
alter table public.friendships         enable row level security;
alter table public.friend_messages     enable row level security;
alter table public.blocks              enable row level security;
alter table public.user_reports        enable row level security;
alter table public.duels               enable row level security;
alter table public.duel_entries        enable row level security;
alter table public.weekly_quizzes      enable row level security;
alter table public.weekly_quiz_entries enable row level security;
