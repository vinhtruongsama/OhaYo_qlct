import { supabase } from './supabaseClient.js';

export async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single();

  return data;
}

export async function updateProfile(userId, name, email) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, name, email, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function fetchSettings(userId) {
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  return data;
}

export async function saveSettings(userId, state) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      user_id: userId,
      budget_limit: state.budgetLimit,
      category_limits: state.categoryLimits,
      savings_target: state.macbookGoal.target,
      savings_saved: state.macbookGoal.saved,
      currency: state.currency,
      theme: state.theme,
      language: state.language,
      categories: state.categories,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

export async function fetchTransactions(userId) {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  return (data || []).map(t => ({
    id: t.id,
    note: t.note,
    category: t.category,
    date: t.date,
    amount: parseFloat(t.amount),
    type: t.type
  }));
}

export async function createTransaction(userId, transaction) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      note: transaction.note,
      category: transaction.category,
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type
    })
    .select()
    .single();

  if (error) throw error;
  return { ...transaction, id: data.id };
}

export async function deleteTransactionById(userId, transactionId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function moveCategoryTransactions(userId, fromCategoryId, toCategoryId) {
  const { error } = await supabase
    .from('transactions')
    .update({ category: toCategoryId })
    .eq('user_id', userId)
    .eq('category', fromCategoryId);

  if (error) throw error;
}
