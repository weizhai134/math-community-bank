import { useEffect, useState } from 'react';
import {
  EXAM_DIFFICULTY_LABEL,
} from '../domain/exam';
import type { ExamHistoryRecord } from '../domain/examHistory';
import { formatDateTime, formatDuration } from '../lib/date';
import { listExamHistory } from '../services/examService';

export function ExamHistoryList(): JSX.Element | null {
  const [items, setItems] = useState<ExamHistoryRecord[] | null>(null);

  useEffect(() => {
    let active = true;
    listExamHistory(8)
      .then((records) => {
        if (active) setItems(records);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="exam-history">
      <div className="section-title-row">
        <div>
          <span className="card-eyebrow">模拟考历史</span>
          <h2>最近几次预测成绩</h2>
        </div>
        <span className="small-note">最近 {items.length} 次</span>
      </div>
      <div className="exam-history-list">
        {items.map((item) => (
          <article className="exam-history-row" key={item.id}>
            <div className="exam-history-main">
              <span className="exam-history-difficulty">
                {EXAM_DIFFICULTY_LABEL[item.difficulty]}
              </span>
              <span className="exam-history-date">{formatDateTime(item.finishedAt)}</span>
            </div>
            <strong className="exam-history-score">
              {item.score.toFixed(1)}
              <small> / {item.total}</small>
            </strong>
            <div className="exam-history-meta">
              <span>正确率 {Math.round(item.accuracy * 100)}%</span>
              <span>{formatDuration(item.durationSec)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
