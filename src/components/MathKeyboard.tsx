import { useState } from 'react';

interface MathSnippet {
  label: string;
  title: string;
  text: string;
  /** 插入后光标相对插入起点的偏移。 */
  caret: number;
}

const SNIPPETS: MathSnippet[] = [
  { label: '∫', title: '积分号', text: '$\\int$', caret: 5 },
  { label: 'lim', title: '极限', text: '$\\lim_{x\\to 0}$', caret: 13 },
  { label: 'Σ', title: '求和', text: '$\\sum_{n=1}^{\\infty}$', caret: 19 },
  { label: '∞', title: '无穷', text: '$\\infty$', caret: 7 },
  { label: 'π', title: '圆周率', text: '$\\pi$', caret: 4 },
  { label: 'θ', title: '角度', text: '$\\theta$', caret: 7 },
  { label: 'x²', title: '平方', text: '$x^{2}$', caret: 6 },
  { label: '√', title: '根号', text: '$\\sqrt{}$', caret: 7 },
  { label: 'a/b', title: '分数', text: '$\\frac{}{}$', caret: 7 },
  { label: 'sin', title: '正弦', text: '$\\sin$', caret: 5 },
  { label: 'cos', title: '余弦', text: '$\\cos$', caret: 5 },
  { label: 'tan', title: '正切', text: '$\\tan$', caret: 5 },
  { label: 'ln', title: '自然对数', text: '$\\ln$', caret: 4 },
  { label: 'eˣ', title: '指数', text: '$e^{x}$', caret: 5 },
  { label: '→', title: '趋于', text: '$\\to$', caret: 4 },
  { label: '≤', title: '小于等于', text: '$\\le$', caret: 4 },
  { label: '≥', title: '大于等于', text: '$\\ge$', caret: 4 },
  { label: '≠', title: '不等于', text: '$\\ne$', caret: 4 },
  { label: '±', title: '正负', text: '$\\pm$', caret: 4 },
  { label: '·', title: '点乘', text: '$\\cdot$', caret: 6 },
  { label: '×', title: '乘号', text: '$\\times$', caret: 7 },
  { label: 'α', title: 'alpha', text: '$\\alpha$', caret: 7 },
  { label: 'β', title: 'beta', text: '$\\beta$', caret: 6 },
  { label: 'Δ', title: 'Delta', text: '$\\Delta$', caret: 7 },
  { label: '∂', title: '偏导', text: '$\\partial$', caret: 9 },
];

export function MathKeyboard({
  onInsert,
  disabled = false,
}: {
  onInsert: (text: string, caret: number) => void;
  disabled?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="math-keyboard">
      <button
        type="button"
        className="math-keyboard-toggle"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-expanded={open}
      >
        ∑ 数学键盘
        <span>{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <div className="math-keyboard-panel" role="group" aria-label="常用数学符号">
          <div className="math-keyboard-grid">
            {SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                type="button"
                className="math-key"
                title={snippet.title}
                aria-label={snippet.title}
                onClick={() => onInsert(snippet.text, snippet.caret)}
              >
                {snippet.label}
              </button>
            ))}
          </div>
          <p className="math-keyboard-note">
            点击插入到光标处；符号会自动包在 $...$ 中，可在下方“公式预览”里查看效果。
          </p>
        </div>
      ) : null}
    </div>
  );
}
