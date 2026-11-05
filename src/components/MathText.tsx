import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useEffect, useRef, type ReactNode } from 'react';

interface Token {
  kind: 'text' | 'inline' | 'block';
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: input.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('$$')) {
      tokens.push({ kind: 'block', value: raw.slice(2, -2).trim() });
    } else {
      tokens.push({ kind: 'inline', value: raw.slice(1, -1) });
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < input.length) {
    tokens.push({ kind: 'text', value: input.slice(lastIndex) });
  }
  return tokens;
}

function renderMath(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
    });
  } catch {
    return `<code>${value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
  }
}

export function MathText({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: string;
  className?: string;
  as?: 'div' | 'span' | 'p';
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement | HTMLParagraphElement | null>(
    null,
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let frame = 0;

    const fitFormulas = () => {
      const blocks = root.querySelectorAll<HTMLElement>('.math-block');
      blocks.forEach((block) => {
        block.style.fontSize = '';
        const available = block.clientWidth;
        const needed = block.scrollWidth;
        if (available <= 0 || needed <= available + 1) return;
        const baseSize = Number.parseFloat(getComputedStyle(block).fontSize) || 16;
        const scale = Math.max(0.48, (available - 2) / needed);
        block.style.fontSize = `${Math.max(8, baseSize * scale)}px`;
      });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitFormulas);
    };

    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, [children]);

  const tokens = tokenize(children);
  const nodes: ReactNode[] = tokens.map((token, index) => {
    if (token.kind === 'text') {
      return <Fragment key={index}>{token.value}</Fragment>;
    }
    if (token.kind === 'block') {
      return (
        <span
          key={index}
          className="math-block"
          dangerouslySetInnerHTML={{ __html: renderMath(token.value, true) }}
        />
      );
    }
    return (
      <span
        key={index}
        className="math-inline"
        dangerouslySetInnerHTML={{ __html: renderMath(token.value, false) }}
      />
    );
  });
  const classes = `math-text ${className}`.trim();
  if (Tag === 'span') {
    return (
      <span
        ref={(node) => {
          containerRef.current = node;
        }}
        className={classes}
      >
        {nodes}
      </span>
    );
  }
  if (Tag === 'p') {
    return (
      <p
        ref={(node) => {
          containerRef.current = node;
        }}
        className={classes}
      >
        {nodes}
      </p>
    );
  }
  return (
    <div
      ref={(node) => {
        containerRef.current = node;
      }}
      className={classes}
    >
      {nodes}
    </div>
  );
}
