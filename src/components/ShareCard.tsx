import { formatDuration } from '../lib/date';
import type { ShareCardData } from '../domain/shareCard';

export function ShareCard({ data }: { data: ShareCardData }): JSX.Element {
  const accuracy = Math.round(data.accuracy * 100);
  return (
    <article className={`share-card share-card-${data.kind}`} data-share-card>
      <div className="share-card-frame">
        <header className="share-card-top">
          <div className="share-brand">
            <span className="share-brand-mark">∫</span>
            <span>
              <strong>高数闯关</strong>
              <small>同济第八版 · 上册</small>
            </span>
          </div>
          <div className="share-rank">
            <span>当前段位</span>
            <strong>{data.rankTitle}</strong>
            <small>{data.rankEpithet}</small>
          </div>
        </header>

        <div className="share-card-rule" />

        <main className="share-card-main">
          <span className="share-kicker">
            {data.kind === 'exam' ? '期末预测成绩' : '关卡结算'}
          </span>
          <h1>{data.title}</h1>
          <p className="share-subtitle">{data.subtitle}</p>

          {data.kind === 'level' ? (
            <div className="share-stars" aria-label={`${data.stars ?? 0} 星`}>
              {[1, 2, 3].map((index) => (
                <span key={index} className={index <= (data.stars ?? 0) ? 'lit' : ''}>
                  ★
                </span>
              ))}
            </div>
          ) : (
            <div className="share-score">
              <strong>{(data.score ?? 0).toFixed(1)}</strong>
              <span>/ {data.total ?? 0} 分</span>
            </div>
          )}

          <div className="share-metrics">
            <div>
              <span>正确率</span>
              <strong>{accuracy}%</strong>
            </div>
            <div>
              <span>用时</span>
              <strong>{formatDuration(data.durationSec)}</strong>
            </div>
            <div>
              <span>{data.kind === 'exam' ? '本场 XP' : '获得 XP'}</span>
              <strong>{data.kind === 'exam' ? '不计' : `+${data.xp ?? 0}`}</strong>
            </div>
          </div>

          <blockquote className="share-quote">“{data.quote}”</blockquote>
        </main>

        <footer className="share-card-footer">
          <span>一关一关，把高数拿下</span>
          <span>{data.dateLabel}</span>
        </footer>

        <span className="share-seal" aria-hidden="true">
          ∫
        </span>
      </div>
    </article>
  );
}
