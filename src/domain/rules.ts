import {
  CHAPTERS,
  CHAPTER_TOTAL_QUESTIONS,
  MAX_CHAPTER_STARS,
  MAX_LEVEL_XP,
  MAX_TRIAL_XP,
  TIER_ORDER,
} from '../domain/constants';
import type {
  Difficulty,
  Grade,
  Level,
  LevelAttempt,
  Profile,
  Question,
  RankInfo,
  StarBreakdown,
  XpResult,
} from '../domain/types';
import { localDateKey, previousDateKey } from '../lib/date';

export const STAR_MULTIPLIER: Record<number, number> = {
  0: 1,
  1: 1,
  2: 1.2,
  3: 1.5,
};

export const RANK_TIERS = [
  { title: '青铜', epithet: '初识极限', min: 0 },
  { title: '白银', epithet: '求导学徒', min: 300 },
  { title: '黄金', epithet: '积分行者', min: 800 },
  { title: '铂金', epithet: '中值定理猎手', min: 1600 },
  { title: '钻石', epithet: '级数征服者', min: 2800 },
  { title: '大师', epithet: '高数领航员', min: 4500 },
] as const;

export function earnedForGrade(grade: Grade | null, autoCorrect?: boolean | null): number {
  if (grade === 'correct') return 1;
  if (grade === 'partial') return 0.5;
  if (grade === 'wrong') return 0;
  return autoCorrect ? 1 : 0;
}

export function gradeFromAuto(isCorrect: boolean): Grade {
  return isCorrect ? 'correct' : 'wrong';
}

export function calculateStars(
  accuracy: number,
  maxCombo: number,
  durationSec: number,
  targetSec: number,
): StarBreakdown {
  const score = accuracy * 5;
  let stars = 0;
  if (accuracy >= 0.6) stars = 1;
  if (accuracy >= 0.8 && durationSec <= targetSec) stars = 2;
  if (accuracy >= 1 || (accuracy >= 0.9 && maxCombo >= 4)) stars = 3;
  return { stars, accuracy, maxCombo, score };
}

export function streakMultiplier(days: number): number {
  if (days >= 60) return 1.5;
  if (days >= 30) return 1.4;
  if (days >= 14) return 1.3;
  if (days >= 7) return 1.2;
  if (days >= 3) return 1.1;
  return 1;
}

export function nextStreak(
  lastActiveDate: string | null,
  currentStreak: number,
  now = Date.now(),
): number {
  const today = localDateKey(now);
  if (lastActiveDate === today) return Math.max(1, currentStreak);
  if (lastActiveDate === previousDateKey(today)) return Math.max(1, currentStreak + 1);
  return 1;
}

export function rankForXp(totalXp: number): RankInfo {
  let index = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i -= 1) {
    if (totalXp >= RANK_TIERS[i].min) {
      index = i;
      break;
    }
  }
  const current = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1] ?? null;
  const progress = next
    ? Math.min(1, Math.max(0, (totalXp - current.min) / (next.min - current.min)))
    : 1;
  return {
    index,
    title: current.title,
    epithet: current.epithet,
    min: current.min,
    nextMin: next?.min ?? null,
    nextTitle: next?.title ?? null,
    progress,
    toNext: next ? Math.max(0, next.min - totalXp) : 0,
  };
}

export interface XpInput {
  correctCount: number;
  advancedCorrect: number;
  challengeCorrect: number;
  stars: number;
  streakDays: number;
  repeatThreeStar: boolean;
  isTrial: boolean;
  trialXpEligibleCount: number;
}

export function calculateXp(input: XpInput): XpResult {
  if (input.isTrial) {
    const xp = Math.min(MAX_TRIAL_XP, Math.max(0, input.trialXpEligibleCount) * 5);
    return { xp, base: xp, repeatPenalty: false, capped: xp >= MAX_TRIAL_XP };
  }

  const answerXp = input.correctCount * 10;
  const difficultyXp = input.advancedCorrect * 5 + input.challengeCorrect * 10;
  const completionXp = input.stars >= 1 ? 20 : 0;
  const threeStarXp = input.stars === 3 && !input.repeatThreeStar ? 50 : 0;
  const base = answerXp + difficultyXp + completionXp + threeStarXp;
  const multiplied = base * STAR_MULTIPLIER[input.stars] * streakMultiplier(input.streakDays);
  const normal = Math.round(multiplied);
  const penalized = input.repeatThreeStar ? Math.floor(normal * 0.3) : normal;
  const xp = Math.min(MAX_LEVEL_XP, penalized);
  return {
    xp,
    base,
    repeatPenalty: input.repeatThreeStar,
    capped: penalized > MAX_LEVEL_XP,
  };
}

export function estimateLevelXp(questions: Question[], streakDays = 1): number {
  const counts = questions.reduce(
    (acc, question) => {
      if (question.difficulty === '挑战') acc.challenge += 1;
      if (question.difficulty === '进阶') acc.advanced += 1;
      return acc;
    },
    { advanced: 0, challenge: 0 },
  );
  return calculateXp({
    correctCount: questions.length,
    advancedCorrect: counts.advanced,
    challengeCorrect: counts.challenge,
    stars: 3,
    streakDays,
    repeatThreeStar: false,
    isTrial: false,
    trialXpEligibleCount: 0,
  }).xp;
}

