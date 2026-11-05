import { db, getSetting, setSetting } from '../db/db';
import {
  COMMUNITY_DAILY_XP_LIMIT,
  COMMUNITY_XP_PER_CORRECT,
  communityAnswerFor,
  communityToQuestion,
  contentHash,
  nextCommunityXpState,
  normalizeDraft,
  pickPracticeSet,
  remainingCommunityXp,
  validateDraft,
  type CommunityDraftErrors,
} from '../domain/community';
import type {
  CommunityDraft,
  CommunityFilters,
  CommunityQuestion,
  CommunityResult,
  CommunityResultItem,
  CommunityRun,
  CommunityRunAnswer,
  CommunitySessionInfo,
  CommunityXpState,
} from '../domain/communityTypes';
import type { Grade, Question } from '../domain/types';
import { earnedForGrade } from '../domain/rules';
import { createWrongItem, recordWrongAgain } from '../domain/sm2';
import { clamp, localDateKey, shuffle, uid } from '../lib/date';
import {
  CommunityUnavailableError,
  describeCommunityError,
  ensureCommunitySession,
  getCommunityClient,
  isOfflineError,
} from './supabaseClient';

export const COMMUNITY_RUN_KEY = 'communityRun';
export const COMMUNITY_RESULT_KEY = 'communityResult';
export const COMMUNITY_XP_KEY = 'communityXp';
export const COMMUNITY_NICKNAME_KEY = 'communityNickname';

export interface CommunityPageResult {
  items: CommunityQuestion[];
  total: number;
  offline: boolean;
  errorMessage?: string;
  cachedAt?: number;
}

export class CommunityValidationError extends Error {
  readonly errors: CommunityDraftErrors;

  constructor(errors: CommunityDraftErrors) {
    super('提交内容校验未通过');
    this.name = 'CommunityValidationError';
    this.errors = errors;
  }
}

function matchesFilters(question: CommunityQuestion, filters: CommunityFilters): boolean {
  if (filters.chapter !== null && question.chapter !== filters.chapter) return false;
  if (filters.difficulty !== null && question.difficulty !== filters.difficulty) return false;
  if (filters.type !== null && question.type !== filters.type) return false;
  return true;
}

