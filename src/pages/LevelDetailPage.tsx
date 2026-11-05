import {
  MAX_LEVEL_XP,
  QUESTION_TYPE_LABEL,
  TIER_LABEL,
} from '../domain/constants';
import {
  bestStarsMap,
  estimateLevelXp,
  isLevelUnlocked,
  levelQuestionStats,
  unlockReason,
} from '../domain/rules';
import { formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import { DifficultyBadge, ProgressBar, Stars } from '../components/ui';

export function LevelDetailPage({ levelId }: { levelId: string }): JSX.Element {
  const profile = useAppStore((state) => state.profile);
  const levels = useAppStore((state) => state.levels);
  const questions = useAppStore((state) => state.questions);
  const attempts = useAppStore((state) => state.attempts);
  const activeRun = useAppStore((state) => state.activeRun);
  const pendingReview = useAppStore((state) => state.pendingReview);
  const startLevel = useAppStore((state) => state.startLevel);
  const showToast = useAppStore((state) => state.showToast);

  if (!profile) return <div className="empty-state">正在载入关卡…</div>;
  const level = levels.find((item) => item.id === levelId);
  if (!level) {
    return (
      <div className="empty-state">
        <h2>关卡不存在</h2>
        <button className="button primary" onClick={() => navigate('/map')}>
          返回章节地图
        </button>
      </div>
    );
  }

  const levelQuestions = level.questionIds
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is NonNullable<typeof question> => Boolean(question));
  const best = bestStarsMap(attempts);
  const bestStars = best[level.id] ?? 0;
  const unlocked = isLevelUnlocked(level, profile, levels, best);
  const reason = unlockReason(level, profile, levels, best);
  const stats = levelQuestionStats(levelQuestions);
  const maxXp = estimateLevelXp(levelQuestions, profile.streakDays || 1);
  const sameRun = activeRun?.levelId === level.id && !activeRun.isTrial;

  const handleStart = async () => {
    if (!unlocked) return;
    if (pendingReview) {
      navigate(`/result/${pendingReview.id}`);
      return;
    }
    if (activeRun) {
      if (sameRun) navigate('/play');
      else showToast('已有另一关进行中，请先继续或退出该关');
      return;
    }
    try {
      await startLevel(level.id);
      navigate('/play');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法开始关卡');
    }
  };

  return (
    <div className="page level-page">
      <button className="back-link" onClick={() => navigate('/map')}>
        ← 返回章节地图
      </button>

      <header className="level-hero">
        <div className="level-hero-main">
          <div className="eyebrow">
            第 {level.chapter} 章 · {TIER_LABEL[level.tier]}
          </div>
          <h1>{level.name}</h1>
          <p>{level.brief}</p>
          <div className="level-tag-row">
            <span className={`tier-chip tier-${level.tier}`}>{TIER_LABEL[level.tier]}</span>
            <DifficultyBadge
              difficulty={level.tier === 'boss' ? '挑战' : level.tier === 'advanced' ? '进阶' : '基础'}
            />
            <span className="muted-chip">5 题</span>
            <Stars value={bestStars} />
            <span className="small-note">历史最高</span>
          </div>
        </div>
        <div className="level-hero-side">
          <span>目标用时</span>
          <strong>{formatDuration(level.targetSec)}</strong>
          <span>单关 XP 上限 {MAX_LEVEL_XP}</span>
        </div>
      </header>

      {!unlocked ? (
        <section className="locked-panel">
          <div className="lock-emblem">锁</div>
          <div>
            <h2>这一关还锁着</h2>
            <p>{reason}</p>
            <div className="lock-rule-list">
              <span>基础关：本章解锁后直接可玩</span>
              <span>进阶关：本章基础关 ≥ 1 星</span>
              <span>Boss 关：基础 + 进阶累计 ≥ 3 星</span>
            </div>
          </div>
          <button className="button ghost" onClick={() => navigate('/map')}>
            查看章节地图
          </button>
        </section>
      ) : null}

      {pendingReview ? (
        <section className="session-banner">
          <div>
            <strong>有一关等待结算</strong>
            <p>先完成「{pendingReview.run.levelName}」的解答题自评，才能开始新的关卡。</p>
          </div>
          <button className="button ink" onClick={() => navigate(`/result/${pendingReview.id}`)}>
            去结算
          </button>
        </section>
      ) : activeRun ? (
        <section className="session-banner">
          <div>
            <strong>{sameRun ? '你正在这一关中' : '已有未完成关卡'}</strong>
            <p>
              {sameRun
                ? `当前第 ${activeRun.currentIndex + 1} / ${activeRun.questionIds.length} 题，进度已保存在本机。`
                : `当前进行的是「${activeRun.levelName}」。继续或退出后才能开始新关卡。`}
            </p>
          </div>
          <button className="button ink" onClick={() => navigate('/play')}>
            继续答题
          </button>
        </section>
      ) : null}

      <div className="level-detail-grid">
        <section className="goal-card">
          <div className="section-title-row">
            <div>
              <span className="card-eyebrow">本关目标</span>
              <h2>先看清楚，再开始</h2>
            </div>
            <span className="goal-count">5 个题号</span>
          </div>

          <div className="goal-block">
            <h3>题型分布</h3>
            <div className="distribution-row">
              {(['choice', 'judge', 'solution'] as const).map((type) => (
                <div className={`distribution-chip type-${type}`} key={type}>
                  <strong>{stats.types[type]}</strong>
                  <span>{QUESTION_TYPE_LABEL[type]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="goal-block">
            <h3>难度分布</h3>
            <div className="distribution-row">
              {(['基础', '进阶', '挑战'] as const).map((difficulty) => (
                <div className={`distribution-chip difficulty-${difficulty}`} key={difficulty}>
                  <strong>{stats.difficulties[difficulty]}</strong>
                  <span>{difficulty}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="goal-block">
            <h3>星级条件</h3>
            <ul className="rule-list">
              <li>
                <span className="star-rule">1 星</span>
                正确率 ≥ 60%，通关。
              </li>
              <li>
                <span className="star-rule">2 星</span>
                正确率 ≥ 80%，且总用时不超过 {formatDuration(level.targetSec)}。
              </li>
              <li>
                <span className="star-rule">3 星</span>
                正确率 100%；或正确率 ≥ 90% 且最高连击 ≥ 4。
              </li>
            </ul>
          </div>

          <div className="goal-metrics">
            <div>
              <span>动态估算用时</span>
              <strong>{formatDuration(level.targetSec)}</strong>
              <small>按题型与难度估算</small>
            </div>
            <div>
              <span>XP 范围</span>
              <strong>0 – {maxXp}</strong>
              <small>{bestStars === 3 ? '重复三星按 ×0.3 计' : '含难度与星级加成'}</small>
            </div>
          </div>

          <button
            className="button primary large full-width"
            disabled={!unlocked || (Boolean(activeRun) && !sameRun) || Boolean(pendingReview)}
            onClick={handleStart}
          >
            {!unlocked
              ? '尚未解锁'
              : pendingReview
                ? '先完成待结算关卡'
                : sameRun
                  ? '继续本关'
                  : activeRun
                    ? '先处理进行中的关卡'
                    : bestStars > 0
                      ? '重试刷新星级'
                      : '开始挑战'}
          </button>
          {bestStars > 0 ? (
            <p className="start-note">重试无惩罚，成绩取历史最高；题目与选项会重新洗牌。</p>
          ) : null}
        </section>

        <aside className="level-question-preview">
          <div className="section-title-row">
            <div>
              <span className="card-eyebrow">题号预览</span>
              <h2>五个题位</h2>
            </div>
          </div>
          <ol className="question-preview-list">
            {levelQuestions.map((question, index) => (
              <li key={question.id}>
                <span className="preview-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{question.topic}</strong>
                  <div className="preview-meta">
                    <span>{QUESTION_TYPE_LABEL[question.type]}</span>
                    <DifficultyBadge difficulty={question.difficulty} />
                    <span className={question.source === '网络改编' ? 'source-tag adapted' : 'source-tag'}>
                      {question.source}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="goal-progress-note">
            <span>本章进度</span>
            <ProgressBar value={bestStars} max={3} label="本关历史最高星数" />
            <span>{bestStars} / 3 星</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
