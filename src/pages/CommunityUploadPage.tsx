import { useEffect, useState } from 'react';
import { CHAPTERS } from '../domain/constants';
import {
  COMMUNITY_LIMITS,
  emptyDraft,
  type CommunityDraftErrors,
} from '../domain/community';
import type { CommunityDraft, CommunityQuestion } from '../domain/communityTypes';
import type { Difficulty, QuestionType } from '../domain/types';
import { getSetting } from '../db/db';
import { COMMUNITY_NICKNAME_KEY, CommunityValidationError } from '../services/communityService';
import { navigate } from '../lib/router';
import { useCommunityStore } from '../store/useCommunityStore';

const DIFFICULTIES: Difficulty[] = ['基础', '进阶', '挑战'];
const TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: 'choice', label: '选择题' },
  { value: 'judge', label: '判断题' },
  { value: 'solution', label: '解答题' },
];

export function CommunityUploadPage(): JSX.Element {
  const configured = useCommunityStore((state) => state.configured);
  const session = useCommunityStore((state) => state.session);
  const sessionError = useCommunityStore((state) => state.sessionError);
  const upload = useCommunityStore((state) => state.upload);

  const [draft, setDraft] = useState<CommunityDraft>(() => emptyDraft());
  const [errors, setErrors] = useState<CommunityDraftErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ question: CommunityQuestion; duplicateId: number | null } | null>(
    null,
  );
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    void getSetting<string>(COMMUNITY_NICKNAME_KEY).then((nickname) => {
      if (nickname) setDraft((current) => (current.nickname ? current : { ...current, nickname }));
    });
  }, []);

  const update = <K extends keyof CommunityDraft>(key: K, value: CommunityDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setGlobalError(null);
  };

  const changeType = (type: QuestionType) => {
    setDraft((current) => {
      if (type === 'judge') return { ...current, type, answer: true };
      if (type === 'solution') return { ...current, type, answer: '' };
      const firstOption = current.options.find((option) => option.text.trim().length > 0);
      return { ...current, type, answer: firstOption?.id ?? 'A' };
    });
    setErrors({});
  };

  const updateOption = (index: number, text: string) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text } : option,
      ),
    }));
    setErrors((current) => ({ ...current, options: undefined }));
  };

  const addOption = () => {
    setDraft((current) => {
      if (current.options.length >= COMMUNITY_LIMITS.optionsMax) return current;
      return {
        ...current,
        options: [
          ...current.options,
          { id: String.fromCharCode(65 + current.options.length), text: '' },
        ],
      };
    });
  };

  const removeOption = (index: number) => {
    setDraft((current) => {
      if (current.options.length <= COMMUNITY_LIMITS.optionsMin) return current;
      const removed = current.options[index];
      const options = current.options
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({ ...option, id: String.fromCharCode(65 + optionIndex) }));
      const answer =
        current.answer === removed.id ? options[0]?.id ?? 'A' : current.answer;
      return { ...current, options, answer };
    });
    setErrors((current) => ({ ...current, options: undefined, answer: undefined }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrors({});
    setGlobalError(null);
    try {
      const result = await upload(draft);
      setSuccess(result);
    } catch (error) {
      if (error instanceof CommunityValidationError) {
        setErrors(error.errors);
        setGlobalError('有几处需要修改，见下方红色提示。');
      } else {
        setGlobalError(error instanceof Error ? error.message : '上传失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!configured) {
    return (
      <div className="page community-page">
        <button className="back-link" onClick={() => navigate('/community')}>
          ← 社区题库
        </button>
        <div className="empty-state">
          <h1>社区功能暂不可用</h1>
          <p>
            缺少 Supabase 配置，上传通道未启用。主线闯关和错题本不受影响。配置步骤见{' '}
            <code>docs/supabase/README.md</code>。
          </p>
          <button className="button primary" onClick={() => navigate('/community')}>
            返回社区题库
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page community-page">
        <section className="community-success">
          <span className="card-eyebrow">提交成功 · 先发后审</span>
          <h1>题目已对所有设备可见</h1>
          <p>
            第 {success.question.chapter} 章 · {success.question.topic} · {success.question.nickname}
          </p>
          {success.duplicateId ? (
            <div className="community-banner warn">
              <p>
                检测到相同题干的题目（#{success.duplicateId}）。本次仍按你的要求提交，未阻断；如属误发，可在“我的投稿”删除。
              </p>
            </div>
          ) : null}
          <div className="inline-actions">
            <button
              className="button primary"
              onClick={() => {
                setSuccess(null);
                setDraft((current) => ({ ...emptyDraft(), nickname: current.nickname }));
              }}
            >
              继续上传
            </button>
            <button className="button ghost" onClick={() => navigate('/community')}>
              去社区题库
            </button>
            <button className="button ghost" onClick={() => navigate('/community/mine')}>
              我的投稿
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page community-page">
      <button className="back-link" onClick={() => navigate('/community')}>
        ← 社区题库
      </button>
      <header className="page-heading">
        <div>
          <div className="eyebrow">先发后审 · 独立于主线</div>
          <h1>上传社区题</h1>
          <p className="page-subtitle">
            提交后立即对所有设备可见；被 3 个不同用户举报后自动隐藏。作者身份取自当前登录（匿名也可以）。
          </p>
        </div>
      </header>

      <section className="community-rules">
        <strong>提交规则</strong>
        <ul>
          <li>题干、解析会做长度校验；昵称、来源必填。</li>
          <li>题干归一化后计算 content_hash，重复时只提示、不阻断。</li>
          <li>不在题目里放个人联系方式；昵称会公开显示。</li>
        </ul>
      </section>

      {sessionError ? (
        <div className="community-banner warn">
          <p>{sessionError}。可以先填表，但提交需要匿名登录可用。</p>
        </div>
      ) : null}

      {!online ? (
        <div className="community-banner offline">
          <p>离线模式：上传不可用。请联网后提交；已缓存的社区题仍可在题库里做。</p>
        </div>
      ) : null}

      {session?.isAnonymous ? (
        <div className="community-banner info">
          <p>
            当前是匿名身份（ID 尾号 {session.userId.slice(-6)}）。清除浏览器数据或换设备会失去作者身份；可在“我的投稿”绑定邮箱。
          </p>
        </div>
      ) : null}

      <div className="upload-grid">
        <section className="upload-card">
          <div className="field-row three">
            <label>
              章节
              <select
                value={draft.chapter}
                onChange={(event) => update('chapter', Number(event.target.value))}
              >
                {CHAPTERS.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    第 {chapter.id} 章 · {chapter.title}
                  </option>
                ))}
              </select>
              {errors.chapter ? <span className="field-error">{errors.chapter}</span> : null}
            </label>
            <label>
              难度
              <select
                value={draft.difficulty}
                onChange={(event) => update('difficulty', event.target.value as Difficulty)}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </label>
            <label>
              题型
              <select
                value={draft.type}
                onChange={(event) => changeType(event.target.value as QuestionType)}
              >
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            知识点
            <input
              value={draft.topic}
              maxLength={COMMUNITY_LIMITS.topic}
              onChange={(event) => update('topic', event.target.value)}
              placeholder="例：等价无穷小、分部积分"
            />
            <span className="field-hint">
              {draft.topic.trim().length}/{COMMUNITY_LIMITS.topic}
              {errors.topic ? <em className="field-error">{errors.topic}</em> : null}
            </span>
          </label>

          <label className="field">
            题干（支持 $...$ / $$...$$ 轻量 LaTeX）
            <textarea
              value={draft.stem}
              maxLength={COMMUNITY_LIMITS.stem}
              onChange={(event) => update('stem', event.target.value)}
              rows={5}
              placeholder="例：求 $\lim_{x \to 0} \frac{\sin x}{x}$。"
            />
            <span className="field-hint">
              {draft.stem.trim().length}/{COMMUNITY_LIMITS.stem}
              {errors.stem ? <em className="field-error">{errors.stem}</em> : null}
            </span>
          </label>

          {draft.type === 'choice' ? (
            <div className="field">
              <span>选项（至少 2 个非空）</span>
              <div className="option-editor">
                {draft.options.map((option, index) => (
                  <div className="option-editor-row" key={option.id}>
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    <input
                      value={option.text}
                      maxLength={COMMUNITY_LIMITS.option}
                      onChange={(event) => updateOption(index, event.target.value)}
                      placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                    />
                    <button
                      className="text-button"
                      onClick={() => removeOption(index)}
                      disabled={draft.options.length <= COMMUNITY_LIMITS.optionsMin}
                      aria-label={`删除选项 ${String.fromCharCode(65 + index)}`}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <div className="option-editor-actions">
                <button
                  className="button small ghost"
                  onClick={addOption}
                  disabled={draft.options.length >= COMMUNITY_LIMITS.optionsMax}
                >
                  添加选项
                </button>
                <span className="field-hint">最多 {COMMUNITY_LIMITS.optionsMax} 个</span>
                {errors.options ? <span className="field-error">{errors.options}</span> : null}
              </div>
              <label className="field">
                正确答案
                <select value={String(draft.answer)} onChange={(event) => update('answer', event.target.value)}>
                  {draft.options.map((option, index) => (
                    <option key={option.id} value={option.id}>
                      {String.fromCharCode(65 + index)}. {option.text.trim() || '（空选项）'}
                    </option>
                  ))}
                </select>
                {errors.answer ? <span className="field-error">{errors.answer}</span> : null}
              </label>
            </div>
          ) : null}

          {draft.type === 'judge' ? (
            <div className="field">
              <span>正确答案</span>
              <div className="judge-row">
                <button
                  className={`judge-button ${draft.answer === true ? 'selected' : ''}`}
                  onClick={() => update('answer', true)}
                >
                  正确
                </button>
                <button
                  className={`judge-button ${draft.answer === false ? 'selected' : ''}`}
                  onClick={() => update('answer', false)}
                >
                  错误
                </button>
              </div>
              {errors.answer ? <span className="field-error">{errors.answer}</span> : null}
            </div>
          ) : null}

          {draft.type === 'solution' ? (
            <label className="field">
              参考答案（不自动判分，供自评）
              <textarea
                value={typeof draft.answer === 'string' ? draft.answer : ''}
                maxLength={COMMUNITY_LIMITS.answer}
                onChange={(event) => update('answer', event.target.value)}
                rows={4}
                placeholder="写出关键步骤与最终结果。"
              />
              <span className="field-hint">
                {typeof draft.answer === 'string' ? draft.answer.trim().length : 0}/
                {COMMUNITY_LIMITS.answer}
                {errors.answer ? <em className="field-error">{errors.answer}</em> : null}
              </span>
            </label>
          ) : null}

          <label className="field">
            解析（完整步骤）
            <textarea
              value={draft.explanation}
              maxLength={COMMUNITY_LIMITS.explanation}
              onChange={(event) => update('explanation', event.target.value)}
              rows={5}
              placeholder="写清楚关键变形、取等条件或反例。"
            />
            <span className="field-hint">
              {draft.explanation.trim().length}/{COMMUNITY_LIMITS.explanation}
              {errors.explanation ? <em className="field-error">{errors.explanation}</em> : null}
            </span>
          </label>

          <div className="field-row">
            <label>
              来源
              <select value={draft.source} onChange={(event) => update('source', event.target.value)}>
                <option value="原创">原创</option>
                <option value="网络改编">网络改编</option>
              </select>
            </label>
            <label>
              昵称（公开）
              <input
                value={draft.nickname}
                maxLength={COMMUNITY_LIMITS.nickname}
                onChange={(event) => update('nickname', event.target.value)}
                placeholder="2–20 字"
              />
              {errors.nickname ? <span className="field-error">{errors.nickname}</span> : null}
            </label>
          </div>

          {globalError ? <div className="form-error">{globalError}</div> : null}

          <button
            className="button primary large full-width"
            onClick={() => void handleSubmit()}
            disabled={submitting || !online}
          >
            {submitting ? '正在提交…' : online ? '提交题目（立即公开）' : '离线模式，无法提交'}
          </button>
          <p className="small-note">
            提交即表示同意公开展示题干、解析与昵称；作者 ID 仅用于删除权限，不展示邮箱。
          </p>
        </section>

        <aside className="upload-preview">
          <span className="card-eyebrow">发布预览</span>
          <h2>{draft.topic.trim() || '知识点'}</h2>
          <div className="community-tags">
            <span className="chapter-tag">第 {draft.chapter} 章</span>
            <span className="muted-chip">{TYPES.find((type) => type.value === draft.type)?.label}</span>
            <span className="muted-chip">{draft.difficulty}</span>
          </div>
          <p className="preview-stem">{draft.stem.trim() || '题干会显示在这里。'}</p>
          <div className="preview-meta">
            <span>来自 {draft.nickname.trim() || '昵称'}</span>
            <span>{draft.source}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
