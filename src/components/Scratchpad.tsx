import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface ScratchpadHandle {
  /** 导出当前画布；从未落笔则返回 null。 */
  getImage: () => string | null;
}

type Tool = 'black' | 'red' | 'eraser';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 1200;
const STROKE_WIDTH = 4;
const ERASER_WIDTH = 28;

const TOOL_COLOR: Record<Tool, string> = {
  black: '#1f1b16',
  red: '#c0392b',
  eraser: '#ffffff',
};

interface Point {
  x: number;
  y: number;
}

/**
 * 刷题草稿纸：原生 canvas，Pointer Events 同时支持鼠标和触屏。
 * 画布固定为 900x1200，CSS 缩放显示；导出 PNG 的 Base64。
 */
export const Scratchpad = forwardRef<
  ScratchpadHandle,
  {
    open: boolean;
    onClose: () => void;
    onChange?: (dataUrl: string | null) => void;
    initialImage?: string;
  }
>(function Scratchpad({ open, onClose, onChange, initialImage }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const initialized = useRef(false);
  const hasInk = useRef(false);
  const drawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const emitTimer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>('black');

  useEffect(() => {
    if (initialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    initialized.current = true;

    if (initialImage) {
      const image = new Image();
      image.onload = () => {
        if (hasInk.current) return;
        ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        hasInk.current = true;
      };
      image.src = initialImage;
    }
    // 只在挂载时初始化；key 随题目变化，切题会重新挂载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (emitTimer.current !== null) window.clearTimeout(emitTimer.current);
    },
    [],
  );

  const exportImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) return null;
    return canvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({ getImage: exportImage }), []);

  const notifyChange = (immediate = false) => {
    if (emitTimer.current !== null) window.clearTimeout(emitTimer.current);
    const run = () => {
      emitTimer.current = null;
      onChangeRef.current?.(exportImage());
    };
    if (immediate) {
      run();
      return;
    }
    emitTimer.current = window.setTimeout(run, 180);
  };

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const paintDot = (point: Point) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const width = tool === 'eraser' ? ERASER_WIDTH : STROKE_WIDTH;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = TOOL_COLOR[tool];
    ctx.beginPath();
    ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!open || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const point = pointFromEvent(event);
    lastPoint.current = point;
    paintDot(point);
    if (tool !== 'eraser') hasInk.current = true;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const last = lastPoint.current;
    if (!last) {
      lastPoint.current = point;
      return;
    }
    const width = tool === 'eraser' ? ERASER_WIDTH : STROKE_WIDTH;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = TOOL_COLOR[tool];
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    if (tool !== 'eraser') hasInk.current = true;
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    notifyChange();
  };

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    hasInk.current = false;
    notifyChange(true);
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 360;
    const height = panel?.offsetHeight ?? 560;
    const nextX = dragStart.current.ox + (event.clientX - dragStart.current.x);
    const nextY = dragStart.current.oy + (event.clientY - dragStart.current.y);
    const minX = -Math.max(0, window.innerWidth - width - 32);
    const maxX = 16;
    const minY = -72;
    const maxY = Math.max(0, window.innerHeight - height - 96);
    setOffset({
      x: Math.min(maxX, Math.max(minX, nextX)),
      y: Math.min(maxY, Math.max(minY, nextY)),
    });
  };

  const handleDragEnd = () => {
    dragStart.current = null;
  };

  return (
    <aside
      ref={panelRef}
      className={`scratchpad-panel ${open ? 'is-open' : ''}`}
      style={{
        transform: open
          ? `translate(${offset.x}px, ${offset.y}px)`
          : `translate(calc(100% + 32px), ${offset.y}px)`,
      }}
      aria-hidden={!open}
      aria-label="草稿纸"
    >
      <div
        className="scratchpad-head"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div>
          <span className="scratchpad-kicker">草稿纸 · 可拖动</span>
          <strong>随手写，别怕乱</strong>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭草稿纸">
          ×
        </button>
      </div>

      <div className="scratchpad-toolbar" role="group" aria-label="画笔工具">
        <button
          type="button"
          className={`scratch-tool ${tool === 'black' ? 'active' : ''}`}
          onClick={() => setTool('black')}
        >
          <span className="scratch-swatch black" />黑笔
        </button>
        <button
          type="button"
          className={`scratch-tool ${tool === 'red' ? 'active' : ''}`}
          onClick={() => setTool('red')}
        >
          <span className="scratch-swatch red" />红笔
        </button>
        <button
          type="button"
          className={`scratch-tool ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => setTool('eraser')}
        >
          <span className="scratch-swatch eraser" />橡皮
        </button>
        <button type="button" className="scratch-tool clear" onClick={clearCanvas}>
          清空
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="scratchpad-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        aria-label="草稿纸画布"
      />

      <p className="scratchpad-note">做错或部分对时，这张草稿会随错题一起保存，可在错题本回看。</p>
    </aside>
  );
});
