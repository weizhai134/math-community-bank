import type { Level, Question } from '../domain/types';
import { formatDuration } from '../lib/date';

interface EncouragementInput {
  attemptId: string;
  stars: number;
  accuracy: number;
  prevBestStars: number;
  consecutiveClears: number;
  isTrial: boolean;
  attemptOrdinal?: number;
  lastEncouragement?: string;
}

const THREE_STAR = [
  '满星通关。五个题号全部站稳，这一章的核心方法已经能被你独立调用，不是靠蒙对的。',
  '三星到手。正确率和节奏同时达标，说明你对本章典型题型的判断已经形成条件反射。',
  '这轮没有给失分留位置。把这种“先识别题型、再落步骤”的节奏带到下一关去。',
  '满星，而且是干净利落的满星。下一步不是重复刷，而是试着用更短时间复现同样的推理。',
];

const THREE_STAR_REFRESH = [
  '刷新历史最高星数，直接顶到满星。之前卡住的地方这次被补上了，这是一次实打实的进步。',
  '从历史成绩再往上走一档，拿到三星。你不仅做对了，还把用时压进了自己的节奏里。',
  '新纪录：满星。错过的题没有白错，这轮你把它们变成了稳定的得分点。',
];

const TWO_STAR = [
  '两星通关，正确率已经不错。离三星只差一层：要么把最后一处失分补齐，要么把速度再提一档。',
  '稳住了 80% 以上的正确率。接下来值得盯的不是“会不会”，而是“能不能在目标时间内做对”。',
  '两星是个扎实的台阶。把失分题的关键步骤单独重写一遍，下一次就有机会冲满。',
];

const TWO_STAR_REFRESH = [
  '星级刷新，来到两星。你正在把“能做”变成“做稳”，这一步比单纯多刷几题更重要。',
  '历史最高被改写为两星。正确率和时间都在往好的方向走，保持这个节奏。',
  '这次比过去更好，拿到两星。下一步只差把最后一处漏洞补上。',
];

const ONE_STAR = [
  '一星过关，先把关卡拿下。现在最重要的不是速度，而是把错题里的第一个断点找出来。',
  '达到通关线，说明基础骨架在。结算页里的失分题值得逐题重做，不要急着开下一关。',
  '一星也是进度。你已经跨过 60% 的门槛，下一步把“部分对”的题补成完整步骤。',
];

const ONE_STAR_REFRESH = [
  '刷新到一星，先完成通关。把这次比上次多拿到的分记住：那是方法开始成形的信号。',
  '历史最好成绩被刷新。虽然还在通关线附近，但方向是对的，接着补具体知识点。',
];

const ZERO_STAR = [
  '这次没过线，但记录已经留下。先别重开，按结算页的顺序把每道失分题的原因说清楚，再挑战。',
  '本轮没有拿到星。把错误分成“不会”和“会但写错”两类，前者回看知识点，后者重练步骤。',
  '卡住了不丢人，悄悄跳过才可惜。先从错题本里挑一道最基础的题重新建立手感。',
];

const TRIAL = [
  '错题试炼完成。复习的价值不在分数，而在把“下次还会错”变成“这次真的会了”。',
  '这一轮是跟旧错误正面交手。记住刚才卡住的步骤，它比总星数更能决定下一章的表现。',
  '错题试炼结束。到期错题被重新过了一遍，接下来按复习日期回来巩固即可。',
];

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

function choose(pool: string[], seed: number, last?: string): string {
  if (pool.length === 0) return '';
  let index = seed % pool.length;
  for (let i = 0; i < pool.length; i += 1) {
    const candidate = pool[(index + i) % pool.length];
    if (candidate !== last) return candidate;
  }
  return pool[index];
}

export function buildEncouragement(input: EncouragementInput): string {
  const refreshed = input.prevBestStars > 0 && input.stars > input.prevBestStars;
  let pool: string[];
  if (input.isTrial) pool = TRIAL;
  else if (input.stars === 3) pool = refreshed ? THREE_STAR_REFRESH : THREE_STAR;
  else if (input.stars === 2) pool = refreshed ? TWO_STAR_REFRESH : TWO_STAR;
  else if (input.stars === 1) pool = refreshed ? ONE_STAR_REFRESH : ONE_STAR;
  else pool = ZERO_STAR;

  const seed = hash(
    `${input.attemptId}:${input.stars}:${input.accuracy.toFixed(2)}:${input.consecutiveClears}:${
      input.prevBestStars
    }`,
  );
  let text = choose(pool, seed, input.lastEncouragement);

  if (!input.isTrial && input.consecutiveClears >= 2) {
    text += ` 你已经连续 ${input.consecutiveClears} 次通关，别让节奏断在今天。`;
  }
  if (!input.isTrial && (input.attemptOrdinal ?? 1) > 1) {
    text += ` 这是你第 ${input.attemptOrdinal} 次结算本关，比较一下这次与上次的具体差别。`;
  }
  return text;
}

interface SuggestionInput {
  answers: Array<{ question: Question; earned: number }>;
  durationSec: number;
  targetSec: number;
  stars: number;
  isTrial: boolean;
}

function topicSuggestion(question: Question): string {
  if (question.type === 'choice') {
    return `重看「${question.topic}」的判定条件，把正确选项之外的每个干扰项为什么错写出来。`;
  }
  if (question.type === 'judge') {
    return `针对「${question.topic}」补一个反例或条件核对，避免把必要条件当成充分条件。`;
  }
  return `重做「${question.topic}」的完整解答，重点补上关键变形、符号和取等条件。`;
}

export function buildSuggestions(input: SuggestionInput): string[] {
  const wrong = input.answers.filter((answer) => answer.earned < 1);
  const suggestions: string[] = [];
  const seenTopics = new Set<string>();

  for (const answer of wrong) {
    if (seenTopics.has(answer.question.topic)) continue;
    seenTopics.add(answer.question.topic);
    suggestions.push(topicSuggestion(answer.question));
    if (suggestions.length >= 2) break;
  }

  if (input.durationSec > input.targetSec) {
    const over = input.durationSec - input.targetSec;
    suggestions.push(
      `本关超出目标用时 ${formatDuration(over)}。下次先做选择、判断题，把解答题留出整块时间，避免在单个式子上反复停留。`,
    );
  }

  if (input.stars === 3 && wrong.length === 0 && suggestions.length < 2) {
    const first = input.answers[0]?.question;
    suggestions.push(
      first
        ? `用 60 秒口述「${first.topic}」的解题主线，再挑一道同章挑战题验证迁移，而不是重复刷同一关。`
        : '用 60 秒口述本章核心方法，再挑一道同章挑战题验证迁移。',
    );
  }

  if (input.stars === 0) {
    suggestions.push('先不要重开一整关：把 1 道错题的完整解答手写一遍，再回来重试，正确率会更快回升。');
  }

  if (input.isTrial && suggestions.length === 0) {
    suggestions.push('按错题本给出的下次复习日期回来复习，不要在同一天反复刷同一道题。');
  }

  return suggestions.slice(0, 3);
}

export function levelUnlockText(level: Level): string {
  if (level.tier === 'basic') return '本章基础关';
  if (level.tier === 'advanced') return '基础关至少 1 星后解锁';
  return '基础关与进阶关累计至少 3 星后解锁';
}
