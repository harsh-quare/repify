'use client';

import { db } from '@/lib/db/dexie';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';

// Local-first identity: knowing who we are must never require the network.
// auth.getUser() always calls the server (and throws "Failed to fetch"
// offline); the synced profile row and the cached session don't.
export async function localUserId(): Promise<string> {
  const profile = await db().profiles.toCollection().first();
  if (profile) return profile.user_id;
  const { data: { session } } = await getSupabaseBrowser().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}
