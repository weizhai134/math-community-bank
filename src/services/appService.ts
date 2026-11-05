import { db } from '../db/db';
import { seedDatabase } from '../db/seed';
import { CHAPTERS, STORAGE_KEYS, TIER_ORDER } from '../domain/constants';
import {
  bestStarsMap,
  calculateStars,
  calculateXp,
  chapterStars,
  completionSequence,
  earnedForGrade,
  isLevelUnlocked,
  newlyUnlockedLevels,
  nextStreak,
  rankForXp,
} from '../domain/rules';
import { buildEncouragement, buildSuggestions } from '../domain/feedback';
import {
  applyReview,
  canAwardTrialXp,
  createWrongItem,
  recordWrongAgain,
  withTrialXpAward,
} from '../domain/sm2';
import type {
  ActiveRun,
  Grade,
  Level,
  LevelAnswer,
  LevelAttempt,
  PendingReview,
  Profile,
  Question,
  ReviewQuality,
  TrialCandidate,
  WrongItem,
} from '../domain/types';
import { clamp, localDateKey, shuffle, uid } from '../lib/date';

export interface AppSnapshot {
  questions: Question[];
  levels: Level[];
  attempts: LevelAttempt[];
  wrongItems: WrongItem[];
  profile: Profile;
  activeRun: ActiveRun | null;
  pendingReview: PendingReview | null;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  await seedDatabase();
  const [questions, levels, attempts, wrongItems, profile, activeRun, pendingReview] =
    await Promise.all([
      db.questions.toArray(),
      db.levels.toArray(),
      db.levelAttempts.toArray(),
      db.wrongItems.toArray(),
      db.profile.get('me'),
      db.settings.get(STORAGE_KEYS.activeRun),
      db.settings.get(STORAGE_KEYS.pendingReview),
    ]);
  if (!profile) throw new Error('用户档案初始化失败');
  return {
    questions: questions.sort((a, b) => a.id.localeCompare(b.id)),
    levels: levels.sort(
      (a, b) =>
        a.chapter - b.chapter || TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
    ),
    attempts: attempts.sort((a, b) => b.finishedAt - a.finishedAt),
    wrongItems: wrongItems.sort((a, b) => a.nextReviewAt - b.nextReviewAt),
    profile,
    activeRun: (activeRun?.value as ActiveRun | undefined) ?? null,
    pendingReview: (pendingReview?.value as PendingReview | undefined) ?? null,
  };
}

export async function getResult(attemptId: string): Promise<{
  attempt: LevelAttempt;
  answers: LevelAnswer[];
} | null> {
  const attempt = await db.levelAttempts.get(attemptId);
  if (!attempt) return null;
  const answers = await db.levelAnswers
    .where('[attemptId+order]')
    .between([attemptId, 0], [attemptId, 99])
    .toArray();
  return { attempt, answers };
}

function shuffledOptionOrder(question: Question): string[] {
  if (!question.options || question.options.length === 0) return [];
  const original = question.options.map((option) => option.id);
  let result = shuffle(original);
  if (result.length > 1 && result.every((id, index) => id === original[index])) {
    result = [...result.slice(1), result[0]];
  }
  return result;
}

export async function createRun(
  level: Level,
  levelQuestions: Question[],
  trialItems?: WrongItem[],
): Promise<ActiveRun> {
  const orderedQuestions = shuffle(levelQuestions);
  const optionOrders: Record<string, string[]> = {};
  for (const question of orderedQuestions) {
    if (question.type === 'choice') optionOrders[question.id] = shuffledOptionOrder(question);
  }
  const now = Date.now();
  const answers: ActiveRun['answers'] = {};
  for (const question of orderedQuestions) {
    answers[question.id] = {
      response: null,
      submitted: false,
      timeSpentSec: 0,
      autoCorrect: null,
    };
  }
  const run: ActiveRun = {
    id: uid('run'),
    levelId: level.id,
    chapter: level.chapter,
    levelName: level.name,
    tier: level.tier,
    isTrial: Boolean(trialItems),
    questionIds: orderedQuestions.map((question) => question.id),
    optionOrders,
    currentIndex: 0,
    startedAt: now,
    answers,
    combo: 0,
    maxCombo: 0,
    questionStartedAt: now,
    targetSec: level.targetSec,
    trialItemIds: trialItems?.map((item) => item.id),
  };
  await db.settings.put({
    key: STORAGE_KEYS.activeRun,
    value: run,
    updatedAt: now,
  });
  return run;
}

