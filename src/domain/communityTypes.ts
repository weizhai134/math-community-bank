import type { Difficulty, Grade, QuestionOption, QuestionType } from './types';

export type CommunityStatus = 'pending' | 'visible' | 'hidden';

/** 与 Supabase 表 community_questions 一一对应的行。 */
export interface CommunityQuestion {
  id: number;
  chapter: number;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  stem: string;
  options: QuestionOption[] | null;
  answer: string | boolean;
  explanation: string;
  source: string;
  nickname: string;
  author_id: string;
  status: CommunityStatus;
  report_count: number;
  content_hash: string;
  created_at: string;
}

export interface CommunityFilters {
  chapter: number | null;
  difficulty: Difficulty | null;
  type: QuestionType | null;
}

export interface CommunityCacheRecord {
  /** 远端主键，同时作为本地缓存主键。 */
  id: number;
  payload: CommunityQuestion;
  fetchedAt: number;
}

export interface CommunityDraft {
  chapter: number;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  /** 选择题为选项 id；判断题为布尔；解答题为文本。 */
  answer: string | boolean;
  explanation: string;
  source: string;
  nickname: string;
}

export interface CommunitySessionInfo {
  userId: string;
  email: string | null;
  isAnonymous: boolean;
}

export interface CommunityRunAnswer {
  response: string | boolean | null;
  submitted: boolean;
  timeSpentSec: number;
  autoCorrect: boolean | null;
  selfGrade: Grade | null;
}

export interface CommunityRun {
  id: string;
  createdAt: number;
  /** 远端题号顺序（已洗牌）。 */
  questionIds: number[];
  questions: Record<string, CommunityQuestion>;
  /** 题号 -> 选项展示顺序（远端题 id 作键）。 */
  optionOrders: Record<string, string[]>;
  answers: Record<string, CommunityRunAnswer>;
  index: number;
  startedAt: number;
  questionStartedAt: number;
  selfGrading: boolean;
}

export interface CommunityResultItem {
  questionId: number;
  question: CommunityQuestion;
  response: string | boolean | null;
  earned: number;
  selfGrade: Grade | null;
  autoCorrect: boolean | null;
  timeSpentSec: number;
  optionsOrder: string[];
}

export interface CommunityResult {
  id: string;
  finishedAt: number;
  durationSec: number;
  total: number;
  correct: number;
  accuracy: number;
  xpEarned: number;
  xpCapped: boolean;
  dailyXpBefore: number;
  dailyLimit: number;
  items: CommunityResultItem[];
}

export interface CommunityXpState {
  /** 本地自然日 YYYY-MM-DD。 */
  date: string;
  xp: number;
}
