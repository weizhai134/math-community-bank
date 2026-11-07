import { useEffect, useState } from 'react';
import { CHAPTERS, QUESTION_TYPE_LABEL } from '../domain/constants';
import type { CommunityFilters, CommunityQuestion } from '../domain/communityTypes';
import type { Difficulty, QuestionType } from '../domain/types';
import { fetchPracticeQuestions, loadCommunityRun, startCommunityRun } from '../services/communityService';
import { isSingleFileDemo } from '../services/supabaseClient';
import { navigate } from '../lib/router';
import { useCommunityStore } from '../store/useCommunityStore';
import { MathText } from '../components/MathText';
import { ConfirmDialog } from '../components/Modal';
import { DifficultyBadge } from '../components/ui';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function CommunityListPage(): JSX.Element {
  const configured = useCommunityStore((state) => state.configured);
  const session = useCommunityStore((state) => state.session);
  const sessionError = useCommunityStore((state) => state.sessionError);
  const items = useCommunityStore((state) => state.items);
  const total = useCommunityStore((state) => state.total);
  const filters = useCommunityStore((state) => state.filters);
  const loading = useCommunityStore((state) => state.loading);
  const loadingMore = useCommunityStore((state) => state.loadingMore);
  const offline = useCommunityStore((state) => state.offline);
  const error = useCommunityStore((state) => state.error);
  const cachedAt = useCommunityStore((state) => state.cachedAt);
  const xpToday = useCommunityStore((state) => state.xpToday);
  const bootstrap = useCommunityStore((state) => state.bootstrap);
  const refresh = useCommunityStore((state) => state.refresh);
  const loadMore = useCommunityStore((state) => state.loadMore);
  const setFilters = useCommunityStore((state) => state.setFilters);
  const report = useCommunityStore((state) => state.report);

  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState<CommunityQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    void bootstrap();
    void loadCommunityRun().then((run) => setHasRun(Boolean(run)));
  }, [bootstrap]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const patchFilters = (patch: Partial<CommunityFilters>) => {
    void setFilters(patch);
  };

  const handlePractice = async () => {
    if (singleFileDemo) {
      setNotice('当前为单机演示版，社区题库功能暂不可用');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const existing = await loadCommunityRun();
      if (existing) {
        navigate('/community/play');
        return;
      }
      const questions = await fetchPracticeQuestions(filters);
      await startCommunityRun(questions);
      setHasRun(true);
      navigate('/community/play');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '无法开始练习');
    } finally {
      setBusy(false);
    }
  };

  const confirmReport = async () => {
    if (!reporting) return;
    try {
      const message = await report(reporting.id);
      setNotice(message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '举报失败');
    } finally {
      setReporting(null);
    }
  };

  const serviceUnavailable = !configured;
  const singleFileDemo = isSingleFileDemo;
  const showEmpty = !loading && items.length === 0;

  return (
    <div className="page community-page">
      <header className="page-heading community-heading">
        <div>
          <div className="eyebrow">独立于主线 · 跨设备共享</div>
          <h1>社区题库</h1>
          <p className="page-subtitle">
            其他同学上传的题目。不参与主线章节进度、星级与 Boss 解锁；答对计入 XP（每日上限{' '}
            {100}），错题按同一条 SM-2 队列复习。
          </p>
        </div>
        <div className="community-heading-actions">
          <button
            className="button ghost"
            onClick={() => navigate('/community/mine')}
            disabled={singleFileDemo}
          >
            我的投稿
          </button>
          <button
            className="button primary"
            onClick={() => navigate('/community/upload')}
            disabled={singleFileDemo}
          >
            上传题目
          </button>
        </div>
      </header>

      {singleFileDemo ? (
        <section className="community-banner unavailable">
          <div>
            <strong>当前为单机演示版</strong>
            <p>社区题库功能暂不可用。主线七章、错题本、XP、公式闪卡、模拟考均可正常使用。</p>
          </div>
        </section>
      ) : null}

      {!singleFileDemo && serviceUnavailable ? (
        <section className="community-banner unavailable">
          <div>
            <strong>社区功能暂不可用</strong>
            <p>
              缺少 Supabase 配置（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）。主线七章、错题本、XP
              不受影响；已缓存过的社区题仍可在下方浏览。
            </p>
            <p className="small-note">
              配置步骤见仓库 <code>docs/supabase/README.md</code>，SQL 见{' '}
              <code>docs/supabase/schema.sql</code>。
            </p>
          </div>
        </section>
      ) : null}

      {!singleFileDemo && !serviceUnavailable && sessionError ? (
        <section className="community-banner warn">
          <div>
            <strong>社区登录不可用</strong>
            <p>{sessionError}。已缓存的题目仍可浏览与练习；上传/举报/删除暂时不可用。</p>
          </div>
        </section>
      ) : null}

      {!singleFileDemo && (offline || (error && !serviceUnavailable)) ? (
        <section className="community-banner offline">
          <div>
            <strong>{offline ? '离线模式，仅显示已缓存题目' : '社区刷新失败'}</strong>
            <p>
              {error ?? '网络不可用'}
              {cachedAt ? ` · 缓存于 ${new Date(cachedAt).toLocaleString('zh-CN')}` : ''}
            </p>
          </div>
        </section>
      ) : null}

      {notice ? (
        <div className="community-notice" role="status">
          {notice}
        </div>
      ) : null}

      <section className="community-toolbar">
        <div className="filter-chips" role="group" aria-label="按章节筛选">
          <button
            className={filters.chapter === null ? 'active' : ''}
            onClick={() => patchFilters({ chapter: null })}
          >
            全部
          </button>
          {CHAPTERS.map((chapter) => (
            <button
              key={chapter.id}
              className={filters.chapter === chapter.id ? 'active' : ''}
              onClick={() => patchFilters({ chapter: chapter.id })}
            >
              {chapter.shortTitle}
            </button>
          ))}
        </div>
        <div className="community-selects">
          <label>
            难度
            <select
              value={filters.difficulty ?? ''}
              onChange={(event) =>
                patchFilters({ difficulty: (event.target.value || null) as Difficulty | null })
              }
            >
              <option value="">全部</option>
              <option value="基础">基础</option>
              <option value="进阶">进阶</option>
              <option value="挑战">挑战</option>
            </select>
          </label>
          <label>
            题型
            <select
              value={filters.type ?? ''}
              onChange={(event) =>
                patchFilters({ type: (event.target.value || null) as QuestionType | null })
              }
            >
              <option value="">全部</option>
              <option value="choice">选择题</option>
              <option value="judge">判断题</option>
              <option value="solution">解答题</option>
            </select>
          </label>
        </div>
      </section>

      <section className="community-actions">
        <div>
          <span className="community-count">
            {loading ? '载入中…' : `共 ${total} 道可见题`}
            {xpToday > 0 ? ` · 今日社区 XP ${Math.min(xpToday, 100)}/100` : ''}
          </span>
          {session?.isAnonymous ? (
            <span className="small-note">当前为匿名身份，升级后可跨设备管理投稿。</span>
          ) : null}
        </div>
        <div className="community-action-buttons">
          {hasRun ? (
            <button className="button ghost" onClick={() => navigate('/community/play')}>
              继续上次练习
            </button>
          ) : null}
          <button className="button ghost" onClick={() => void refresh()} disabled={loading}>
            刷新
          </button>
          <button
            className="button ink"
            onClick={() => void handlePractice()}
            disabled={busy || loading || singleFileDemo}
          >
            {busy ? '正在抽题…' : '随机抽 5 题练习'}
          </button>
        </div>
      </section>

      {loading && items.length === 0 ? (
        <div className="community-skeleton" aria-label="正在载入社区题">
          {[0, 1, 2].map((index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="empty-state community-empty">
          <h2>
            {singleFileDemo
              ? '单机演示版没有社区题'
              : offline
                ? '缓存里还没有社区题'
                : '社区题库还是空的'}
          </h2>
          <p>
            {singleFileDemo
              ? '社区题库需要联网；主线七章、错题本、公式闪卡和模拟考不受影响。'
              : offline
                ? '联网后刷新一次，题目会缓存到本机，之后断网也能看。'
                : '成为第一个上传题目的人；提交即对所有设备可见。'}
          </p>
          <div className="inline-actions">
            <button
              className="button primary"
              onClick={() => navigate('/community/upload')}
              disabled={singleFileDemo}
            >
              上传题目
            </button>
            <button className="button ghost" onClick={() => navigate('/map')}>
              回到主线地图
            </button>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="community-list">
          {items.map((question) => (
            <article className="community-card" key={question.id}>
              <div className="community-card-head">
                <div className="community-tags">
                  <span className="chapter-tag">第 {question.chapter} 章</span>
                  <span className="muted-chip">{QUESTION_TYPE_LABEL[question.type]}</span>
                  <DifficultyBadge difficulty={question.difficulty} />
                  <span
                    className={
                      question.source === '网络改编' ? 'source-tag adapted' : 'source-tag'
                    }
                  >
                    {question.source}
                  </span>
                  <span className="muted-chip">{question.topic}</span>
                </div>
                <button
                  className="text-button community-report"
                  onClick={() => setReporting(question)}
                  disabled={offline || singleFileDemo}
                  title={
                    singleFileDemo
                      ? '单机演示版不能举报'
                      : offline
                        ? '离线模式下不能举报'
                        : '举报违规或错误题目'
                  }
                >
                  举报
                </button>
              </div>
              <MathText className="community-stem">{question.stem}</MathText>
              <div className="community-card-foot">
                <span>来自 {question.nickname}</span>
                <span>{formatDate(question.created_at)}</span>
                {question.report_count > 0 ? <span>已被举报 {question.report_count} 次</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {items.length < total ? (
        <div className="community-more">
          <button className="button ghost" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(reporting)}
        title="举报这道社区题？"
        confirmLabel="确认举报"
        cancelLabel="取消"
        danger
        onCancel={() => setReporting(null)}
        onConfirm={() => void confirmReport()}
      >
        <p>
          举报会提交给数据库统计；同一道题被 3 个不同用户举报后会自动隐藏。同一用户对同一题只能举报一次。
        </p>
      </ConfirmDialog>
    </div>
  );
}
