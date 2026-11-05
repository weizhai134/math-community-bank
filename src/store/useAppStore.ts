import { create } from 'zustand';
import type {
  ActiveRun,
  Grade,
  Level,
  LevelAttempt,
  PendingReview,
  Profile,
  Question,
  ReviewQuality,
  WrongItem,
} from '../domain/types';
import { isLevelUnlocked } from '../domain/rules';
import {
  abandonRun,
  advanceRun,
  applyAnswer,
  buildTrialCandidate,
  confirmChapterUnlock,
  createRun,
  finalizeRun,
  loadSnapshot,
  persistActiveRun,
  reviewWrongItem,
  savePendingReview,
  setWrongArchived,
  trialLevel,
} from '../services/appService';
import { importQuestionBank, restoreBackup } from '../services/dataTransfer';

interface SettlementReady {
  kind: 'pending' | 'attempt';
  id: string;
}

interface AppStore {
  loading: boolean;
  bootError: string | null;
  questions: Question[];
  levels: Level[];
  attempts: LevelAttempt[];
  wrongItems: WrongItem[];
  profile: Profile | null;
  activeRun: ActiveRun | null;
  pendingReview: PendingReview | null;
  dataOpen: boolean;
  toast: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setDataOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  startLevel: (levelId: string) => Promise<ActiveRun>;
  startTrial: () => Promise<ActiveRun>;
  submitCurrent: (response: string | boolean) => Promise<number | null>;
  nextQuestion: () => Promise<void>;
  resetQuestionTimer: () => Promise<void>;
  prepareSettlement: () => Promise<SettlementReady>;
  finalizePending: (grades: Record<string, Grade>) => Promise<string>;
  abandonActive: () => Promise<string>;
  reviewWrong: (id: string, quality: ReviewQuality) => Promise<void>;
  archiveWrong: (id: string, archived: boolean) => Promise<void>;
  unlockChapter: (chapter: number) => Promise<void>;
  importBank: (raw: unknown) => Promise<void>;
  restore: (raw: unknown) => Promise<void>;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  loading: true,
  bootError: null,
  questions: [],
  levels: [],
  attempts: [],
  wrongItems: [],
  profile: null,
  activeRun: null,
  pendingReview: null,
  dataOpen: false,
  toast: null,

  bootstrap: async () => {
    try {
      set({ loading: true, bootError: null });
      const snapshot = await loadSnapshot();
      set({ ...snapshot, loading: false });
    } catch (error) {
      set({
        loading: false,
        bootError: error instanceof Error ? error.message : '应用初始化失败',
      });
    }
  },

  refresh: async () => {
    const snapshot = await loadSnapshot();
    set(snapshot);
  },

