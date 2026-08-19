# planner_drafts RLS 수동 통합 검증

이 절차는 로컬 Supabase 또는 별도의 테스트 프로젝트에서만 실행한다. 운영 사용자나 운영 초안을 사용하지 않는다. 사용자 A와 B는 Auth에서 만든 일회용 테스트 사용자여야 한다.

아래의 `<USER_A_UUID>`와 `<USER_B_UUID>`를 실제 테스트 사용자 UUID로 바꾼다. 각 검증은 SQL Editor에서 독립적으로 실행하고, 마지막 정리 단계까지 완료한다.

## 1. 사용자 A CRUD와 사용자 B 격리

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);

insert into public.planner_drafts (user_id, form_data, step_index, schema_version)
values ('<USER_A_UUID>', '{"income": {}}'::jsonb, 0, '1');

-- 각각 1이어야 한다.
select count(*) from public.planner_drafts where user_id = '<USER_A_UUID>';
update public.planner_drafts set step_index = 1 where user_id = '<USER_A_UUID>';
select count(*) from public.planner_drafts where user_id = '<USER_B_UUID>'; -- 0
update public.planner_drafts set step_index = 2 where user_id = '<USER_B_UUID>'; -- UPDATE 0
delete from public.planner_drafts where user_id = '<USER_B_UUID>'; -- DELETE 0
delete from public.planner_drafts where user_id = '<USER_A_UUID>'; -- DELETE 1
rollback;
```

## 2. user_id 변경 우회 차단

아래 UPDATE는 RLS `WITH CHECK` 위반으로 실패해야 한다.

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
insert into public.planner_drafts (user_id, form_data, step_index, schema_version)
values ('<USER_A_UUID>', '{}'::jsonb, 0, '1');
update public.planner_drafts
set user_id = '<USER_B_UUID>'
where user_id = '<USER_A_UUID>';
rollback;
```

## 3. anon 차단

아래 SELECT는 테이블 권한 오류로 실패해야 한다. INSERT, UPDATE, DELETE도 같은 방식으로 거부되어야 한다.

```sql
begin;
set local role anon;
select * from public.planner_drafts;
rollback;
```

## 4. 사용자 삭제 cascade

별도 테스트 프로젝트에서만 실행한다. postgres 권한으로 사용자 A 초안을 만든 뒤 `auth.users`의 테스트 사용자를 삭제하면 초안 수가 0이어야 한다. 전체 작업은 롤백한다.

```sql
begin;
insert into public.planner_drafts (user_id, form_data, step_index, schema_version)
values ('<USER_A_UUID>', '{}'::jsonb, 0, '1');
delete from auth.users where id = '<USER_A_UUID>';
select count(*) from public.planner_drafts where user_id = '<USER_A_UUID>'; -- 0
rollback;
```
