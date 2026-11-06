export type Difficulty = '基础' | '进阶' | '挑战';
export type QuestionType = 'choice' | 'judge' | 'solution';
export type LevelTier = 'basic' | 'advanced' | 'boss' | 'trial';
export type Grade = 'correct' | 'partial' | 'wrong';
export type ReviewQuality = 1 | 3 | 5;

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  chapter: number;
  topic: string;
  difficulty: Difficulty;
  source: string;
  type: QuestionType;
  stem: string;
  options?: QuestionOption[];
  answer: string | boolean;
  explanation: string;
}

export interface Level {
  id: string;
  chapter: number;
  tier: LevelTier;
  name: string;
  questionIds: string[];
  targetSec: number;
  brief: string;
}

export interface Chapter {
  id: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  accent: string;
}

export interface RunAnswer {
  response: string | boolean | null;
  submitted: boolean;
  timeSpentSec: number;
  autoCorrect: boolean | null;
}

export interface ActiveRun {
  id: string;
  levelId: string;
  chapter: number;
  levelName: string;
  tier: LevelTier;
  isTrial: boolean;
  questionIds: string[];
  optionOrders: Record<string, string[]>;
  currentIndex: number;
  startedAt: number;
  answers: Record<string, RunAnswer>;
  /** 题目 id -> 当时草稿画布的 Base64 PNG。仅在用户真正画过时存在。 */
  scratchImages?: Record<string, string>;
  combo: number;
  maxCombo: number;
  questionStartedAt: number;
  targetSec: number;
  trialItemIds?: string[];
}

export interface PendingReview {
  id: string;
  run: ActiveRun;
  createdAt: number;
}

export interface LevelAttempt {
  id: string;
  levelId: string;
  chapter: number;
  levelName: string;
  tier: LevelTier;
  isTrial: boolean;
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  targetSec: number;
  stars: number;
  prevBestStars: number;
  accuracy: number;
  maxCombo: number;
  xpEarned: number;
  totalXpAfter: number;
  rankTitleAfter: string;
  status: 'completed' | 'abandoned';
  encouragement: string;
  suggestions: string[];
  newUnlocks: string[];
  streakDays: number;
  chapterCleared: boolean;
  trialItemIds?: string[];
}

export interface LevelAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  chapter: number;
  order: number;
  type: QuestionType;
  difficulty: Difficulty;
  topic: string;
  response: string | boolean | null;
  optionsOrder: string[];
  autoCorrect: boolean | null;
  selfGrade: Grade | null;
  earned: number;
  timeSpentSec: number;
  questionSnapshot: Question;
  /** 做错/部分对时保存的草稿画布，Base64 PNG；做对不保存。 */
  scratchImage?: string;
}

export interface WrongItem {
  id: string;
  questionId: string;
  chapter: number;
  topic: string;
  type: QuestionType;
  difficulty: Difficulty;
  wrongCount: number;
  interval: number;
  easeFactor: number;
  nextReviewAt: number;
  createdAt: number;
  updatedAt: number;
  lastWrongAt: number;
  lastReviewedAt?: number;
  lastXpAt?: number;
  reviewCount: number;
  archived: boolean;
  questionSnapshot: Question;
  /** 第二阶段：缺省视为主线错题，旧记录无需迁移。 */
  source?: 'mainline' | 'community';
  /** 社区错题对应的远端 community_questions.id。 */
  communityId?: number;
  /** 这道错题最近一次作答时保存的草稿画布，Base64 PNG。 */
  scratchImage?: string;
}

export interface Profile {
  id: 'me';
  totalXp: number;
  streakDays: number;
  lastActiveDate: string | null;
  unlockedChapters: number[];
  pendingUnlocks: number[];
  createdAt: number;
  updatedAt: number;
  lastEncouragement?: string;
  /** 每日盲盒抽到的称号，展示在首页段位旁。 */
  title?: string;
}

export interface SettingRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface StarBreakdown {
  stars: number;
  accuracy: number;
  maxCombo: number;
  score: number;
}

export interface XpResult {
  xp: number;
  base: number;
  repeatPenalty: boolean;
  capped: boolean;
}

export interface RankInfo {
  index: number;
  title: string;
  epithet: string;
  min: number;
  nextMin: number | null;
  nextTitle: string | null;
  progress: number;
  toNext: number;
}

export interface TrialCandidate {
  questions: Question[];
  items: WrongItem[];
}
