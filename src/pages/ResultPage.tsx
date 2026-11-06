import { useEffect, useMemo, useState } from 'react';
import {
  MAX_LEVEL_XP,
  QUESTION_TYPE_LABEL,
  TIER_LABEL,
} from '../domain/constants';
import type {
  Grade,
  LevelAnswer,
  LevelAttempt,
  PendingReview,
  Question,
  QuestionOption,
} from '../domain/types';
import { rankForXp } from '../domain/rules';
import { formatDateTime, formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { getResult } from '../services/appService';
import { useAppStore } from '../store/useAppStore';
import { MathText } from '../components/MathText';
import { DifficultyBadge, ProgressBar, Stars } from '../components/ui';

function gradeLabel(grade: Grade | null): string {
  if (grade === 'correct') return '做对';
  if (grade === 'partial') return '部分对';
  if (grade === 'wrong') return '做错';
  return '未自评';
}

function answerTypeLabel(type: LevelAnswer['type']): string {
  return QUESTION_TYPE_LABEL[type];
}

function ChoiceResponse({
  response,
  options,
  optionsOrder,
}: {
  response: string | boolean | null;
  options?: QuestionOption[];
  optionsOrder: string[];
}): JSX.Element {
  if (response === null || response === '') {
    return <span className="empty-response">未作答</span>;
  }
  if (typeof response === 'boolean') {
    return <>{response ? '正确' : '错误'}</>;
  }
  const index = optionsOrder.indexOf(response);
  const option = options?.find((candidate) => candidate.id === response);
  return (
    <span className="choice-response">
      <span className="answer-option-letter">
        {index >= 0 ? String.fromCharCode(65 + index) : '?'}
      </span>
      <MathText as="span">{option?.text ?? response}</MathText>
    </span>
  );
}

function AnswerResponse({ answer }: { answer: LevelAnswer }): JSX.Element {
  if (answer.response === null || answer.response === '') {
    return <span className="empty-response">未作答</span>;
  }
  if (answer.type === 'judge') {
    return <>{answer.response === true ? '正确' : '错误'}</>;
  }
  if (answer.type === 'choice') {
    return (
      <ChoiceResponse
        response={answer.response}
        options={answer.questionSnapshot.options}
        optionsOrder={answer.optionsOrder}
      />
    );
  }
  return <span className="solution-response">{String(answer.response)}</span>;
}

function PendingResponse({
  question,
  response,
  optionsOrder,
}: {
  question: Question;
  response: string | boolean | null;
  optionsOrder: string[];
}): JSX.Element {
  if (!response && response !== false) return <span className="empty-response">未作答</span>;
  if (question.type === 'judge') {
    return <>{response === true ? '正确' : '错误'}</>;
  }
  if (question.type === 'solution') {
    return <span className="solution-response">{String(response)}</span>;
  }
  return (
    <ChoiceResponse response={response} options={question.options} optionsOrder={optionsOrder} />
  );
}

function optionLabel(answer: LevelAnswer, optionId: string): string {
  const index = answer.optionsOrder.indexOf(optionId);
  const option = answer.questionSnapshot.options?.find((item) => item.id === optionId);
  return `${index >= 0 ? String.fromCharCode(65 + index) : ''} ${option?.text ?? optionId}`.trim();
}

function correctAnswerText(answer: LevelAnswer): string {
  const question = answer.questionSnapshot;
  if (question.type === 'choice') return optionLabel(answer, String(question.answer));
  if (question.type === 'judge') return question.answer === true ? '正确' : '错误';
  return String(question.answer);
}

export function ResultPage({ id }: { id: string }): JSX.Element {
  const loading = useAppStore((state) => state.loading);
  const pendingReview = useAppStore((state) => state.pendingReview);
  const [attempt, setAttempt] = useState<LevelAttempt | null>(null);
  const [answers, setAnswers] = useState<LevelAnswer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingResult, setLoadingResult] = useState(true);

  useEffect(() => {
    if (id.startsWith('review_')) {
      setLoadingResult(false);
      return;
    }
    let active = true;
    setLoadingResult(true);
    setLoadError(null);
    getResult(id)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setLoadError('结算记录不存在，可能已被备份覆盖。');
        } else {
          setAttempt(result.attempt);
          setAnswers(result.answers);
        }
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : '无法读取结算记录');
      })
      .finally(() => {
        if (active) setLoadingResult(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (id.startsWith('review_')) {
    if (loading) return <div className="empty-state">正在读取待结算关卡…</div>;
    if (pendingReview?.id === id) {
      return <PendingReviewView pending={pendingReview} />;
    }
    return (
      <ResultError
        title="自评记录不在了"
        copy="这条待结算记录可能已被刷新覆盖或恢复备份替换。请回到章节地图重新挑战本关。"
      />
    );
  }

  if (loadingResult || loading) return <div className="empty-state">正在读取结算记录…</div>;
  if (loadError || !attempt) {
    return <ResultError title="无法打开结算" copy={loadError ?? '记录不存在'} />;
  }
  return <FinalResultView attempt={attempt} answers={answers} />;
}

function ResultError({ title, copy }: { title: string; copy: string }): JSX.Element {
  return (
    <div className="page">
      <div className="empty-state result-error">
        <h1>{title}</h1>
        <p>{copy}</p>
        <div className="inline-actions">
          <button className="button primary" onClick={() => navigate('/map')}>
            返回章节地图
          </button>
          <button className="button ghost" onClick={() => navigate('/')}>
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingReviewView({ pending }: { pending: PendingReview }): JSX.Element {
  const questions = useAppStore((state) => state.questions);
  const levels = useAppStore((state) => state.levels);
  const finalizePending = useAppStore((state) => state.finalizePending);
  const showToast = useAppStore((state) => state.showToast);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [busy, setBusy] = useState(false);
  const run = pending.run;
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const level = levels.find((item) => item.id === run.levelId);
  const solutionIds = run.questionIds.filter((qid) => {
    const question = questionById.get(qid);
    return question?.type === 'solution' && run.answers[qid]?.submitted;
  });
  const allGraded = solutionIds.every((qid) => Boolean(grades[qid]));

  const handleFinalize = async () => {
    if (!allGraded) {
      showToast('还有解答题没有自评');
      return;
    }
    setBusy(true);
    try {
      const attemptId = await finalizePending(grades);
      navigate(`/result/${attemptId}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '结算失败');
      setBusy(false);
    }
  };

  return (
    <div className="page result-page pending-result">
      <button className="back-link" onClick={() => navigate('/map')}>
        ← 章节地图
      </button>
      <section className="result-hero pending-hero">
        <div className="result-eyebrow">本关已答完 · 等待自评</div>
        <div className="pending-star-display" aria-label="等待自评后揭晓星级">
          <span>★</span>
          <span>★</span>
          <span>★</span>
        </div>
        <h1>{run.levelName}</h1>
        <p>
          {run.isTrial ? '错题试炼 · 只做复习，不计章节星' : `${TIER_LABEL[run.tier]} · 第 ${run.chapter} 章`}
        </p>
        <div className="pending-callout">
          <strong>星级尚未计算</strong>
          <span>
            解答题不自动判分。请对照参考答案逐题选择“做对 / 部分对 / 做错”，全部完成后才会写入星级、XP 与错题本。
          </span>
        </div>
      </section>

      <section className="review-section">
        <div className="section-title-row">
          <div>
            <span className="card-eyebrow">解答题自评</span>
            <h2>先对自己的步骤负责</h2>
          </div>
          <span className="auto-note">选择题与判断题已封存，结算后统一揭晓</span>
        </div>

        <div className="review-list">
          {run.questionIds.map((qid, index) => {
            const question = questionById.get(qid);
            const answer = run.answers[qid];
            if (!question || !answer) return null;
            const isSolution = question.type === 'solution';
            const needsGrade = isSolution && answer.submitted;
            const submitted = answer.submitted;
            return (
              <article className="review-item pending-review-item" key={qid}>
                <div className="review-item-head">
                  <span className="review-number">Q{String(index + 1).padStart(2, '0')}</span>
                  <div className="review-tags">
                    <span className="muted-chip">{answerTypeLabel(question.type)}</span>
                    <DifficultyBadge difficulty={question.difficulty} />
                    <span className="muted-chip">{question.topic}</span>
                    <span
                      className={question.source === '网络改编' ? 'source-tag adapted' : 'source-tag'}
                    >
                      {question.source}
                    </span>
                  </div>
                  <span className="pending-status">
                    {!submitted ? '未作答' : needsGrade ? '待自评' : '已记录'}
                  </span>
                </div>
                <MathText className="review-stem">{question.stem}</MathText>
                <div className="response-box">
                  <span className="response-label">你的作答</span>
                  <div className={`response-content ${!submitted ? 'empty' : ''}`}>
                    {submitted ? (
                      <PendingResponse
                        question={question}
                        response={answer.response}
                        optionsOrder={run.optionOrders[qid] ?? []}
                      />
                    ) : (
                      '未作答（按错误计入分母）'
                    )}
                  </div>
                </div>

                {needsGrade ? (
                  <>
                    <div className="reference-box">
                      <span className="response-label">参考答案</span>
                      <MathText className="reference-answer">{String(question.answer)}</MathText>
                      <div className="explanation-box">
                        <span>解析</span>
                        <MathText>{question.explanation}</MathText>
                      </div>
                    </div>
                    <div className="self-grade-row">
                      <span>这道解答题你做得怎么样？</span>
                      <div className="segmented">
                        {(['correct', 'partial', 'wrong'] as const).map((grade) => (
                          <button
                            key={grade}
                            className={grades[qid] === grade ? 'active' : ''}
                            onClick={() => setGrades((prev) => ({ ...prev, [qid]: grade }))}
                          >
                            {gradeLabel(grade)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {!needsGrade && isSolution ? (
                  <div className="pending-status-note">未作答的解答题按错误计入，不进入自评。</div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <div className="pending-final-bar">
        <div>
          <strong>{solutionIds.filter((qid) => grades[qid]).length} / {solutionIds.length}</strong>
          <span>道解答题已自评</span>
        </div>
        <button
          className="button primary large"
          onClick={handleFinalize}
          disabled={!allGraded || busy}
        >
          {busy ? '正在结算…' : '完成自评，揭晓结果'}
        </button>
      </div>
      <p className="pending-footnote">
        关卡{level ? `「${level.name}」` : ''}的星级以最终正确率为准；“部分对”按 0.5 题计入，并会打断连击。
      </p>
    </div>
  );
}

function FinalResultView({
  attempt,
  answers,
}: {
  attempt: LevelAttempt;
  answers: LevelAnswer[];
}): JSX.Element {
  const profile = useAppStore((state) => state.profile);
  const levels = useAppStore((state) => state.levels);
  if (!profile) return <div className="empty-state">正在载入结算…</div>;

  const rank = rankForXp(profile.totalXp);
  const firstRecord = attempt.prevBestStars === 0;
  const improved = !firstRecord && attempt.stars > attempt.prevBestStars;
  const matched = attempt.stars === attempt.prevBestStars && attempt.prevBestStars > 0;
  const newUnlockNames = attempt.newUnlocks
    .map((levelId) => levels.find((level) => level.id === levelId))
    .filter((level): level is NonNullable<typeof level> => Boolean(level));
  const score = answers.reduce((sum, item) => sum + item.earned, 0);
  const pendingChapter = profile.pendingUnlocks[0];

  return (
    <div
      className={`page result-page final-result-page ${
        attempt.stars === 3 ? 'result-perfect' : ''
      }`}
    >
      <button className="back-link" onClick={() => navigate('/map')}>
        ← 章节地图
      </button>

      <section className="result-hero">
        <div className="result-eyebrow">
          {attempt.isTrial
            ? attempt.levelId.startsWith('targeted-')
              ? '靶向突破结算'
              : '错题试炼结算'
            : `${TIER_LABEL[attempt.tier]} · 第 ${attempt.chapter} 章`}
        </div>
        <div className="result-stars" aria-label={`本次 ${attempt.stars} 星`}>
          {[1, 2, 3].map((index) => (
            <span
              key={index}
              className={`result-star ${index <= attempt.stars ? 'lit' : ''}`}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              ★
            </span>
          ))}
        </div>
        <h1>{attempt.levelName}</h1>
        <p className="result-subline">
          {formatDateTime(attempt.finishedAt)} · {attempt.status === 'abandoned' ? '未完成记录' : '本次结算'}
        </p>
        {attempt.status === 'abandoned' ? (
          <div className="abandon-note">这是一条未完成记录，未获得星级与 XP。重新挑战会重新洗牌。</div>
        ) : null}
        <div className="result-headline">
          {attempt.stars >= 1
            ? attempt.stars === 3
              ? '满星通过'
              : `${attempt.stars} 星通关`
            : '未达通关线'}
        </div>
        {firstRecord && attempt.stars > 0 ? (
          <span className="record-flag neutral">首次记录</span>
        ) : improved ? (
          <span className="record-flag">刷新历史最高</span>
        ) : matched ? (
          <span className="record-flag neutral">追平历史最高</span>
        ) : null}
      </section>

      <section className="result-metrics-grid">
        <div className="metric-card">
          <span>总用时</span>
          <strong>{formatDuration(attempt.durationSec)}</strong>
          <small>目标 {formatDuration(attempt.targetSec)}</small>
        </div>
        <div className="metric-card">
          <span>正确率</span>
          <strong>{Math.round(attempt.accuracy * 100)}%</strong>
          <small>{score.toFixed(1)} / {answers.length} 题</small>
        </div>
        <div className="metric-card">
          <span>最高连击</span>
          <strong>{attempt.maxCombo}</strong>
          <small>部分对会打断连击</small>
        </div>
        <div className="metric-card xp-metric">
          <span>本轮 XP</span>
          <strong>+{attempt.xpEarned}</strong>
          <small>单关上限 {MAX_LEVEL_XP}</small>
        </div>
      </section>

      <section className="answer-review-section">
        <div className="section-title-row">
          <div>
            <span className="card-eyebrow">逐题回顾</span>
            <h2>对错、作答与完整解析</h2>
          </div>
          <span className="review-count">{answers.length} 题</span>
        </div>
        <div className="review-list">
          {answers.map((answer) => {
            const isCorrect = answer.earned === 1;
            const isPartial = answer.earned === 0.5;
            return (
              <article className="review-item" key={answer.id}>
                <div className="review-item-head">
                  <span className="review-number">Q{String(answer.order + 1).padStart(2, '0')}</span>
                  <div className="review-tags">
                    <span className="muted-chip">{answerTypeLabel(answer.type)}</span>
                    <DifficultyBadge difficulty={answer.difficulty} />
                    <span className="muted-chip">{answer.topic}</span>
                    <span
                      className={
                        answer.questionSnapshot.source === '网络改编'
                          ? 'source-tag adapted'
                          : 'source-tag'
                      }
                    >
                      {answer.questionSnapshot.source}
                    </span>
                  </div>
                  <span
                    className={`result-badge ${
                      isCorrect ? 'correct' : isPartial ? 'partial' : 'wrong'
                    }`}
                  >
                    {isCorrect ? '做对' : isPartial ? '部分对' : '做错'}
                  </span>
                  <span className="review-time">{formatDuration(answer.timeSpentSec)}</span>
                </div>
                <MathText className="review-stem">{answer.questionSnapshot.stem}</MathText>
                <div className="answer-pair">
                  <div className="response-box">
                    <span className="response-label">你的作答</span>
                    <div className={`response-content ${answer.response === null ? 'empty' : ''}`}>
                      <AnswerResponse answer={answer} />
                    </div>
                  </div>
                  <div className="correct-box">
                    <span className="response-label">正确答案</span>
                    <MathText className="reference-answer">{correctAnswerText(answer)}</MathText>
                  </div>
                </div>
                <details
                  className="review-explanation"
                  onToggle={() => window.dispatchEvent(new Event('resize'))}
                >
                  <summary>查看完整解析</summary>
                  <div className="explanation-box">
                    <span>完整解析</span>
                    <MathText>{answer.questionSnapshot.explanation}</MathText>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <section className="result-compare-card">
        <div>
          <span className="card-eyebrow">星级对比</span>
          <h2>本次 {attempt.stars} 星</h2>
          <p>
            历史最高 {attempt.prevBestStars} 星
            {attempt.prevBestStars === 0
              ? ' · 这是第一次记录'
              : improved
                ? ' · 本次刷新'
                : matched
                  ? ' · 本次追平'
                  : ' · 本次未刷新'}
          </p>
        </div>
        <div className="compare-stars">
          <div>
            <span>本次</span>
            <Stars value={attempt.stars} />
          </div>
          <div>
            <span>历史最高</span>
            <Stars value={Math.max(attempt.prevBestStars, attempt.stars)} />
          </div>
        </div>
        {attempt.stars < 3 ? (
          <div className="next-star-hint">
            <strong>下一颗星怎么拿</strong>
            <span>
              {attempt.stars < 1
                ? '正确率先过 60%：优先补齐错题主题，再重试。'
                : attempt.stars === 1
                  ? '正确率到 80% 且用时不超过目标，可以拿到 2 星。'
                  : '正确率 100%，或 ≥ 90% 且连击 ≥ 4，才能拿到 3 星。'}
            </span>
          </div>
        ) : null}
      </section>

      <section className="result-encouragement-section">
        <span className="card-eyebrow">这一轮</span>
        <p className="result-encouragement">{attempt.encouragement}</p>
      </section>

      <section className="result-two-col">
        <article className="advice-card">
          <span className="card-eyebrow">刷题建议</span>
          <h2>下一步做这三件事</h2>
          <ol className="suggestion-list">
            {attempt.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ol>
        </article>

        <article className="xp-rank-card">
          <span className="card-eyebrow">成长</span>
          <div className="xp-rank-head">
            <div>
              <h2>{rank.title} · {rank.epithet}</h2>
              <p>累计 {profile.totalXp.toLocaleString()} XP · 连续 {attempt.streakDays} 天</p>
            </div>
            <span className="xp-big">+{attempt.xpEarned}</span>
          </div>
          <ProgressBar value={rank.progress * 100} max={100} label="段位进度" />
          <div className="rank-progress-copy">
            <span>{rank.title}</span>
            <span>
              {rank.nextTitle ? `距「${rank.nextTitle}」还差 ${rank.toNext} XP` : '最高段位'}
            </span>
          </div>
          {attempt.isTrial ? (
            <p className="trial-note">错题试炼只按答对题数给 XP，不计入章节总星数，也没有完成与三星奖励。</p>
          ) : null}
          {attempt.xpEarned === 0 ? <p className="xp-zero-note">本轮没有获得 XP。</p> : null}
          {attempt.prevBestStars === 3 && !attempt.isTrial ? (
            <p className="trial-note">重刷已三星关卡：本轮按 ×0.3 计入，且不再获得三星额外 50 XP。</p>
          ) : null}

          <div className="unlock-list">
            <span className="unlock-title">解锁进度</span>
            {newUnlockNames.length > 0 ? (
              newUnlockNames.map((level) => (
                <button
                  className="unlock-chip"
                  key={level.id}
                  onClick={() => navigate(`/level/${level.id}`)}
                >
                  <span>新解锁</span>
                  {level.name}
                </button>
              ))
            ) : (
              <span className="small-note">本轮没有自动解锁新关卡。</span>
            )}
            {attempt.chapterCleared ? (
              <div className="chapter-clear-note">
                本章 Boss 已达 1 星，视为通关。
                {attempt.chapter < 7 ? '下一章需要在章节地图手动确认解锁。' : '上册七章全部通关。'}
              </div>
            ) : null}
            {pendingChapter ? (
              <button className="unlock-chip pending" onClick={() => navigate('/map')}>
                <span>待确认</span>第 {pendingChapter} 章基础关
              </button>
            ) : null}
          </div>
        </article>
      </section>

      <div className="result-actions">
        <button
          className="button primary"
          onClick={() => navigate(attempt.isTrial ? '/wrong' : `/level/${attempt.levelId}`)}
        >
          {attempt.isTrial ? '回到错题本' : '再挑战本关'}
        </button>
        <button className="button ghost" onClick={() => navigate('/map')}>
          返回章节地图
        </button>
        <button className="button ghost" onClick={() => navigate('/')}>
          首页
        </button>
      </div>
    </div>
  );
}
