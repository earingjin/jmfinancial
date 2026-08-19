alter table public.planner_results
add column submission_id uuid;

alter table public.planner_results
add constraint planner_results_user_submission_unique
unique (user_id, submission_id);
