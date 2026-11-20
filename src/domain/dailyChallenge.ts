import type { Question } from './types';

export const DAILY_CHALLENGE_XP = 20;

export interface DailyChallengeRecord {
  /** 东八区自然日，YYYY-MM-DD。 */
  date: string;
  questionId: string;
  completedAt: number;
  answer: string | boolean;
  correct: boolean;
}

/** 简单的 FNV-1a 32 位哈希，用于把日期稳定映射到题库下标。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 每日一题只从可自动判分的选择/判断题中抽，
 * 这样“完成即发 20 XP”不需要额外的解答题自评流程。
 * 题库按 id 排序，保证同一日期在所有设备上抽到同一道题。
 */
export function pickDailyQuestion(questions: Question[], date: string): Question | null {
  const pool = questions
    .filter((question) => question.type === 'choice' || question.type === 'judge')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  return pool[hashString(`gaoshu-daily-v1:${date}`) % pool.length] ?? null;
}

export function isDailyAnswerCorrect(
  question: Question,
  answer: string | boolean,
): boolean {
  return answer === question.answer;
}
