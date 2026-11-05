import type { Level, Question } from '../domain/types';
import { CHAPTERS, DIFFICULTY_ORDER, LEVEL_QUESTIONS, TIER_ORDER } from '../domain/constants';
import { questions as seedQuestions } from './questions';
import { LEVEL_SEEDS } from './levels';

export { questions } from './questions';
export { LEVEL_SEEDS } from './levels';
export { CHAPTERS } from '../domain/constants';

const VALID_SOURCES = ['原创', '网络改编'] as const;
const VALID_TYPES = ['choice', 'judge', 'solution'] as const;

export function validateBank(
  questions: Question[],
  levels: Level[],
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (questions.length !== 105) errors.push(`题量应为 105，当前为 ${questions.length}`);
  if (levels.length !== 21) errors.push(`关卡数应为 21，当前为 ${levels.length}`);

  const ids = new Set<string>();
  for (const question of questions) {
    if (!question.id) errors.push('存在缺少 id 的题目');
    if (ids.has(question.id)) errors.push(`题目 id 重复：${question.id}`);
    ids.add(question.id);
    if (!CHAPTERS.some((chapter) => chapter.id === question.chapter)) {
      errors.push(`题目 ${question.id} 的章节不在上册七章内`);
    }
    if (!DIFFICULTY_ORDER.includes(question.difficulty)) {
      errors.push(`题目 ${question.id} 难度不合法`);
    }
    if (!VALID_TYPES.includes(question.type)) {
      errors.push(`题目 ${question.id} 题型不合法`);
    }
    for (const field of ['id', 'topic', 'source', 'stem', 'explanation'] as const) {
      if (typeof question[field] !== 'string' || question[field].trim().length === 0) {
        errors.push(`题目 ${question.id} 的 ${field} 不能为空`);
      }
    }
    if (!VALID_SOURCES.includes(question.source as (typeof VALID_SOURCES)[number])) {
      errors.push(`题目 ${question.id} 的 source 必须为 原创 或 网络改编`);
    }
    if (question.type === 'choice') {
      if (!question.options || question.options.length < 2) {
        errors.push(`选择题 ${question.id} 至少需要 2 个选项`);
      } else {
        const optionIds = new Set<string>();
        for (const option of question.options) {
          if (!option.id || !option.text) {
            errors.push(`选择题 ${question.id} 存在空选项字段`);
          }
          if (optionIds.has(option.id)) {
            errors.push(`选择题 ${question.id} 的选项 id 重复：${option.id}`);
          }
          optionIds.add(option.id);
        }
        if (typeof question.answer !== 'string' || !optionIds.has(question.answer)) {
          errors.push(`选择题 ${question.id} 的答案不是有效选项 id`);
        }
      }
    }
    if (question.type === 'judge' && typeof question.answer !== 'boolean') {
      errors.push(`判断题 ${question.id} 的答案必须为布尔值`);
    }
    if (question.type === 'solution' && typeof question.answer !== 'string') {
      errors.push(`解答题 ${question.id} 的答案必须为文本`);
    }
  }

  for (const chapter of CHAPTERS) {
    const chapterQuestions = questions.filter((question) => question.chapter === chapter.id);
    if (chapterQuestions.length !== 15) {
      errors.push(`第 ${chapter.id} 章题量应为 15，当前为 ${chapterQuestions.length}`);
    }
    for (const type of VALID_TYPES) {
      if (!chapterQuestions.some((question) => question.type === type)) {
        errors.push(`第 ${chapter.id} 章缺少 ${type} 题型`);
      }
    }
    for (const difficulty of DIFFICULTY_ORDER) {
      if (!chapterQuestions.some((question) => question.difficulty === difficulty)) {
        errors.push(`第 ${chapter.id} 章缺少「${difficulty}」难度`);
      }
    }
  }

  const levelIds = new Set<string>();
  for (const chapter of CHAPTERS) {
    const chapterLevels = levels.filter((item) => item.chapter === chapter.id);
    if (chapterLevels.length !== 3) errors.push(`第 ${chapter.id} 章关卡数应为 3`);
    for (const tier of TIER_ORDER) {
      if (!chapterLevels.some((level) => level.tier === tier)) {
        errors.push(`第 ${chapter.id} 章缺少 ${tier} 关卡`);
      }
    }
    for (const level of chapterLevels) {
      if (levelIds.has(level.id)) errors.push(`关卡 id 重复：${level.id}`);
      levelIds.add(level.id);
      if (!level.id || !level.name || !level.brief) {
        errors.push(`关卡 ${level.id || '(缺少 id)'} 缺少必填字段`);
      }
      if (!Number.isFinite(level.targetSec) || level.targetSec <= 0) {
        errors.push(`关卡 ${level.id} 的目标用时不合法`);
      }
      if (level.questionIds.length !== LEVEL_QUESTIONS) {
        errors.push(`关卡 ${level.id} 必须固定 5 题`);
      }
      if (new Set(level.questionIds).size !== level.questionIds.length) {
        errors.push(`关卡 ${level.id} 存在重复题号`);
      }
      for (const questionId of level.questionIds) {
        const question = questions.find((item) => item.id === questionId);
        if (!question) errors.push(`关卡 ${level.id} 引用了不存在的题目 ${questionId}`);
        else if (question.chapter !== level.chapter) {
          errors.push(`关卡 ${level.id} 引用了其他章节的题目 ${questionId}`);
        }
      }
      if (level.tier === 'boss') {
        const challengeCount = level.questionIds.filter(
          (id) => questions.find((item) => item.id === id)?.difficulty === '挑战',
        ).length;
        if (challengeCount < 2) errors.push(`Boss 关 ${level.id} 至少需要 2 道挑战题`);
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function assertSeedIntegrity(): void {
  const result = validateBank(seedQuestions, LEVEL_SEEDS);
  if (!result.ok) {
    throw new Error(`内置题库校验失败：\n${result.errors.join('\n')}`);
  }
}
