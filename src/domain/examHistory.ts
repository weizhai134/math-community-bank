import type { ExamDifficulty, ExamResult } from './exam';

/** 模拟考历史只存成绩摘要，完整逐题结果仍以 settings.examResult 保存最近一场。 */
export interface ExamHistoryRecord {
  id: string;
  difficulty: ExamDifficulty;
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  score: number;
  total: number;
  accuracy: number;
  createdAt: number;
}

export function examResultToHistory(result: ExamResult): ExamHistoryRecord {
  return {
    id: result.id,
    difficulty: result.difficulty,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationSec: result.durationSec,
    score: result.score,
    total: result.total,
    accuracy: result.accuracy,
    createdAt: Date.now(),
  };
}
