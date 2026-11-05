import type { ActiveRun, Chapter, LevelTier } from './types';

export const APP_NAME = '高数闯关';
export const PASS_STARS = 1;

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: '函数与极限',
    shortTitle: '极限',
    subtitle: '从函数出发，抓住极限与连续',
    accent: '#b45309',
  },
  {
    id: 2,
    title: '导数与微分',
    shortTitle: '导数',
    subtitle: '理解变化率，熟练求导',
    accent: '#0f766e',
  },
  {
    id: 3,
    title: '微分中值定理与导数的应用',
    shortTitle: '中值定理',
    subtitle: '用定理分析函数的形状',
    accent: '#7c3aed',
  },
  {
    id: 4,
    title: '不定积分',
    shortTitle: '不定积分',
    subtitle: '掌握换元、分部与有理函数',
    accent: '#be123c',
  },
  {
    id: 5,
    title: '定积分',
    shortTitle: '定积分',
    subtitle: '从黎曼和到牛顿—莱布尼茨',
    accent: '#0369a1',
  },
  {
    id: 6,
    title: '定积分的应用',
    shortTitle: '积分应用',
    subtitle: '面积、体积、弧长与物理量',
    accent: '#4d7c0f',
  },
  {
    id: 7,
    title: '微分方程',
    shortTitle: '微分方程',
    subtitle: '识别方程类型，建立模型',
    accent: '#a16207',
  },
];

export const TIER_LABEL: Record<LevelTier, string> = {
  basic: '基础关',
  advanced: '进阶关',
  boss: 'Boss 关',
  trial: '错题试炼',
};

export const TIER_EN: Record<LevelTier, string> = {
  basic: 'BASIC',
  advanced: 'ADVANCED',
  boss: 'BOSS',
  trial: 'TRIAL',
};

export const TIER_ORDER: LevelTier[] = ['basic', 'advanced', 'boss'];

export const CHAPTER_TOTAL_QUESTIONS = 15;
export const LEVEL_QUESTIONS = 5;
export const MAX_CHAPTER_STARS = 9;
export const MAX_LEVEL_XP = 300;
export const MAX_TRIAL_XP = 100;

export const QUESTION_TYPE_LABEL = {
  choice: '选择题',
  judge: '判断题',
  solution: '解答题',
} as const;

export const DIFFICULTY_LABEL = {
  基础: '基础',
  进阶: '进阶',
  挑战: '挑战',
} as const;

export const DIFFICULTY_ORDER = ['基础', '进阶', '挑战'] as const;

export const STORAGE_KEYS = {
  activeRun: 'activeRun',
  pendingReview: 'pendingReview',
  lastBackupAt: 'lastBackupAt',
  seedVersion: 'seedVersion',
} as const;

export function getChapter(chapter: number): Chapter {
  return CHAPTERS.find((item) => item.id === chapter) ?? CHAPTERS[0];
}

export function getTierLabel(tier: LevelTier): string {
  return TIER_LABEL[tier];
}

export function emptyAnswers(run: Pick<ActiveRun, 'questionIds'>): ActiveRun['answers'] {
  const answers: ActiveRun['answers'] = {};
  for (const id of run.questionIds) {
    answers[id] = {
      response: null,
      submitted: false,
      timeSpentSec: 0,
      autoCorrect: null,
    };
  }
  return answers;
}
