import { db } from '../db/db';
import { localDateKey } from '../lib/date';
import {
  DAILY_CHALLENGE_XP,
  isDailyAnswerCorrect,
  type DailyChallengeRecord,
} from '../domain/dailyChallenge';
import type { Question } from '../domain/types';

const DAILY_CHALLENGE_KEY = 'dailyChallenge';

export async function getTodayDailyChallenge(): Promise<DailyChallengeRecord | null> {
  const date = localDateKey();
  const record = await db.settings.get(DAILY_CHALLENGE_KEY);
  const value = record?.value as DailyChallengeRecord | undefined;
  return value?.date === date ? value : null;
}

export interface CompleteDailyResult {
  record: DailyChallengeRecord;
  newlyRewarded: boolean;
  xp: number;
}

/**
 * 每天的第一次提交即完成；无论答对答错都发 20 XP（“完成奖励”）。
 * 用 settings 单条记录 + 事务保证刷新/重复点击不会重复发奖。
 */
export async function completeDailyChallenge(
  question: Question,
  answer: string | boolean,
  now = Date.now(),
): Promise<CompleteDailyResult> {
  const date = localDateKey(now);
  return db.transaction('rw', [db.settings, db.profile], async () => {
    const existing = await db.settings.get(DAILY_CHALLENGE_KEY);
    const previous = existing?.value as DailyChallengeRecord | undefined;
    if (previous?.date === date) {
      return { record: previous, newlyRewarded: false, xp: 0 };
    }

    const profile = await db.profile.get('me');
    if (!profile) throw new Error('用户档案尚未加载');

    const record: DailyChallengeRecord = {
      date,
      questionId: question.id,
      completedAt: now,
      answer,
      correct: isDailyAnswerCorrect(question, answer),
    };

    await db.profile.put({
      ...profile,
      totalXp: profile.totalXp + DAILY_CHALLENGE_XP,
      updatedAt: now,
    });
    await db.settings.put({
      key: DAILY_CHALLENGE_KEY,
      value: record,
      updatedAt: now,
    });

    return { record, newlyRewarded: true, xp: DAILY_CHALLENGE_XP };
  });
}