export async function persistActiveRun(run: ActiveRun | null): Promise<void> {
  if (!run) {
    await db.settings.delete(STORAGE_KEYS.activeRun);
    return;
  }
  await db.settings.put({
    key: STORAGE_KEYS.activeRun,
    value: run,
    updatedAt: Date.now(),
  });
}

export async function savePendingReview(run: ActiveRun): Promise<PendingReview> {
  const pending: PendingReview = {
    id: `review_${run.id}`,
    run,
    createdAt: Date.now(),
  };
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({
      key: STORAGE_KEYS.pendingReview,
      value: pending,
      updatedAt: Date.now(),
    });
    await db.settings.delete(STORAGE_KEYS.activeRun);
  });
  return pending;
}

export function applyAnswer(
  run: ActiveRun,
  question: Question,
  response: string | boolean,
  now = Date.now(),
): ActiveRun {
  const existing = run.answers[question.id];
  if (!existing || existing.submitted) return run;
  const timeSpentSec = clamp(Math.round((now - run.questionStartedAt) / 1000), 1, 3600);
  let autoCorrect: boolean | null = null;
  let combo = run.combo;
  if (question.type === 'choice') {
    autoCorrect = response === question.answer;
    combo = autoCorrect ? combo + 1 : 0;
  } else if (question.type === 'judge') {
    autoCorrect = response === question.answer;
    combo = autoCorrect ? combo + 1 : 0;
  }
  return {
    ...run,
    combo,
    maxCombo: Math.max(run.maxCombo, combo),
    answers: {
      ...run.answers,
      [question.id]: {
        response,
        submitted: true,
        timeSpentSec,
        autoCorrect,
      },
    },
  };
}

export async function advanceRun(run: ActiveRun, now = Date.now()): Promise<ActiveRun> {
  if (run.currentIndex >= run.questionIds.length - 1) return run;
  const next: ActiveRun = {
    ...run,
    currentIndex: run.currentIndex + 1,
    questionStartedAt: now,
  };
  await persistActiveRun(next);
  return next;
}

export function buildTrialCandidate(
  wrongItems: WrongItem[],
  questions: Question[],
  now = Date.now(),
): TrialCandidate {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const available = wrongItems
    .filter((item) => !item.archived && questionMap.has(item.questionId))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
  const due = available.filter((item) => item.nextReviewAt <= now);
  const rest = available.filter((item) => item.nextReviewAt > now);
  const chosen: WrongItem[] = [];
  for (const item of [...due, ...rest]) {
    if (chosen.length >= 5) break;
    chosen.push(item);
  }
  return {
    questions: chosen
      .map((item) => questionMap.get(item.questionId))
      .filter((question): question is Question => Boolean(question)),
    items: chosen,
  };
}

export function trialLevel(questions: Question[]): Level {
  return {
    id: 'trial',
    chapter: questions[0]?.chapter ?? 1,
    tier: 'trial',
    name: '错题试炼',
    questionIds: questions.map((question) => question.id),
    targetSec: 600,
    brief: '从错题本抽取的复习关卡',
  };
}

export interface FinalizeResult {
  attempt: LevelAttempt;
  profile: Profile;
  newUnlocks: string[];
}

