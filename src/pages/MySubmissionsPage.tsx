import { useEffect, useState } from 'react';
import { QUESTION_TYPE_LABEL } from '../domain/constants';
import type { CommunityQuestion } from '../domain/communityTypes';
import { linkGoogleIdentity } from '../services/communityService';
import { navigate } from '../lib/router';
import { useCommunityStore } from '../store/useCommunityStore';
import { MathText } from '../components/MathText';
import { ConfirmDialog } from '../components/Modal';
import { DifficultyBadge } from '../components/ui';

export function MySubmissionsPage(): JSX.Element {
  const configured = useCommunityStore((state) => state.configured);
  const session = useCommunityStore((state) => state.session);
  const sessionError = useCommunityStore((state) => state.sessionError);
  const myItems = useCommunityStore((state) => state.myItems);
  const myLoading = useCommunityStore((state) => state.myLoading);
  const myError = useCommunityStore((state) => state.myError);
  const loadMine = useCommunityStore((state) => state.loadMine);
  const remove = useCommunityStore((state) => state.remove);
  const upgrade = useCommunityStore((state) => state.upgrade);
  const login = useCommunityStore((state) => state.login);
  const signOut = useCommunityStore((state) => state.signOut);

  const [mode, setMode] = useState<'upgrade' | 'login'>('upgrade');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommunityQuestion | null>(null);

  useEffect(() => {
    if (configured) void loadMine();
  }, [configured, loadMine]);

  if (!configured) {
    return (
      <div className="page community-page">
        <button className="back-link" onClick={() => navigate('/community')}>
          ← 社区题库
        </button>
        <div className="empty-state">
          <h1>社区功能暂不可用</h1>
          <p>缺少 Supabase 配置，“我的投稿”与账号升级未启用。主线功能不受影响。</p>
          <button className="button primary" onClick={() => navigate('/community')}>
            返回社区题库
          </button>
        </div>
      </div>
    );
  }

  const submitAccount = async () => {
    setBusy(true);
    setFormError(null);
    setMessage(null);
    try {
      const result =
        mode === 'upgrade' ? await upgrade(email, password) : await login(email, password);
      setMessage(result);
      setEmail('');
      setPassword('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkGoogle = async () => {
    setFormError(null);
    try {
      await linkGoogleIdentity();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '绑定 Google 失败');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      setMessage('题目已删除，其他设备刷新后不再显示。');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page community-page">
      <button className="back-link" onClick={() => navigate('/community')}>
        ← 社区题库
      </button>
      <header className="page-heading">
        <div>
          <div className="eyebrow">作者身份 · 跨设备管理</div>
          <h1>我的投稿</h1>
          <p className="page-subtitle">
            匿名也可以投稿；绑定邮箱或 Google 后，换设备登录同一账号仍能管理这些题目。
          </p>
        </div>
      </header>

      {sessionError ? (
        <div className="community-banner warn">
          <p>{sessionError}</p>
        </div>
      ) : null}

      <section className="account-card">
        <div className="account-head">
          <div>
            <span className="card-eyebrow">当前身份</span>
            <h2>
              {session ? (session.isAnonymous ? '匿名用户' : session.email ?? '已登录') : '未登录'}
            </h2>
            <p className="small-note">
              {session
                ? `ID 尾号 ${session.userId.slice(-6)}${session.isAnonymous ? ' · 清缓存或换设备会丢失作者身份' : ''}`
                : '社区登录不可用；已缓存的题目仍可浏览。'}
            </p>
          </div>
          <div className="account-actions">
            {session ? (
              <button
                className="button small ghost"
                onClick={() => void signOut().then(() => setMessage('已退出当前身份'))}
              >
                退出登录
              </button>
            ) : null}
          </div>
        </div>

        {session?.isAnonymous ? (
          <div className="community-banner info">
            <p>
              你现在是匿名身份：清除浏览器数据、换浏览器或换设备后，无法再找回这些投稿的删除权。
              绑定邮箱后用户 ID 不变，已上传题目会自动跟到新设备。
            </p>
          </div>
        ) : null}

        <div className="account-forms">
          <div className="account-form">
            <div className="segmented">
              <button className={mode === 'upgrade' ? 'active' : ''} onClick={() => setMode('upgrade')}>
                绑定邮箱（升级）
              </button>
              <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
                已有账号登录
              </button>
            </div>
            <label className="field">
              邮箱
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <span className="field-hint">只用于登录与找回投稿，不公开、不展示给其他用户。</span>
            </label>
            <label className="field">
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                autoComplete={mode === 'upgrade' ? 'new-password' : 'current-password'}
              />
            </label>
            {formError ? <div className="form-error">{formError}</div> : null}
            {message ? <div className="community-notice">{message}</div> : null}
            <div className="inline-actions">
              <button className="button primary" onClick={() => void submitAccount()} disabled={busy}>
                {busy ? '处理中…' : mode === 'upgrade' ? '绑定并升级' : '登录'}
              </button>
              <button className="button ghost" onClick={() => void handleLinkGoogle()}>
                绑定 Google
              </button>
            </div>
            {mode === 'upgrade' ? (
              <p className="small-note">
                绑定后如需邮箱确认，请先查收邮件；确认前仍是匿名身份。Google 绑定需要在 Supabase
                配置 Provider 与重定向地址。
              </p>
            ) : (
              <p className="small-note">
                登录后会切换到这个邮箱账号；匿名身份下上传的题目不会自动合并，除非之前已在该账号下绑定。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="my-submissions">
        <div className="section-title-row">
          <div>
            <span className="card-eyebrow">已上传</span>
            <h2>{myLoading ? '读取中…' : `${myItems.length} 道题`}</h2>
          </div>
          <button className="button small ghost" onClick={() => void loadMine()} disabled={myLoading}>
            刷新
          </button>
        </div>
        {myError ? <div className="community-banner warn"><p>{myError}</p></div> : null}
        {myItems.length === 0 && !myLoading ? (
          <div className="empty-state">
            <p>这个身份下还没有投稿。</p>
            <button className="button primary" onClick={() => navigate('/community/upload')}>
              上传第一道
            </button>
          </div>
        ) : (
          <div className="my-submission-list">
            {myItems.map((question) => (
              <article className="my-submission" key={question.id}>
                <div className="community-tags">
                  <span className="chapter-tag">第 {question.chapter} 章</span>
                  <span className="muted-chip">{QUESTION_TYPE_LABEL[question.type]}</span>
                  <DifficultyBadge difficulty={question.difficulty} />
                  <span className="muted-chip">{question.topic}</span>
                  {question.report_count > 0 ? (
                    <span className="due-pill due">举报 {question.report_count}</span>
                  ) : null}
                </div>
                <MathText className="my-submission-stem">{question.stem}</MathText>
                <div className="my-submission-foot">
                  <span>{new Date(question.created_at).toLocaleString('zh-CN')}</span>
                  <button className="text-button danger-text" onClick={() => setDeleteTarget(question)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这道题？"
        confirmLabel="确认删除"
        cancelLabel="取消"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      >
        <p>删除后其他设备刷新将不再看到这道题；已进入错题本的记录会保留在本地。</p>
      </ConfirmDialog>
    </div>
  );
}
