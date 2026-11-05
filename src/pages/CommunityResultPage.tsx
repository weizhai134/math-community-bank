import { useEffect, useState } from 'react';
import { QUESTION_TYPE_LABEL } from '../domain/constants';
import type { CommunityQuestion, CommunityResult, CommunityResultItem } from '../domain/communityTypes';
import { loadCommunityResult } from '../services/communityService';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { MathText } from '../components/MathText';
import { DifficultyBadge } from '../components/ui';

function optionLabel(item: CommunityResultItem, optionId: string): string {
  const index = item.optionsOrder.indexOf(optionId);
  const option = item.question.options?.find((candidate) => candidate.id === optionId);
  const letter = index >= 0 ? String.fromCharCode(65 + index) : '';
  return `${letter} ${option?.text ?? optionId}`.trim();
}

function correctAnswerText(item: CommunityResultItem): string {
  if (item.question.type === 'choice') return optionLabel(item, String(item.question.answer));
  if (item.question.type === 'judge') return item.question.answer === true ? '正确' : '错误';
  return String(item.question.answer);
}

function responseText(item: CommunityResultItem): string {
  if (item.response === null || item.response === '') return '未作答';
  if (item.question.type === 'choice') return optionLabel(item, String(item.response));
  if (item.question.type === 'judge') return item.response === true ? '正确' : '错误';
  return String(item.response);
}

function tagLine(question: CommunityQuestion) {
  return `${question.nickname} · 第 ${question.chapter} 章 · ${question.topic}`;
}

export function CommunityResultPage(): JSX.Element {
  const [result, setResult] = useState<CommunityResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 社区结算会写 profile.totalXp 与错题本；挂载时刷新主线快照，保证顶栏与错题本立即一致。
    void useAppStore.getState().refresh();
    let active = true;
    loadCommunityResult()
      .then((data) => {
        if (active) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="empty-state">正在读取社区练习结果…</div>;

  if (!result) {
    return (
      <div className="empty-state">
        <h1>还没有社区练习结果</h1>
        <p>回社区题库随机抽 5 题，完成一组后这里会显示结果。</p>
        <button className="button primary" onClick={() => navigate('/community')}>
          去社区题库
        </button>
      </div>
    );
  }

  const dailyUsed = Math.min(result.dailyLimit, result.dailyXpBefore + result.xpEarned);

  return (
    <div className="page community-page community-result-page">
      <button className="back-link" onClick={() => navigate('/community')}>
        ← 社区题库
      </button>

      <section className="community-result-hero">
        <div className="eyebrow">社区题 · 独立练习</div>
        <h1>{result.correct} / {result.total} 题答对</h1>
        <p>
          正确率 {Math.round(result.accuracy * 100)}% · 用时 {formatDuration(result.durationSec)} ·{' '}
          {formatDateTime(result.finishedAt)}
        </p>
        <div className="community-result-xp">
          <strong>+{result.xpEarned}</strong>
          <span>本轮社区 XP</span>
        </div>
        {result.xpCapped ? (
          <div className="community-banner warn inline">
            <p>
              今日社区题 XP 已达上限（{result.dailyLimit}）。本轮应得{' '}
              {result.correct * 10}，实际只记入 {result.xpEarned}；明天再练会继续计分。
            </p>
          </div>
        ) : (
          <p className="small-note">
            今日社区 XP：{dailyUsed} / {result.dailyLimit}。社区题不影响主线星级、章节进度与连续天数。
          </p>
        )}
      </section>

      <section className="community-result-list">
        {result.items.map((item, index) => {
          const correct = item.earned === 1;
          const partial = item.earned === 0.5;
          return (
            <article className="review-item" key={item.questionId}>
              <div className="review-item-head">
                <span className="review-number">Q{String(index + 1).padStart(2, '0')}</span>
                <div className="review-tags">
                  <span className="muted-chip">{QUESTION_TYPE_LABEL[item.question.type]}</span>
                  <DifficultyBadge difficulty={item.question.difficulty} />
                  <span className="muted-chip">{item.question.topic}</span>
                  <span className="source-tag community">社区</span>
                </div>
                <span className={`result-badge ${correct ? 'correct' : partial ? 'partial' : 'wrong'}`}>
                  {correct ? '做对' : partial ? '部分对' : '做错'}
                </span>
                <span className="review-time">{formatDuration(item.timeSpentSec)}</span>
              </div>
              <MathText className="review-stem">{item.question.stem}</MathText>
              <div className="answer-pair">
                <div className="response-box">
                  <span className="response-label">你的作答</span>
                  <div className={`response-content ${item.response === null ? 'empty' : ''}`}>
                    {responseText(item)}
                  </div>
                </div>
                <div className="correct-box">
                  <span className="response-label">正确答案</span>
                  <MathText className="reference-answer">{correctAnswerText(item)}</MathText>
                </div>
              </div>
              <details
                className="review-explanation"
                onToggle={() => window.dispatchEvent(new Event('resize'))}
              >
                <summary>查看完整解析</summary>
                <div className="explanation-box">
                  <span>完整解析</span>
                  <MathText>{item.question.explanation}</MathText>
                </div>
              </details>
              <div className="community-result-foot">
                <span>{tagLine(item.question)}</span>
                {item.earned < 1 ? <span className="community-wrong-note">已进入错题本 · 来源：社区</span> : null}
              </div>
            </article>
          );
        })}
      </section>

      <div className="result-actions">
        <button className="button primary" onClick={() => navigate('/community')}>
          再抽 5 题
        </button>
        <button className="button ghost" onClick={() => navigate('/wrong')}>
          去错题本
        </button>
        <button className="button ghost" onClick={() => navigate('/map')}>
          主线地图
        </button>
      </div>
    </div>
  );
}
