import type { CSSProperties } from 'react';
import {
  CHAPTERS,
  MAX_CHAPTER_STARS,
  TIER_LABEL,
} from '../domain/constants';
import {
  bestStarsMap,
  chapterClear,
  chapterStars,
  filterDueWrong,
  rankForXp,
  recentAttempt,
  recommendNextLevel,
} from '../domain/rules';
import { FLASHCARDS } from '../data/flashcards';
import { formatDateTime, formatDuration, localDateKey } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import { InstallHint } from '../components/InstallHint';
import { ProgressBar, Stars } from '../components/ui';

export function HomePage(): JSX.Element {
  const profile = useAppStore((state) => state.profile);
  const levels = useAppStore((state) => state.levels);
  const attempts = useAppStore((state) => state.attempts);
  const wrongItems = useAppStore((state) => state.wrongItems);
  const activeRun = useAppStore((state) => state.activeRun);
  const pendingReview = useAppStore((state) => state.pendingReview);
  const startTrial = useAppStore((state) => state.startTrial);
  const showToast = useAppStore((state) => state.showToast);

  if (!profile) return <div className="empty-state">正在载入学习档案…</div>;

  const best = bestStarsMap(attempts);
  const rank = rankForXp(profile.totalXp);
  const dueWrong = filterDueWrong(wrongItems);
  const activeWrong = wrongItems.filter((item) => !item.archived);
  const nextReview = [...activeWrong].sort((a, b) => a.nextReviewAt - b.nextReviewAt)[0];
  const recommended = recommendNextLevel(profile, levels, best);
  const last = recentAttempt(attempts);
  const todayDone = profile.lastActiveDate === localDateKey();
  const totalStars = levels.reduce((sum, level) => sum + (best[level.id] ?? 0), 0);

  const continueAction = pendingReview
    ? {
        eyebrow: '还有一关待结算',
        title: pendingReview.run.levelName,
        copy: '解答题自评后才会写入星级与 XP。',
        label: '完成结算',
        go: () => navigate(`/result/${pendingReview.id}`),
      }
    : activeRun
      ? {
          eyebrow: '继续上次进度',
          title: activeRun.levelName,
          copy: `第 ${activeRun.currentIndex + 1} / ${activeRun.questionIds.length} 题，当前连击 ${activeRun.combo}。`,
          label: '继续答题',
          go: () => navigate('/play'),
        }
      : recommended
        ? {
            eyebrow:
              (best[recommended.id] ?? 0) > 0 ? '继续冲击满星' : '下一关已就绪',
            title: recommended.name,
            copy: `第 ${recommended.chapter} 章 · ${TIER_LABEL[recommended.tier]} · 目标 ${formatDuration(recommended.targetSec)}`,
            label: '查看关卡目标',
            go: () => navigate(`/level/${recommended.id}`),
          }
        : {
            eyebrow: '全部完成',
            title: '上册七章已全部通关',
            copy: '可以回到任意三星关卡刷新速度，或从错题本继续巩固。',
            label: '查看章节地图',
            go: () => navigate('/map'),
          };

  const handleTrial = async () => {
    try {
      await startTrial();
      navigate('/play');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法开始错题试炼');
    }
  };

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">同济版《高等数学》第八版 · 上册</div>
          <h1>
            把高数拆成
            <br />
            <span>可以一关一关拿下的事。</span>
          </h1>
          <p className="lede">
            七章、二十一关、一百零五道题。选择与判断即时记录，解答题在结算页自评；
            星级、XP 和错题复习全部保存在本机浏览器。
          </p>
          <div className="hero-actions">
            <button className="button primary large" onClick={continueAction.go}>
              {activeRun ? '继续答题' : pendingReview ? '完成结算' : '继续闯关'}
              <span className="button-arrow">→</span>
            </button>
            <button className="button ghost large" onClick={() => navigate('/map')}>
              章节地图
            </button>
          </div>
        </div>
        <div className="rank-card">
          <div className="rank-card-top">
            <span className="rank-kicker">当前段位</span>
            <span className="rank-index">RANK {rank.index + 1}</span>
          </div>
          <div className="rank-title">
            <strong>{rank.title}</strong>
            <span>{rank.epithet}</span>
          </div>
          <div className="xp-number">
            <span>{profile.totalXp.toLocaleString()}</span> XP
          </div>
          <ProgressBar value={rank.progress * 100} max={100} label="段位进度" />
          <p className="rank-next">
            {rank.nextTitle
              ? `距「${rank.nextTitle}」还差 ${rank.toNext} XP`
              : '已到最高段位，继续刷新满星纪录。'}
          </p>
          <div className="rank-mini-grid">
            <div>
              <span>连续天数</span>
              <strong>{profile.streakDays} 天</strong>
            </div>
            <div>
              <span>今日已闯关</span>
              <strong className={todayDone ? 'teal-text' : 'muted-text'}>
                {todayDone ? '已打卡' : '未打卡'}
              </strong>
            </div>
            <div>
              <span>总星数</span>
              <strong>
                {totalStars} / {CHAPTERS.length * MAX_CHAPTER_STARS}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <InstallHint />

      <section className="dashboard-grid">
        <article className="continue-card">
          <span className="card-eyebrow">{continueAction.eyebrow}</span>
          <h2>{continueAction.title}</h2>
          <p>{continueAction.copy}</p>
          <div className="continue-row">
            <button className="button ink" onClick={continueAction.go}>
              {continueAction.label} →
            </button>
            {recommended ? (
              <span className="small-note">
                历史最高 {best[recommended.id] ?? 0} 星
              </span>
            ) : null}
          </div>
        </article>

        <article className={`review-card ${dueWrong.length > 0 ? 'has-due' : ''}`}>
          <div className="review-card-head">
            <span className="card-eyebrow">错题复习</span>
            {dueWrong.length > 0 ? <span className="red-dot-label">{dueWrong.length} 道到期</span> : null}
          </div>
          <h2>{dueWrong.length > 0 ? '今天的错题该见面了' : '错题队列暂时安静'}</h2>
          <p>
            {activeWrong.length > 0
              ? `错题本共 ${activeWrong.length} 道，${dueWrong.length} 道已到复习时间。试炼会优先取到期题。`
              : '答错或部分对的题会自动进入错题本，并按简化 SM-2 安排下一次复习。'}
          </p>
          {nextReview ? (
            <p className="next-review-copy">
              下一次复习：{formatDateTime(nextReview.nextReviewAt)}
              {nextReview.nextReviewAt <= Date.now() ? ' · 已到期' : ''}
            </p>
          ) : null}
          <div className="continue-row">
            <button
              className="button ghost"
              onClick={
                activeWrong.length > 0 && dueWrong.length > 0
                  ? handleTrial
                  : () => navigate('/wrong')
              }
            >
              {dueWrong.length > 0 ? '开始错题试炼' : '错题试炼'}
            </button>
            {activeWrong.length === 0 ? (
              <button className="button ghost" onClick={() => navigate('/map')}>
                去第一章练手
              </button>
            ) : null}
            {dueWrong.length === 0 && activeWrong.length > 0 ? (
              <span className="small-note">提前试炼可在错题本中开启</span>
            ) : null}
          </div>
        </article>

        <article className="recent-card">
          <span className="card-eyebrow">最近一次</span>
          {last ? (
            <>
              <div className="recent-head">
                <div>
                  <h2>{last.levelName}</h2>
                  <p>
                    第 {last.chapter} 章 · {formatDateTime(last.finishedAt)}
                  </p>
                </div>
                <Stars value={last.stars} />
              </div>
              <div className="recent-stats">
                <span>正确率 {Math.round(last.accuracy * 100)}%</span>
                <span>{formatDuration(last.durationSec)}</span>
                <span className="xp-chip">+{last.xpEarned} XP</span>
              </div>
              <button
                className="text-link"
                onClick={() => navigate(`/result/${last.id}`)}
              >
                查看上次结算 →
              </button>
            </>
          ) : (
            <>
              <h2>还没有通关记录</h2>
              <p>从第 1 章基础关开始。第一次记录会同时建立你的段位与连续天数。</p>
              <button className="text-link" onClick={() => navigate('/level/c1-basic')}>
                去第一关 →
              </button>
            </>
          )}
        </article>
      </section>

      <section className="home-flashcards">
        <div>
          <span className="card-eyebrow">公式闪卡 · 每天 5 分钟</span>
          <h2>把公式翻过来，才算真的记住</h2>
          <p>
            内置 {FLASHCARDS.length} 张高数上册核心公式卡：等价无穷小、导数表、积分表、
            泰勒展开与中值定理条件。点卡片翻面，按“没记住 / 记住了”自动安排下次复习。
          </p>
        </div>
        <div className="home-flashcards-actions">
          <button className="button primary" onClick={() => navigate('/flashcards')}>
            开始公式闪卡
            <span className="button-arrow">→</span>
          </button>
          <span className="small-note">本地 SM-2 · 不上传</span>
        </div>
      </section>

      <section className="home-community">
        <div>
          <span className="card-eyebrow">社区题库 · 独立于主线</span>
          <h2>做别人上传的题，也把自己的题放进来</h2>
          <p>
            不参与主线章节进度、星级与 Boss 解锁；答对计入 XP（每日上限 100），错题和主线一样进入
            SM-2 复习队列。
          </p>
        </div>
        <div className="home-community-actions">
          <button className="button primary" onClick={() => navigate('/community')}>
            进入社区题库
          </button>
          <button className="button ghost" onClick={() => navigate('/community/upload')}>
            上传题目
          </button>
        </div>
      </section>

      <section className="home-map-section">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">上册章节地图</div>
            <h2>七章，每章三关</h2>
          </div>
          <button className="text-link" onClick={() => navigate('/map')}>
            打开完整地图 →
          </button>
        </div>
        <div className="chapter-mini-grid">
          {CHAPTERS.map((chapter) => {
            const starCount = chapterStars(chapter.id, levels, best);
            const cleared = chapterClear(chapter.id, levels, best);
            const locked = !profile.unlockedChapters.includes(chapter.id);
            const pending = profile.pendingUnlocks.includes(chapter.id);
            const chapterLevels = levels.filter((level) => level.chapter === chapter.id);
            return (
              <button
                className={`chapter-mini ${locked ? 'locked' : ''}`}
                key={chapter.id}
                style={{ '--chapter-accent': chapter.accent } as CSSProperties}
                onClick={() => navigate('/map')}
              >
                <div className="chapter-mini-head">
                  <span className="chapter-no">{String(chapter.id).padStart(2, '0')}</span>
                  <span className={`chapter-state ${cleared ? 'cleared' : ''}`}>
                    {pending ? '待确认' : locked ? '未解锁' : cleared ? '已通关' : `${starCount}/9`}
                  </span>
                </div>
                <h3>{chapter.title}</h3>
                <p>{chapter.subtitle}</p>
                <ProgressBar
                  value={starCount}
                  max={MAX_CHAPTER_STARS}
                  label={`${chapter.title}星数`}
                  tone={cleared ? 'teal' : 'amber'}
                />
                <div className="mini-levels">
                  {chapterLevels.map((level) => (
                    <span key={level.id} className="mini-level">
                      <em>{TIER_LABEL[level.tier].replace('关', '')}</em>
                      <Stars value={best[level.id] ?? 0} className="stars-small" />
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="page-footnote">
        所有进度、错题与设置仅保存在当前浏览器的 IndexedDB，不会上传到任何服务器。
      </footer>
    </div>
  );
}
