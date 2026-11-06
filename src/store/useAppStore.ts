import { create } from 'zustand';
import type { AchievementEvent } from '../domain/achievements';
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
  ensureAchievementStates,
  evaluateAchievements,
} from '../services/achievementService';
import { markDailyBoxEligible } from '../services/dailyBoxService';
import {
  abandonRun,
  advanceRun,
  applyAnswer,
  buildTargetedInput,
  buildTrialCandidate,
  confirmChapterUnlock,
  createRun,
  finalizeRun,
  loadSnapshot,
  markTargetedStarted,
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
  recordCompletion: (event: AchievementEvent) => Promise<void>;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setDataOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  startLevel: (levelId: string) => Promise<ActiveRun>;
  startTrial: () => Promise<ActiveRun>;
  startTargeted: (topic: string) => Promise<ActiveRun>;
  submitCurrent: (response: string | boolean) => Promise<number | null>;
  nextQuestion: () => Promise<void>;
  resetQuestionTimer: () => Promise<void>;
  saveScratchImage: (questionId: string, dataUrl: string | null) => Promise<void>;
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
      await ensureAchievementStates(true).catch(() => undefined);
      set({ ...snapshot, loading: false });
    } catch (error) {
      set({
        loading: false,
        bootError: error instanceof Error ? error.message : '应用初始化失败',
      });
    }
  },

  recordCompletion: async (event) => {
    const unlocked = await evaluateAchievements(event);
    await markDailyBoxEligible(event.finishedAt);
    if (unlocked.length > 0) {
      get().showToast(`成就解锁：${unlocked.map((item) => item.title).join('、')}`);
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

  startTargeted: async (topic) => {
    const { questions, wrongItems, activeRun, pendingReview } = get();
    if (pendingReview) throw new Error('还有待结算的关卡，请先完成结算');
    if (activeRun) throw new Error('已有未完成关卡，请先继续或退出当前关卡');
    const input = buildTargetedInput(wrongItems, questions, topic);
    if (input.items.length === 0) throw new Error('这个知识点的错题已经清空');
    const run = await createRun(input.level, input.questions, input.items);
    await markTargetedStarted(topic);
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

  saveScratchImage: async (questionId, dataUrl) => {
    const activeRun = get().activeRun;
    if (!activeRun) return;
    const scratchImages = { ...(activeRun.scratchImages ?? {}) };
    if (dataUrl) scratchImages[questionId] = dataUrl;
    else delete scratchImages[questionId];
    const updated = { ...activeRun, scratchImages };
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
    await get().recordCompletion({
      correct: result.correctCount,
      maxCombo: result.attempt.maxCombo,
      finishedAt: result.attempt.finishedAt,
      basicCleared:
        !result.attempt.isTrial &&
        result.attempt.tier === 'basic' &&
        result.attempt.stars >= 1,
    });
    set({ activeRun: null, pendingReview: null });
    return { kind: 'attempt', id: result.attempt.id };
  },

  finalizePending: async (grades) => {
    const pending = get().pendingReview;
    if (!pending) throw new Error('没有待结算的关卡');
    const result = await finalizeRun(pending.run, grades);
    await get().refresh();
    await get().recordCompletion({
      correct: result.correctCount,
      maxCombo: result.attempt.maxCombo,
      finishedAt: result.attempt.finishedAt,
      basicCleared:
        !result.attempt.isTrial &&
        result.attempt.tier === 'basic' &&
        result.attempt.stars >= 1,
    });
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
