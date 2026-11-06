import { useEffect, useState } from 'react';
import { MathText } from '../components/MathText';
import { navigate } from '../lib/router';
import {
  loadDueFlashcards,
  loadFlashcardDeck,
  reviewFlashcard,
  type FlashcardDeckItem,
} from '../services/flashcardService';

export function FlashcardsPage(): JSX.Element {
  const [queue, setQueue] = useState<FlashcardDeckItem[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (mode: 'due' | 'all') => {
    setLoading(true);
    setError(null);
    try {
      const deck = mode === 'due' ? await loadDueFlashcards() : await loadFlashcardDeck();
      setQueue(deck);
      setTotal(deck.length);
      setReviewed(0);
      setFlipped(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '无法读取闪卡');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load('due');
  }, []);

  const current = queue[0];

  const handleRate = async (remembered: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reviewFlashcard(current.card.id, remembered);
      setReviewed((value) => value + 1);
      setQueue((prev) => prev.slice(1));
      setFlipped(false);
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : '保存复习结果失败');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="empty-state">正在读取公式闪卡…</div>;
  }

  if (error && !current) {
    return (
      <div className="empty-state">
        <h1>闪卡没有打开</h1>
        <p>{error}</p>
        <button className="button primary" onClick={() => void load('due')}>
          重试
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="page flashcards-page">
        <button className="back-link" onClick={() => navigate('/')}>
          ← 首页
        </button>
        <section className="flashcards-empty">
          <span className="flashcards-empty-mark">∑</span>
          <span className="card-eyebrow">公式闪卡 · 本地 SM-2</span>
          <h1>{reviewed > 0 ? '这一轮翻完了' : '今天没有到期卡片'}</h1>
          <p>
            {reviewed > 0
              ? `你刚刚复习了 ${reviewed} 张卡，下一次复习时间已经按“记住 / 没记住”排好。`
              : '所有卡片都在计划内。可以提前再复习一轮，或回到首页继续刷题。'}
          </p>
          <div className="flashcards-empty-actions">
            <button className="button primary" onClick={() => void load('all')}>
              再复习一轮
            </button>
            <button className="button ghost" onClick={() => navigate('/')}>
              回到首页
            </button>
          </div>
        </section>
      </div>
    );
  }

  const progress = total > 0 ? (reviewed / total) * 100 : 0;

  return (
    <div className="page flashcards-page">
      <button className="back-link" onClick={() => navigate('/')}>
        ← 首页
      </button>

      <header className="flashcards-head">
        <div>
          <span className="card-eyebrow">公式闪卡 · 本地 SM-2</span>
          <h1>翻过来，才算真的记住</h1>
          <p>先自己想，再翻面核对；选“没记住”会重置间隔，“记住了”会拉长下一次复习。</p>
        </div>
        <div className="flashcards-stats">
          <div>
            <strong>{queue.length}</strong>
            <span>待复习</span>
          </div>
          <div>
            <strong>{reviewed}</strong>
            <span>已翻</span>
          </div>
        </div>
      </header>

      <div className="flashcards-progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="flashcards-stage">
        <div
          className={`flashcard-scene ${flipped ? 'is-flipped' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={flipped ? '翻回问题面' : '翻到答案面'}
          onClick={() => setFlipped((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setFlipped((value) => !value);
            }
          }}
        >
          <div className="flashcard-inner">
            <div className="flashcard-face flashcard-front">
              <div className="flashcard-meta">
                <span className="flashcard-topic">{current.card.topic}</span>
                <span>第 {reviewed + 1} / {total} 张</span>
              </div>
              <div className="flashcard-body">
                <MathText className="flashcard-text" as="div">
                  {current.card.front}
                </MathText>
              </div>
              <span className="flashcard-hint">点击卡片翻面</span>
            </div>
            <div className="flashcard-face flashcard-back">
              <div className="flashcard-meta">
                <span className="flashcard-topic">{current.card.topic}</span>
                <span>答案</span>
              </div>
              <div className="flashcard-body">
                <MathText className="flashcard-text" as="div">
                  {current.card.back}
                </MathText>
              </div>
              <span className="flashcard-hint">点击翻回问题</span>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="community-notice">{error}</div> : null}

      <div className="flashcards-actions">
        <button
          type="button"
          className="button flashcard-forgot"
          disabled={!flipped || busy}
          onClick={() => void handleRate(false)}
        >
          没记住
        </button>
        <button
          type="button"
          className="button primary flashcard-remember"
          disabled={!flipped || busy}
          onClick={() => void handleRate(true)}
        >
          记住了
        </button>
      </div>
      <p className="flashcards-hint">
        {flipped ? '根据刚才的回忆如实选择；这会影响下次出现的时间。' : '先翻面看答案，再选择记住程度。'}
      </p>
    </div>
  );
}
