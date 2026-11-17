import type { SupabaseClient } from '@supabase/supabase-js';
import { getSetting, setSetting } from '../db/db';
import {
  PAPER_BUCKET,
  PAPER_MAX_DESCRIPTION,
  PAPER_MAX_TITLE,
  PAPER_MIME_TYPES,
  formatPaperSize,
  paperExtension,
  paperKind,
  paperMimeForExtension,
  validatePaperFile,
  validatePaperMeta,
  type CommunityPaper,
  type PaperUploadInput,
} from '../domain/papers';
import { COMMUNITY_NICKNAME_KEY } from './communityService';
import {
  describeCommunityError,
  ensureCommunitySession,
  getCommunityClient,
} from './supabaseClient';

const PAPER_LIST_LIMIT = 60;

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function storagePath(userId: string, file: File): string {
  const extension = paperExtension(file.name) || 'pdf';
  return `${userId}/${Date.now()}-${randomSuffix()}.${extension}`;
}

function storageErrorMessage(error: unknown): string {
  const message = describeCommunityError(error);
  if (/bucket.*not found|bucket not found/i.test(message)) {
    return '找不到 papers 存储桶，请先在 Supabase Storage 中创建它';
  }
  if (/row-level security|not authorized|permission denied|403/i.test(message)) {
    return '没有上传权限：请检查 papers 桶的 Storage INSERT 策略（需允许 authenticated 上传）';
  }
  if (/payload too large|maximum.*size|exceeded.*size/i.test(message)) {
    return '文件大小超过 Supabase 允许的上限';
  }
  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  if (!isRecord(error)) return String(error ?? '');
  return String(error.message ?? error.details ?? '').trim();
}

function errorCode(error: unknown): string {
  if (!isRecord(error)) return '';
  return String(error.code ?? '');
}

function unknownColumn(error: unknown): string | null {
  const message = errorMessage(error);
  const quoted = message.match(/Could not find the '([^']+)' column/i);
  if (quoted?.[1]) return quoted[1];
  const named = message.match(/column "?([a-zA-Z0-9_]+)"? .*does not exist/i);
  return named?.[1] ?? null;
}

function isCheckConstraint(error: unknown): boolean {
  return errorCode(error) === '23514' || /violates check constraint/i.test(errorMessage(error));
}

function isMissingRequired(error: unknown): boolean {
  return errorCode(error) === '23502' || /null value in column/i.test(errorMessage(error));
}

type PaperRow = Record<string, unknown>;

function insertPayload(input: {
  title: string;
  description: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  nickname: string;
  userId: string;
}): PaperRow {
  const kind = paperKind(input.fileName, input.mimeType);
  return {
    title: input.title,
    description: input.description,
    file_url: input.publicUrl,
    file_name: input.fileName,
    file_type: kind,
    file_size: input.fileSize,
    nickname: input.nickname,
    author_id: input.userId,
    created_at: new Date().toISOString(),
    // 兼容常见的自定义列名；服务端不存在的列会在下面自动剔除。
    file_path: input.publicUrl,
    url: input.publicUrl,
    filename: input.fileName,
    mime_type: input.mimeType,
    size: input.fileSize,
    uploader_id: input.userId,
    uploaded_by: input.userId,
    uploader_name: input.nickname,
  };
}

/**
 * community_papers 由用户在 Supabase 后台创建，列名可能是 file_url / url、author_id / uploader_id。
 * 先提交兼容字段；若 PostgREST 返回“列不存在”，剔除该列后重试，避免一套命名差异就整条失败。
 */
