import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';

export async function POST(request: Request) {
  const sb = await getSupabaseServer();
  await sb.auth.signOut();
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  return NextResponse.redirect(new URL('/auth/sign-in', base));
}
