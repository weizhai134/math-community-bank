import { useEffect, useState } from 'react';
import { DAILY_CHALLENGE_XP, pickDailyQuestion } from '../domain/dailyChallenge';
import type { DailyChallengeRecord } from '../domain/dailyChallenge';
import { localDateKey } from '../lib/date';
import { navigate } from '../lib/router';
import { getTodayDailyChallenge } from '../services/dailyChallengeService';
import { useAppStore } from '../store/useAppStore';

export function DailyChallengeCard(): JSX.Element | null {
  const questions = useAppStore((state) => state.questions);
  const [today, setToday] = useState(() => localDateKey());
  const [record, setRecord] = useState<DailyChallengeRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDateKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    getTodayDailyChallenge()
      .then((value) => {
        if (active) {
          setRecord(value);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setRecord(null);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [today]);

  const question = pickDailyQuestion(questions, today);
  if (!question) return null;

  const done = Boolean(record?.date === today);

  return (
    <section className={`home-daily ${done ? 'is-done' : ''}`}>
      <div className="home-daily-copy">
        <span className="card-eyebrow">每日一题 · 所有人今天同一道</span>
        <h2>{done ? '今天的题已经写完了' : '今天，就写一道题'}</h2>
        <p>
          {done
            ? `今天抽到的是「${question.topic}」，明天会换一道新题。`
            : `第 ${question.chapter} 章 · ${question.topic} · ${question.difficulty}。完成即得 ${DAILY_CHALLENGE_XP} XP，每天只有一次。`}
        </p>
      </div>
      <div className="home-daily-side">
        {done ? (
          <button type="button" className="button ghost daily-done-button" disabled>
            明天再来
            <small>今日 +{DAILY_CHALLENGE_XP} XP</small>
          </button>
        ) : (
          <button
            type="button"
            className="button primary"
            disabled={!ready}
            onClick={() => navigate('/daily')}
          >
            开始今天的题
            <span className="button-arrow">→</span>
          </button>
        )}
        <span className="small-note">固定种子抽题 · 不影响章节进度</span>
      </div>
    </section>
  );
}
