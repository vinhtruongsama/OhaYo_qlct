import { supabase } from './supabaseClient.js';

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signUpWithPassword(name, email, password) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