function sortNewest(items: CommunityQuestion[]): CommunityQuestion[] {
  return [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

export async function cacheCommunityQuestions(items: CommunityQuestion[]): Promise<void> {
  if (items.length === 0) return;
  const fetchedAt = Date.now();
  await db.communityQuestions.bulkPut(
    items.map((item) => ({ id: item.id, payload: item, fetchedAt })),
  );
}

export async function readCachedCommunityQuestions(
  filters: CommunityFilters,
): Promise<{ items: CommunityQuestion[]; cachedAt: number | null }> {
  const records = await db.communityQuestions.toArray();
  const visible = records.filter(
    (record) => record.payload.status === 'visible' && matchesFilters(record.payload, filters),
  );
  const cachedAt = records.reduce((latest, record) => Math.max(latest, record.fetchedAt), 0);
  return {
    items: sortNewest(visible.map((record) => record.payload)),
    cachedAt: cachedAt > 0 ? cachedAt : null,
  };
}

/** 在线分页；网络失败时回退缓存，并标记 offline。 */
export async function fetchCommunityPage(
  filters: CommunityFilters,
  page: number,
  pageSize = 8,
): Promise<CommunityPageResult> {
  const sb = getCommunityClient();
  if (!sb) {
    const cached = await readCachedCommunityQuestions(filters);
    return {
      items: cached.items,
      total: cached.items.length,
      offline: true,
      cachedAt: cached.cachedAt ?? undefined,
      errorMessage: '未配置 Supabase，仅显示已缓存题目',
    };
  }

  try {
    let query = sb
      .from('community_questions')
      .select('*', { count: 'exact' })
      .eq('status', 'visible');
    if (filters.chapter !== null) query = query.eq('chapter', filters.chapter);
    if (filters.difficulty !== null) query = query.eq('difficulty', filters.difficulty);
    if (filters.type !== null) query = query.eq('type', filters.type);

    const from = page * pageSize;
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const items = (data ?? []) as CommunityQuestion[];
    await cacheCommunityQuestions(items);
    return { items, total: count ?? items.length, offline: false };
  } catch (error) {
    const cached = await readCachedCommunityQuestions(filters);
    return {
      items: cached.items,
      total: cached.items.length,
      offline: true,
      cachedAt: cached.cachedAt ?? undefined,
      errorMessage: isOfflineError(error)
        ? '离线模式，仅显示已缓存题目'
        : describeCommunityError(error),
    };
  }
}

/** 随机抽 5 题练习：优先在线取一批再洗牌；失败时用缓存。 */
export async function fetchPracticeQuestions(filters: CommunityFilters): Promise<CommunityQuestion[]> {
  const sb = getCommunityClient();
  if (sb) {
    try {
      let query = sb
        .from('community_questions')
        .select('*')
        .eq('status', 'visible');
      if (filters.chapter !== null) query = query.eq('chapter', filters.chapter);
      if (filters.difficulty !== null) query = query.eq('difficulty', filters.difficulty);
      if (filters.type !== null) query = query.eq('type', filters.type);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const items = (data ?? []) as CommunityQuestion[];
      await cacheCommunityQuestions(items);
      if (items.length >= 5) return pickPracticeSet(items);
    } catch {
      // 落到缓存
    }
  }
  const cached = await readCachedCommunityQuestions(filters);
  return pickPracticeSet(cached.items);
}

export async function findDuplicateQuestion(hash: string): Promise<number | null> {
  const sb = getCommunityClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('community_questions')
      .select('id')
      .eq('content_hash', hash)
      .eq('status', 'visible')
      .limit(1);
    if (error) throw error;
    const row = (data ?? [])[0] as { id: number } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export interface UploadResult {
  question: CommunityQuestion;
  duplicateId: number | null;
}

export async function uploadCommunityQuestion(
  draft: CommunityDraft,
  session: CommunitySessionInfo,
): Promise<UploadResult> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法上传', 'unconfigured');

  const normalized = normalizeDraft(draft);
  const errors = validateDraft(normalized);
  if (Object.keys(errors).length > 0) throw new CommunityValidationError(errors);

  const hash = await contentHash(normalized.stem);
  const duplicateId = await findDuplicateQuestion(hash);

  const payload = {
    chapter: normalized.chapter,
    topic: normalized.topic,
    difficulty: normalized.difficulty,
    type: normalized.type,
    stem: normalized.stem,
    options: normalized.type === 'choice' ? normalized.options : null,
    answer: normalized.answer,
    explanation: normalized.explanation,
    source: normalized.source,
    nickname: normalized.nickname,
    author_id: session.userId,
    status: 'visible' as const,
    content_hash: hash,
  };

  const { data, error } = await sb.from('community_questions').insert(payload).select('*').single();
  if (error) throw new Error(describeCommunityError(error));

  const question = data as CommunityQuestion;
  await cacheCommunityQuestions([question]);
  await setSetting(COMMUNITY_NICKNAME_KEY, normalized.nickname);
  return { question, duplicateId };
}

export async function reportCommunityQuestion(questionId: number, session: CommunitySessionInfo): Promise<void> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法举报', 'unconfigured');
  const { error } = await sb.from('community_reports').insert({
    question_id: questionId,
    reporter_id: session.userId,
  });
  if (error) {
    if (error.code === '23505') throw new Error('你已经举报过这道题');
    throw new Error(describeCommunityError(error));
  }
}

export async function deleteCommunityQuestion(questionId: number, session: CommunitySessionInfo): Promise<void> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法删除', 'unconfigured');
  const { data, error } = await sb
    .from('community_questions')
    .delete()
    .eq('id', questionId)
    .eq('author_id', session.userId)
    .select('id');
  if (error) throw new Error(describeCommunityError(error));
  if (!data || data.length === 0) {
    throw new Error('删除失败：题目不存在，或你不是作者');
  }
  await db.communityQuestions.delete(questionId);
}

export async function listMyCommunityQuestions(session: CommunitySessionInfo): Promise<CommunityQuestion[]> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法读取投稿', 'unconfigured');
  const { data, error } = await sb
    .from('community_questions')
    .select('*')
    .eq('author_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(describeCommunityError(error));
  return (data ?? []) as CommunityQuestion[];
}

