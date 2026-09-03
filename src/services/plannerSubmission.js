import { supabase } from '../lib/supabaseClient';
import { deleteDraft } from '../state/draftStorage';

export function createSubmissionId() {
  return globalThis.crypto.randomUUID();
}

export function buildPlannerResultRow(user, formData, result, submissionId) {
  return {
    user_id: user.id,
    submission_id: submissionId,
    schema_version: 'v2',
    input_json: formData,
    result_json: result,
    assumptions_json: {
      submissionId,
      assumedReturnRate: result?.simulation?.assumedReturnRate,
      simulationInflationRate: result?.simulation?.inflationRate,
      futureFinance: result?.webSummary?.futureFinance?.assumptions,
    },
  };
}

export async function savePlannerResult(user, formData, result, submissionId, client = supabase) {
  const { data, error } = await client
    .from('planner_results')
    .insert(buildPlannerResultRow(user, formData, result, submissionId))
    .select('id')
    .single();
  if (!error) return data;
  if (error.code !== '23505') throw error;

  const { data: existing, error: lookupError } = await client
    .from('planner_results')
    .select('id')
    .eq('user_id', user.id)
    .eq('submission_id', submissionId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) throw error;
  return existing;
}

export async function hasSavedPlannerResults(userId, client = supabase) {
  const { data, error } = await client
    .from('planner_results')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function completePlannerSubmission(pending, user, operations = {}) {
  const persistResult = operations.saveResult || savePlannerResult;
  const removeDraft = operations.deleteDraft || deleteDraft;
  if (!pending.resultSaved) {
    await persistResult(user, pending.formData, pending.data, pending.submissionId);
    pending.resultSaved = true;
  }
  await removeDraft(user.id);
  return pending.data;
}