export async function finalizeRun(
  run: ActiveRun,
  selfGrades: Record<string, Grade>,
): Promise<FinalizeResult> {
  return db.transaction(
    'rw',
    [
      db.questions,
      db.levels,
      db.levelAttempts,
      db.levelAnswers,
      db.wrongItems,
      db.profile,
      db.settings,
    ],
    async () => {
      const profile = await db.profile.get('me');
      if (!profile) throw new Error('用户档案不存在');
      const questionList = (
        await Promise.all(run.questionIds.map((id) => db.questions.get(id)))
      ).filter((question): question is Question => Boolean(question));
      if (questionList.length !== run.questionIds.length) {
        throw new Error('题库已变更，无法结算本关');
      }
      const levels = await db.levels.toArray();
      const allAttempts = await db.levelAttempts.toArray();
      if (allAttempts.some((attempt) => attempt.id === `attempt_${run.id}`)) {
        throw new Error('本关已经结算，不能重复写入');
      }
      const allWrongItems = await db.wrongItems.toArray();
      const wrongMap = new Map(allWrongItems.map((item) => [item.questionId, item]));
      const now = Date.now();
      const isTrial = run.isTrial;
      const total = questionList.length;
      const answers: Array<{
        question: Question;
        answer: LevelAnswer;
        earned: number;
      }> = [];

      for (let index = 0; index < questionList.length; index += 1) {
        const question = questionList[index];
        const current = run.answers[question.id];
        const submitted = Boolean(current?.submitted);
        let grade: Grade;
        let autoCorrect: boolean | null = null;
        if (question.type === 'solution') {
          if (submitted) {
            const selected = selfGrades[question.id];
            if (!selected) throw new Error(`请先完成「${question.topic}」的自评`);
            grade = selected;
          } else {
            grade = 'wrong';
          }
        } else {
          autoCorrect = submitted ? Boolean(current?.autoCorrect) : false;
          grade = autoCorrect ? 'correct' : 'wrong';
        }
        const earned = earnedForGrade(grade, autoCorrect);
        answers.push({
          question,
          earned,
          answer: {
            id: `attempt_${run.id}:${index}`,
            attemptId: `attempt_${run.id}`,
            questionId: question.id,
            chapter: question.chapter,
            order: index,
            type: question.type,
            difficulty: question.difficulty,
            topic: question.topic,
            response: submitted ? (current?.response ?? null) : null,
            optionsOrder: run.optionOrders[question.id] ?? [],
            autoCorrect,
            selfGrade: grade,
            earned,
            timeSpentSec: submitted ? (current?.timeSpentSec ?? 0) : 0,
            questionSnapshot: question,
          },
        });
      }

      const score = answers.reduce((sum, item) => sum + item.earned, 0);
      const accuracy = total > 0 ? score / total : 0;
      const durationSec = answers.reduce((sum, item) => sum + item.answer.timeSpentSec, 0);

      let combo = 0;
      let maxCombo = 0;
      for (const item of answers) {
        if (item.answer.selfGrade === 'correct') combo += 1;
        else combo = 0;
        maxCombo = Math.max(maxCombo, combo);
      }

      const starBreakdown = calculateStars(accuracy, maxCombo, durationSec, run.targetSec);
      const stars = starBreakdown.stars;
      const prevBestStars = allAttempts
        .filter(
          (attempt) =>
            attempt.levelId === run.levelId &&
            attempt.status === 'completed' &&
            !attempt.isTrial,
        )
        .reduce((best, attempt) => Math.max(best, attempt.stars), 0);
      const repeatThreeStar = !isTrial && prevBestStars === 3;
      const passed = stars >= 1;
      const streakDays = passed
        ? nextStreak(profile.lastActiveDate, profile.streakDays, now)
        : profile.streakDays;

      const correctCount = answers.filter((item) => item.earned === 1).length;
      const advancedCorrect = answers.filter(
        (item) => item.earned === 1 && item.question.difficulty === '进阶',
      ).length;
      const challengeCorrect = answers.filter(
        (item) => item.earned === 1 && item.question.difficulty === '挑战',
      ).length;

      const eligibleTrialQuestions = new Set<string>();
      if (isTrial) {
        for (const item of answers) {
          if (item.earned !== 1) continue;
          const wrong = wrongMap.get(item.question.id);
          if (canAwardTrialXp(wrong, now)) eligibleTrialQuestions.add(item.question.id);
        }
      }

      const xpResult = calculateXp({
        correctCount,
        advancedCorrect,
        challengeCorrect,
        stars,
        streakDays,
        repeatThreeStar,
        isTrial,
        trialXpEligibleCount: eligibleTrialQuestions.size,
      });
      const totalXpAfter = profile.totalXp + xpResult.xp;
      const rank = rankForXp(totalXpAfter);
      const chapterCleared =
        !isTrial &&
        run.tier === 'boss' &&
        run.chapter >= 1 &&
        run.chapter <= CHAPTERS.length &&
        stars >= 1;

      const pendingUnlocks = [...profile.pendingUnlocks];
      if (
        chapterCleared &&
        run.chapter < CHAPTERS.length &&
        !profile.unlockedChapters.includes(run.chapter + 1) &&
        !pendingUnlocks.includes(run.chapter + 1)
      ) {
        pendingUnlocks.push(run.chapter + 1);
      }

      const profileAfter: Profile = {
        ...profile,
        totalXp: totalXpAfter,
        streakDays,
        lastActiveDate: passed ? localDateKey(now) : profile.lastActiveDate,
        pendingUnlocks,
        updatedAt: now,
      };

      const bestBefore = bestStarsMap(allAttempts);
      const bestAfter = { ...bestBefore };
      if (!isTrial) {
        bestAfter[run.levelId] = Math.max(bestAfter[run.levelId] ?? 0, stars);
      }
      const newUnlocks = isTrial
        ? []
        : newlyUnlockedLevels(bestBefore, bestAfter, profile, profileAfter, levels);

      const attemptId = `attempt_${run.id}`;
      const provisional: LevelAttempt = {
        id: attemptId,
        levelId: run.levelId,
        chapter: run.chapter,
        levelName: run.levelName,
        tier: run.tier,
        isTrial,
        startedAt: run.startedAt,
        finishedAt: now,
        durationSec,
        targetSec: run.targetSec,
        stars,
        prevBestStars,
        accuracy,
        maxCombo,
        xpEarned: xpResult.xp,
        totalXpAfter,
        rankTitleAfter: rank.title,
        status: 'completed',
        encouragement: '',
        suggestions: [],
        newUnlocks,
        streakDays,
        chapterCleared,
        trialItemIds: run.trialItemIds,
      };
      const consecutiveClears = isTrial ? 0 : completionSequence([...allAttempts, provisional]);
      const attemptOrdinal =
        allAttempts.filter(
          (attempt) =>
            attempt.levelId === run.levelId &&
            attempt.status === 'completed' &&
            !attempt.isTrial,
        ).length + 1;
      const encouragement = buildEncouragement({
        attemptId,
        stars,
        accuracy,
        prevBestStars,
        consecutiveClears,
        isTrial,
        attemptOrdinal,
        lastEncouragement: profile.lastEncouragement,
      });
      const suggestions = buildSuggestions({
        answers: answers.map((item) => ({ question: item.question, earned: item.earned })),
        durationSec,
        targetSec: run.targetSec,
        stars,
        isTrial,
      });
      const attempt: LevelAttempt = {
        ...provisional,
        encouragement,
        suggestions,
      };
      profileAfter.lastEncouragement = encouragement;

      await db.levelAttempts.add(attempt);
      await db.levelAnswers.bulkAdd(answers.map((item) => item.answer));
      await db.profile.put(profileAfter);

      const updatedWrongItems: WrongItem[] = [];
      for (const item of answers) {
        const wrong = wrongMap.get(item.question.id);
        if (isTrial) {
          if (!wrong) {
            const created = applyReview(createWrongItem(item.question, now), item.earned === 1 ? 5 : item.earned === 0.5 ? 3 : 1, now);
            updatedWrongItems.push(created);
            continue;
          }
          let reviewed = applyReview(
            wrong,
            item.earned === 1 ? 5 : item.earned === 0.5 ? 3 : 1,
            now,
          );
          if (item.earned === 0) {
            reviewed = { ...reviewed, wrongCount: wrong.wrongCount + 1, lastWrongAt: now };
          }
          if (item.earned === 1 && eligibleTrialQuestions.has(item.question.id)) {
            reviewed = withTrialXpAward(reviewed, now);
          }
          updatedWrongItems.push(reviewed);
        } else if (item.earned < 1) {
          updatedWrongItems.push(
            wrong ? recordWrongAgain(wrong, now) : createWrongItem(item.question, now),
          );
        }
      }
      if (updatedWrongItems.length > 0) {
        await db.wrongItems.bulkPut(updatedWrongItems);
      }

      await db.settings.delete(STORAGE_KEYS.activeRun);
      await db.settings.delete(STORAGE_KEYS.pendingReview);
      return { attempt, profile: profileAfter, newUnlocks };
    },
  );
}

