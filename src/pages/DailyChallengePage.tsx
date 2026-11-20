import { useEffect, useState } from 'react';
import { DAILY_CHALLENGE_XP, pickDailyQuestion } from '../domain/dailyChallenge';
import type { DailyChallengeRecord } from '../domain/dailyChallenge';
import type { Question } from '../domain/types';
import { formatShortDate, localDateKey } from '../lib/date';
import { navigate } from '../lib/router';
import { getTodayDailyChallenge, completeDailyChallenge } from '../services/dailyChallengeService';
import { useAppStore } from '../store/useAppStore';
import { ChoiceOptions, JudgeButtons } from '../components/AnswerInputs';
import { MathText } from '../components/MathText';
import { GraphButton } from '../components/GraphButton';
import { DifficultyBadge } from '../components/ui';

function answerLabel(question: Question, answer: string | boolean): string {
  if (question.type === 'judge') return answer ? '正确' : '错误';
  const option = question.options?.find((item) => item.id === answer);
  return option ? `${answer}. ${option.text}` : String(answer);
}

export function DailyChallengePage(): JSX.Element {
  const questions = useAppStore((state) => state.questions);
  const refresh = useAppStore((state) => state.refresh);
  const showToast = useAppStore((state) => state.showToast);
  const [today, setToday] = useState(() => localDateKey());
  const [record, setRecord] = useState<DailyChallengeRecord | null | undefined>(undefined);
  const [response, setResponse] = useState<string | boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDateKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setRecord(undefined);
    getTodayDailyChallenge()
      .then((value) => {
        if (active) setRecord(value);
      })
      .catch(() => {
        if (active) setRecord(null);
      });
    return () => {
      active = false;
    };
  }, [today]);

  const picked = pickDailyQuestion(questions, today);
  const question = record
    ? questions.find((item) => item.id === record.questionId) ?? picked
    : picked;

  const submit = async () => {
    if (!question || response === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await completeDailyChallenge(question, response);
      setRecord(result.record);
      await refresh();
      if (result.newlyRewarded) {
        showToast(`每日一题完成，额外 +${result.xp} XP`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setBusy(false);
    }
  };

  if (!question) {
    return (
      <div className="page daily-page">
        <div className="empty-state">
          <h1>今天的题目还没有准备好</h1>
          <p>题库中没有可自动判分的题目，请先检查题库。</p>
          <button className="button primary" onClick={() => navigate('/')}>
            回到首页
          </button>
        </div>
      </div>
    );
  }

  const completed = Boolean(record);

  return (
    <div className="page daily-page">
      <button className="text-link daily-back" onClick={() => navigate('/')}>
        ← 返回首页
      </button>

      <header className="daily-head">
        <div>
          <span className="eyebrow">每日一题 · 固定种子 · {today}</span>
          <h1>今天只写一道，也算向前。</h1>
          <p>
            同一天所有设备抽到同一道题；完成即得 {DAILY_CHALLENGE_XP} XP，每天只发一次。
            题目不进入章节星级和错题本，只作为当天的热身。
          </p>
        </div>
        <div className={`daily-status ${completed ? 'is-done' : ''}`}>
          <span>{completed ? '今日已完成' : '今日待完成'}</span>
          <strong>{completed ? `+${DAILY_CHALLENGE_XP} XP` : `+${DAILY_CHALLENGE_XP} XP`}</strong>
          <small>{completed ? '明天再来' : '完成即发'}</small>
        </div>
      </header>

      <section className="daily-card">
        <div className="question-meta">
          <span className="question-number">DAILY</span>
          <span>第 {question.chapter} 章</span>
          <span>{question.topic}</span>
          <span>{question.type === 'choice' ? '选择题' : '判断题'}</span>
          <DifficultyBadge difficulty={question.difficulty} />
        </div>
        <div className="question-stem-row">
          <MathText className="question-stem" as="div">
            {question.stem}
          </MathText>
          <GraphButton question={question} />
        </div>

        {!completed ? (
          <>
            {question.type === 'choice' ? (
              <ChoiceOptions
                options={question.options ?? []}
                selected={response}
                disabled={busy}
                onSelect={(value) => setResponse(value)}
              />
            ) : (
              <JudgeButtons value={response} disabled={busy} onChange={(value) => setResponse(value)} />
            )}
            {error ? <div className="form-error">{error}</div> : null}
            <div className="daily-actions">
              <button
                className="button primary"
                disabled={busy || response === null}
                onClick={() => void submit()}
              >
                {busy ? '正在提交…' : '提交并领取 20 XP'}
                {!busy ? <span className="button-arrow">→</span> : null}
              </button>
              <span className="small-note">提交后不可修改，明天再来换新题。</span>
            </div>
          </>
        ) : (
          <div className="daily-completed">
            <div className={`daily-result ${record?.correct ? 'correct' : 'wrong'}`}>
              <span>{record?.correct ? '答对了' : '这次先记下来'}</span>
              <strong>{record?.correct ? '漂亮，今天的高数已经热身完毕。' : '没关系，答案已经收进本机复习记录。'}</strong>
              <p>
                你的答案：
                {record ? (
                  <MathText as="span">{answerLabel(question, record.answer)}</MathText>
                ) : (
                  '—'
                )}
                {record ? ` · ${formatShortDate(record.completedAt)} 完成` : ''}
              </p>
            </div>
            <div className="daily-explanation">
              <span className="card-eyebrow">解析</span>
              <MathText as="div">{question.explanation}</MathText>
            </div>
            <div className="daily-actions">
              <button className="button ghost" onClick={() => navigate('/')}>
                回到首页
              </button>
              <span className="small-note">明天再来会抽到另一道题。</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
