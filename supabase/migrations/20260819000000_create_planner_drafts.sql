create table public.planner_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  form_data jsonb not null,
  step_index integer not null default 0 check (step_index between 0 and 5),
  schema_version text not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_drafts enable row level security;

revoke all on table public.planner_drafts from anon;
grant select, insert, update, delete on table public.planner_drafts to authenticated;

create policy "Users can read their own planner draft"
on public.planner_drafts for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own planner draft"
on public.planner_drafts for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own planner draft"
on public.planner_drafts for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own planner draft"
on public.planner_drafts for delete
to authenticated
using ((select auth.uid()) = user_id);
