import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  PAPER_ACCEPT,
  PAPER_MAX_DESCRIPTION,
  PAPER_MAX_TITLE,
  formatPaperSize,
  formatPaperTime,
  validatePaperFile,
  validatePaperMeta,
  type CommunityPaper,
} from '../domain/papers';
import {
  listCommunityPapers,
  paperDownloadUrl,
  paperUploadHint,
  uploadCommunityPaper,
} from '../services/paperService';
import { Modal } from './Modal';

export function PaperSharePanel({
  configured,
  singleFileDemo,
}: {
  configured: boolean;
  singleFileDemo: boolean;
}): JSX.Element {
  const [papers, setPapers] = useState<CommunityPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<CommunityPaper | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!configured || singleFileDemo) return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listCommunityPapers();
      setPapers(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '试卷列表读取失败');
    } finally {
      setLoading(false);
    }
  }, [configured, singleFileDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleFile = (next: File | null) => {
    setFile(next);
    setUploadError(next ? validatePaperFile(next) : null);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading || !configured || singleFileDemo) return;

    const metaError = validatePaperMeta(title, description);
    if (metaError) {
      setUploadError(metaError);
      return;
    }
    const fileError = validatePaperFile(file);
    if (fileError) {
      setUploadError(fileError);
      return;
    }
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setNotice(null);
    try {
      const created = await uploadCommunityPaper({ title, description, file });
      setPapers((current) => [created, ...current.filter((paper) => paper.id !== created.id)]);
      resetForm();
      setNotice('试卷已发布，所有设备都能看到。');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '试卷上传失败');
    } finally {
      setUploading(false);
    }
  };

  if (singleFileDemo) {
    return (
      <section className="community-banner unavailable">
        <div>
          <strong>单机演示版没有试卷库</strong>
          <p>试卷分享需要联网和 Supabase；主线七章、错题本、公式闪卡与模拟考不受影响。</p>
        </div>
      </section>
    );
  }

  if (!configured) {
    return (
      <section className="community-banner unavailable">
        <div>
          <strong>试卷分享暂不可用</strong>
          <p>缺少 Supabase 配置，无法上传或读取试卷。配置后再回到这里。</p>
        </div>
      </section>
    );
  }

  return (
    <div className="paper-share">
      {notice ? (
        <div className="community-notice" role="status">
          {notice}
        </div>
      ) : null}

      <form className="upload-card paper-upload-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="paper-form-head">
          <div>
            <span className="card-eyebrow">上传试卷 · 公开分享</span>
            <h2>把整张卷子放进来</h2>
            <p>支持 PDF、PNG、JPG/JPEG，单个文件不超过 10MB；上传后对所有设备可见。</p>
          </div>
          <span className="paper-limit-badge">≤ 10MB</span>
        </div>

        <label className="field">
          <span>
            试卷标题 <em className="required-mark">*</em>
          </span>
          <input
            value={title}
            maxLength={PAPER_MAX_TITLE}
            onChange={(event) => {
              setTitle(event.target.value);
              setUploadError(null);
            }}
            placeholder="例：第 3 章 微分中值定理单元卷"
            disabled={uploading}
          />
          <span className="field-hint">
            {title.trim().length}/{PAPER_MAX_TITLE}
          </span>
        </label>

        <label className="field">
          描述（选填）
          <textarea
            value={description}
            maxLength={PAPER_MAX_DESCRIPTION}
            onChange={(event) => {
              setDescription(event.target.value);
              setUploadError(null);
            }}
            rows={3}
            placeholder="范围、难度、是否含答案，写清楚更方便别人挑。"
            disabled={uploading}
          />
          <span className="field-hint">
            {description.trim().length}/{PAPER_MAX_DESCRIPTION}
          </span>
        </label>

        <div className="paper-file-field">
          <span className="paper-file-label">试卷文件</span>
          <div className={`paper-file-picker ${file ? 'has-file' : ''}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept={PAPER_ACCEPT}
              className="paper-file-input"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              disabled={uploading}
            />
            <span className="paper-file-cta">{file ? '重新选择文件' : '选择 PDF / 图片'}</span>
          </div>
          {file ? (
            <div className="paper-selected-file">
              <span className={`paper-file-icon ${file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'}`}>
                {file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}
              </span>
              <span>
                <strong>{file.name}</strong>
                <small>{paperUploadHint(file)}</small>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  handleFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={uploading}
              >
                移除
              </button>
            </div>
          ) : (
            <p className="small-note">仅接受 .pdf / .png / .jpg / .jpeg，单个文件 ≤ 10MB。</p>
          )}
        </div>

        {uploadError ? (
          <div className="form-error" role="alert">
            {uploadError}
          </div>
        ) : null}

        <div className="paper-form-actions">
          <span className="small-note">
            上传即公开；上传者身份取自当前匿名登录或已绑定账号。
          </span>
          <button
            type="submit"
            className="button primary large"
            disabled={uploading || Boolean(uploadError)}
          >
            {uploading ? (
              <>
                <span className="paper-spinner" aria-hidden="true" /> 正在上传…
              </>
            ) : (
              '发布试卷'
            )}
          </button>
        </div>
      </form>

      <div className="paper-list-head">
        <div>
          <span className="card-eyebrow">试卷库 · 按时间倒序</span>
          <h2>同学分享的整卷</h2>
        </div>
        <button className="button ghost" onClick={() => void load()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {loadError ? (
        <div className="community-banner warn">
          <div>
            <strong>试卷列表读取失败</strong>
            <p>{loadError}</p>
            <button className="button ghost small" onClick={() => void load()}>
              重试
            </button>
          </div>
        </div>
      ) : null}

      {loading && papers.length === 0 ? (
        <div className="paper-skeleton-list" aria-label="正在载入试卷">
          {[0, 1].map((index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      ) : null}

      {!loading && !loadError && papers.length === 0 ? (
        <div className="empty-state community-empty">
          <h2>还没有人分享试卷</h2>
          <p>上传第一张卷子，别人就能在这里预览和下载。</p>
        </div>
      ) : null}

      {papers.length > 0 ? (
        <div className="paper-list">
          {papers.map((paper) => (
            <article className="paper-card" key={paper.id}>
              <button
                type="button"
                className="paper-open"
                onClick={() => setPreview(paper)}
                aria-label={`预览 ${paper.title}`}
              >
                <span className={`paper-file-icon ${paper.fileKind}`}>
                  {paper.fileKind === 'pdf' ? 'PDF' : 'IMG'}
                </span>
                <span className="paper-card-main">
                  <strong className="paper-title">{paper.title}</strong>
                  {paper.description ? (
                    <span className="paper-description">{paper.description}</span>
                  ) : null}
                  <span className="paper-meta">
                    <span>{paper.nickname}</span>
                    <span>{formatPaperTime(paper.createdAt)}</span>
                    <span>{formatPaperSize(paper.fileSize)}</span>
                  </span>
                </span>
              </button>
              <div className="paper-card-actions">
                <a
                  className="button ghost small"
                  href={paper.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  新窗口
                </a>
                <a
                  className="button ink small"
                  href={paperDownloadUrl(paper)}
                  download={paper.fileName}
                >
                  下载
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <Modal
        open={Boolean(preview)}
        title={preview?.title ?? '试卷预览'}
        wide
        onClose={() => setPreview(null)}
      >
        {preview ? (
          <div className="paper-preview">
            <div className="paper-preview-meta">
              <span>
                {preview.nickname} · {formatPaperTime(preview.createdAt)} ·{' '}
                {formatPaperSize(preview.fileSize)}
              </span>
              <span className="paper-preview-actions">
                <a
                  className="button ghost small"
                  href={preview.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  新窗口
                </a>
                <a
                  className="button ink small"
                  href={paperDownloadUrl(preview)}
                  download={preview.fileName}
                >
                  下载
                </a>
              </span>
            </div>
            {preview.fileKind === 'pdf' ? (
              <iframe
                className="paper-preview-frame"
                src={preview.fileUrl}
                title={preview.title}
                loading="lazy"
              />
            ) : (
              <img
                className="paper-preview-image"
                src={preview.fileUrl}
                alt={preview.title}
                loading="lazy"
              />
            )}
            <p className="small-note">
              如果预览被浏览器拦截，请用“新窗口”打开或在浏览器中直接查看。
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
