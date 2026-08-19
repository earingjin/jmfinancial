alter table public.planner_drafts
add constraint planner_drafts_form_data_object
check (jsonb_typeof(form_data) = 'object') not valid;

alter table public.planner_drafts
add constraint planner_drafts_form_data_size
check (length(form_data::text) <= 200000) not valid;

create or replace function public.set_planner_draft_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_planner_draft_updated_at
before insert or update on public.planner_drafts
for each row
execute function public.set_planner_draft_updated_at();
