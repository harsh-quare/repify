'use client';

import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db/dexie';
import { localUserId } from '@/lib/auth/local-user';
import { applyLocalDelete, applyLocalUpsert } from '@/lib/sync/engine';
import type { BodyWeightEntry } from '@/lib/types';

export async function logBodyWeight(weightKg: number, notes?: string): Promise<BodyWeightEntry> {
  const entry: BodyWeightEntry = {
    id: uuid(),
    user_id: await localUserId(),
    weight_kg: weightKg,
    logged_at: new Date().toISOString(),
    notes: notes ?? null,
    updated_at: new Date().toISOString(),
  };
  await applyLocalUpsert('body_weight_log', entry);
  return entry;
}

export async function deleteBodyWeightEntry(id: string): Promise<void> {
  await applyLocalDelete('body_weight_log', id);
}

export async function updateBodyWeightEntry(id: string, weightKg: number): Promise<void> {
  if (!(weightKg > 0)) return;
  const existing = await db().body_weight_log.get(id);
  if (!existing) return;
  await applyLocalUpsert('body_weight_log', { ...existing, weight_kg: weightKg });
}
