const DRAFT_VERSION = 1;
const keyFor = (userId) => `jm-financial-planner:draft:${userId}`;

export function readDraft(userId) {
  if (!userId) return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(keyFor(userId)));
    return parsed?.version === DRAFT_VERSION && parsed.formData && typeof parsed.formData === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft(userId, formData, stepIndex = 0) {
  if (!userId) return null;
  try {
    const draft = { version: DRAFT_VERSION, updatedAt: new Date().toISOString(), stepIndex, formData };
    window.localStorage.setItem(keyFor(userId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function updateDraftStep(userId, stepIndex) {
  const draft = readDraft(userId);
  if (!draft) return null;
  return writeDraft(userId, draft.formData, stepIndex);
}

export function removeDraft(userId) {
  try {
    if (userId) window.localStorage.removeItem(keyFor(userId));
  } catch {
    // 브라우저가 저장소 접근을 차단한 경우에도 로그인 흐름은 계속 진행한다.
  }
}
