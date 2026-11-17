export type PaperKind = 'pdf' | 'image';

/** `community_papers` 的前端归一化模型。 */
export interface CommunityPaper {
  id: string | number;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileKind: PaperKind;
  fileSize: number | null;
  nickname: string;
  authorId: string;
  createdAt: string;
}

export interface PaperUploadInput {
  title: string;
  description: string;
  file: File;
  nickname?: string;
}

export const PAPER_BUCKET = 'papers';
export const PAPER_MAX_BYTES = 10 * 1024 * 1024;
export const PAPER_MAX_TITLE = 100;
export const PAPER_MAX_DESCRIPTION = 500;
export const PAPER_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

const PAPER_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg']);
export const PAPER_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

export function paperExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

export function paperKind(fileName: string, mimeType = ''): PaperKind {
  if (mimeType === 'application/pdf' || paperExtension(fileName) === 'pdf') return 'pdf';
  return 'image';
}

export function paperMimeForExtension(extension: string): string {
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  return 'image/jpeg';
}

/** 返回第一条错误；通过时返回 null。 */
export function validatePaperFile(file: File | null): string | null {
  if (!file) return '请选择要上传的试卷文件';
  const extension = paperExtension(file.name);
  if (!PAPER_EXTENSIONS.has(extension)) {
    return '仅支持 PDF、PNG、JPG/JPEG 文件';
  }
  const fileType = file.type.toLowerCase();
  if (fileType && fileType !== 'application/octet-stream' && !PAPER_MIME_TYPES.has(fileType)) {
    return '文件类型与扩展名不匹配，请选择 PDF、PNG 或 JPG/JPEG';
  }
  if (file.size <= 0) return '文件为空，请重新选择';
  if (file.size > PAPER_MAX_BYTES) {
    return `文件不能超过 10MB（当前 ${formatPaperSize(file.size)}）`;
  }
  return null;
}

export function validatePaperMeta(title: string, description: string): string | null {
  if (!title.trim()) return '请填写试卷标题';
  if (title.trim().length > PAPER_MAX_TITLE) return `标题不能超过 ${PAPER_MAX_TITLE} 字`;
  if (description.trim().length > PAPER_MAX_DESCRIPTION) {
    return `描述不能超过 ${PAPER_MAX_DESCRIPTION} 字`;
  }
  return null;
}

export function formatPaperSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '大小未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPaperTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
