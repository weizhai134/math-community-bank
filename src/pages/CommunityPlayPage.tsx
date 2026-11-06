import { useEffect, useRef, useState } from 'react';
import {
  QUESTION_TYPE_LABEL,
} from '../domain/constants';
import type { CommunityQuestion, CommunityRun } from '../domain/communityTypes';
import type { Grade } from '../domain/types';
import {
  advanceCommunityRun,
  applyCommunityAnswer,
  clearCommunityRun,
  communityRunNeedsSelfGrade,
  finishCommunityRun,
  loadCommunityRun,
  saveCommunityRun,
  setCommunityScratch,
  setCommunitySelfGrade,
} from '../services/communityService';
import { formatClock, formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import { MathText } from '../components/MathText';
import { ChoiceOptions, JudgeButtons, SolutionInput } from '../components/AnswerInputs';
import { ConfirmDialog } from '../components/Modal';
import { Scratchpad, type ScratchpadHandle } from '../components/Scratchpad';
import { DifficultyBadge } from '../components/ui';

type ResponseValue = string | boolean | null;

function orderedOptions(question: CommunityQuestion, order: string[] | undefined) {
  const options = question.options ?? [];
  if (!order || order.length === 0) return options;
  return [...options].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function CommunityPlayPage(): JSX.Element {
  const [run, setRun] = useState<CommunityRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<ResponseValue>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const timerKey = useRef('');
  const runRef = useRef<CommunityRun | null>(null);
  const scratchRef = useRef<ScratchpadHandle>(null);

  useEffect(() => {
    let active = true;
    loadCommunityRun()
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          setRun(null);
          setLoading(false);
          return;
        }
        const answer = loaded.answers[String(loaded.questionIds[loaded.index])];
        const stale = Date.now() - loaded.questionStartedAt > 10 * 60 * 1000;
        const next =
          !answer?.submitted && stale ? { ...loaded, questionStartedAt: Date.now() } : loaded;
        if (next !== loaded) void saveCommunityRun(next);
        runRef.current = next;
        setRun(next);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setNotice(error instanceof Error ? error.message : '无法读取练习');
        setLoading(false);
      });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const currentId = run?.questionIds[run.index];
  const currentQuestion = run && currentId !== undefined ? run.questions[String(currentId)] : null;
  const currentAnswer = run && currentId !== undefined ? run.answers[String(currentId)] : null;

  useEffect(() => {
    if (!run || !currentId) return;
    const key = `${run.id}:${run.index}`;
    if (timerKey.current === key) return;
    timerKey.current = key;
    setResponse(currentAnswer?.response ?? null);
  }, [run, currentId, currentAnswer?.response]);

  if (loading) {
    return <div className="empty-state">正在读取社区练习…</div>;
  }

  if (!run) {
    return (
      <div className="empty-state">
        <h1>没有进行中的社区练习</h1>
        <p>回社区题库随机抽 5 题即可开始。</p>
        <button className="button primary" onClick={() => navigate('/community')}>
          去社区题库
        </button>
      </div>
    );
  }

  const persist = async (next: CommunityRun) => {
    runRef.current = next;
    setRun(next);
    await saveCommunityRun(next);
  };

  const saveScratch = async (questionId: number, dataUrl: string | null) => {
    const current = runRef.current;
    if (!current) return;
    await persist(setCommunityScratch(current, questionId, dataUrl));
  };

  /**
   * 自评可能被连续快速点击；必须基于 ref 里的最新快照计算，
   * 否则两次点击会各自从旧 run 出发、后一次覆盖前一次。
   */
  const handleSelfGrade = async (questionId: number, grade: Grade) => {
    const current = runRef.current;
    if (!current) return;
    await persist(setCommunitySelfGrade(current, questionId, grade));
  };

  const handleSubmit = async () => {
    if (!currentQuestion || !currentAnswer || currentAnswer.submitted || busy) return;
    if (currentQuestion.type === 'solution') {
      if (typeof response !== 'string' || response.trim().length === 0) return;
    } else if (response === null) {
      return;
    }
    setBusy(true);
    try {
      const value =
        currentQuestion.type === 'solution'
          ? String(response).trim()
          : (response as string | boolean);
      const current = runRef.current ?? run;
      const image = scratchRef.current?.getImage() ?? null;
      let updated = applyCommunityAnswer(current, value);
      updated = setCommunityScratch(updated, currentQuestion.id, image);
      await persist(updated);
      setNow(Date.now());
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    if (!currentQuestion || !currentAnswer || !currentAnswer.submitted || busy) return;
    setBusy(true);
    try {
      const current = runRef.current ?? run;
      const image = scratchRef.current?.getImage() ?? null;
      const latest = setCommunityScratch(current, currentQuestion.id, image);
      const isLast = latest.index >= latest.questionIds.length - 1;
      if (!isLast) {
        await persist(advanceCommunityRun(latest));
        setNow(Date.now());
        return;
      }
      const needsSelfGrade = communityRunNeedsSelfGrade(latest).length > 0;
      if (needsSelfGrade) {
        await persist({ ...advanceCommunityRun(latest), selfGrading: true });
        return;
      }
      const result = await finishCommunityRun();
      void result;
      await useAppStore.getState().refresh();
      navigate('/community/result');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '结算失败');
    } finally {
      setBusy(false);
    }
  };

  const handleExit = async () => {
    await clearCommunityRun();
    setExitOpen(false);
    navigate('/community');
  };

  const handleFinishSelfGrade = async () => {
    const pending = communityRunNeedsSelfGrade(run).filter(
      (question) => !run.answers[String(question.id)]?.selfGrade,
    );
    if (pending.length > 0) {
      setNotice('还有解答题没有自评');
      return;
    }
    setBusy(true);
    try {
      await finishCommunityRun();
      await useAppStore.getState().refresh();
      navigate('/community/result');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '结算失败');
      setBusy(false);
    }
  };

  if (run.selfGrading) {
    const solutions = communityRunNeedsSelfGrade(run);
    const graded = solutions.filter((question) => run.answers[String(question.id)]?.selfGrade).length;
    return (
      <div className="page community-page community-grade-page">
        <button className="back-link" onClick={() => setExitOpen(true)}>
          ← 放弃本组
        </button>
        <header className="community-grade-head">
          <span className="card-eyebrow">第 2 步 · 解答题自评</span>
          <h1>先为自己的步骤负责</h1>
          <p>
            解答题不自动判分。对照参考答案选择“做对 / 部分对 / 做错”，完成后才写入 XP 与错题本。
          </p>
        </header>

        {solutions.map((question) => {
          const answer = run.answers[String(question.id)];
          return (
            <article className="community-grade-item" key={question.id}>
              <div className="community-grade-tags">
                <span className="muted-chip">{QUESTION_TYPE_LABEL.solution}</span>
                <DifficultyBadge difficulty={question.difficulty} />
                <span className="muted-chip">{question.topic}</span>
              </div>
              <MathText className="review-stem">{question.stem}</MathText>
              <div className="response-box">
                <span className="response-label">你的作答</span>
                <div className="response-content">
                  {typeof answer?.response === 'string' && answer.response.trim().length > 0
                    ? answer.response
                    : '未作答（按错误计入）'}
                </div>
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
                <span>这道解答题你做得怎么样？</span>
                <div className="segmented">
                  {(['correct', 'partial', 'wrong'] as Grade[]).map((grade) => (
                    <button
                      key={grade}
                      className={answer?.selfGrade === grade ? 'active' : ''}
                      onClick={() => void handleSelfGrade(question.id, grade)}
                    >
                      {grade === 'correct' ? '做对' : grade === 'partial' ? '部分对' : '做错'}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}

        {notice ? <div className="community-notice">{notice}</div> : null}
        <div className="pending-final-bar">
          <div>
            <strong>
              {graded} / {solutions.length}
            </strong>
            <span>道解答题已自评</span>
          </div>
          <button
            className="button primary large"
            onClick={() => void handleFinishSelfGrade()}
            disabled={busy || graded < solutions.length}
          >
            {busy ? '正在结算…' : '完成自评，查看结果'}
          </button>
        </div>

        <ConfirmDialog
          open={exitOpen}
          title="放弃本组练习？"
          confirmLabel="退出并放弃"
          cancelLabel="继续自评"
          danger
          onCancel={() => setExitOpen(false)}
          onConfirm={() => void handleExit()}
        >
          <p>退出后本次答题不会获得 XP，也不会写入错题本。</p>
        </ConfirmDialog>
      </div>
    );
  }

  if (!currentQuestion || !currentAnswer) {
    return (
      <div className="empty-state">
        <h1>练习数据缺失</h1>
        <p>题目快照不完整，请退出后重新抽题。</p>
        <button className="button ghost" onClick={() => void handleExit()}>
          退出练习
        </button>
      </div>
    );
  }

  const options = orderedOptions(currentQuestion, run.optionOrders[String(currentQuestion.id)]);
  const submitted = currentAnswer.submitted;
  const elapsedCurrent = submitted
    ? currentAnswer.timeSpentSec
    : Math.max(0, (now - run.questionStartedAt) / 1000);
  const accumulated = run.questionIds.reduce((sum, id) => {
    if (id === currentQuestion.id) return sum;
    return sum + (run.answers[String(id)]?.timeSpentSec ?? 0);
  }, 0);
  const hasResponse =
    currentQuestion.type === 'solution'
      ? typeof response === 'string' && response.trim().length > 0
      : response !== null;
  const isLast = run.index >= run.questionIds.length - 1;

  return (
    <div className="focus-shell community-focus">
      <header className="play-header">
        <button className="play-exit" onClick={() => setExitOpen(true)}>
          ← 退出
        </button>
        <div className="play-title">
          <span>社区题 · 独立练习</span>
          <strong>随机 5 题</strong>
        </div>
        <div className="play-progress-text">
          第 {run.index + 1} / {run.questionIds.length} 题
        </div>
      </header>

      <div className="play-progress-line">
        <span style={{ width: `${((run.index + (submitted ? 1 : 0)) / run.questionIds.length) * 100}%` }} />
      </div>

      <main className="play-main">
        <section className="play-statusbar">
          <div>
            <span>难度</span>
            <DifficultyBadge difficulty={currentQuestion.difficulty} />
          </div>
          <div>
            <span>累计用时</span>
            <strong>{formatClock(accumulated + elapsedCurrent)}</strong>
          </div>
          <div>
            <span>本题计时</span>
            <strong>{formatClock(elapsedCurrent)}</strong>
          </div>
          <div>
            <span>来源</span>
            <strong>{currentQuestion.nickname}</strong>
          </div>
        </section>

        <section className="question-card">
          <div className="question-meta">
            <span className="question-number">Q{String(run.index + 1).padStart(2, '0')}</span>
            <span>{QUESTION_TYPE_LABEL[currentQuestion.type]}</span>
            <span>{currentQuestion.topic}</span>
            <span className="source-tag community">社区</span>
          </div>
          <MathText className="question-stem" as="div">
            {currentQuestion.stem}
          </MathText>

          {currentQuestion.type === 'choice' ? (
            <ChoiceOptions options={options} selected={response} disabled={submitted} onSelect={setResponse} />
          ) : null}
          {currentQuestion.type === 'judge' ? (
            <JudgeButtons value={response} disabled={submitted} onChange={setResponse} />
          ) : null}
          {currentQuestion.type === 'solution' ? (
            <SolutionInput
              value={typeof response === 'string' ? response : ''}
              disabled={submitted}
              onChange={setResponse}
              inputId="community-solution-input"
              placeholder="写出关键步骤与最终结果。本题不自动判分，结束后统一自评。"
            />
          ) : null}

          {submitted ? (
            <div className="recorded-note" role="status">
              <span className="sealed-mark">已提交</span>
              第 {run.index + 1} 题用时 {formatDuration(currentAnswer.timeSpentSec)}；对错与解析在整组结束后揭晓。
            </div>
          ) : null}
        </section>

        <button className="text-button community-skip" onClick={() => setExitOpen(true)}>
          放弃本组练习
        </button>
      </main>

      <footer className="play-footer">
        <div className="play-footer-side">
          <span>社区题不计入主线星级与章节进度</span>
        </div>
        <button
          className="button primary play-primary"
          onClick={submitted ? () => void handleNext() : () => void handleSubmit()}
          disabled={busy || (!submitted && !hasResponse)}
        >
          {busy ? '处理中…' : submitted ? (isLast ? '完成本组' : '下一题') : '提交本题'}
        </button>
      </footer>

      {notice ? <div className="community-notice floating">{notice}</div> : null}

      <ConfirmDialog
        open={exitOpen}
        title="退出社区练习？"
        confirmLabel="退出并放弃"
        cancelLabel="继续答题"
        danger
        onCancel={() => setExitOpen(false)}
        onConfirm={() => void handleExit()}
      >
        <p>退出后本次答题不会获得 XP，也不会写入错题本。</p>
      </ConfirmDialog>

      <button
        type="button"
        className="scratch-fab"
        onClick={() => setScratchOpen((value) => !value)}
        aria-expanded={scratchOpen}
      >
        {scratchOpen ? '收起草稿' : '✎ 草稿纸'}
      </button>

      <Scratchpad
        key={currentQuestion.id}
        ref={scratchRef}
        open={scratchOpen}
        onClose={() => setScratchOpen(false)}
        initialImage={run.answers[String(currentQuestion.id)]?.scratchImage}
        onChange={(dataUrl) => {
          void saveScratch(currentQuestion.id, dataUrl);
        }}
      />
    </div>
  );
}
