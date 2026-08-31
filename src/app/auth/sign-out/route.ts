import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';

export async function POST() {
  const sb = await getSupabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL('/auth/sign-in', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
}
