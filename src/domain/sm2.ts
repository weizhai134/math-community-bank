import type { Question, ReviewQuality, WrongItem } from '../domain/types';

const DAY_MS = 86_400_000;

const INITIAL_MINUTES: Record<Question['type'], number> = {
  choice: 15,
  judge: 30,
  solution: 60,
};

const MIN_GOOD_INTERVAL_DAYS: Record<Question['type'], number> = {
  choice: 1,
  judge: 2,
  solution: 3,
};

export const QUALITY_LABEL: Record<ReviewQuality, string> = {
  1: '忘记',
  3: '模糊',
  5: '记住',
};

/** 简化 SM-2 的难度系数更新；错题本和公式闪卡共用同一套评分公式。 */
export function nextEaseFactor(easeFactor: number, quality: ReviewQuality): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return Math.max(1.3, easeFactor + delta);
}

export function initialWrongMinutes(type: Question['type']): number {
  return INITIAL_MINUTES[type];
}

export function createWrongItem(question: Question, now = Date.now()): WrongItem {
  const minutes = INITIAL_MINUTES[question.type];
  return {
    id: question.id,
    questionId: question.id,
    chapter: question.chapter,
    topic: question.topic,
    type: question.type,
    difficulty: question.difficulty,
    wrongCount: 1,
    interval: minutes / (24 * 60),
    easeFactor: 2.5,
    nextReviewAt: now + minutes * 60_000,
    createdAt: now,
    updatedAt: now,
    lastWrongAt: now,
    reviewCount: 0,
    archived: false,
    questionSnapshot: question,
  };
}

export function recordWrongAgain(item: WrongItem, now = Date.now()): WrongItem {
  const minutes = INITIAL_MINUTES[item.type];
  return {
    ...item,
    wrongCount: item.wrongCount + 1,
    interval: minutes / (24 * 60),
    easeFactor: Math.max(1.3, item.easeFactor - 0.2),
    nextReviewAt: now + minutes * 60_000,
    lastWrongAt: now,
    updatedAt: now,
    archived: false,
  };
}

export function applyReview(
  item: WrongItem,
  quality: ReviewQuality,
  now = Date.now(),
): WrongItem {
  const q = quality;
  const easeFactor = nextEaseFactor(item.easeFactor, q);

  let interval: number;
  if (q < 3) {
    interval = INITIAL_MINUTES[item.type] / (24 * 60);
  } else {
    const base = Math.max(MIN_GOOD_INTERVAL_DAYS[item.type], item.interval);
    interval = q === 3 ? base * 1.2 : base * easeFactor;
  }
  interval = Math.min(365, Math.max(INITIAL_MINUTES[item.type] / (24 * 60), interval));

  return {
    ...item,
    interval,
    easeFactor,
    nextReviewAt: now + interval * DAY_MS,
    lastReviewedAt: now,
    updatedAt: now,
    reviewCount: item.reviewCount + 1,
    archived: false,
  };
}

export function isDue(item: WrongItem, now = Date.now()): boolean {
  return !item.archived && item.nextReviewAt <= now;
}

export function canAwardTrialXp(item: WrongItem | undefined, now = Date.now()): boolean {
  if (!item) return true;
  return !item.lastXpAt || now - item.lastXpAt >= DAY_MS;
}

export function withTrialXpAward(item: WrongItem, now = Date.now()): WrongItem {
  return {
    ...item,
    lastXpAt: now,
    updatedAt: now,
  };
}