export async function upgradeToEmail(email: string, password: string): Promise<string> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法升级账号', 'unconfigured');
  const cleanEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('邮箱格式不正确');
  if (password.length < 6) throw new Error('密码至少 6 位');
  const { data, error } = await sb.auth.updateUser({ email: cleanEmail, password });
  if (error) throw new Error(describeCommunityError(error));
  if (data.user?.email && data.user.email !== cleanEmail) {
    return '升级请求已提交，请查收确认邮件后生效；确认前仍是匿名身份。';
  }
  return '已绑定邮箱，之后可用该邮箱在新设备登录并管理投稿。';
}

export async function linkGoogleIdentity(): Promise<void> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法绑定 Google', 'unconfigured');
  const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
  const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
  if (error) throw new Error(describeCommunityError(error));
}

export async function signInWithPassword(email: string, password: string): Promise<string> {
  const sb = getCommunityClient();
  if (!sb) throw new CommunityUnavailableError('未配置 Supabase，无法登录', 'unconfigured');
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(describeCommunityError(error));
  return '已登录，可在本设备管理此前投稿。';
}

export async function signOutCommunity(): Promise<void> {
  const sb = getCommunityClient();
  if (!sb) return;
  await sb.auth.signOut();
}

// ---------- 社区练习 ----------

export async function loadCommunityRun(): Promise<CommunityRun | null> {
  return (await getSetting<CommunityRun>(COMMUNITY_RUN_KEY)) ?? null;
}

export async function saveCommunityRun(run: CommunityRun): Promise<void> {
  await setSetting(COMMUNITY_RUN_KEY, run);
}

export async function clearCommunityRun(): Promise<void> {
  await db.settings.delete(COMMUNITY_RUN_KEY);
}

export async function startCommunityRun(questions: CommunityQuestion[]): Promise<CommunityRun> {
  const picked = pickPracticeSet(questions);
  const optionOrders: Record<string, string[]> = {};
  const answers: Record<string, CommunityRunAnswer> = {};
  for (const question of picked) {
    if (question.type === 'choice' && question.options && question.options.length > 0) {
      const ids = question.options.map((option) => option.id);
      let order = shuffle(ids);
      if (order.length > 1 && order.every((id, index) => id === ids[index])) {
        order = [...order.slice(1), order[0]];
      }
      optionOrders[String(question.id)] = order;
    }
    answers[String(question.id)] = {
      response: null,
      submitted: false,
      timeSpentSec: 0,
      autoCorrect: null,
      selfGrade: null,
    };
  }
  const now = Date.now();
  const run: CommunityRun = {
    id: uid('community-run'),
    createdAt: now,
    questionIds: picked.map((question) => question.id),
    questions: Object.fromEntries(picked.map((question) => [String(question.id), question])),
    optionOrders,
    answers,
    index: 0,
    startedAt: now,
    questionStartedAt: now,
    selfGrading: false,
  };
  await saveCommunityRun(run);
  return run;
}

export function currentCommunityQuestion(run: CommunityRun): CommunityQuestion {
  const id = run.questionIds[run.index];
  const question = run.questions[String(id)];
  if (!question) throw new Error('社区练习题目缺失，请重新开始');
  return question;
}

export function applyCommunityAnswer(
  run: CommunityRun,
  response: string | boolean,
  now = Date.now(),
): CommunityRun {
  const question = currentCommunityQuestion(run);
  const key = String(question.id);
  const existing = run.answers[key];
  if (!existing || existing.submitted) return run;
  const timeSpentSec = clamp(Math.round((now - run.questionStartedAt) / 1000), 1, 3600);
  let autoCorrect: boolean | null = null;
  if (question.type !== 'solution') {
    autoCorrect = response === communityAnswerFor(question);
  }
  return {
    ...run,
    answers: {
      ...run.answers,
      [key]: { ...existing, response, submitted: true, timeSpentSec, autoCorrect },
    },
  };
}

export function advanceCommunityRun(run: CommunityRun, now = Date.now()): CommunityRun {
  if (run.index >= run.questionIds.length - 1) return { ...run, selfGrading: true };
  return {
    ...run,
    index: run.index + 1,
    questionStartedAt: now,
  };
}

export function setCommunitySelfGrade(run: CommunityRun, questionId: number, grade: Grade): CommunityRun {
  const key = String(questionId);
  const existing = run.answers[key];
  if (!existing) return run;
  return {
    ...run,
    answers: { ...run.answers, [key]: { ...existing, selfGrade: grade } },
  };
}

