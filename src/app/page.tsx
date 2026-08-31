import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { TopNav } from '@/components/TopNav';
import { DashboardClient } from '@/components/DashboardClient';

export default async function Home() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  const { data: profile } = await sb
    .from('profiles')
    .select('height_cm, unit_preference')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile || profile.height_cm == null) {
    redirect('/onboarding');
  }

  return (
    <>
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <DashboardClient />
      </main>
    </>
  );
}