export function levelQuestionStats(questions: Question[]): {
  types: Record<'choice' | 'judge' | 'solution', number>;
  difficulties: Record<Difficulty, number>;
} {
  return {
    types: {
      choice: questions.filter((question) => question.type === 'choice').length,
      judge: questions.filter((question) => question.type === 'judge').length,
      solution: questions.filter((question) => question.type === 'solution').length,
    },
    difficulties: {
      基础: questions.filter((question) => question.difficulty === '基础').length,
      进阶: questions.filter((question) => question.difficulty === '进阶').length,
      挑战: questions.filter((question) => question.difficulty === '挑战').length,
    },
  };
}

export function bestStarsMap(attempts: LevelAttempt[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const attempt of attempts) {
    if (attempt.status !== 'completed' || attempt.isTrial) continue;
    result[attempt.levelId] = Math.max(result[attempt.levelId] ?? 0, attempt.stars);
  }
  return result;
}

export function chapterStars(chapter: number, levels: Level[], best: Record<string, number>): number {
  return levels
    .filter((level) => level.chapter === chapter)
    .reduce((sum, level) => sum + (best[level.id] ?? 0), 0);
}

export function chapterClear(
  chapter: number,
  levels: Level[],
  best: Record<string, number>,
): boolean {
  const boss = levels.find((level) => level.chapter === chapter && level.tier === 'boss');
  return boss ? (best[boss.id] ?? 0) >= 1 : false;
}

export function isChapterUnlocked(profile: Profile, chapter: number): boolean {
  return profile.unlockedChapters.includes(chapter);
}

export function isLevelUnlocked(
  level: Level,
  profile: Profile,
  levels: Level[],
  best: Record<string, number>,
): boolean {
  if (!isChapterUnlocked(profile, level.chapter)) return false;
  if (level.tier === 'basic') return true;
  const basic = levels.find((item) => item.chapter === level.chapter && item.tier === 'basic');
  if (level.tier === 'advanced') return (best[basic?.id ?? ''] ?? 0) >= 1;
  const advanced = levels.find((item) => item.chapter === level.chapter && item.tier === 'advanced');
  return (best[basic?.id ?? ''] ?? 0) + (best[advanced?.id ?? ''] ?? 0) >= 3;
}

export function unlockReason(
  level: Level,
  profile: Profile,
  levels: Level[],
  best: Record<string, number>,
): string {
  if (!isChapterUnlocked(profile, level.chapter)) {
    if (level.chapter === 1) return '本章尚未解锁';
    return `先通关第 ${level.chapter - 1} 章 Boss 关，并在章节地图手动确认解锁第 ${level.chapter} 章`;
  }
  const basic = levels.find((item) => item.chapter === level.chapter && item.tier === 'basic');
  const advanced = levels.find(
    (item) => item.chapter === level.chapter && item.tier === 'advanced',
  );
  if (level.tier === 'basic') return '本章基础关默认解锁';
  if (level.tier === 'advanced') {
    return `本章基础关至少 1 星（当前 ${best[basic?.id ?? ''] ?? 0}/3 星）`;
  }
  const total = (best[basic?.id ?? ''] ?? 0) + (best[advanced?.id ?? ''] ?? 0);
  return `本章基础关 + 进阶关累计至少 3 星（当前 ${total}/6 星）`;
}

export function newlyUnlockedLevels(
  before: Record<string, number>,
  after: Record<string, number>,
  profileBefore: Profile,
  profileAfter: Profile,
  levels: Level[],
): string[] {
  return levels
    .filter(
      (level) =>
        !isLevelUnlocked(level, profileBefore, levels, before) &&
        isLevelUnlocked(level, profileAfter, levels, after),
    )
    .map((level) => level.id);
}

export function chapterMastery(wrongCount: number): {
  wrong: number;
  total: number;
  mastery: number;
} {
  const total = CHAPTER_TOTAL_QUESTIONS;
  const wrong = Math.min(total, wrongCount);
  return { wrong, total, mastery: (total - wrong) / total };
}

export function recommendNextLevel(
  profile: Profile,
  levels: Level[],
  best: Record<string, number>,
): Level | null {
  const unlocked = levels.filter((level) => isLevelUnlocked(level, profile, levels, best));
  const ordered = unlocked.sort((a, b) => {
    const chapterDiff = a.chapter - b.chapter;
    if (chapterDiff !== 0) return chapterDiff;
    return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
  });
  return ordered.find((level) => (best[level.id] ?? 0) < 3) ?? ordered[0] ?? null;
}

export function recentAttempt(attempts: LevelAttempt[]): LevelAttempt | null {
  return (
    [...attempts]
      .filter((attempt) => attempt.status === 'completed')
      .sort((a, b) => b.finishedAt - a.finishedAt)[0] ?? null
  );
}

export function filterDueWrong<T extends { nextReviewAt: number; archived: boolean }>(
  items: T[],
  now = Date.now(),
): T[] {
  return items.filter((item) => !item.archived && item.nextReviewAt <= now);
}

export function completionSequence(attempts: LevelAttempt[], limit = 10): number {
  const completed = [...attempts]
    .filter((attempt) => attempt.status === 'completed' && !attempt.isTrial)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, limit);
  let count = 0;
  for (const attempt of completed) {
    if (attempt.stars >= 1) count += 1;
    else break;
  }
  return count;
}

export function allChapterStars(best: Record<string, number>, levels: Level[]): number {
  return CHAPTERS.reduce((sum, chapter) => sum + chapterStars(chapter.id, levels, best), 0);
}

export const MAX_STARS = CHAPTERS.length * MAX_CHAPTER_STARS;