async function insertPaperRecord(sb: SupabaseClient, input: PaperRow): Promise<void> {
  const payload: PaperRow = { ...input };
  let checkedConstraint = false;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { error } = await sb.from('community_papers').insert(payload);
    if (!error) return;

    const column = unknownColumn(error);
    if (column && Object.prototype.hasOwnProperty.call(payload, column)) {
      delete payload[column];
      continue;
    }

    if (!checkedConstraint && isCheckConstraint(error)) {
      // 有些表会把 file_type 约束成 MIME；先尝试 MIME，再退回去掉可选元数据。
      checkedConstraint = true;
      if (typeof payload.mime_type === 'string' && payload.mime_type) {
        payload.file_type = payload.mime_type;
      } else {
        for (const key of ['file_type', 'file_size', 'nickname', 'uploader_name', 'size']) {
          delete payload[key];
        }
      }
      continue;
    }

    if (isMissingRequired(error)) {
      throw new Error(
        'community_papers 表缺少必填字段。请确认包含 title、description、file_url、file_name、author_id（或 uploader_id）和 created_at。',
      );
    }

    throw new Error(describeCommunityError(error));
  }

  throw new Error('试卷记录写入失败：community_papers 表结构与前端约定不兼容');
}

function pickString(row: PaperRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const name = decodeURIComponent(path.split('/').pop() ?? '');
    return name || '试卷文件';
  } catch {
    return '试卷文件';
  }
}

function resolvePublicUrl(raw: string): string {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const sb = getCommunityClient();
  const path = raw.replace(/^\/+/, '').replace(new RegExp(`^${PAPER_BUCKET}/`), '');
  return sb?.storage.from(PAPER_BUCKET).getPublicUrl(path).data.publicUrl ?? raw;
}

function normalizePaperRow(row: PaperRow): CommunityPaper | null {
  const rawUrl = pickString(row, ['file_url', 'url', 'file_path', 'public_url', 'download_url']);
  const fileUrl = resolvePublicUrl(rawUrl);
  if (!fileUrl) return null;

  const fileName =
    pickString(row, ['file_name', 'filename', 'original_name', 'name']) || fileNameFromUrl(fileUrl);
  const mimeType = pickString(row, ['mime_type', 'file_type', 'content_type']).toLowerCase();
  const authorId = pickString(row, ['author_id', 'uploader_id', 'uploaded_by', 'user_id', 'owner_id']);
  const rawNickname = pickString(row, [
    'nickname',
    'uploader_name',
    'author_name',
    'uploader',
    'author_nickname',
  ]);
  const nickname = rawNickname || (authorId ? `匿名同学 ${authorId.slice(-4)}` : '匿名同学');
  const rawSize = row.file_size ?? row.size ?? row.bytes;
  const fileSize =
    typeof rawSize === 'number'
      ? rawSize
      : typeof rawSize === 'string' && rawSize.trim() && Number.isFinite(Number(rawSize))
        ? Number(rawSize)
        : null;
  const createdAt = pickString(row, ['created_at', 'uploaded_at', 'inserted_at']);
  const id =
    typeof row.id === 'string' || typeof row.id === 'number'
      ? row.id
      : `${createdAt || fileUrl}-${fileName}`;

  return {
    id,
    title: pickString(row, ['title', 'paper_title']) || fileName,
    description: pickString(row, ['description', 'desc', 'summary', 'note']),
    fileUrl,
    fileName,
    fileKind: paperKind(fileName, mimeType),
    fileSize,
    nickname,
    authorId,
    createdAt,
  };
}

