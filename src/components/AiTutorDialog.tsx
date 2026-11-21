import { useEffect, useState } from 'react';
import type { WrongItem } from '../domain/types';
import { useAppStore } from '../store/useAppStore';
import { MathText } from './MathText';
import { Modal } from './Modal';
import { askAiTutor, AiTutorError } from '../services/aiTutor';

function answerText(item: WrongItem, answer: string | boolean | undefined): string {
  if (answer === undefined || answer === null) return '未记录（旧错题没有保存作答）';
  if (item.type === 'choice') {
    const option = item.questionSnapshot.options?.find((candidate) => candidate.id === answer);
    return option ? `${String(answer)} · ${option.text}` : String(answer);
  }
  if (item.type === 'judge') return answer === true ? '正确' : '错误';
  return String(answer);
}

function correctAnswerText(item: WrongItem): string {
  if (item.type === 'choice') {
    const option = item.questionSnapshot.options?.find(
      (candidate) => candidate.id === item.questionSnapshot.answer,
    );
    return option
      ? `${String(item.questionSnapshot.answer)} · ${option.text}`
      : String(item.questionSnapshot.answer);
  }
  if (item.type === 'judge') return item.questionSnapshot.answer === true ? '正确' : '错误';
  return String(item.questionSnapshot.answer);
}

type State = 'loading' | 'success' | 'error';

export function AiTutorDialog({
  item,
  onClose,
}: {
  item: WrongItem | null;
  onClose: () => void;
}): JSX.Element {
  const setDataOpen = useAppStore((state) => state.setDataOpen);
  const setDataTab = useAppStore((state) => state.setDataTab);
  const [state, setState] = useState<State>('loading');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<AiTutorError | Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setState('loading');
    setAnswer('');
    setError(null);
    void askAiTutor({
      stem: item.questionSnapshot.stem,
      wrongAnswer: answerText(item, item.lastAnswer),
      correctAnswer: correctAnswerText(item),
      explanation: item.questionSnapshot.explanation,
    })
      .then((text) => {
        if (cancelled) return;
        setAnswer(text);
        setState('success');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error('AI 请求失败，请重试'));
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [item, attempt]);

  const errorCode = error instanceof AiTutorError ? error.code : null;

  return (
    <Modal open={Boolean(item)} title="AI 错题点拨" onClose={onClose}>
      {item ? (
        <div className="ai-panel">
          <div className="ai-context">
            <span>这题的易错点</span>
            <strong>{item.topic}</strong>
          </div>

          {state === 'loading' ? (
            <div className="ai-status" aria-live="polite">
              <span className="ai-spinner" aria-hidden="true" />
              <span>AI 助教正在分析这道题…</span>
            </div>
          ) : null}

          {state === 'error' && error ? (
            <div className="ai-error" role="alert">
              <strong>这次没能问到 AI</strong>
              <p>{error.message}</p>
              <div className="ai-error-actions">
                {errorCode === 'missing-key' ? (
                  <button
                    type="button"
                    className="button primary small"
                    onClick={() => {
                      onClose();
                      setDataTab('ai');
                      setDataOpen(true);
                    }}
                  >
                    去设置配置
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  重试
                </button>
              </div>
            </div>
          ) : null}

          {state === 'success' ? (
            <div className="ai-answer">
              <span className="response-label">AI 助教怎么说</span>
              <MathText as="div" className="ai-answer-text">
                {answer}
              </MathText>
            </div>
          ) : null}

          <p className="ai-footnote">
            AI 生成内容仅供参考，可能出错；请以教材和老师讲解为准。API Key 只保存在本机浏览器。
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