export async function abandonRun(run: ActiveRun): Promise<string> {
  return db.transaction(
    'rw',
    db.questions,
    db.levelAttempts,
    db.levelAnswers,
    db.profile,
    db.settings,
    async () => {
      const profile = await db.profile.get('me');
      if (!profile) throw new Error('用户档案不存在');
      const questionList = (
        await Promise.all(run.questionIds.map((id) => db.questions.get(id)))
      ).filter((question): question is Question => Boolean(question));
      const allAttempts = await db.levelAttempts.toArray();
      const prevBestStars = allAttempts
        .filter(
          (attempt) =>
            attempt.levelId === run.levelId &&
            attempt.status === 'completed' &&
            !attempt.isTrial,
        )
        .reduce((best, attempt) => Math.max(best, attempt.stars), 0);
      const now = Date.now();
      const attemptId = uid('attempt');
      const answers: LevelAnswer[] = questionList.map((question, index) => {
        const current = run.answers[question.id];
        const submitted = Boolean(current?.submitted);
        const autoCorrect =
          question.type === 'solution' ? null : submitted ? Boolean(current?.autoCorrect) : false;
        return {
          id: `${attemptId}:${index}`,
          attemptId,
          questionId: question.id,
          chapter: question.chapter,
          order: index,
          type: question.type,
          difficulty: question.difficulty,
          topic: question.topic,
          response: submitted ? (current?.response ?? null) : null,
          optionsOrder: run.optionOrders[question.id] ?? [],
          autoCorrect,
          selfGrade: question.type === 'solution' ? null : autoCorrect ? 'correct' : 'wrong',
          earned: question.type === 'solution' ? 0 : autoCorrect ? 1 : 0,
          timeSpentSec: submitted ? (current?.timeSpentSec ?? 0) : 0,
          questionSnapshot: question,
        };
      });
      const attempt: LevelAttempt = {
        id: attemptId,
        levelId: run.levelId,
        chapter: run.chapter,
        levelName: run.levelName,
        tier: run.tier,
        isTrial: run.isTrial,
        startedAt: run.startedAt,
        finishedAt: now,
        durationSec: answers.reduce((sum, item) => sum + item.timeSpentSec, 0),
        targetSec: run.targetSec,
        stars: 0,
        prevBestStars,
        accuracy: 0,
        maxCombo: run.maxCombo,
        xpEarned: 0,
        totalXpAfter: profile.totalXp,
        rankTitleAfter: rankForXp(profile.totalXp).title,
        status: 'abandoned',
        encouragement: '本关已保存为未完成记录。已作答题目的过程保留在记录中，重新挑战时会重新洗牌。',
        suggestions: ['重新进入关卡后，未作答的题会按新顺序出现；建议先用完整步骤解决一道同类题热身。'],
        newUnlocks: [],
        streakDays: profile.streakDays,
        chapterCleared: false,
        trialItemIds: run.trialItemIds,
      };
      await db.levelAttempts.add(attempt);
      if (answers.length > 0) await db.levelAnswers.bulkAdd(answers);
      await db.settings.delete(STORAGE_KEYS.activeRun);
      return attemptId;
    },
  );
}

