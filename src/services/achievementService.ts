import { db } from '../db/db';
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  type AchievementEvent,
  type AchievementState,
} from '../domain/achievements';

function nightHour(timestamp: number): number {
  return new Date(timestamp).getHours();
}

function definitionById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((item) => item.id === id);
}

/**
 * 首次启动时把历史数据折算成成就初始状态；只做一次（缺失记录时）。
 * 之后的累计值由 evaluateAchievements 增量更新。
 */
export async function ensureAchievementStates(
  seedFromHistory = true,
): Promise<AchievementState[]> {
  return db.transaction(
    'rw',
    [db.achievements, db.levelAttempts, db.levelAnswers],
    async () => {
      const existing = await db.achievements.toArray();
      const map = new Map(existing.map((state) => [state.id, state]));
      let changed = false;
      const attempts = seedFromHistory ? await db.levelAttempts.toArray() : [];
      const correctAnswers = seedFromHistory
        ? (await db.levelAnswers.toArray()).filter((answer) => answer.earned === 1).length
        : 0;
      const now = Date.now();

      for (const definition of ACHIEVEMENTS) {
        if (map.has(definition.id)) continue;
        let progress = 0;
        let unlockedAt: number | undefined;

        if (seedFromHistory) {
          if (definition.id === 'first-basic') {
            const attempt = attempts.find(
              (item) =>
                item.status === 'completed' &&
                !item.isTrial &&
                item.tier === 'basic' &&
                item.stars >= 1,
            );
            if (attempt) {
              progress = 1;
              unlockedAt = attempt.finishedAt;
            }
          } else if (definition.id === 'hundred-correct') {
            progress = correctAnswers;
            if (progress >= 100) unlockedAt = now;
          } else if (definition.id === 'night-owl') {
            const attempt = attempts.find(
              (item) => item.status === 'completed' && nightHour(item.finishedAt) < 4,
            );
            if (attempt) {
              progress = 1;
              unlockedAt = attempt.finishedAt;
            }
          } else if (definition.id === 'combo-master') {
            const attempt = attempts.find(
              (item) => item.status === 'completed' && item.maxCombo >= 5,
            );
            if (attempt) {
              progress = 1;
              unlockedAt = attempt.finishedAt;
            }
          }
        }

        map.set(definition.id, { id: definition.id, progress, unlockedAt });
        changed = true;
      }

      if (changed) {
        await db.achievements.bulkPut([...map.values()]);
      }
      return ACHIEVEMENTS.map(
        (definition) =>
          map.get(definition.id) ?? { id: definition.id, progress: 0 },
      );
    },
  );
}

/**
 * 成就页读取：缺失记录时用历史数据初始化一次。
 */
export async function loadAchievementStates(): Promise<AchievementState[]> {
  return ensureAchievementStates(true);
}

/**
 * 每次关卡/练习结算后调用。返回本次新解锁的成就，由上层弹 Toast。
 */
export async function evaluateAchievements(
  event: AchievementEvent,
): Promise<AchievementDefinition[]> {
  const states = await ensureAchievementStates(false);
  const map = new Map(states.map((state) => [state.id, { ...state }]));
  const now = Date.now();
  const newlyUnlocked: AchievementDefinition[] = [];
  let changed = false;

  const unlock = (definition: AchievementDefinition) => {
    const state = map.get(definition.id);
    if (!state || state.unlockedAt) return;
    map.set(definition.id, {
      ...state,
      progress: definition.target ?? 1,
      unlockedAt: now,
    });
    newlyUnlocked.push(definition);
    changed = true;
  };

  if (event.basicCleared) {
    const definition = definitionById('first-basic');
    if (definition) unlock(definition);
  }

  if (event.maxCombo >= 5) {
    const definition = definitionById('combo-master');
    if (definition) unlock(definition);
  }

  if (nightHour(event.finishedAt) < 4) {
    const definition = definitionById('night-owl');
    if (definition) unlock(definition);
  }

  const hundred = definitionById('hundred-correct');
  if (hundred) {
    const state = map.get(hundred.id);
    if (state && !state.unlockedAt && event.correct > 0) {
      state.progress += event.correct;
      changed = true;
      if (state.progress >= (hundred.target ?? 100)) {
        state.progress = hundred.target ?? 100;
        state.unlockedAt = now;
        newlyUnlocked.push(hundred);
      }
    }
  }

  if (changed) {
    await db.achievements.bulkPut([...map.values()]);
  }
  return newlyUnlocked;
}
