alter table public.planner_drafts
add column screen_id text null;

alter table public.planner_drafts
add constraint planner_drafts_screen_id_length
check (screen_id is null or length(screen_id) <= 100) not valid;
