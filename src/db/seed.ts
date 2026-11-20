import { assertSeedIntegrity, LEVEL_SEEDS, questions } from '../data';
import { STORAGE_KEYS } from '../domain/constants';
import type { Profile } from '../domain/types';
import { db, getProfile, setSetting } from './db';

export const SEED_VERSION = '1.2.0';

export async function seedDatabase(): Promise<void> {
  assertSeedIntegrity();
  const questionCount = await db.questions.count();
  const levelCount = await db.levels.count();
  const seedVersion = await db.settings.get(STORAGE_KEYS.seedVersion);

  const needsInitialSeed = questionCount === 0 || levelCount === 0;

  if (needsInitialSeed) {
    await db.transaction('rw', db.questions, db.levels, db.settings, async () => {
      await db.questions.bulkPut(questions);
      await db.levels.bulkPut(LEVEL_SEEDS);
      await db.settings.put({
        key: STORAGE_KEYS.seedVersion,
        value: SEED_VERSION,
        updatedAt: Date.now(),
      });
    });
  } else if (seedVersion?.value !== SEED_VERSION) {
    // 只补静态题的图形元数据，不覆盖用户导入的自定义题库。
    await db.transaction('rw', db.questions, async () => {
      for (const seedQuestion of questions) {
        if (!seedQuestion.hasGraph) continue;
        const existing = await db.questions.get(seedQuestion.id);
        if (!existing || existing.stem !== seedQuestion.stem) continue;
        await db.questions.put({
          ...existing,
          hasGraph: true,
          graph: seedQuestion.graph,
        });
      }
    });
  }

  const profile = await getProfile();
  if (!profile) {
    const now = Date.now();
    const initial: Profile = {
      id: 'me',
      totalXp: 0,
      streakDays: 0,
      lastActiveDate: null,
      unlockedChapters: [1],
      pendingUnlocks: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.profile.put(initial);
  }

  await setSetting(STORAGE_KEYS.seedVersion, SEED_VERSION);
}
