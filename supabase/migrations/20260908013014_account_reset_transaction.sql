-- service_role로 호출할 때만 실행되는 invoker 함수다. 브라우저 역할에는 EXECUTE를
-- 부여하지 않으며, 한 사용자의 연결 데이터를 단일 트랜잭션으로 정리한다.
create or replace function public.delete_planner_user_data(
  p_user_id uuid,
  p_delete_profile boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 결과 본문을 참조하거나 포함할 수 있는 관리자 메모·감사 행을 먼저 제거한다.
  delete from public.admin_notes as notes
  using public.planner_results as results
  where notes.result_id = results.id
    and results.user_id = p_user_id;

  delete from public.admin_audit_logs as logs
  where logs.admin_user_id = p_user_id
     or logs.target_user_id = p_user_id
     or exists (
       select 1
       from public.planner_results as results
       where results.id = logs.result_id
         and results.user_id = p_user_id
     );

  delete from public.planner_results
  where user_id = p_user_id;

  delete from public.planner_drafts
  where user_id = p_user_id;

  if p_delete_profile then
    delete from public.profiles
    where id = p_user_id;
  else
    -- 계정 초기화에서는 결과 FK의 부모이자 권한 기준인 profile 행을 유지한다.
    -- 가명만 비워 초기화 후 이전 사용자의 표시 정보가 남지 않게 한다.
    update public.profiles
    set name = null,
        updated_at = now()
    where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.delete_planner_user_data(uuid, boolean) from public;
revoke all on function public.delete_planner_user_data(uuid, boolean) from anon;
revoke all on function public.delete_planner_user_data(uuid, boolean) from authenticated;
grant execute on function public.delete_planner_user_data(uuid, boolean) to service_role;