  setDataOpen: (open) => set({ dataOpen: open }),

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },

  startLevel: async (levelId) => {
    const { levels, questions, profile, attempts, activeRun, pendingReview } = get();
    if (!profile) throw new Error('用户档案尚未加载');
    if (pendingReview) throw new Error('还有待结算的关卡，请先完成结算');
    if (activeRun) throw new Error('已有未完成关卡，请先继续或退出当前关卡');
    const level = levels.find((item) => item.id === levelId);
    if (!level) throw new Error('关卡不存在');
    if (!isLevelUnlocked(level, profile, levels, attemptsBest(attempts))) {
      throw new Error('关卡尚未解锁');
    }
    const levelQuestions = level.questionIds
      .map((id) => questions.find((question) => question.id === id))
      .filter((question): question is Question => Boolean(question));
    if (levelQuestions.length !== level.questionIds.length) {
      throw new Error('关卡题目缺失，请检查题库');
    }
    const run = await createRun(level, levelQuestions);
    set({ activeRun: run });
    return run;
  },

  startTrial: async () => {
    const { questions, wrongItems, activeRun, pendingReview } = get();
    if (pendingReview) throw new Error('还有待结算的关卡，请先完成结算');
    if (activeRun) throw new Error('已有未完成关卡，请先继续或退出当前关卡');
    const candidate = buildTrialCandidate(wrongItems, questions);
    if (candidate.questions.length === 0) throw new Error('错题本中暂无可试炼的题目');
    const level = trialLevel(candidate.questions);
    const run = await createRun(level, candidate.questions, candidate.items);
    set({ activeRun: run });
    return run;
  },

  submitCurrent: async (response) => {
    const { activeRun, questions } = get();
    if (!activeRun) throw new Error('没有进行中的关卡');
    const questionId = activeRun.questionIds[activeRun.currentIndex];
    const question = questions.find((item) => item.id === questionId);
    if (!question) throw new Error('当前题目不存在');
    if (activeRun.answers[questionId]?.submitted) return null;
    const updated = applyAnswer(activeRun, question, response);
    await persistActiveRun(updated);
    set({ activeRun: updated });
    return updated.answers[questionId]?.timeSpentSec ?? null;
  },

  nextQuestion: async () => {
    const activeRun = get().activeRun;
    if (!activeRun) return;
    const current = activeRun.answers[activeRun.questionIds[activeRun.currentIndex]];
    if (!current?.submitted) return;
    const updated = await advanceRun(activeRun);
    set({ activeRun: updated });
  },

  resetQuestionTimer: async () => {
    const activeRun = get().activeRun;
    if (!activeRun) return;
    const current = activeRun.answers[activeRun.questionIds[activeRun.currentIndex]];
    if (current?.submitted) return;
    const updated = { ...activeRun, questionStartedAt: Date.now() };
    await persistActiveRun(updated);
    set({ activeRun: updated });
  },

  prepareSettlement: async () => {
    const { activeRun, questions, pendingReview } = get();
    if (pendingReview) return { kind: 'pending', id: pendingReview.id };
    if (!activeRun) throw new Error('没有进行中的关卡');
    const solutionSubmitted = activeRun.questionIds.some((id) => {
      const question = questions.find((item) => item.id === id);
      return question?.type === 'solution' && activeRun.answers[id]?.submitted;
    });
    if (solutionSubmitted) {
      const pending = await savePendingReview(activeRun);
      set({ activeRun: null, pendingReview: pending });
      return { kind: 'pending', id: pending.id };
    }
    const result = await finalizeRun(activeRun, {});
    await get().refresh();
    set({ activeRun: null, pendingReview: null });
    return { kind: 'attempt', id: result.attempt.id };
  },

  finalizePending: async (grades) => {
    const pending = get().pendingReview;
    if (!pending) throw new Error('没有待结算的关卡');
    const result = await finalizeRun(pending.run, grades);
    await get().refresh();
    set({ pendingReview: null, activeRun: null });
    return result.attempt.id;
  },

  abandonActive: async () => {
    const activeRun = get().activeRun;
    if (!activeRun) throw new Error('没有进行中的关卡');
    const attemptId = await abandonRun(activeRun);
    await get().refresh();
    set({ activeRun: null });
    return attemptId;
  },

  reviewWrong: async (id, quality) => {
    await reviewWrongItem(id, quality);
    await get().refresh();
  },

  archiveWrong: async (id, archived) => {
    await setWrongArchived(id, archived);
    await get().refresh();
  },

  unlockChapter: async (chapter) => {
    await confirmChapterUnlock(chapter);
    await get().refresh();
  },

  importBank: async (raw) => {
    const result = await importQuestionBank(raw);
    await get().refresh();
    get().showToast(`题库已导入：${result.questions} 题 / ${result.levels} 关`);
  },

  restore: async (raw) => {
    await restoreBackup(raw);
    await get().refresh();
    get().showToast('备份已恢复');
  },
}));

export function attemptsBest(attempts: LevelAttempt[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const attempt of attempts) {
    if (attempt.status !== 'completed' || attempt.isTrial) continue;
    result[attempt.levelId] = Math.max(result[attempt.levelId] ?? 0, attempt.stars);
  }
  return result;
}
