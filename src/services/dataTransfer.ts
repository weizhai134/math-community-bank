import { validateBank } from '../data';
import { db } from '../db/db';
import { STORAGE_KEYS, TIER_ORDER } from '../domain/constants';
import type { CommunityCacheRecord } from '../domain/communityTypes';
import type {
  Level,
  LevelAnswer,
  LevelAttempt,
  Profile,
  Question,
  SettingRecord,
  WrongItem,
} from '../domain/types';
import { localDateKey } from '../lib/date';

interface BankPayload {
  format: 'gaoshu-question-bank';
  version: 1;
  exportedAt: string;
  questions: Question[];
  levels: Level[];
}

interface BackupPayload {
  format: 'gaoshu-quest-backup';
  version: 1;
  exportedAt: string;
  data: {
    questions: Question[];
    levels: Level[];
    levelAttempts: LevelAttempt[];
    levelAnswers: LevelAnswer[];
    wrongItems: WrongItem[];
    profile: Profile;
    settings: SettingRecord[];
    /** 第二阶段新增；旧备份没有该字段也能恢复。 */
    communityQuestions?: CommunityCacheRecord[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertLevelFields(levels: Level[]): void {
  for (const level of levels) {
    if (
      !level.id ||
      !level.name ||
      !Number.isFinite(level.targetSec) ||
      level.targetSec <= 0 ||
      !TIER_ORDER.includes(level.tier)
    ) {
      throw new Error(`关卡 ${level.id || '(缺少 id)'} 的字段不完整`);
    }
  }
}

async function assertNoActiveSession(): Promise<void> {
  const [active, pending] = await Promise.all([
    db.settings.get(STORAGE_KEYS.activeRun),
    db.settings.get(STORAGE_KEYS.pendingReview),
  ]);
  if (active || pending) {
    throw new Error('当前还有未完成或待结算的关卡，请先处理后再导入题库');
  }
}

export function buildBankExport(questions: Question[], levels: Level[]): BankPayload {
  return {
    format: 'gaoshu-question-bank',
    version: 1,
    exportedAt: new Date().toISOString(),
    questions,
    levels,
  };
}

export function buildBackup(data: BackupPayload['data']): BackupPayload {
  return {
    format: 'gaoshu-quest-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function loadBackupData(): Promise<BackupPayload['data']> {
  const [questions, levels, levelAttempts, levelAnswers, wrongItems, profile, settings, communityQuestions] =
    await Promise.all([
      db.questions.toArray(),
      db.levels.toArray(),
      db.levelAttempts.toArray(),
      db.levelAnswers.toArray(),
      db.wrongItems.toArray(),
      db.profile.get('me'),
      db.settings.toArray(),
      db.communityQuestions.toArray(),
    ]);
  if (!profile) throw new Error('用户档案不存在，无法导出备份');
  return {
    questions,
    levels,
    levelAttempts,
    levelAnswers,
    wrongItems,
    profile,
    settings,
    communityQuestions,
  };
}

export async function importQuestionBank(raw: unknown): Promise<{ questions: number; levels: number }> {
  if (!isRecord(raw)) throw new Error('题库文件必须是 JSON 对象');
  if (raw.format !== 'gaoshu-question-bank') {
    throw new Error('不是题库文件：format 应为 gaoshu-question-bank');
  }
  if (!Array.isArray(raw.questions) || !Array.isArray(raw.levels)) {
    throw new Error('题库文件缺少 questions 或 levels 数组');
  }
  await assertNoActiveSession();
  const questions = raw.questions as Question[];
  const levels = raw.levels as Level[];
  const result = validateBank(questions, levels);
  if (!result.ok) {
    throw new Error(`题库校验失败：\n${result.errors.slice(0, 8).join('\n')}`);
  }
  assertLevelFields(levels);
  await db.transaction('rw', db.questions, db.levels, async () => {
    await db.questions.clear();
    await db.levels.clear();
    await db.questions.bulkPut(questions);
    await db.levels.bulkPut(levels);
  });
  return { questions: questions.length, levels: levels.length };
}

export async function restoreBackup(raw: unknown): Promise<void> {
  if (!isRecord(raw)) throw new Error('备份文件必须是 JSON 对象');
  if (raw.format !== 'gaoshu-quest-backup' || raw.version !== 1) {
    throw new Error('不是可识别的 V1 备份文件');
  }
  if (!isRecord(raw.data)) throw new Error('备份缺少 data');
  const data = raw.data;
  if (
    !Array.isArray(data.questions) ||
    !Array.isArray(data.levels) ||
    !Array.isArray(data.levelAttempts) ||
    !Array.isArray(data.levelAnswers) ||
    !Array.isArray(data.wrongItems)
  ) {
    throw new Error('备份数据结构不完整');
  }
  const questions = data.questions as Question[];
  const levels = data.levels as Level[];
  const result = validateBank(questions, levels);
  if (!result.ok) {
    throw new Error(`备份中的题库校验失败：\n${result.errors.slice(0, 8).join('\n')}`);
  }
  assertLevelFields(levels);
  if (!isRecord(data.profile) || data.profile.id !== 'me') throw new Error('备份中的用户档案无效');
  const profile = data.profile as unknown as Profile;
  if (!Array.isArray(profile.unlockedChapters) || !Array.isArray(profile.pendingUnlocks)) {
    throw new Error('备份中的解锁状态无效');
  }
  if (!Number.isFinite(profile.totalXp) || !Number.isFinite(profile.streakDays)) {
    throw new Error('备份中的用户档案字段无效');
  }
  const settings = Array.isArray(data.settings) ? (data.settings as SettingRecord[]) : [];
  const levelAttempts = data.levelAttempts as LevelAttempt[];
  const levelAnswers = data.levelAnswers as LevelAnswer[];
  const wrongItems = data.wrongItems as WrongItem[];
  const communityQuestions = Array.isArray(data.communityQuestions)
    ? (data.communityQuestions as CommunityCacheRecord[])
    : [];

  await db.transaction(
    'rw',
    [
      db.questions,
      db.levels,
      db.levelAttempts,
      db.levelAnswers,
      db.wrongItems,
      db.profile,
      db.settings,
      db.communityQuestions,
    ],
    async () => {
      await Promise.all([
        db.questions.clear(),
        db.levels.clear(),
        db.levelAttempts.clear(),
        db.levelAnswers.clear(),
        db.wrongItems.clear(),
        db.profile.clear(),
        db.settings.clear(),
        db.communityQuestions.clear(),
      ]);
      await db.questions.bulkPut(questions);
      await db.levels.bulkPut(levels);
      if (levelAttempts.length > 0) await db.levelAttempts.bulkAdd(levelAttempts);
      if (levelAnswers.length > 0) await db.levelAnswers.bulkAdd(levelAnswers);
      if (wrongItems.length > 0) await db.wrongItems.bulkPut(wrongItems);
      await db.profile.put({ ...profile, updatedAt: Date.now() });
      if (settings.length > 0) await db.settings.bulkPut(settings);
      if (communityQuestions.length > 0) await db.communityQuestions.bulkPut(communityQuestions);
    },
  );
  // 防止备份中的日期格式与当前实现不一致。
  const fresh = await db.profile.get('me');
  if (fresh && fresh.lastActiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(fresh.lastActiveDate)) {
    await db.profile.put({ ...fresh, lastActiveDate: localDateKey() });
  }
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
