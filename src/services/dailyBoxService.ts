import { db } from '../db/db';
import {
  DAILY_QUOTES,
  DAILY_TITLES,
  DAILY_XP_REWARD,
  type DailyBoxRecord,
  type DailyReward,
} from '../domain/dailyBox';
import { localDateKey } from '../lib/date';

export async function getTodayBox(now = Date.now()): Promise<DailyBoxRecord | null> {
  return (await db.dailyBoxes.get(localDateKey(now))) ?? null;
}

/** 完成任意关卡/试炼后调用；当天已领取则不再改变状态。 */
export async function markDailyBoxEligible(now = Date.now()): Promise<void> {
  const date = localDateKey(now);
  await db.transaction('rw', db.dailyBoxes, async () => {
    const existing = await db.dailyBoxes.get(date);
    if (existing?.claimedAt) return;
    if (existing) {
      if (!existing.eligible) {
        await db.dailyBoxes.put({ ...existing, eligible: true });
      }
      return;
    }
    await db.dailyBoxes.put({ date, eligible: true });
  });
}

export function rollDailyReward(): DailyReward {
  const roll = Math.random();
  if (roll < 0.5) {
    return {
      type: 'xp',
      amount: DAILY_XP_REWARD,
      text: `额外 +${DAILY_XP_REWARD} XP`,
    };
  }
  if (roll < 0.75) {
    const title = DAILY_TITLES[Math.floor(Math.random() * DAILY_TITLES.length)];
    return {
      type: 'title',
      title,
      text: `称号 · ${title}`,
    };
  }
  const quote = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
  return { type: 'quote', text: quote };
}

/** 每个自然日只允许领取一次；随机奖励并持久化。 */
export async function claimDailyBox(now = Date.now()): Promise<DailyReward> {
  const date = localDateKey(now);
  return db.transaction('rw', [db.dailyBoxes, db.profile], async () => {
    const record = await db.dailyBoxes.get(date);
    if (!record?.eligible) {
      throw new Error('今天完成一关后才会出现盲盒');
    }
    if (record.claimedAt) {
      throw new Error('今天已经领过了，明天再来');
    }
    const reward = rollDailyReward();
    const profile = await db.profile.get('me');
    if (profile) {
      await db.profile.put({
        ...profile,
        totalXp:
          reward.type === 'xp' ? profile.totalXp + (reward.amount ?? 0) : profile.totalXp,
        title: reward.type === 'title' ? reward.title : profile.title,
        updatedAt: now,
      });
    }
    await db.dailyBoxes.put({
      ...record,
      claimedAt: now,
      rewardType: reward.type,
      rewardText: reward.text,
      rewardTitle: reward.title,
    });
    return reward;
  });
}
