import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { friendlyAuthError, safeNextPath } from '@/lib/auth/next';
import type { User } from '@supabase/supabase-js';

function isBrandNewGoogleOnly(user: User): boolean {
  const created = new Date(user.created_at).getTime();
  if (Number.isNaN(created) || Date.now() - created > 120_000) return false;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers)) {
    return providers.length === 1 && providers[0] === 'google';
  }
  return user.app_metadata?.provider === 'google';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  const intent = url.searchParams.get('intent') === 'sign_up' ? 'sign_up' : 'sign_in';
  const oauthError =
    url.searchParams.get('error_description') || url.searchParams.get('error');

  if (!code) {
    if (oauthError) {
      const signIn = new URL('/auth/sign-in', url.origin);
      signIn.searchParams.set('error', friendlyAuthError(oauthError));
      return NextResponse.redirect(signIn);
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  let outgoing = NextResponse.redirect(new URL(next, url.origin));
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
            outgoing.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const signIn = new URL('/auth/sign-in', url.origin);
    signIn.searchParams.set('error', friendlyAuthError(error.message));
    return NextResponse.redirect(signIn);
  }

  if (intent === 'sign_in') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && isBrandNewGoogleOnly(user)) {
      const signIn = new URL('/auth/sign-in', url.origin);
      signIn.searchParams.set('error', friendlyAuthError('create an account first'));
      outgoing = NextResponse.redirect(signIn);
      await supabase.auth.signOut();
      const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (service) {
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await admin.auth.admin.deleteUser(user.id);
      }
      return outgoing;
    }
  }

  return outgoing;
}
