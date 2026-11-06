import { useEffect, useState } from 'react';
import {
  EXAM_DIFFICULTY_DESC,
  EXAM_DIFFICULTY_LABEL,
  EXAM_DURATION_MINUTES,
  EXAM_TOTAL_QUESTIONS,
  type ExamDifficulty,
  type ExamResult,
  type ExamSession,
} from '../domain/exam';
import { formatClock, formatDateTime } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import {
  loadExamResult,
  loadExamSession,
  startExam,
} from '../services/examService';
import { ConfirmDialog } from '../components/Modal';

const DIFFICULTIES: ExamDifficulty[] = ['easy', 'medium', 'hard'];

export function ExamPage(): JSX.Element {
  const questions = useAppStore((state) => state.questions);
  const activeRun = useAppStore((state) => state.activeRun);
  const pendingReview = useAppStore((state) => state.pendingReview);
  const showToast = useAppStore((state) => state.showToast);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<ExamDifficulty | null>(null);
  const [pendingDifficulty, setPendingDifficulty] = useState<ExamDifficulty | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadExamSession(), loadExamResult()])
      .then(([loadedSession, loadedResult]) => {
        if (!active) return;
        setSession(loadedSession);
        setResult(loadedResult);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const begin = async (difficulty: ExamDifficulty) => {
    if (activeRun || pendingReview) {
      showToast('有未完成/待结算的关卡，处理完才能进入模拟考场');
      return;
    }
    setStarting(difficulty);
    try {
      const created = await startExam(difficulty, questions);
      setSession(created);
      navigate('/exam/play');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '组卷失败');
    } finally {
      setStarting(null);
    }
  };

  const handleStart = (difficulty: ExamDifficulty) => {
    if (session) {
      setPendingDifficulty(difficulty);
      return;
    }
    void begin(difficulty);
  };

  const remaining = session ? Math.max(0, session.deadlineAt - Date.now()) : 0;

  if (loading) return <div className="empty-state">正在读取模拟考场…</div>;

  return (
    <div className="page exam-page">
      <button className="back-link" onClick={() => navigate('/')}>
        ← 首页
      </button>

      <header className="exam-hero">
        <span className="card-eyebrow">期末模拟考场 · 独立于主线</span>
        <h1>用一场完整考试，预测你的期末分数</h1>
        <p>
          从题库随机组 {EXAM_TOTAL_QUESTIONS} 题：5 道选择、5 道判断、6 道解答。
          {EXAM_DURATION_MINUTES} 分钟倒计时，考试中不显示对错与解析，可自由跳题。
        </p>
        <div className="exam-hero-rules">
          <span>时间到自动交卷</span>
          <span>解答题交卷后自评</span>
          <span>答错题进入错题本</span>
          <span>不计章节星级</span>
        </div>
      </header>

      {session ? (
        <section className="exam-resume">
          <div>
            <span className="card-eyebrow">有一场考试正在进行</span>
            <h2>{EXAM_DIFFICULTY_LABEL[session.difficulty]}</h2>
            <p>
              开考 {formatDateTime(session.startedAt)} · 截止 {formatDateTime(session.deadlineAt)}
            </p>
          </div>
          <div className="exam-resume-side">
            <div className="exam-resume-clock">
              <span>剩余</span>
              <strong>{formatClock(Math.floor(remaining / 1000))}</strong>
            </div>
            <div className="inline-actions">
              <button className="button primary" onClick={() => navigate('/exam/play')}>
                继续考试 →
              </button>
              {session.submittedAt ? (
                <button className="button ghost" onClick={() => navigate('/exam/result')}>
                  去自评/看成绩
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="exam-last-result">
          <div>
            <span className="card-eyebrow">上次模拟成绩</span>
            <h2>
              {result.score.toFixed(1)} / {result.total} 分
            </h2>
            <p>
              {EXAM_DIFFICULTY_LABEL[result.difficulty]} · 正确率{' '}
              {Math.round(result.accuracy * 100)}% · {formatDateTime(result.finishedAt)}
            </p>
          </div>
          <button className="button ghost" onClick={() => navigate('/exam/result')}>
            查看上次成绩单 →
          </button>
        </section>
      ) : null}

      <section className="exam-options">
        <div className="section-title-row">
          <div>
            <span className="card-eyebrow">选择试卷梯度</span>
            <h2>三套难度，同一场考试规则</h2>
          </div>
          <span className="small-note">每次随机组卷</span>
        </div>
        <div className="exam-difficulty-grid">
          {DIFFICULTIES.map((difficulty) => (
            <article className="exam-difficulty-card" key={difficulty}>
              <div className="exam-difficulty-top">
                <span>{EXAM_DIFFICULTY_LABEL[difficulty]}</span>
                <strong>{EXAM_TOTAL_QUESTIONS} 题</strong>
              </div>
              <p>{EXAM_DIFFICULTY_DESC[difficulty]}</p>
              <ul>
                <li>5 选择 + 5 判断 + 6 解答</li>
                <li>{EXAM_DURATION_MINUTES} 分钟</li>
                <li>考试中无对错提示</li>
              </ul>
              <button
                className="button primary"
                disabled={starting !== null || Boolean(activeRun || pendingReview)}
                onClick={() => handleStart(difficulty)}
              >
                {starting === difficulty ? '组卷中…' : `开始${EXAM_DIFFICULTY_LABEL[difficulty]}`}
              </button>
            </article>
          ))}
        </div>
        {activeRun || pendingReview ? (
          <p className="small-note">当前有未完成/待结算的关卡，先处理完才能开始模拟考。</p>
        ) : null}
      </section>

      <section className="exam-rules-card">
        <div>
          <span className="card-eyebrow">考试规则</span>
          <h2>先看清楚，再开考</h2>
        </div>
        <ol>
          <li>选择题、判断题交卷后自动判分；解答题对照参考答案自评。</li>
          <li>考试期间只记录作答，不显示正确答案、解析或得分。</li>
          <li>可以自由上一题/下一题，不会因为切换题目重置计时。</li>
          <li>时间到自动交卷；提前交卷后不能再修改答案。</li>
          <li>答错的题会进入错题本，但不改变主线章节星级与解锁进度。</li>
        </ol>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDifficulty)}
        title="重新组卷？"
        confirmLabel="重新开始"
        cancelLabel="保留当前考试"
        danger
        onCancel={() => setPendingDifficulty(null)}
        onConfirm={() => {
          const difficulty = pendingDifficulty;
          setPendingDifficulty(null);
          if (difficulty) void begin(difficulty);
        }}
      >
        <p>重新组卷会覆盖当前正在进行的模拟考，已作答内容不会保留。</p>
      </ConfirmDialog>
    </div>
  );
}
