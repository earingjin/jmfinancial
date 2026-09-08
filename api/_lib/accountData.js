export async function deletePlannerUserData(admin, userId, { deleteProfile = false } = {}) {
  const { error } = await admin.rpc('delete_planner_user_data', {
    p_user_id: userId,
    p_delete_profile: deleteProfile,
  });

  if (error) {
    throw new Error('사용자 연결 데이터를 정리하지 못했습니다.', { cause: error });
  }
}
