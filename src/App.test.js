import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

// App.jsx는 supabase 클라이언트 등 무거운 트리를 정적으로 import한다(draftStorage.test.js/
// FormContext.test.jsx가 실제 supabaseClient를 모킹하는 이유와 같다). 여기서는 App.jsx를
// import하지 않고 소스 텍스트만 읽어, "새 진단"이 아닌 흐름(기존 draft 이어하기 / 입력 화면으로
// 돌아가기)이 서버 draft 삭제를 절대 호출하지 않는지 함수 단위로 검증한다(코드리뷰 후속:
// resetFormSession이 서버 draft를 지우게 된 뒤에도 이 흐름들은 여전히 건드리지 않아야 한다).
async function readAppSource() {
  return readFile(new URL('./App.jsx', import.meta.url), 'utf8');
}

function extractFunctionBody(source, functionSignature) {
  const start = source.indexOf(functionSignature);
  if (start === -1) throw new Error(`function not found in App.jsx: ${functionSignature}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(bodyStart, i + 1);
    }
  }
  throw new Error(`unterminated function body for: ${functionSignature}`);
}

describe('App.jsx - "새 진단"이 아닌 흐름은 서버 draft를 지우지 않는다(코드리뷰 후속 회귀 방지)', () => {
  it('Case 4: backToWizard(결과 화면 뒤로가기 / 입력 화면으로 돌아가기)는 deleteDraft·resetFormSession을 호출하지 않는다', async () => {
    const body = extractFunctionBody(await readAppSource(), 'const backToWizard = ()');
    expect(body).not.toContain('deleteDraft');
    expect(body).not.toContain('resetFormSession');
  });

  it('Case 1: continueDraft(기존 draft 이어하기)는 deleteDraft·resetFormSession을 호출하지 않는다', async () => {
    const body = extractFunctionBody(await readAppSource(), 'const continueDraft = async ()');
    expect(body).not.toContain('deleteDraft');
    expect(body).not.toContain('resetFormSession');
  });

  it('restart/startDiagnosis는 resetFormSession(서버 draft 삭제 경유)을 shouldResetFormSession 판정 뒤에만 호출한다(회귀 확인)', async () => {
    const source = await readAppSource();
    expect(extractFunctionBody(source, 'const restart = async ()')).toContain('resetFormSession()');
    expect(extractFunctionBody(source, 'const startDiagnosis = async ()')).toContain('resetFormSession()');
  });

  // 버그 수정(실사용자 리포트): 계산 실패로 "처음부터 다시 입력하기"를 눌렀을 뿐인데 아직 저장된
  // 적 없는 정상 입력값과 서버 draft가 함께 지워지던 문제. restart는 이제 shouldResetFormSession이
  // false를 반환하는 분기(직전 세션 미완료)에서 deleteDraft/resetFormSession을 절대 부르지 않고
  // wizardStep만 0으로 되돌려야 한다.
  it('restart는 shouldResetFormSession이 false인 분기에서 deleteDraft/resetFormSession을 호출하지 않고 setWizardStep(0)만 호출한다', async () => {
    const source = await readAppSource();
    const restartBody = extractFunctionBody(source, 'const restart = async ()');
    const elseStart = restartBody.indexOf('} else {');
    const elseBody = restartBody.slice(elseStart, restartBody.lastIndexOf('}'));
    expect(elseBody).not.toContain('deleteDraft');
    expect(elseBody).not.toContain('resetFormSession()');
    expect(elseBody).toContain('setWizardStep(0)');
  });
});
