import { useEffect, useRef, useState } from 'react';
import { QUESTION_TYPE_LABEL, TIER_LABEL } from '../domain/constants';
import type { Question, QuestionOption } from '../domain/types';
import { formatClock, formatDuration } from '../lib/date';
import { navigate } from '../lib/router';
import { useAppStore } from '../store/useAppStore';
import { MathText } from '../components/MathText';
import { ChoiceOptions, JudgeButtons, SolutionInput } from '../components/AnswerInputs';
import { ConfirmDialog } from '../components/Modal';
import { FormulaCheatSheet } from '../components/FormulaCheatSheet';
import { Scratchpad, type ScratchpadHandle } from '../components/Scratchpad';
import { DifficultyBadge } from '../components/ui';

type ResponseValue = string | boolean | null;

/** 超过这个时长仍未提交，视为“离开后回来”，本题计时从当前时刻重新开始。 */
const RESUME_TIMER_THRESHOLD_MS = 10 * 60 * 1000;

function PlayKeyboard({
  question,
  options,
  submitted,
  busy,
  blocked,
  hasResponse,
  onSelect,
  onSubmit,
  onNext,
}: {
  question: Question;
  options: QuestionOption[];
  submitted: boolean;
  busy: boolean;
  blocked: boolean;
  hasResponse: boolean;
  onSelect: (value: ResponseValue) => void;
  onSubmit: () => void;
  onNext: () => void;
}): null {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (blocked || busy) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ? target.tagName.toLowerCase() : '';
      const typing =
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable ||
        tag === 'select';
      if (typing) {
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          question.type === 'solution' &&
          !submitted
        ) {
          event.preventDefault();
          if (hasResponse) onSubmit();
        }
        return;
      }
      if (event.key.toLowerCase() === 'n' && submitted) {
        event.preventDefault();
        onNext();
        return;
      }
      if (event.key === 'Enter') {
        if (submitted) return;
        event.preventDefault();
        if (hasResponse) onSubmit();
        return;
      }
      if (submitted) return;
      const numeric = Number(event.key);
      if (!Number.isInteger(numeric) || numeric < 1) return;
      if (question.type === 'choice') {
        const option = options[numeric - 1];
        if (option) {
          event.preventDefault();
          onSelect(option.id);
        }
      } else if (question.type === 'judge' && (numeric === 1 || numeric === 2)) {
        event.preventDefault();
        onSelect(numeric === 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return null;
}

export function PlayPage(): JSX.Element {
  const activeRun = useAppStore((state) => state.activeRun);
  const pendingReview = useAppStore((state) => state.pendingReview);
  const questions = useAppStore((state) => state.questions);
  const submitCurrent = useAppStore((state) => state.submitCurrent);
  const nextQuestion = useAppStore((state) => state.nextQuestion);
  const resetQuestionTimer = useAppStore((state) => state.resetQuestionTimer);
  const prepareSettlement = useAppStore((state) => state.prepareSettlement);
  const abandonActive = useAppStore((state) => state.abandonActive);
  const saveScratchImage = useAppStore((state) => state.saveScratchImage);
  const showToast = useAppStore((state) => state.showToast);

  const [response, setResponse] = useState<ResponseValue>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const scratchRef = useRef<ScratchpadHandle>(null);
  const resetKey = useRef<string>('');

  const currentQuestionId = activeRun?.questionIds[activeRun.currentIndex];
  const currentQuestion = questions.find((item) => item.id === currentQuestionId);
  const currentAnswer = currentQuestionId ? activeRun?.answers[currentQuestionId] : undefined;
  const submitted = Boolean(currentAnswer?.submitted);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeRun || !currentQuestionId) return;
    const key = `${activeRun.id}:${activeRun.currentIndex}:${currentQuestionId}`;
    if (resetKey.current === key) return;
    resetKey.current = key;
    if (activeRun.answers[currentQuestionId]?.submitted) return;
    // 刷新页面后继续计时；只有离开超过 10 分钟才按“重新开始本题”处理，避免快速刷新重开计时。
    const startedAt = activeRun.questionStartedAt;
    if (!startedAt || Date.now() - startedAt > RESUME_TIMER_THRESHOLD_MS) {
      void resetQuestionTimer();
    }
  }, [activeRun, currentQuestionId, resetQuestionTimer]);

  useEffect(() => {
    setResponse(currentAnswer?.response ?? null);
  }, [currentQuestionId, currentAnswer?.submitted, currentAnswer?.response]);

  useEffect(() => {
    if (!activeRun && pendingReview) {
      navigate(`/result/${pendingReview.id}`, true);
    }
  }, [activeRun, pendingReview]);

  if (!activeRun) {
    return (
      <div className="focus-empty">
        <h1>{pendingReview ? '正在打开待结算关卡…' : '没有进行中的关卡'}</h1>
        {!pendingReview ? (
          <>
            <p>可以回到章节地图重新选择关卡。</p>
            <button className="button primary" onClick={() => navigate('/map')}>
              返回章节地图
            </button>
          </>
        ) : null}
      </div>
    );
  }

  if (!currentQuestion || !currentAnswer) {
    return (
      <div className="focus-empty">
        <h1>题目数据缺失</h1>
        <p>本关引用的题目可能已被题库替换。请退出关卡后重新开始。</p>
        <button className="button ghost" onClick={() => navigate('/map')}>
          返回章节地图
        </button>
      </div>
    );
  }

  const currentIndex = activeRun.currentIndex;
  const totalQuestions = activeRun.questionIds.length;
  const isLast = currentIndex === totalQuestions - 1;
  const isTargeted = activeRun.levelId.startsWith('targeted-');
  const elapsedCurrent = submitted
    ? currentAnswer.timeSpentSec
    : Math.max(0, (now - activeRun.questionStartedAt) / 1000);
  const accumulated = activeRun.questionIds.reduce((sum, id) => {
    if (id === currentQuestion.id) return sum;
    return sum + (activeRun.answers[id]?.timeSpentSec ?? 0);
  }, 0);
  const totalElapsed = accumulated + elapsedCurrent;

  const options = (currentQuestion.options ?? [])
    .slice()
    .sort((a, b) => {
      const order = activeRun.optionOrders[currentQuestion.id] ?? [];
      return order.indexOf(a.id) - order.indexOf(b.id);
    });

  const hasResponse =
    currentQuestion.type === 'solution'
      ? typeof response === 'string' && response.trim().length > 0
      : response !== null;

  const flushScratch = async () => {
    const image = scratchRef.current?.getImage() ?? null;
    await saveScratchImage(currentQuestion.id, image);
  };

  const settle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await flushScratch();
      const result = await prepareSettlement();
      navigate(`/result/${result.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '结算失败');
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (busy || submitted || !hasResponse) return;
    setBusy(true);
    try {
      const value = currentQuestion.type === 'solution' ? String(response).trim() : response;
      if (value === null) throw new Error('请先作答');
      await flushScratch();
      await submitCurrent(value);
      setNow(Date.now());
    } catch (error) {
      showToast(error instanceof Error ? error.message : '提交失败');
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    if (busy) return;
    if (!submitted) {
      await handleSubmit();
      return;
    }
    if (isLast) {
      await settle();
      return;
    }
    setBusy(true);
    try {
      await flushScratch();
      await nextQuestion();
      setResponse(null);
      setNow(Date.now());
    } finally {
      setBusy(false);
    }
  };

  const handleExit = async () => {
    setBusy(true);
    try {
      await abandonActive();
      setExitOpen(false);
      showToast('未完成记录已保存到本机');
      navigate(activeRun.isTrial ? '/wrong' : `/level/${activeRun.levelId}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败');
      setBusy(false);
    }
  };

  const handleEarly = async () => {
    setEarlyOpen(false);
    await settle();
  };

  const selectResponse = (value: ResponseValue) => {
    if (submitted) return;
    setResponse(value);
  };

  return (
    <div className="focus-shell">
      <PlayKeyboard
        question={currentQuestion}
        options={options}
        submitted={submitted}
        busy={busy}
        blocked={exitOpen || earlyOpen}
        hasResponse={hasResponse}
        onSelect={selectResponse}
        onSubmit={() => void handleSubmit()}
        onNext={() => void handleNext()}
      />
      <header className="play-header">
        <button className="play-exit" onClick={() => setExitOpen(true)}>
          ← 退出
        </button>
        <div className="play-title">
          <span>{isTargeted ? '靶向突破' : activeRun.isTrial ? '错题试炼' : TIER_LABEL[activeRun.tier]}</span>
          <strong>
            {isTargeted
              ? activeRun.levelName.replace(/^靶向突破 · /, '')
              : activeRun.isTrial
                ? `${activeRun.questionIds.length} 题复习`
                : activeRun.levelName}
          </strong>
        </div>
        <div className="play-header-right">
          <div className="play-progress-text">
            第 {currentIndex + 1} / {totalQuestions} 题
          </div>
          <button
            type="button"
            className="formula-trigger"
            onClick={() => setCheatOpen(true)}
            aria-label="打开公式本"
          >
            ∑ 公式本
          </button>
        </div>
      </header>

      <div className="play-progress-line">
        <span style={{ width: `${((currentIndex + (submitted ? 1 : 0)) / totalQuestions) * 100}%` }} />
      </div>

      <main className="play-main">
        <section className="play-statusbar">
          <div>
            <span>难度</span>
            <DifficultyBadge difficulty={currentQuestion.difficulty} />
          </div>
          <div>
            <span>累计用时</span>
            <strong>{formatClock(totalElapsed)}</strong>
          </div>
          <div>
            <span>连击</span>
            <strong className={activeRun.combo > 0 ? 'combo-on' : ''}>
              {activeRun.combo}
              {activeRun.combo >= 3 ? ' 连' : ''}
            </strong>
          </div>
          <div>
            <span>本题计时</span>
            <strong>{formatClock(elapsedCurrent)}</strong>
          </div>
        </section>

        <section className="question-card">
          <div className="question-meta">
            <span className="question-number">Q{String(currentIndex + 1).padStart(2, '0')}</span>
            <span>{QUESTION_TYPE_LABEL[currentQuestion.type]}</span>
            <span>{currentQuestion.topic}</span>
            <span className={`source-tag ${currentQuestion.source === '网络改编' ? 'adapted' : ''}`}>
              {currentQuestion.source}
            </span>
          </div>
          <MathText className="question-stem" as="div">
            {currentQuestion.stem}
          </MathText>

          {currentQuestion.type === 'choice' ? (
            <ChoiceOptions
              options={options}
              selected={response}
              disabled={submitted}
              onSelect={selectResponse}
            />
          ) : null}

          {currentQuestion.type === 'judge' ? (
            <JudgeButtons value={response} disabled={submitted} onChange={selectResponse} />
          ) : null}

          {currentQuestion.type === 'solution' ? (
            <SolutionInput
              value={typeof response === 'string' ? response : ''}
              disabled={submitted}
              onChange={selectResponse}
              placeholder="写出关键步骤与最终结果。本题不自动判分，结算页会给出参考答案并由你自评。"
            />
          ) : null}

          {submitted ? (
            <div className="recorded-note" role="status">
              <span className="sealed-mark">已封存</span>
              第 {currentIndex + 1} 题已提交，用时 {formatDuration(currentAnswer.timeSpentSec)}。
              对错与解析将在结算页统一揭晓。
            </div>
          ) : null}
        </section>

        <div className="keyboard-hints">
          {currentQuestion.type === 'choice' ? <span>数字键选择</span> : null}
          {currentQuestion.type === 'judge' ? <span>1 正确 · 2 错误</span> : null}
          <span>Enter 提交</span>
          <span>N 下一题</span>
        </div>
      </main>

      <footer className="play-footer">
        <div className="play-footer-side">
          <button className="text-button" onClick={() => setEarlyOpen(true)}>
            提前结算
          </button>
          <span>未作答按错误计入分母</span>
        </div>
        <button
          className="button primary play-primary"
          onClick={submitted ? handleNext : handleSubmit}
          disabled={busy || (!submitted && !hasResponse)}
        >
          {busy
            ? '处理中…'
            : submitted
              ? isLast
                ? '完成本关'
                : '下一题'
              : '提交本题'}
          {!busy ? <span className="button-arrow">→</span> : null}
        </button>
      </footer>

      <ConfirmDialog
        open={exitOpen}
        title="退出当前关卡？"
        confirmLabel="退出并保存"
        cancelLabel="继续答题"
        danger
        onCancel={() => setExitOpen(false)}
        onConfirm={handleExit}
      >
        <p>
          退出后会保存一条<strong>未完成记录</strong>，但不会写入错题本，也不会获得星级或 XP。
          下次进入需要重新开始并重新洗牌。
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={earlyOpen}
        title="提前结算本关？"
        confirmLabel="提前结算"
        cancelLabel="继续答题"
        onCancel={() => setEarlyOpen(false)}
        onConfirm={handleEarly}
      >
        <p>
          尚未作答的题目按错误计入正确率分母。已作答的解答题仍需要在结算页自评，
          不会自动判分。
        </p>
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
        initialImage={activeRun.scratchImages?.[currentQuestion.id]}
        onChange={(dataUrl) => {
          void saveScratchImage(currentQuestion.id, dataUrl);
        }}
      />

      <FormulaCheatSheet open={cheatOpen} onClose={() => setCheatOpen(false)} />
    </div>
  );
}
