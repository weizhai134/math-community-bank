import type { CommunityDraft, CommunityQuestion, CommunityXpState } from './communityTypes';
import type { Question } from './types';
import { localDateKey, shuffle } from '../lib/date';

export const COMMUNITY_DAILY_XP_LIMIT = 100;
export const COMMUNITY_XP_PER_CORRECT = 10;
export const COMMUNITY_PRACTICE_SIZE = 5;

export const COMMUNITY_LIMITS = {
  topic: 30,
  stem: 500,
  explanation: 1000,
  nickname: 20,
  answer: 500,
  option: 200,
  optionsMin: 2,
  optionsMax: 6,
} as const;

export type CommunityDraftErrors = Partial<
  Record<'chapter' | 'topic' | 'difficulty' | 'type' | 'stem' | 'explanation' | 'nickname' | 'source' | 'options' | 'answer', string>
>;

/** 题干归一化：全半角统一、去空白、去常见标点、转小写，用于查重。 */
export function normalizeStem(stem: string): string {
  return stem
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。；：、,.;:!?！？"'“”‘’（）()【】[\]{}<>《》]/g, '')
    .toLowerCase();
}

function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `fnv1a-${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/** 题干的 SHA-256（不可用 crypto.subtle 时退回稳定哈希），只用于查重提示。 */
export async function contentHash(stem: string): Promise<string> {
  const normalized = normalizeStem(stem);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return fallbackHash(normalized);
    }
  }
  return fallbackHash(normalized);
}

export function emptyDraft(): CommunityDraft {
  return {
    chapter: 1,
    topic: '',
    difficulty: '基础',
    type: 'choice',
    stem: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ],
    answer: 'A',
    explanation: '',
    source: '原创',
    nickname: '',
  };
}

/** 客户端校验；返回空对象表示通过。长度按去掉首尾空白后的字符数计算。 */
export function validateDraft(draft: CommunityDraft): CommunityDraftErrors {
  const errors: CommunityDraftErrors = {};
  const topic = draft.topic.trim();
  const stem = draft.stem.trim();
  const explanation = draft.explanation.trim();
  const nickname = draft.nickname.trim();

  if (!Number.isInteger(draft.chapter) || draft.chapter < 1 || draft.chapter > 7) {
    errors.chapter = '章节需在 1–7 之间';
  }
  if (topic.length < 2 || topic.length > COMMUNITY_LIMITS.topic) {
    errors.topic = `知识点需为 2–${COMMUNITY_LIMITS.topic} 字`;
  }
  if (stem.length < 5 || stem.length > COMMUNITY_LIMITS.stem) {
    errors.stem = `题干需为 5–${COMMUNITY_LIMITS.stem} 字`;
  }
  if (explanation.length < 5 || explanation.length > COMMUNITY_LIMITS.explanation) {
    errors.explanation = `解析需为 5–${COMMUNITY_LIMITS.explanation} 字`;
  }
  if (nickname.length < 2 || nickname.length > COMMUNITY_LIMITS.nickname) {
    errors.nickname = `昵称需为 2–${COMMUNITY_LIMITS.nickname} 字`;
  }
  if (!['原创', '网络改编'].includes(draft.source)) {
    errors.source = '来源需为「原创」或「网络改编」';
  }

  if (draft.type === 'choice') {
    const filled = draft.options.filter((option) => option.text.trim().length > 0);
    if (filled.length < COMMUNITY_LIMITS.optionsMin || filled.length > COMMUNITY_LIMITS.optionsMax) {
      errors.options = `选择题需 ${COMMUNITY_LIMITS.optionsMin}–${COMMUNITY_LIMITS.optionsMax} 个非空选项`;
    } else if (filled.some((option) => option.text.trim().length > COMMUNITY_LIMITS.option)) {
      errors.options = `单个选项不超过 ${COMMUNITY_LIMITS.option} 字`;
    } else if (!filled.some((option) => option.id === draft.answer)) {
      errors.answer = '请选择一个非空选项作为正确答案';
    }
  } else if (draft.type === 'judge') {
    if (typeof draft.answer !== 'boolean') errors.answer = '请选择「正确」或「错误」';
  } else {
    const answer = typeof draft.answer === 'string' ? draft.answer.trim() : '';
    if (answer.length < 1 || answer.length > COMMUNITY_LIMITS.answer) {
      errors.answer = `参考答案需为 1–${COMMUNITY_LIMITS.answer} 字`;
    }
  }

  return errors;
}

/** 选择题只保留有内容的选项，并重新编号 A/B/C…，避免空选项进入云端。 */
export function normalizeDraft(draft: CommunityDraft): CommunityDraft {
  if (draft.type !== 'choice') {
    return {
      ...draft,
      topic: draft.topic.trim(),
      stem: draft.stem.trim(),
      explanation: draft.explanation.trim(),
      nickname: draft.nickname.trim(),
    };
  }
  const filled = draft.options.filter((option) => option.text.trim().length > 0);
  const options = filled.map((option, index) => ({
    id: String.fromCharCode(65 + index),
    text: option.text.trim(),
  }));
  const oldAnswerIndex = filled.findIndex((option) => option.id === draft.answer);
  return {
    ...draft,
    topic: draft.topic.trim(),
    stem: draft.stem.trim(),
    explanation: draft.explanation.trim(),
    nickname: draft.nickname.trim(),
    options,
    answer: oldAnswerIndex >= 0 ? options[oldAnswerIndex].id : options[0]?.id ?? 'A',
  };
}

/** 社区题 -> 主线题目形状，供 MathText、错题本、SM-2 复用。 */
export function communityToQuestion(question: CommunityQuestion): Question {
  const source = question.source === '网络改编' ? '社区 · 网络改编' : '社区 · 原创';
  return {
    id: `community-${question.id}`,
    chapter: question.chapter,
    topic: question.topic,
    difficulty: question.difficulty,
    type: question.type,
    stem: question.stem,
    options: question.options ?? undefined,
    answer: question.answer,
    explanation: question.explanation,
    source,
  };
}

export function communityAnswerFor(question: CommunityQuestion): string | boolean {
  if (question.type === 'judge') return question.answer === true;
  return typeof question.answer === 'string' ? question.answer : String(question.answer);
}

/** 每日社区 XP 余额。 */
export function remainingCommunityXp(state: CommunityXpState | null | undefined, now = Date.now()): number {
  if (!state || state.date !== localDateKey(now)) return COMMUNITY_DAILY_XP_LIMIT;
  return Math.max(0, COMMUNITY_DAILY_XP_LIMIT - Math.max(0, state.xp));
}

export function nextCommunityXpState(
  state: CommunityXpState | null | undefined,
  gained: number,
  now = Date.now(),
): CommunityXpState {
  const today = localDateKey(now);
  const base = state && state.date === today ? Math.max(0, state.xp) : 0;
  return { date: today, xp: base + Math.max(0, gained) };
}

/** 从候选里随机抽 5 题；不足 5 题时抛错。 */
export function pickPracticeSet<T>(items: T[], size = COMMUNITY_PRACTICE_SIZE): T[] {
  if (items.length < size) {
    throw new Error(`社区题不足 ${size} 道，先去上传几道吧`);
  }
  return shuffle(items).slice(0, size);
}
