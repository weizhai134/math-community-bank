import type { Difficulty } from '../domain/types';
import { DIFFICULTY_LABEL } from '../domain/constants';

export function Stars({ value, className = '' }: { value: number; className?: string }): JSX.Element {
  return (
    <span
      className={`stars ${className}`.trim()}
      role="img"
      aria-label={`${value} 星，共 3 星`}
    >
      {[1, 2, 3].map((item) => (
        <span key={item} className={item <= value ? 'star on' : 'star off'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }): JSX.Element {
  return (
    <span className={`badge difficulty difficulty-${difficulty}`}>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  label,
  tone = 'amber',
}: {
  value: number;
  max: number;
  label?: string;
  tone?: 'amber' | 'teal' | 'violet';
}): JSX.Element {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label ?? `进度 ${value} / ${max}`}
    >
      <span className="progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}
