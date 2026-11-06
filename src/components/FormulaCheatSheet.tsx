import { useEffect, useState } from 'react';
import { CHEAT_SHEET } from '../data/cheatSheet';
import { MathText } from './MathText';

export function FormulaCheatSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const [active, setActive] = useState(CHEAT_SHEET[0]?.id ?? '');

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const category = CHEAT_SHEET.find((item) => item.id === active) ?? CHEAT_SHEET[0];

  return (
    <>
      <div
        className={`cheat-backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`cheat-drawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="公式本"
        aria-hidden={!open}
      >
        <header className="cheat-head">
          <div>
            <span className="cheat-kicker">公式速查 · 仅通用公式</span>
            <h2>公式本</h2>
            <p>导数、积分、泰勒与中值定理；不包含当前题目的答案。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭公式本">
            ×
          </button>
        </header>

        <div className="cheat-tabs" role="tablist" aria-label="公式分类">
          {CHEAT_SHEET.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === active}
              className={item.id === active ? 'active' : ''}
              onClick={() => setActive(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="cheat-body">
          {category?.entries.map((entry) => (
            <article className="cheat-entry" key={entry.id}>
              <div className="cheat-entry-head">
                <span>{entry.name}</span>
              </div>
              <MathText as="div" className="cheat-formula">
                {`$$${entry.latex}$$`}
              </MathText>
              {entry.note ? (
                <MathText as="p" className="cheat-note">
                  {entry.note}
                </MathText>
              ) : null}
            </article>
          ))}
        </div>

        <footer className="cheat-foot">只供查阅；合上抽屉继续答题。</footer>
      </aside>
    </>
  );
}