export function communityRunNeedsSelfGrade(run: CommunityRun): CommunityQuestion[] {
  return run.questionIds
    .map((id) => run.questions[String(id)])
    .filter(
      (question): question is CommunityQuestion =>
        Boolean(question) && question.type === 'solution' && run.answers[String(question.id)]?.submitted,
    );
}

function gradeForAnswer(
  question: CommunityQuestion,
  answer: CommunityRunAnswer | undefined,
): { earned: number; grade: Grade | null; autoCorrect: boolean | null } {
  if (!answer || !answer.submitted) {
    return { earned: 0, grade: question.type === 'solution' ? null : 'wrong', autoCorrect: false };
  }
  if (question.type === 'solution') {
    const grade = answer.selfGrade ?? 'wrong';
    return { earned: earnedForGrade(grade), grade, autoCorrect: null };
  }
  const autoCorrect = Boolean(answer.autoCorrect);
  const grade = autoCorrect ? 'correct' : 'wrong';
  return { earned: earnedForGrade(grade, autoCorrect), grade, autoCorrect };
}

export async function loadCommunityResult(): Promise<CommunityResult | null> {
  return (await getSetting<CommunityResult>(COMMUNITY_RESULT_KEY)) ?? null;
}

export async function finishCommunityRun(): Promise<CommunityResult> {
  const run = await loadCommunityRun();
  if (!run) throw new Error('没有进行中的社区练习');

  const now = Date.now();
  const items: CommunityResultItem[] = run.questionIds.map((id) => {
    const question = run.questions[String(id)];
    const answer = run.answers[String(id)];
    const graded = gradeForAnswer(question, answer);
    return {
      questionId: id,
      question,
      response: answer?.response ?? null,
      earned: graded.earned,
      selfGrade: graded.grade,
      autoCorrect: graded.autoCorrect,
      timeSpentSec: answer?.timeSpentSec ?? 0,
      optionsOrder: run.optionOrders[String(id)] ?? [],
    };
  });

  const total = items.length;
  const correct = items.filter((item) => item.earned === 1).length;
  const accuracy = total > 0 ? items.reduce((sum, item) => sum + item.earned, 0) / total : 0;
  const durationSec = items.reduce((sum, item) => sum + item.timeSpentSec, 0);

  const daily = (await getSetting<CommunityXpState>(COMMUNITY_XP_KEY)) ?? null;
  const remaining = remainingCommunityXp(daily, now);
  const wanted = correct * COMMUNITY_XP_PER_CORRECT;
  const xpEarned = Math.min(wanted, remaining);
  const xpCapped = xpEarned < wanted;

  const profile = await db.profile.get('me');
  if (profile) {
    await db.profile.put({
      ...profile,
      totalXp: profile.totalXp + xpEarned,
      updatedAt: now,
    });
  }
  await setSetting(COMMUNITY_XP_KEY, nextCommunityXpState(daily, xpEarned, now));

  for (const item of items) {
    if (item.earned >= 1) continue;
    const id = `community-${item.questionId}`;
    const mapped: Question = communityToQuestion(item.question);
    const existing = await db.wrongItems.get(id);
    const base = existing ?? createWrongItem(mapped, now);
    const updated = existing ? recordWrongAgain(existing, now) : base;
    await db.wrongItems.put({
      ...updated,
      source: 'community',
      communityId: item.questionId,
      questionSnapshot: mapped,
    });
  }

  const result: CommunityResult = {
    id: uid('community-result'),
    finishedAt: now,
    durationSec,
    total,
    correct,
    accuracy,
    xpEarned,
    xpCapped,
    dailyXpBefore: daily && daily.date === localDateKey(now) ? daily.xp : 0,
    dailyLimit: COMMUNITY_DAILY_XP_LIMIT,
    items,
  };
  await setSetting(COMMUNITY_RESULT_KEY, result);
  await clearCommunityRun();
  return result;
}

export async function todayCommunityXp(): Promise<number> {
  const daily = await getSetting<CommunityXpState>(COMMUNITY_XP_KEY);
  if (!daily || daily.date !== localDateKey()) return 0;
  return Math.max(0, daily.xp);
}

export { ensureCommunitySession };
