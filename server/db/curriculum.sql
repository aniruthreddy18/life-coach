-- =============================================================
-- curriculum.sql — daily plan details (safe to re-run)
-- Tasks can come from the DSA curriculum (a LeetCode problem or a
-- "Learn" concept), and unfinished tasks move to the next day.
-- =============================================================
alter table public.tasks add column if not exists item_id    text; -- curriculum item: 'lc:two-sum', 'learn:trees'
alter table public.tasks add column if not exists kind       text; -- 'learn' | 'problem' | 'revision' | null (AI/rules task)
alter table public.tasks add column if not exists topic      text; -- 'Arrays & Hashing'
alter table public.tasks add column if not exists difficulty text; -- Easy | Medium | Hard
alter table public.tasks add column if not exists link       text; -- where to solve it (LeetCode, or free LintCode)
alter table public.tasks add column if not exists video      text; -- solution video if stuck
alter table public.tasks add column if not exists from_date  date; -- backlog: the day it was first given (null = new today)
create index if not exists tasks_user_item on public.tasks (user_id, item_id);

alter table public.profiles add column if not exists track      text; -- 'dsa' = follows the DSA curriculum
alter table public.profiles add column if not exists planned_on date; -- last day the planner ran for this student
