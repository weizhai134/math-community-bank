import { useEffect, useRef, useState } from 'react';
import {
  EXAM_DIFFICULTY_LABEL,
  type ExamResult,
  type ExamResultItem,
  type ExamSession,
} from '../domain/exam';
import { QUESTION_TYPE_LABEL } from '../domain/constants';
import type { Grade, Question } from '../domain/types';
import { formatDateTime, formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import {
  finalizeExam,
  loadExamResult,
  loadExamSession,
  saveExamSession,
} from '../services/examService';
import { MathText } from '../components/MathText';
import { DifficultyBadge } from '../components/ui';

const GRADE_LABEL: Record<Grade, string> = {
  correct: '做对',
  partial: '部分对',
  wrong: '做错',
};

function optionLabel(question: Question, optionId: string | boolean | null): string {
  if (optionId === null || optionId === '') return '未作答';
  const options = question.options ?? [];
  const index = options.findIndex((option) => option.id === String(optionId));
  const option = options[index];
  if (!option) return String(optionId);
  return `${String.fromCharCode(65 + index)}. ${option.text}`;
}

function responseText(item: ExamResultItem): string {
  const question = item.question;
  if (item.response === null || item.response === '') return '未作答';
  if (question.type === 'judge') return item.response === true ? '正确' : '错误';
  if (question.type === 'choice') return optionLabel(question, item.response);
  return String(item.response);
}

function correctText(item: ExamResultItem): string {
  const question = item.question;
  if (question.type === 'choice') return optionLabel(question, question.answer);
  if (question.type === 'judge') return question.answer === true ? '正确' : '错误';
  return String(question.answer);
}

export function ExamResultPage(): JSX.Element {
  const questions = useAppStore((state) => state.questions);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<ExamSession | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadExamResult(), loadExamSession()])
      .then(([loadedResult, loadedSession]) => {
        if (!active) return;
        setResult(loadedResult);
        setSession(loadedSession);
        sessionRef.current = loadedSession;
        setGrades(loadedSession?.selfGrades ?? {});
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : '无法读取成绩');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="empty-state">正在读取模拟考成绩…</div>;

  if (!session) {
    if (result) return <ExamReport result={result} />;
    return (
      <div className="page">
        <div className="empty-state">
          <h1>还没有模拟考成绩</h1>
          <p>{error ?? '先完成一场期末模拟考，成绩单会显示在这里。'}</p>
          <button className="button primary" onClick={() => navigate('/exam')}>
            去模拟考场
          </button>
        </div>
      </div>
    );
  }

  if (!session.submittedAt) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1>考试还在进行中</h1>
          <p>交卷后才能自评并生成成绩单。</p>
          <button className="button primary" onClick={() => navigate('/exam/play')}>
            继续考试
          </button>
        </div>
      </div>
    );
  }

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const solutions = session.questionIds
    .map((id) => questionMap.get(id))
    .filter(
      (question): question is Question =>
        question !== undefined && question.type === 'solution',
    )
    .filter((question) => {
      const response = session.answers[question.id]?.response;
      return typeof response === 'string' && response.trim().length > 0;
    });
  const allGraded = solutions.every((question) => Boolean(grades[question.id]));

  const handleGrade = (questionId: string, grade: Grade) => {
    const nextGrades = { ...grades, [questionId]: grade };
    setGrades(nextGrades);
    const current = sessionRef.current;
    if (!current) return;
    const nextSession: ExamSession = { ...current, selfGrades: nextGrades };
    sessionRef.current = nextSession;
    setSession(nextSession);
    void saveExamSession(nextSession);
  };

  const handleFinalize = async () => {
    if (!allGraded) {
      setError('还有解答题没有自评');
      return;
    }
    const current = sessionRef.current;
    if (!current) {
      setError('考试记录已失效，请返回模拟考场');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const finalResult = await finalizeExam(current, questions);
      setResult(finalResult);
      setSession(null);
      sessionRef.current = null;
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : '成绩计算失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page exam-result-page">
      <button className="back-link" onClick={() => navigate('/exam')}>
        ← 模拟考场
      </button>

      <header className="exam-result-hero">
        <span className="card-eyebrow">已交卷 · 等待解答题自评</span>
        <h1>期末预测成绩单</h1>
        <p>
          {EXAM_DIFFICULTY_LABEL[session.difficulty]} · 交卷于 {formatDateTime(session.submittedAt)}
        </p>
      </header>

      <section className="exam-self-grade-list">
        <div className="section-title-row">
          <div>
            <span className="card-eyebrow">解答题自评</span>
            <h2>对照参考答案，如实评分</h2>
          </div>
          <span className="small-note">
            {solutions.filter((question) => grades[question.id]).length} / {solutions.length} 已评
          </span>
        </div>

        {solutions.map((question, index) => {
          const answer = session.answers[question.id];
          return (
            <article className="exam-self-grade-item" key={question.id}>
              <div className="exam-self-grade-head">
                <span>解答题 {index + 1}</span>
                <span className="muted-chip">{question.topic}</span>
                <DifficultyBadge difficulty={question.difficulty} />
              </div>
              <MathText className="review-stem">{question.stem}</MathText>
              <div className="response-box">
                <span className="response-label">你的作答</span>
                <div className="response-content">{String(answer?.response ?? '')}</div>
              </div>
              <div className="reference-box">
                <span className="response-label">参考答案</span>
                <MathText className="reference-answer">{String(question.answer)}</MathText>
                <div className="explanation-box">
                  <span>解析</span>
                  <MathText>{question.explanation}</MathText>
                </div>
              </div>
              <div className="self-grade-row">
                <span>这道题你做得怎么样？</span>
                <div className="segmented">
                  {(['correct', 'partial', 'wrong'] as const).map((grade) => (
                    <button
                      key={grade}
                      className={grades[question.id] === grade ? 'active' : ''}
                      onClick={() => handleGrade(question.id, grade)}
                    >
                      {GRADE_LABEL[grade]}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {solutions.length === 0 ? (
        <p className="small-note">本卷没有已作答的解答题，未作答解答题会按错误计入。</p>
      ) : null}

      {error ? <div className="community-notice">{error}</div> : null}

      <div className="pending-final-bar">
        <div>
          <strong>{solutions.filter((question) => grades[question.id]).length}</strong>
          <span> / {solutions.length} 道解答题已评</span>
        </div>
        <button
          className="button primary large"
          disabled={busy || !allGraded}
          onClick={() => void handleFinalize()}
        >
          {busy ? '正在生成成绩单…' : '完成自评，生成成绩单'}
        </button>
      </div>
    </div>
  );
}

function ExamReport({ result }: { result: ExamResult }): JSX.Element {
  const groups = [
    { type: 'choice' as const, label: '选择题' },
    { type: 'judge' as const, label: '判断题' },
    { type: 'solution' as const, label: '解答题' },
  ];
  const wrongItems = result.items.filter((item) => item.earned < 1);

  return (
    <div className="page exam-report-page">
      <button className="back-link" onClick={() => navigate('/exam')}>
        ← 模拟考场
      </button>

      <header className="exam-report-hero">
        <span className="card-eyebrow">期末预测 · {EXAM_DIFFICULTY_LABEL[result.difficulty]}</span>
        <h1>期末预测成绩单</h1>
        <p>
          {formatDateTime(result.finishedAt)} · 用时 {formatDuration(result.durationSec)}
        </p>
        <div className="exam-score-display">
          <strong>{result.score.toFixed(1)}</strong>
          <span>/ {result.total} 分</span>
        </div>
        <div className="exam-report-metrics">
          <div>
            <span>正确率</span>
            <strong>{Math.round(result.accuracy * 100)}%</strong>
          </div>
          <div>
            <span>答错/部分对</span>
            <strong>{wrongItems.length} 题</strong>
          </div>
          <div>
            <span>总题数</span>
            <strong>{result.total} 题</strong>
          </div>
        </div>
      </header>

      <section className="exam-section-stats">
        {groups.map((group) => {
          const items = result.items.filter((item) => item.question.type === group.type);
          const earned = items.reduce((sum, item) => sum + item.earned, 0);
          return (
            <article className="exam-stat-card" key={group.type}>
              <span>{group.label}</span>
              <strong>{earned.toFixed(1)} / {items.length}</strong>
              <small>
                正确率 {items.length > 0 ? Math.round((earned / items.length) * 100) : 0}%
              </small>
            </article>
          );
        })}
      </section>

      <section className="exam-wrong-report">
        <div className="section-title-row">
          <div>
            <span className="card-eyebrow">错题报告</span>
            <h2>需要补回来的题</h2>
          </div>
          <span className="small-note">答错题已进入错题本</span>
        </div>

        {wrongItems.length === 0 ? (
          <div className="exam-perfect-note">本次没有答错题，预测成绩很稳。</div>
        ) : (
          <div className="exam-wrong-list">
            {wrongItems.map((item, index) => (
              <article className="exam-wrong-item" key={item.question.id}>
                <div className="review-item-head">
                  <span className="review-number">Q{String(index + 1).padStart(2, '0')}</span>
                  <span className="muted-chip">{QUESTION_TYPE_LABEL[item.question.type]}</span>
                  <DifficultyBadge difficulty={item.question.difficulty} />
                  <span className="muted-chip">{item.question.topic}</span>
                  <span className={`result-badge ${item.earned === 0.5 ? 'partial' : 'wrong'}`}>
                    {item.earned === 0.5 ? '部分对' : '做错'}
                  </span>
                </div>
                <MathText className="review-stem">{item.question.stem}</MathText>
                <div className="answer-pair">
                  <div className="response-box">
                    <span className="response-label">你的作答</span>
                    <div className="response-content">
                      <MathText as="span">{responseText(item)}</MathText>
                    </div>
                  </div>
                  <div className="correct-box">
                    <span className="response-label">正确答案</span>
                    <MathText className="reference-answer">{correctText(item)}</MathText>
                  </div>
                </div>
                <div className="explanation-box">
                  <span>完整解析</span>
                  <MathText>{item.question.explanation}</MathText>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="result-actions">
        <button className="button primary" onClick={() => navigate('/exam')}>
          再考一次
        </button>
        <button className="button ghost" onClick={() => navigate('/wrong')}>
          去错题本
        </button>
        <button className="button ghost" onClick={() => navigate('/')}>
          返回首页
        </button>
      </div>
    </div>
  );
}
