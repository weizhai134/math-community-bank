import Dexie, { type EntityTable } from 'dexie';
import type { CommunityCacheRecord } from '../domain/communityTypes';
import type { FlashcardState } from '../domain/flashcards';
import type {
  Level,
  LevelAnswer,
  LevelAttempt,
  Profile,
  Question,
  SettingRecord,
  WrongItem,
} from '../domain/types';

export class GaoshuDatabase extends Dexie {
  questions!: EntityTable<Question, 'id'>;
  levels!: EntityTable<Level, 'id'>;
  levelAttempts!: EntityTable<LevelAttempt, 'id'>;
  levelAnswers!: EntityTable<LevelAnswer, 'id'>;
  wrongItems!: EntityTable<WrongItem, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  communityQuestions!: EntityTable<CommunityCacheRecord, 'id'>;
  flashcardStates!: EntityTable<FlashcardState, 'id'>;

  constructor() {
    super('gaoshu-quest');
    this.version(1).stores({
      questions: 'id, chapter, type, difficulty, topic',
      levels: 'id, chapter, tier',
      levelAttempts:
        'id, levelId, chapter, finishedAt, status, isTrial, [levelId+finishedAt], [chapter+status]',
      levelAnswers: 'id, attemptId, questionId, chapter, [attemptId+order]',
      wrongItems:
        'id, questionId, chapter, type, nextReviewAt, archived, [chapter+archived]',
      profile: 'id',
      settings: 'key',
    });
    // 第二阶段：只新增社区题缓存表，主线表结构不变。
    this.version(2).stores({
      communityQuestions: 'id, chapter, difficulty, type, fetchedAt',
    });
    // 第三阶段：公式闪卡的本地 SM-2 状态；只加表，不改已有表。
    this.version(3).stores({
      flashcardStates: 'id, nextReviewAt',
    });
  }
}

export const db = new GaoshuDatabase();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const record = await db.settings.get(key);
  return record?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get('me');
}
