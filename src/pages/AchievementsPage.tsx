import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, type AchievementState } from '../domain/achievements';
import { formatDateTime } from '../lib/date';
import { navigate } from '../lib/router';
import { loadAchievementStates } from '../services/achievementService';
import { ProgressBar } from '../components/ui';

export function AchievementsPage(): JSX.Element {
  const [states, setStates] = useState<AchievementState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadAchievementStates()
      .then((loaded) => {
        if (active) setStates(loaded);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stateMap = new Map(states.map((state) => [state.id, state]));
  const unlockedCount = states.filter((state) => state.unlockedAt).length;

  return (
    <div className="page achievements-page">
      <button className="back-link" onClick={() => navigate('/')}>
        ← 首页
      </button>

      <header className="achievements-head">
        <div>
          <span className="card-eyebrow">成就徽章墙 · 永久保存在本机</span>
          <h1>我的成就</h1>
          <p>完成关卡、累计答对和特殊时段刷题都会点亮徽章；解锁后不会消失。</p>
        </div>
        <div className="achievements-count">
          <strong>{unlockedCount}</strong>
          <span>/ {ACHIEVEMENTS.length} 已点亮</span>
        </div>
      </header>

      {loading ? (
        <div className="empty-state">正在读取成就…</div>
      ) : (
        <div className="achievement-grid">
          {ACHIEVEMENTS.map((definition) => {
            const state = stateMap.get(definition.id);
            const unlocked = Boolean(state?.unlockedAt);
            const progress = Math.min(definition.target ?? 1, state?.progress ?? 0);
            return (
              <article
                className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
                key={definition.id}
              >
                <div className="achievement-medal" aria-hidden="true">
                  {definition.icon}
                </div>
                <div className="achievement-copy">
                  <span className="achievement-state">{unlocked ? '已点亮' : '未解锁'}</span>
                  <h2>{definition.title}</h2>
                  <p>{definition.description}</p>
                  {definition.target ? (
                    <div className="achievement-progress">
                      <ProgressBar
                        value={progress}
                        max={definition.target}
                        label={`${definition.title}进度`}
                        tone={unlocked ? 'teal' : 'amber'}
                      />
                      <span>
                        {progress} / {definition.target}
                      </span>
                    </div>
                  ) : null}
                  {unlocked && state?.unlockedAt ? (
                    <span className="achievement-date">
                      {formatDateTime(state.unlockedAt)} 解锁
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="page-footnote">
        成就状态存在 IndexedDB 的 achievements 表；刷新或关闭浏览器都不会丢失。
      </footer>
    </div>
  );
}