export async function listCommunityPapers(): Promise<CommunityPaper[]> {
  const sb = getCommunityClient();
  if (!sb) throw new Error('未配置 Supabase，无法读取试卷');

  let result = await sb
    .from('community_papers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PAPER_LIST_LIMIT);

  // 有些表用 uploaded_at / inserted_at；没有 created_at 时退回读取后在本地排序。
  if (
    result.error &&
    (unknownColumn(result.error) === 'created_at' ||
      /created_at.*does not exist/i.test(errorMessage(result.error)))
  ) {
    result = await sb.from('community_papers').select('*').limit(PAPER_LIST_LIMIT);
  }

  const { data, error } = result;
  if (error) {
    if (errorCode(error) === 'PGRST205' || /could not find the table/i.test(errorMessage(error))) {
      throw new Error('community_papers 表不存在，请先在 Supabase 中创建它');
    }
    if (errorCode(error) === '42501' || /permission denied/i.test(errorMessage(error))) {
      throw new Error('没有读取试卷的权限，请检查 community_papers 的 SELECT 策略');
    }
    throw new Error(describeCommunityError(error));
  }

  const papers = (data ?? [])
    .map((row) => normalizePaperRow(row as PaperRow))
    .filter((paper): paper is CommunityPaper => Boolean(paper));

  if (papers.some((paper) => paper.createdAt)) {
    papers.sort((a, b) => {
      const left = Date.parse(a.createdAt);
      const right = Date.parse(b.createdAt);
      if (Number.isNaN(left) || Number.isNaN(right)) return 0;
      return right - left;
    });
  }
  return papers;
}

async function resolveNickname(userId: string, provided?: string): Promise<string> {
  const candidate = (provided ?? (await getSetting<string>(COMMUNITY_NICKNAME_KEY)) ?? '').trim();
  if (candidate.length >= 2) return candidate.slice(0, 20);
  return `匿名同学${userId.slice(-4)}`;
}

export async function uploadCommunityPaper(input: PaperUploadInput): Promise<CommunityPaper> {
  const sb = getCommunityClient();
  if (!sb) throw new Error('未配置 Supabase，无法上传试卷');

  const fileError = validatePaperFile(input.file);
  if (fileError) throw new Error(fileError);
  const metaError = validatePaperMeta(input.title, input.description);
  if (metaError) throw new Error(metaError);

  const title = input.title.trim();
  const description = input.description.trim().slice(0, PAPER_MAX_DESCRIPTION);
  if (title.length > PAPER_MAX_TITLE) throw new Error(`标题不能超过 ${PAPER_MAX_TITLE} 字`);

  const session = await ensureCommunitySession();
  const nickname = await resolveNickname(session.userId, input.nickname);
  const path = storagePath(session.userId, input.file);
  const requestedMime = input.file.type.toLowerCase();
  const mimeType = PAPER_MIME_TYPES.has(requestedMime)
    ? input.file.type
    : paperMimeForExtension(paperExtension(input.file.name));

  const { error: uploadError } = await sb.storage.from(PAPER_BUCKET).upload(path, input.file, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) {
    throw new Error(storageErrorMessage(uploadError));
  }

  const publicUrl = sb.storage.from(PAPER_BUCKET).getPublicUrl(path).data.publicUrl;
  try {
    await insertPaperRecord(sb, {
      ...insertPayload({
        title,
        description,
        publicUrl,
        fileName: input.file.name,
        mimeType,
        fileSize: input.file.size,
        nickname,
        userId: session.userId,
      }),
      // 保证新表也有 author_id 默认值可用；如果表用其他列名，会由插入重试剔除。
      author_id: session.userId,
    });
  } catch (error) {
    await sb.storage.from(PAPER_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }

  await setSetting(COMMUNITY_NICKNAME_KEY, nickname);
  return {
    id: path,
    title,
    description,
    fileUrl: publicUrl,
    fileName: input.file.name,
    fileKind: paperKind(input.file.name, mimeType),
    fileSize: input.file.size,
    nickname,
    authorId: session.userId,
    createdAt: new Date().toISOString(),
  };
}

export function paperDownloadUrl(paper: CommunityPaper): string {
  if (!paper.fileUrl) return '';
  const separator = paper.fileUrl.includes('?') ? '&' : '?';
  return `${paper.fileUrl}${separator}download=${encodeURIComponent(paper.fileName || '试卷')}`;
}

export function paperUploadHint(file: File | null): string {
  if (!file) return '支持 PDF、PNG、JPG/JPEG，单个文件不超过 10MB。';
  return `${file.name} · ${formatPaperSize(file.size)} · ${paperKind(file.name, file.type).toUpperCase()}`;
}
