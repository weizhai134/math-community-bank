import { useEffect, useRef, useState } from 'react';
import {
  EXAM_DIFFICULTY_LABEL,
  type ExamSession,
} from '../domain/exam';
import { QUESTION_TYPE_LABEL } from '../domain/constants';
import { formatClock, formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import {
  loadExamSession,
  markExamSubmitted,
  saveExamSession,
} from '../services/examService';
import { MathText } from '../components/MathText';
import { ChoiceOptions, JudgeButtons, SolutionInput } from '../components/AnswerInputs';
import { ConfirmDialog } from '../components/Modal';
import { DifficultyBadge } from '../components/ui';

type ResponseValue = string | boolean | null;

export function ExamPlayPage(): JSX.Element {
  const questions = useAppStore((state) => state.questions);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<ExamSession | null>(null);
  const submitRef = useRef(false);

  const submitExam = async () => {
    const current = sessionRef.current;
    if (!current || submitRef.current) return;
    submitRef.current = true;
    try {
      const submitted = await markExamSubmitted(current);
      sessionRef.current = submitted;
      setSession(submitted);
      navigate('/exam/result');
    } catch (submitError) {
      submitRef.current = false;
      setError(submitError instanceof Error ? submitError.message : '交卷失败，请重试');
    }
  };

  useEffect(() => {
    let active = true;
    loadExamSession()
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          setLoading(false);
          return;
        }
        if (loaded.submittedAt) {
          navigate('/exam/result');
          return;
        }
        sessionRef.current = loaded;
        setSession(loaded);
        const left = Math.max(0, Math.ceil((loaded.deadlineAt - Date.now()) / 1000));
        setRemaining(left);
        setLoading(false);
        if (left <= 0) void submitExam();
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '无法读取考试');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((session.deadlineAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) void submitExam();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    if (!session || session.submittedAt) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [session]);

  const updateResponse = (questionId: string, response: ResponseValue) => {
    const current = sessionRef.current;
    if (!current) return;
    const next: ExamSession = {
      ...current,
      answers: { ...current.answers, [questionId]: { response } },
    };
    sessionRef.current = next;
    setSession(next);
    void saveExamSession(next);
  };

  const goTo = (index: number) => {
    const current = sessionRef.current;
    if (!current) return;
    const next = { ...current, currentIndex: index };
    sessionRef.current = next;
    setSession(next);
    void saveExamSession(next);
  };

  if (loading) return <div className="empty-state">正在打开模拟考场…</div>;

  if (!session) {
    return (
      <div className="empty-state">
        <h1>没有正在进行的模拟考</h1>
        <p>先选择一套试卷梯度并开始考试。</p>
        <button className="button primary" onClick={() => navigate('/exam')}>
          去模拟考场
        </button>
      </div>
    );
  }

  const currentId = session.questionIds[session.currentIndex];
  const question = questions.find((item) => item.id === currentId);
  if (!question) {
    return (
      <div className="empty-state">
        <h1>题目数据缺失</h1>
        <p>题库可能在考试期间被替换，请交卷后重新组卷。</p>
        <button className="button primary" onClick={() => void submitExam()}>
          交卷
        </button>
      </div>
    );
  }

  const response = session.answers[currentId]?.response ?? null;
  const total = session.questionIds.length;
  const answered = session.questionIds.filter((id) => {
    const value = session.answers[id]?.response;
    return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
  }).length;
  const isLast = session.currentIndex >= total - 1;
  const progress = total > 0 ? ((session.currentIndex + 1) / total) * 100 : 0;
  const options = (question.options ?? [])
    .slice()
    .sort((a, b) => {
      const order = session.optionOrders[question.id] ?? [];
      return order.indexOf(a.id) - order.indexOf(b.id);
    });

  return (
    <div className="focus-shell exam-shell">
      <header className="play-header exam-play-header">
        <button className="play-exit" onClick={() => setExitOpen(true)}>
          ← 退出考场
        </button>
        <div className="play-title">
          <span>{EXAM_DIFFICULTY_LABEL[session.difficulty]} · 期末模拟</span>
          <strong>期末预测</strong>
        </div>
        <div className={`exam-timer ${remaining <= 300 ? 'urgent' : ''}`}>
          <span>剩余</span>
          <strong>{formatClock(remaining)}</strong>
        </div>
      </header>

      <div className="play-progress-line">
        <span style={{ width: `${progress}%` }} />
      </div>

      <main className="play-main exam-main">
        <section className="play-statusbar">
          <div>
            <span>题型</span>
            <strong>{QUESTION_TYPE_LABEL[question.type]}</strong>
          </div>
          <div>
            <span>难度</span>
            <DifficultyBadge difficulty={question.difficulty} />
          </div>
          <div>
            <span>已答</span>
            <strong>{answered} / {total}</strong>
          </div>
          <div>
            <span>本题</span>
            <strong>{session.currentIndex + 1} / {total}</strong>
          </div>
        </section>

        <section className="question-card exam-question-card">
          <div className="question-meta">
            <span className="question-number">
              Q{String(session.currentIndex + 1).padStart(2, '0')}
            </span>
            <span>{QUESTION_TYPE_LABEL[question.type]}</span>
            <span>{question.topic}</span>
            <span className="source-tag">{question.source}</span>
          </div>
          <MathText className="question-stem" as="div">
            {question.stem}
          </MathText>

          {question.type === 'choice' ? (
            <ChoiceOptions
              options={options}
              selected={response}
              disabled={false}
              onSelect={(value) => updateResponse(currentId, value)}
            />
          ) : null}
          {question.type === 'judge' ? (
            <JudgeButtons
              value={response}
              disabled={false}
              onChange={(value) => updateResponse(currentId, value)}
            />
          ) : null}
          {question.type === 'solution' ? (
            <SolutionInput
              inputId="exam-solution-input"
              value={typeof response === 'string' ? response : ''}
              disabled={false}
              onChange={(value) => updateResponse(currentId, value)}
              placeholder="写出关键步骤与最终结果。考试期间不显示对错与解析，交卷后再自评。"
            />
          ) : null}
        </section>

        <nav className="exam-nav" aria-label="题号导航">
          {session.questionIds.map((id, index) => {
            const value = session.answers[id]?.response;
            const hasAnswer =
              typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
            return (
              <button
                key={id}
                type="button"
                className={`exam-nav-button ${index === session.currentIndex ? 'current' : ''} ${
                  hasAnswer ? 'answered' : ''
                }`}
                onClick={() => goTo(index)}
                aria-label={`第 ${index + 1} 题${hasAnswer ? '，已作答' : '，未作答'}`}
              >
                {index + 1}
              </button>
            );
          })}
        </nav>

        {error ? <div className="community-notice floating">{error}</div> : null}
      </main>

      <footer className="play-footer exam-footer">
        <div className="play-footer-side">
          <button
            className="text-button"
            onClick={() => goTo(Math.max(0, session.currentIndex - 1))}
            disabled={session.currentIndex === 0}
          >
            ← 上一题
          </button>
          <button className="text-button" onClick={() => setSubmitOpen(true)}>
            提前交卷
          </button>
        </div>
        <button
          className="button primary play-primary"
          onClick={() => {
            if (isLast) {
              setSubmitOpen(true);
              return;
            }
            goTo(session.currentIndex + 1);
          }}
        >
          {isLast ? '检查并交卷' : '下一题 →'}
        </button>
      </footer>

      <ConfirmDialog
        open={submitOpen}
        title="确认交卷？"
        confirmLabel="交卷并自评"
        cancelLabel="继续作答"
        danger
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() => {
          setSubmitOpen(false);
          void submitExam();
        }}
      >
        <p>
          当前已答 {answered} / {total} 题，剩余时间 {formatDuration(Math.floor(remaining))}。
          交卷后不能再修改答案，解答题需要自评。
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={exitOpen}
        title="暂时退出考场？"
        confirmLabel="退出并保留考试"
        cancelLabel="继续作答"
        onCancel={() => setExitOpen(false)}
        onConfirm={() => {
          setExitOpen(false);
          navigate('/exam');
        }}
      >
        <p>考试不会暂停，倒计时会继续。之后可以从模拟考场入口继续。</p>
      </ConfirmDialog>
    </div>
  );
}