export async function confirmChapterUnlock(chapter: number): Promise<Profile> {
  return db.transaction('rw', db.profile, async () => {
    const profile = await db.profile.get('me');
    if (!profile) throw new Error('用户档案不存在');
    if (!profile.pendingUnlocks.includes(chapter)) {
      throw new Error('该章节当前没有待确认的解锁');
    }
    const updated: Profile = {
      ...profile,
      unlockedChapters: [...new Set([...profile.unlockedChapters, chapter])].sort((a, b) => a - b),
      pendingUnlocks: profile.pendingUnlocks.filter((item) => item !== chapter),
      updatedAt: Date.now(),
    };
    await db.profile.put(updated);
    return updated;
  });
}

export async function reviewWrongItem(id: string, quality: ReviewQuality): Promise<void> {
  await db.transaction('rw', db.wrongItems, async () => {
    const item = await db.wrongItems.get(id);
    if (!item) throw new Error('错题记录不存在');
    await db.wrongItems.put(applyReview(item, quality));
  });
}

export async function setWrongArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.wrongItems, async () => {
    const item = await db.wrongItems.get(id);
    if (!item) throw new Error('错题记录不存在');
    await db.wrongItems.put({
      ...item,
      archived,
      nextReviewAt: archived ? item.nextReviewAt : Date.now(),
      updatedAt: Date.now(),
    });
  });
}

export async function chapterStats(
  chapter: number,
  levels: Level[],
  attempts: LevelAttempt[],
): Promise<{ stars: number; best: Record<string, number> }> {
  const best = bestStarsMap(attempts);
  return { stars: chapterStars(chapter, levels, best), best };
}

export async function levelLocked(
  level: Level,
  profile: Profile,
  levels: Level[],
  attempts: LevelAttempt[],
): Promise<boolean> {
  return !isLevelUnlocked(level, profile, levels, bestStarsMap(attempts));
}
