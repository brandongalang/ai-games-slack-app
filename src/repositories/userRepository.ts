import { supabaseAdmin } from '../database/supabase';
import { LocalDBClient } from '../database/localClient';

const useLocal = process.env.USE_LOCAL_DB === 'true';

export async function fetchUserBySlackId(slackId: string) {
  if (useLocal) {
    return LocalDBClient.getUserBySlackId(slackId);
  }
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('slack_id', slackId)
    .single();
  if (error && error.code !== 'PGRST116') {
    return { data: null, error };
  }
  return { data, error: null };
}

export async function insertUser(payload: any) {
  if (useLocal) {
    return LocalDBClient.createUser(payload);
  }
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function fetchUserById(id: number) {
  if (useLocal) {
    return LocalDBClient.getUserById(id);
  }
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('user_id', id)
    .single();
  if (error && error.code !== 'PGRST116') {
    return { data: null, error };
  }
  return { data, error: null };
}

export async function updateUser(id: number, fields: any) {
  if (useLocal) {
    return LocalDBClient.updateUser(id, fields);
  }
  const { error } = await supabaseAdmin
    .from('users')
    .update(fields)
    .eq('user_id', id);
  return { error };
}

export async function countSubmissionsByAuthor(authorId: number) {
  if (useLocal) {
    return LocalDBClient.submissionsCount(authorId);
  }
  const { count, error } = await supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', authorId);
  return { count: count || 0, error };
}

export async function incrementXP(userId: number, xpValue: number) {
  if (useLocal) {
    const userRes = await LocalDBClient.getUserById(userId);
    if (userRes.error || !userRes.data) {
      return { error: userRes.error || { message: 'User not found' } };
    }
    const current = userRes.data.total_xp || 0;
    return LocalDBClient.updateUser(userId, { total_xp: current + xpValue });
  }
  const { error } = await supabaseAdmin.rpc('increment_user_xp', {
    user_id: userId,
    xp_amount: xpValue,
  });
  return { error };
}
