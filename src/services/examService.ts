import { db, deleteSetting, getSetting, setSetting } from '../db/db';
import {
  EXAM_DIFFICULTY_PRIORITY,
  EXAM_DURATION_MS,
  EXAM_QUESTION_COUNTS,
  EXAM_TOTAL_QUESTIONS,
  type ExamDifficulty,
  type ExamResult,
  type ExamResultItem,
  type ExamSession,
} from '../domain/exam';
import { earnedForGrade } from '../domain/rules';
import { createWrongItem, recordWrongAgain } from '../domain/sm2';
import type { Grade, Question, QuestionType } from '../domain/types';
import { shuffle, uid } from '../lib/date';

export const EXAM_SESSION_KEY = 'examSession';
export const EXAM_RESULT_KEY = 'examResult';

function shuffledOptionOrder(question: Question): string[] {
  if (!question.options || question.options.length === 0) return [];
  const original = question.options.map((option) => option.id);
  let result = shuffle(original);
  if (result.length > 1 && result.every((id, index) => id === original[index])) {
    result = [...result.slice(1), result[0]];
  }
  return result;
}

function pickByType(
  questions: Question[],
  type: QuestionType,
  count: number,
  difficulty: ExamDifficulty,
): Question[] {
  const pool = questions.filter((question) => question.type === type);
  const chosen: Question[] = [];
  for (const level of EXAM_DIFFICULTY_PRIORITY[difficulty]) {
    for (const question of shuffle(pool.filter((item) => item.difficulty === level))) {
      if (chosen.length >= count) break;
      if (!chosen.some((item) => item.id === question.id)) chosen.push(question);
    }
    if (chosen.length >= count) break;
  }
  if (chosen.length < count) {
    for (const question of shuffle(pool)) {
      if (chosen.length >= count) break;
      if (!chosen.some((item) => item.id === question.id)) chosen.push(question);
    }
  }
  return chosen;
}

export function buildExamPaper(
  questions: Question[],
  difficulty: ExamDifficulty,
): { questions: Question[]; optionOrders: Record<string, string[]> } {
  const selected = [
    ...pickByType(questions, 'choice', EXAM_QUESTION_COUNTS.choice, difficulty),
    ...pickByType(questions, 'judge', EXAM_QUESTION_COUNTS.judge, difficulty),
    ...pickByType(questions, 'solution', EXAM_QUESTION_COUNTS.solution, difficulty),
  ];
  if (selected.length < EXAM_TOTAL_QUESTIONS) {
    throw new Error(
      `题库不足：模拟考需要 ${EXAM_TOTAL_QUESTIONS} 题，当前只能抽出 ${selected.length} 题`,
    );
  }
  const ordered = shuffle(selected);
  const optionOrders: Record<string, string[]> = {};
  for (const question of ordered) {
    if (question.type === 'choice') optionOrders[question.id] = shuffledOptionOrder(question);
  }
  return { questions: ordered, optionOrders };
}

export async function loadExamSession(): Promise<ExamSession | null> {
  return (await getSetting<ExamSession>(EXAM_SESSION_KEY)) ?? null;
}

export async function saveExamSession(session: ExamSession): Promise<void> {
  await setSetting(EXAM_SESSION_KEY, session);
}

export async function clearExamSession(): Promise<void> {
  await deleteSetting(EXAM_SESSION_KEY);
}

export async function startExam(
  difficulty: ExamDifficulty,
  questions: Question[],
): Promise<ExamSession> {
  const paper = buildExamPaper(questions, difficulty);
  const now = Date.now();
  const answers: ExamSession['answers'] = {};
  for (const question of paper.questions) {
    answers[question.id] = { response: null };
  }
  const session: ExamSession = {
    id: uid('exam'),
    difficulty,
    startedAt: now,
    deadlineAt: now + EXAM_DURATION_MS,
    questionIds: paper.questions.map((question) => question.id),
    optionOrders: paper.optionOrders,
    answers,
    currentIndex: 0,
    selfGrades: {},
  };
  await saveExamSession(session);
  return session;
}

export async function markExamSubmitted(session: ExamSession): Promise<ExamSession> {
  const submitted: ExamSession = { ...session, submittedAt: Date.now() };
  await saveExamSession(submitted);
  return submitted;
}

export async function loadExamResult(): Promise<ExamResult | null> {
  return (await getSetting<ExamResult>(EXAM_RESULT_KEY)) ?? null;
}

export async function finalizeExam(
  session: ExamSession,
  questions: Question[],
): Promise<ExamResult> {
  const now = Date.now();
  const items: ExamResultItem[] = session.questionIds.map((id) => {
    const question = questions.find((item) => item.id === id);
    if (!question) throw new Error('题库已变更，无法结算本次模拟考');
    const response = session.answers[id]?.response ?? null;
    let autoCorrect: boolean | null = null;
    let grade: Grade;

    if (question.type === 'solution') {
      const answered = typeof response === 'string' && response.trim().length > 0;
      grade = answered ? (session.selfGrades?.[id] ?? 'wrong') : 'wrong';
      if (answered && !session.selfGrades?.[id]) {
        throw new Error(`请先完成「${question.topic}」的自评`);
      }
    } else {
      autoCorrect = response !== null && response === question.answer;
      grade = autoCorrect ? 'correct' : 'wrong';
    }

    return {
      question,
      response,
      autoCorrect,
      selfGrade: grade,
      earned: earnedForGrade(grade, autoCorrect),
    };
  });

  const score = items.reduce((sum, item) => sum + item.earned, 0);
  const accuracy = items.length > 0 ? score / items.length : 0;
  const durationSec = Math.min(
    EXAM_DURATION_MS / 1000,
    Math.max(1, Math.round((now - session.startedAt) / 1000)),
  );
  const result: ExamResult = {
    id: uid('exam-result'),
    difficulty: session.difficulty,
    startedAt: session.startedAt,
    finishedAt: now,
    durationSec,
    total: items.length,
    score,
    accuracy,
    items,
  };

  await db.transaction('rw', db.wrongItems, async () => {
    for (const item of items) {
      if (item.earned >= 1) continue;
      const existing = await db.wrongItems.get(item.question.id);
      const wrong = existing
        ? recordWrongAgain(existing, now)
        : createWrongItem(item.question, now);
      await db.wrongItems.put({
        ...wrong,
        source: 'mainline',
        questionSnapshot: item.question,
      });
    }
  });

  await setSetting(EXAM_RESULT_KEY, result);
  await clearExamSession();
  return result;
}
