import type { Difficulty, Grade, Question } from './types';

export type ExamDifficulty = 'easy' | 'medium' | 'hard';

export const EXAM_DURATION_MINUTES = 120;
export const EXAM_DURATION_MS = EXAM_DURATION_MINUTES * 60 * 1000;
export const EXAM_QUESTION_COUNTS = { choice: 5, judge: 5, solution: 6 } as const;
export const EXAM_TOTAL_QUESTIONS =
  EXAM_QUESTION_COUNTS.choice + EXAM_QUESTION_COUNTS.judge + EXAM_QUESTION_COUNTS.solution;

export const EXAM_DIFFICULTY_LABEL: Record<ExamDifficulty, string> = {
  easy: '简单卷',
  medium: '中等卷',
  hard: '困难卷',
};

export const EXAM_DIFFICULTY_DESC: Record<ExamDifficulty, string> = {
  easy: '以基础题为主，适合第一次完整模拟。',
  medium: '基础与进阶混合，贴近常规期末难度。',
  hard: '以挑战/进阶题为主，适合冲刺高分。',
};

/** 组卷时各难度优先取用的题库难度顺序。 */
export const EXAM_DIFFICULTY_PRIORITY: Record<ExamDifficulty, Difficulty[]> = {
  easy: ['基础', '进阶', '挑战'],
  medium: ['进阶', '基础', '挑战'],
  hard: ['挑战', '进阶', '基础'],
};

export interface ExamAnswer {
  response: string | boolean | null;
}

export interface ExamSession {
  id: string;
  difficulty: ExamDifficulty;
  startedAt: number;
  deadlineAt: number;
  questionIds: string[];
  optionOrders: Record<string, string[]>;
  answers: Record<string, ExamAnswer>;
  currentIndex: number;
  /** 解答题自评；交卷后才填写。 */
  selfGrades?: Record<string, Grade>;
  submittedAt?: number;
}

export interface ExamResultItem {
  question: Question;
  response: string | boolean | null;
  autoCorrect: boolean | null;
  selfGrade: Grade;
  earned: number;
}

export interface ExamResult {
  id: string;
  difficulty: ExamDifficulty;
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  total: number;
  score: number;
  accuracy: number;
  items: ExamResultItem[];
}
