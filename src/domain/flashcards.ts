import { nextEaseFactor } from './sm2';

const DAY_MS = 86_400_000;

/** 公式闪卡的本地复习状态；只存在 IndexedDB 的 flashcardStates 表。 */
export interface FlashcardState {
  id: string;
  /** 简化 SM-2 难度系数，初始 2.5。 */
  easeFactor: number;
  /** 当前间隔（天）；0 表示新卡或刚遗忘。 */
  interval: number;
  /** 连续记住次数。 */
  repetitions: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  reviewCount: number;
}

export function initialFlashcardState(id: string, now = Date.now()): FlashcardState {
  return {
    id,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: now,
    reviewCount: 0,
  };
}

export function isFlashcardDue(state: FlashcardState, now = Date.now()): boolean {
  return state.nextReviewAt <= now;
}

/**
 * 复用错题本的简化 SM-2 难度系数公式：
 * - 没记住：重置连续次数与间隔，10 分钟后再出现；
 * - 记住了：1 天 → 3 天 → 按难度系数增长，最长 180 天。
 */
export function scheduleFlashcard(
  state: FlashcardState,
  remembered: boolean,
  now = Date.now(),
): FlashcardState {
  const quality = remembered ? 5 : 1;
  const easeFactor = nextEaseFactor(state.easeFactor, quality);

  if (!remembered) {
    return {
      ...state,
      easeFactor,
      interval: 0,
      repetitions: 0,
      nextReviewAt: now + 10 * 60_000,
      lastReviewedAt: now,
      reviewCount: state.reviewCount + 1,
    };
  }

  const repetitions = state.repetitions + 1;
  const interval =
    repetitions === 1
      ? 1
      : repetitions === 2
        ? 3
        : Math.min(180, Math.max(1, Math.round((state.interval || 1) * easeFactor)));

  return {
    ...state,
    easeFactor,
    interval,
    repetitions,
    nextReviewAt: now + interval * DAY_MS,
    lastReviewedAt: now,
    reviewCount: state.reviewCount + 1,
  };
}
