import { supabase } from '../lib/supabaseClient';
import { deleteDraft } from '../state/draftStorage';

export function createSubmissionId() {
  return globalThis.crypto.randomUUID();
}

export function buildPlannerResultRow(user, formData, result, submissionId) {
  return {
    user_id: user.id,
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
  const { data: existing, error: lookupError } = await client
    .from('planner_results')
    .select('id')
    .eq('user_id', user.id)
    .contains('assumptions_json', { submissionId })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data, error } = await client
    .from('planner_results')
    .insert(buildPlannerResultRow(user, formData, result, submissionId))
    .select('id')
    .single();
  if (error) throw error;
  return data;
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
