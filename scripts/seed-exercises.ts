/**
 * One-off seed: pulls Free Exercise DB (public domain) and upserts into Supabase.
 *
 * Run with: npm run seed:exercises
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

type SourceExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  images: string[];
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log('Fetching Free Exercise DB...');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  const source: SourceExercise[] = await res.json();
  console.log(`Got ${source.length} exercises.`);

  const rows = source.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    primary_muscles: e.primaryMuscles ?? [],
    secondary_muscles: e.secondaryMuscles ?? [],
    equipment: e.equipment,
    level: e.level,
    mechanic: e.mechanic,
    force: e.force,
    instructions: e.instructions ?? [],
    image_urls: (e.images ?? []).map((p) => `${IMAGE_BASE}/${p}`),
  }));

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from('exercises').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error('Upsert failed at chunk', i, error.message);
      process.exit(1);
    }
    console.log(`Upserted ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
