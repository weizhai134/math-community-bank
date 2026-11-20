import {
  EXAM_DIFFICULTY_LABEL,
  type ExamResult,
} from './exam';
import type { LevelAttempt, Profile } from './types';
import { rankForXp } from './rules';
import { TIER_LABEL } from './constants';

export type ShareCardKind = 'level' | 'exam';

export interface ShareCardData {
  kind: ShareCardKind;
  /** 卡片中部的大标题。 */
  title: string;
  /** 标题下的一行说明。 */
  subtitle: string;
  rankTitle: string;
  rankEpithet: string;
  /** 普通关卡有星级与 XP；模拟考没有。 */
  stars?: number;
  xp?: number;
  /** 模拟考有卷面得分；普通关卡不展示。 */
  score?: number;
  total?: number;
  accuracy: number;
  durationSec: number;
  quote: string;
  dateLabel: string;
}

/** 内置 10 句高数骚话；每次生成战报随机取一句。 */
export const SHARE_QUOTES = [
  '高数虐我千百遍，我待高数如初恋。',
  '这套卷子，就这？',
  '极限求不出，不如回老家种树。',
  '积分积到天亮，结果还是负号。',
  '拉格朗日说这里有个 ξ，我找了半天没找到。',
  '导数会了，人生就顺了（大概）。',
  '今天不刷题，明天两行泪。',
  '函数有界，我的努力无界。',
  '中值定理都找到了，对象还没找到。',
  '别问，问就是洛必达。',
] as const;

function quoteFor(seed: number): string {
  return SHARE_QUOTES[Math.abs(seed) % SHARE_QUOTES.length];
}

function dateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function buildLevelShareData(attempt: LevelAttempt, profile: Profile): ShareCardData {
  const rank = rankForXp(profile.totalXp);
  const category = attempt.isTrial
    ? attempt.levelId.startsWith('targeted-')
      ? '靶向突破'
      : '错题试炼'
    : `${TIER_LABEL[attempt.tier]} · 第 ${attempt.chapter} 章`;
  return {
    kind: 'level',
    title: attempt.levelName,
    subtitle: category,
    rankTitle: rank.title,
    rankEpithet: rank.epithet,
    stars: attempt.stars,
    xp: attempt.xpEarned,
    accuracy: attempt.accuracy,
    durationSec: attempt.durationSec,
    quote: quoteFor(attempt.finishedAt),
    dateLabel: dateLabel(attempt.finishedAt),
  };
}

export function buildExamShareData(result: ExamResult, profile: Profile): ShareCardData {
  const rank = rankForXp(profile.totalXp);
  return {
    kind: 'exam',
    title: `期末预测 · ${EXAM_DIFFICULTY_LABEL[result.difficulty]}`,
    subtitle: `高数上册 · ${result.total} 题完整模拟`,
    rankTitle: rank.title,
    rankEpithet: rank.epithet,
    score: result.score,
    total: result.total,
    accuracy: result.accuracy,
    durationSec: result.durationSec,
    quote: quoteFor(result.finishedAt),
    dateLabel: dateLabel(result.finishedAt),
  };
}
