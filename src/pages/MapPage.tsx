import { useEffect, useState, type CSSProperties } from 'react';
import {
  CHAPTERS,
  MAX_CHAPTER_STARS,
  TIER_EN,
  TIER_LABEL,
} from '../domain/constants';
import type { Difficulty, Level } from '../domain/types';
import {
  bestStarsMap,
  chapterClear,
  chapterStars,
  filterDueWrong,
  isLevelUnlocked,
  unlockReason,
} from '../domain/rules';
import { formatDateTime } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import { getSetting } from '../db/db';
import { TARGETED_TOPICS_KEY } from '../services/appService';
import { DifficultyBadge, ProgressBar, Stars } from '../components/ui';
import { Modal } from '../components/Modal';

function levelDifficulty(level: Level): Difficulty {
  if (level.tier === 'boss') return '挑战';
  if (level.tier === 'advanced') return '进阶';
  return '基础';
}

export function MapPage(): JSX.Element {
  const profile = useAppStore((state) => state.profile);
  const levels = useAppStore((state) => state.levels);
  const attempts = useAppStore((state) => state.attempts);
  const wrongItems = useAppStore((state) => state.wrongItems);
  const startTargeted = useAppStore((state) => state.startTargeted);
  const unlockChapter = useAppStore((state) => state.unlockChapter);
  const showToast = useAppStore((state) => state.showToast);
  const [startedTopics, setStartedTopics] = useState<string[]>([]);
  const [targetBusy, setTargetBusy] = useState<string | null>(null);
  const [lockedSelection, setLockedSelection] = useState<{ level: Level; reason: string } | null>(
    null,
  );
  const [unlocking, setUnlocking] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void getSetting<string[]>(TARGETED_TOPICS_KEY)
      .then((topics) => {
        if (active) setStartedTopics(topics ?? []);
      })
      .catch(() => {
        if (active) setStartedTopics([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!profile) return <div className="empty-state">正在载入章节地图…</div>;

  const best = bestStarsMap(attempts);
  const totalStars = levels.reduce((sum, level) => sum + (best[level.id] ?? 0), 0);
  const clearedChapters = CHAPTERS.filter((chapter) => chapterClear(chapter.id, levels, best));
  const dueCount = filterDueWrong(wrongItems).length;
  const nextReview = [...wrongItems]
    .filter((item) => !item.archived)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)[0];
  const activeWrong = wrongItems.filter((item) => !item.archived);
  const topicMap = new Map<string, { topic: string; chapter: number; count: number }>();
  for (const item of activeWrong) {
    const existing = topicMap.get(item.topic);
    if (existing) {
      existing.count += 1;
    } else {
      topicMap.set(item.topic, { topic: item.topic, chapter: item.chapter, count: 1 });
    }
  }
  const targetedTopics = [...topicMap.values()]
    .filter((item) => item.count >= 3 || (item.count > 0 && startedTopics.includes(item.topic)))
    .sort((a, b) => b.count - a.count);

  const handleTargeted = async (topic: string) => {
    setTargetBusy(topic);
    try {
      await startTargeted(topic);
      navigate('/play');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法开始靶向突破');
    } finally {
      setTargetBusy(null);
    }
  };

  const handleNode = (level: Level) => {
    if (!isLevelUnlocked(level, profile, levels, best)) {
      setLockedSelection({ level, reason: unlockReason(level, profile, levels, best) });
      return;
    }
    navigate(`/level/${level.id}`);
  };

  const handleUnlock = async (chapter: number) => {
    setUnlocking(chapter);
    try {
      await unlockChapter(chapter);
      showToast(`第 ${chapter} 章已解锁，基础关可以进入`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '解锁失败');
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <div className="page map-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">上册 · 七章 · 二十一关</div>
          <h1>章节地图</h1>
          <p className="page-subtitle">
            每章基础、进阶、Boss 三关，每关五题。Boss 关至少一星即视为本章通关。
          </p>
        </div>
        <div className="map-summary">
          <div className="summary-number">
            <strong>{totalStars}</strong>
            <span>/ {CHAPTERS.length * MAX_CHAPTER_STARS} 星</span>
          </div>
          <div className="summary-meta">
            <span>{clearedChapters.length} / 7 章通关</span>
            {dueCount > 0 ? (
              <span className="red-dot-label">{dueCount} 道错题到期</span>
            ) : (
              <span>{nextReview ? `下次复习 ${formatDateTime(nextReview.nextReviewAt)}` : '暂无到期错题'}</span>
            )}
          </div>
        </div>
      </header>

      <section className="map-community-entry">
        <div>
          <span className="card-eyebrow">社区题库 · 独立于主线</span>
          <strong>跨设备共享的题目</strong>
          <span>不计入本章星数；答对计入 XP（每日上限 100）。</span>
        </div>
        <button className="button ghost small" onClick={() => navigate('/community')}>
          进入社区题库 →
        </button>
      </section>

      {targetedTopics.length > 0 ? (
        <section className="targeted-zone">
          <div className="targeted-heading">
            <div>
              <span className="card-eyebrow">靶向突破 · 由错题动态生成</span>
              <h2>把同一个知识点的错题一次打穿</h2>
              <p>
                当某个知识点的未归档错题达到 3 道，这里会出现靶向关；优先抽该知识点的错题，
                不足 5 题用同章节题补足。全部归档后节点自动消失。
              </p>
            </div>
            <span className="targeted-count">{targetedTopics.length} 个知识点</span>
          </div>
          <div className="targeted-grid">
            {targetedTopics.map((target) => (
              <article className="targeted-card" key={target.topic}>
                <div className="targeted-card-top">
                  <span>第 {target.chapter} 章</span>
                  <span>{target.count} 道未归档</span>
                </div>
                <h3>{target.topic}</h3>
                <p>不计入主线星级，按错题试炼规则结算 XP。</p>
                <button
                  className="button primary small"
                  disabled={targetBusy !== null}
                  onClick={() => void handleTargeted(target.topic)}
                >
                  {targetBusy === target.topic ? '正在组卷…' : '进入靶向关 →'}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile.pendingUnlocks.length > 0 ? (
        <section className="unlock-banner">
          <div>
            <span className="card-eyebrow">手动确认</span>
            <h2>Boss 已击破，下一章等你亲自开门</h2>
            <p>章节之间不自动跳转。确认后，下一章基础关才会加入可挑战范围。</p>
          </div>
          <div className="unlock-actions">
            {profile.pendingUnlocks.map((chapter) => (
              <button
                className="button primary"
                key={chapter}
                disabled={unlocking !== null}
                onClick={() => handleUnlock(chapter)}
              >
                {unlocking === chapter ? '解锁中…' : `确认解锁第 ${chapter} 章`}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="chapter-stack">
        {CHAPTERS.map((chapter) => {
          const chapterLevels = levels.filter((level) => level.chapter === chapter.id);
          const stars = chapterStars(chapter.id, levels, best);
          const cleared = chapterClear(chapter.id, levels, best);
          const chapterLocked = !profile.unlockedChapters.includes(chapter.id);
          const pending = profile.pendingUnlocks.includes(chapter.id);
          return (
            <section
              key={chapter.id}
              className={`chapter-panel ${chapterLocked ? 'chapter-locked' : ''}`}
              style={{ '--chapter-accent': chapter.accent } as CSSProperties}
              data-chapter={chapter.id}
            >
              <div className="chapter-panel-head">
                <div className="chapter-title-block">
                  <div className="chapter-index">
                    <span>CHAPTER</span>
                    <strong>{String(chapter.id).padStart(2, '0')}</strong>
                  </div>
                  <div>
                    <div className="chapter-title-line">
                      <h2>{chapter.title}</h2>
                      {cleared ? <span className="status-pill cleared">已通关</span> : null}
                      {pending ? <span className="status-pill pending">待确认解锁</span> : null}
                      {chapterLocked && !pending ? (
                        <span className="status-pill locked">未解锁</span>
                      ) : null}
                    </div>
                    <p>{chapter.subtitle}</p>
                  </div>
                </div>
                <div className="chapter-score">
                  <span>{stars} / {MAX_CHAPTER_STARS} 星</span>
                  <ProgressBar
                    value={stars}
                    max={MAX_CHAPTER_STARS}
                    label={`${chapter.title}总星数`}
                    tone={cleared ? 'teal' : 'amber'}
                  />
                </div>
              </div>

              <div className="level-track">
                {chapterLevels.map((level, index) => {
                  const unlocked = isLevelUnlocked(level, profile, levels, best);
                  const starValue = best[level.id] ?? 0;
                  return (
                    <div className="level-track-item" key={level.id}>
                      {index > 0 ? <span className="track-connector" aria-hidden="true" /> : null}
                      <button
                        className={`level-node ${unlocked ? '' : 'locked'} ${
                          starValue > 0 ? 'has-stars' : ''
                        } ${level.tier === 'boss' ? 'boss' : ''}`}
                        data-level-id={level.id}
                        data-tier={level.tier}
                        onClick={() => handleNode(level)}
                        aria-label={`${level.name}，${TIER_LABEL[level.tier]}，${starValue} 星${
                          unlocked ? '' : '，未解锁'
                        }`}
                      >
                        <div className="node-topline">
                          <span className="node-code">
                            {String(chapter.id)}-{index + 1} · {TIER_EN[level.tier]}
                          </span>
                          {!unlocked ? <span className="lock-mark">锁定</span> : null}
                        </div>
                        <div className="node-title">
                          <h3>{level.name}</h3>
                          {level.tier === 'boss' ? <span className="boss-mark">BOSS</span> : null}
                        </div>
                        <p>{level.brief}</p>
                        <div className="node-meta">
                          <DifficultyBadge difficulty={levelDifficulty(level)} />
                          <span className="node-count">5 题</span>
                          <Stars value={starValue} />
                        </div>
                        {!unlocked ? (
                          <span className="node-lock-copy">
                            {unlockReason(level, profile, levels, best)}
                          </span>
                        ) : (
                          <span className="node-enter">{starValue > 0 ? '重试刷新星级' : '进入关卡'} →</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {pending ? (
                <div className="chapter-unlock-inline">
                  <span>上一章 Boss 已至少一星，本章基础关等待你手动确认解锁。</span>
                  <button
                    className="button small primary"
                    disabled={unlocking !== null}
                    onClick={() => handleUnlock(chapter.id)}
                  >
                    {unlocking === chapter.id ? '解锁中…' : `确认解锁第 ${chapter.id} 章`}
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="map-legend">
        <div>
          <span className="legend-dot cleared" /> 已通关
        </div>
        <div>
          <span className="legend-dot pending" /> 待手动确认
        </div>
        <div>
          <span className="legend-dot locked" /> 锁定节点仍可见，点击查看条件
        </div>
      </div>

      <Modal
        open={Boolean(lockedSelection)}
        title={lockedSelection ? `${lockedSelection.level.name} · 尚未解锁` : ''}
        onClose={() => setLockedSelection(null)}
      >
        {lockedSelection ? (
          <div className="lock-detail">
            <div className="lock-icon">锁</div>
            <p>{lockedSelection.reason}</p>
            <div className="lock-rules">
              <span>基础关：本章解锁后可直接挑战</span>
              <span>进阶关：本章基础关 ≥ 1 星</span>
              <span>Boss 关：基础 + 进阶累计 ≥ 3 星</span>
            </div>
            <button className="button primary" onClick={() => setLockedSelection(null)}>
              我知道了
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
