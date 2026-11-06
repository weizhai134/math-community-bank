export type DailyRewardType = 'xp' | 'title' | 'quote';

export interface DailyReward {
  type: DailyRewardType;
  text: string;
  amount?: number;
  title?: string;
}

export interface DailyBoxRecord {
  /** 本地自然日 YYYY-MM-DD，同时作为主键。 */
  date: string;
  eligible: boolean;
  claimedAt?: number;
  rewardType?: DailyRewardType;
  rewardText?: string;
  rewardTitle?: string;
}

export const DAILY_XP_REWARD = 50;

export const DAILY_TITLES = [
  '极限夜行者',
  '积分收藏家',
  '泰勒展开官',
  '中值定理守门人',
];

export const DAILY_QUOTES = [
  '今天也把高数拆小了一点，继续保持。',
  '不会的题不是墙，是还没找到的门。',
  '先写一步，再写一步；极限也是这样逼近的。',
  '错题本里的每一道，都是下次多拿的一分。',
];
