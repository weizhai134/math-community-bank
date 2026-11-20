import { useState } from 'react';
import type { Question } from '../domain/types';
import { GraphModal } from './GraphModal';

export function GraphButton({ question }: { question: Question }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!question.hasGraph || !question.graph) return null;

  return (
    <>
      <button
        type="button"
        className="graph-button"
        onClick={() => setOpen(true)}
        aria-label="画图查看函数图像"
      >
        <span aria-hidden="true">▱</span>
        画图
      </button>
      <GraphModal
        open={open}
        graph={question.graph}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
