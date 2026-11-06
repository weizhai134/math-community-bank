import { useRef } from 'react';
import type { QuestionOption } from '../domain/types';
import { MathKeyboard } from './MathKeyboard';
import { MathText } from './MathText';

export function ChoiceOptions({
  options,
  selected,
  disabled,
  onSelect,
}: {
  /** 已按展示顺序排好的选项。 */
  options: QuestionOption[];
  selected: string | boolean | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}): JSX.Element {
  return (
    <div className="option-list" role="radiogroup" aria-label="选项">
      {options.map((option, index) => {
        const isSelected = selected === option.id;
        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={isSelected}
            className={`option-button ${isSelected ? 'selected' : ''} ${disabled ? 'locked' : ''}`}
            onClick={() => onSelect(option.id)}
            disabled={disabled}
          >
            <span className="option-key">{index + 1}</span>
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <MathText as="span" className="option-text">
              {option.text}
            </MathText>
          </button>
        );
      })}
    </div>
  );
}

export function JudgeButtons({
  value,
  disabled,
  onChange,
}: {
  value: string | boolean | null;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <div className="judge-row" role="radiogroup" aria-label="判断">
      <button
        className={`judge-button ${value === true ? 'selected' : ''}`}
        onClick={() => onChange(true)}
        disabled={disabled}
        role="radio"
        aria-checked={value === true}
      >
        <span className="judge-key">1</span>
        正确
      </button>
      <button
        className={`judge-button ${value === false ? 'selected' : ''}`}
        onClick={() => onChange(false)}
        disabled={disabled}
        role="radio"
        aria-checked={value === false}
      >
        <span className="judge-key">2</span>
        错误
      </button>
    </div>
  );
}

export function SolutionInput({
  value,
  disabled,
  onChange,
  inputId = 'solution-input',
  placeholder = '写出关键步骤与最终结果。本题不自动判分，结束后给出参考答案并由你自评。',
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  inputId?: string;
  placeholder?: string;
}): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = (text: string, caret: number) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      const position = start + caret;
      element.setSelectionRange(position, position);
    });
  };

  return (
    <div className="solution-area">
      <label htmlFor={inputId}>你的解答</label>
      <textarea
        ref={textareaRef}
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={8}
      />
      <span className="input-hint">
        支持键盘输入；Ctrl / ⌘ + Enter 提交。Enter 在文本框内换行。
      </span>
      <MathKeyboard onInsert={handleInsert} disabled={disabled} />
      {value.includes('$') ? (
        <div className="solution-preview">
          <span className="solution-preview-label">公式预览</span>
          <MathText as="div" className="solution-preview-body">
            {value}
          </MathText>
        </div>
      ) : null}
    </div>
  );
}
