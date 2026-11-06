import { useEffect, useMemo, useState } from 'react';
import { CHAPTERS, CHAPTER_TOTAL_QUESTIONS, QUESTION_TYPE_LABEL } from '../domain/constants';
import type { ReviewQuality, WrongItem } from '../domain/types';
import { QUALITY_LABEL } from '../domain/sm2';
import { formatDateTime, formatShortDate } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import { MathText } from '../components/MathText';
import { Modal } from '../components/Modal';
import { DifficultyBadge, ProgressBar } from '../components/ui';
import { exportWrongBookPdf } from '../services/wrongBookExport';

function intervalText(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))} 分钟`;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} 小时`;
  if (days < 30) return `${days.toFixed(1)} 天`;
  return `${Math.round(days)} 天`;
}

function correctAnswerText(item: WrongItem): string {
  if (item.type === 'choice') {
    const option = item.questionSnapshot.options?.find(
      (candidate) => candidate.id === item.questionSnapshot.answer,
    );
    return `${String(item.questionSnapshot.answer)} · ${option?.text ?? ''}`;
  }
  if (item.type === 'judge') return item.questionSnapshot.answer === true ? '正确' : '错误';
  return String(item.questionSnapshot.answer);
}

export function WrongBookPage(): JSX.Element {
  const profile = useAppStore((state) => state.profile);
  const wrongItems = useAppStore((state) => state.wrongItems);
  const activeRun = useAppStore((state) => state.activeRun);
  const pendingReview = useAppStore((state) => state.pendingReview);
  const startTrial = useAppStore((state) => state.startTrial);
  const reviewWrong = useAppStore((state) => state.reviewWrong);
  const archiveWrong = useAppStore((state) => state.archiveWrong);
  const showToast = useAppStore((state) => state.showToast);

  const [chapterFilter, setChapterFilter] = useState<number | 'all'>('all');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scratchItem, setScratchItem] = useState<WrongItem | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // 社区练习会直接写入错题本；进入页面时重新读一次，避免看到启动时的旧快照。
    void useAppStore.getState().refresh();
  }, []);

  const now = Date.now();
  const activeItems = useMemo(() => wrongItems.filter((item) => !item.archived), [wrongItems]);
  const archivedItems = useMemo(() => wrongItems.filter((item) => item.archived), [wrongItems]);
  const dueItems = activeItems.filter((item) => item.nextReviewAt <= now);
  const sourceItems = tab === 'active' ? activeItems : archivedItems;
  const filtered = sourceItems
    .filter((item) => chapterFilter === 'all' || item.chapter === chapterFilter)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);

  if (!profile) return <div className="empty-state">正在载入错题本…</div>;

  const selectedTotal =
    chapterFilter === 'all' ? CHAPTERS.length * CHAPTER_TOTAL_QUESTIONS : CHAPTER_TOTAL_QUESTIONS;
  // 掌握度只统计主线题；社区题不计入“每章 15 题”的分母。
  const mainlineActive = activeItems.filter((item) => item.source !== 'community');
  const selectedWrong =
    chapterFilter === 'all'
      ? mainlineActive.length
      : mainlineActive.filter((item) => item.chapter === chapterFilter).length;
  const communityActiveCount = activeItems.length - mainlineActive.length;
  const mastery =
    selectedTotal > 0 ? Math.max(0, (selectedTotal - selectedWrong) / selectedTotal) : 1;

  const chapterCount = (chapter: number) => sourceItems.filter((item) => item.chapter === chapter).length;

  const handleReview = async (item: WrongItem, quality: ReviewQuality) => {
    setBusyId(item.id);
    try {
      await reviewWrong(item.id, quality);
      showToast(`「${item.topic}」已记为${QUALITY_LABEL[quality]}，复习时间已更新`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '复习记录失败');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (item: WrongItem, archived: boolean) => {
    setBusyId(item.id);
    try {
      await archiveWrong(item.id, archived);
      showToast(archived ? '错题已归档，不再进入复习队列' : '已重新加入复习队列，现在到期');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  };

  const handleTrial = async () => {
    try {
      await startTrial();
      navigate('/play');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法开始错题试炼');
    }
  };

  const handleExport = async () => {
    if (filtered.length === 0 || exporting) return;
    setExporting(true);
    try {
      const scope = `${tab === 'active' ? '复习中' : '已归档'} · ${
        chapterFilter === 'all' ? '全部章节' : `第 ${chapterFilter} 章`
      }`;
      await exportWrongBookPdf(filtered, scope);
      showToast(`已导出 ${filtered.length} 道错题 PDF`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'PDF 导出失败');
    } finally {
      setExporting(false);
    }
  };

  const trialDisabled = Boolean(activeRun || pendingReview) || activeItems.length === 0;

  return (
    <div className="page wrong-page">
      <header className="page-heading wrong-heading">
        <div>
          <div className="eyebrow">简化 SM-2 · 本地复习队列</div>
          <h1>错题本</h1>
          <p className="page-subtitle">
            答错或部分对的题自动入库。按“忘记 / 模糊 / 记住”复习，下次日期会随自评调整。
          </p>
        </div>
        <div className="wrong-summary">
          <div>
            <strong className={dueItems.length > 0 ? 'due-text' : ''}>{dueItems.length}</strong>
            <span>今日到期</span>
          </div>
          <div>
            <strong>{activeItems.length}</strong>
            <span>复习中</span>
          </div>
          <div>
            <strong>{archivedItems.length}</strong>
            <span>已归档</span>
          </div>
        </div>
      </header>

      <section className={`trial-card ${dueItems.length > 0 ? 'trial-due' : ''}`}>
        <div className="trial-copy">
          <div className="trial-kicker">
            <span className="trial-dot" />
            {dueItems.length > 0 ? `${dueItems.length} 道错题已到期` : '暂无到期错题'}
          </div>
          <h2>错题试炼</h2>
          <p>
            {dueItems.length > 0
              ? '优先抽取到期错题；不足 5 题时用其他错题补足。答对每题 +5 XP，同一题 24 小时内不重复给 XP。'
              : activeItems.length > 0
                ? `最近一次复习安排在 ${formatDateTime(
                    activeItems.slice().sort((a, b) => a.nextReviewAt - b.nextReviewAt)[0].nextReviewAt,
                  )}。现在也可以提前试炼，但不会改变原复习计划。`
                : '先在一次关卡里产生错题，试炼入口才会出现。'}
          </p>
          {activeItems.length > 0 && activeItems.length < 5 ? (
            <span className="small-note">当前错题不足 5 道，本轮按现有题数开始。</span>
          ) : null}
          {activeRun || pendingReview ? (
            <span className="small-note">有未完成 / 待结算关卡，处理完才能开始试炼。</span>
          ) : null}
        </div>
        <div className="trial-actions">
          <button className="button primary" disabled={trialDisabled} onClick={handleTrial}>
            {dueItems.length > 0 ? '开始到期试炼' : '提前试炼'}
            <span className="button-arrow">→</span>
          </button>
          <span>不计入章节总星数</span>
        </div>
      </section>

      <section className="mastery-panel">
        <div className="mastery-copy">
          <span className="card-eyebrow">掌握度</span>
          <h2>{chapterFilter === 'all' ? '上册整体' : `第 ${chapterFilter} 章`}</h2>
          <p>
            该范围错题 <strong>{selectedWrong}</strong> / {selectedTotal} 题，掌握度{' '}
            <strong>{Math.round(mastery * 100)}%</strong>
          </p>
          {communityActiveCount > 0 ? (
            <p className="small-note">
              另有 {communityActiveCount} 道社区错题，按同一条 SM-2 队列复习，但不计入主线掌握度。
            </p>
          ) : null}
        </div>
        <div className="mastery-visual">
          <ProgressBar
            value={mastery * 100}
            max={100}
            tone={mastery >= 0.8 ? 'teal' : 'amber'}
            label="掌握度"
          />
          <span>{selectedTotal - selectedWrong} 题未进入错题本</span>
        </div>
      </section>

      <div className="wrong-toolbar">
        <div className="filter-chips" role="group" aria-label="按章节筛选">
          <button
            className={chapterFilter === 'all' ? 'active' : ''}
            onClick={() => setChapterFilter('all')}
          >
            全部 <span>{sourceItems.length}</span>
          </button>
          {CHAPTERS.map((chapter) => (
            <button
              key={chapter.id}
              className={chapterFilter === chapter.id ? 'active' : ''}
              onClick={() => setChapterFilter(chapter.id)}
            >
              {chapter.shortTitle} <span>{chapterCount(chapter.id)}</span>
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>
            复习中
          </button>
          <button className={tab === 'archived' ? 'active' : ''} onClick={() => setTab('archived')}>
            已归档
          </button>
        </div>
        <button
          type="button"
          className="button ghost wrong-export"
          disabled={filtered.length === 0 || exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? '正在生成 PDF…' : `导出当前错题 (${filtered.length})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state wrong-empty">
          <div className="empty-mark">{tab === 'active' ? '○' : '□'}</div>
          <h2>{tab === 'active' ? '这个范围还没有错题' : '没有已归档的错题'}</h2>
          <p>
            {tab === 'active'
              ? '答错或部分对的题会自动出现在这里。先去关卡里认真做一轮。'
              : '复习稳定后可以手动归档；归档后可随时恢复。'}
          </p>
          <button className="button ghost" onClick={() => navigate('/map')}>
            去章节地图
          </button>
        </div>
      ) : (
        <div className="wrong-list">
          {filtered.map((item) => {
            const due = item.nextReviewAt <= now;
            return (
              <article
                className={`wrong-item ${due && !item.archived ? 'is-due' : ''}`}
                key={item.id}
                data-wrong-id={item.id}
              >
                <div className="wrong-item-top">
                  <div className="wrong-tags">
                    <span className="chapter-tag">第 {item.chapter} 章</span>
                    <span className="muted-chip">{QUESTION_TYPE_LABEL[item.type]}</span>
                    <DifficultyBadge difficulty={item.difficulty} />
                    <span className="muted-chip">{item.topic}</span>
                    {item.source === 'community' ? (
                      <span className="source-tag community">社区</span>
                    ) : null}
                    <span
                      className={
                        item.questionSnapshot.source === '网络改编'
                          ? 'source-tag adapted'
                          : 'source-tag'
                      }
                    >
                      {item.questionSnapshot.source}
                    </span>
                  </div>
                  <span className={`due-pill ${due && !item.archived ? 'due' : ''}`}>
                    {item.archived
                      ? '已归档'
                      : due
                        ? '今日到期'
                        : `下次 ${formatShortDate(item.nextReviewAt)}`}
                  </span>
                </div>
                <MathText className="wrong-stem">{item.questionSnapshot.stem}</MathText>

                <div className="wrong-metrics">
                  <div>
                    <span>错误次数</span>
                    <strong>{item.wrongCount}</strong>
                  </div>
                  <div>
                    <span>复习次数</span>
                    <strong>{item.reviewCount}</strong>
                  </div>
                  <div>
                    <span>下次复习</span>
                    <strong>{formatDateTime(item.nextReviewAt)}</strong>
                  </div>
                  <div>
                    <span>当前间隔</span>
                    <strong>{intervalText(item.interval)}</strong>
                  </div>
                  <div>
                    <span>难度系数</span>
                    <strong>{item.easeFactor.toFixed(2)}</strong>
                  </div>
                </div>

                <details className="wrong-details">
                  <summary>查看参考答案与完整解析</summary>
                  <div className="wrong-reference">
                    <span className="response-label">正确答案</span>
                    <MathText>{correctAnswerText(item)}</MathText>
                  </div>
                  <div className="explanation-box">
                    <span>解析</span>
                    <MathText>{item.questionSnapshot.explanation}</MathText>
                  </div>
                </details>

                {item.scratchImage ? (
                  <button
                    type="button"
                    className="button small ghost scratch-open"
                    onClick={() => setScratchItem(item)}
                  >
                    查看当时的草稿
                  </button>
                ) : null}

                <div className="wrong-actions">
                  {!item.archived ? (
                    <>
                      <span className="review-prompt">复习自评</span>
                      <div className="review-buttons">
                        {([1, 3, 5] as const).map((quality) => (
                          <button
                            key={quality}
                            className={`review-quality quality-${quality}`}
                            disabled={busyId === item.id}
                            onClick={() => handleReview(item, quality)}
                          >
                            {QUALITY_LABEL[quality]}
                          </button>
                        ))}
                      </div>
                      <button
                        className="text-button archive-button"
                        disabled={busyId === item.id}
                        onClick={() => handleArchive(item, true)}
                      >
                        归档
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="review-prompt">已移出复习队列</span>
                      <button
                        className="button small ghost"
                        disabled={busyId === item.id}
                        onClick={() => handleArchive(item, false)}
                      >
                        恢复复习
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="page-footnote">
        复习调度为简化 SM-2：忘记 = 1，模糊 = 3，记住 = 5；再次答错会降低难度系数。
        {profile.pendingUnlocks.length > 0 ? ' 章节地图还有待确认的解锁。' : ''}
      </footer>

      <Modal
        open={Boolean(scratchItem)}
        title="当时的草稿"
        onClose={() => setScratchItem(null)}
        wide
      >
        {scratchItem?.scratchImage ? (
          <img
            className="scratch-preview-image"
            src={scratchItem.scratchImage}
            alt={`${scratchItem.topic} 作答时的草稿`}
          />
        ) : null}
      </Modal>
    </div>
  );
}
