import { useEffect, useRef, useState } from 'react';
import type { FunctionPlotDatum, FunctionPlotOptions } from 'function-plot';
import type { GraphSpec } from '../domain/graph';
import { Modal } from './Modal';

function buildData(graph: GraphSpec): FunctionPlotDatum[] {
  const xMin = graph.xMin ?? -5;
  const xMax = graph.xMax ?? 5;
  const range: [number, number] = [xMin, xMax];

  if (graph.kind === 'area') {
    const from = graph.areaFrom ?? xMin;
    const to = graph.areaTo ?? xMax;
    return [
      {
        fn: graph.expression,
        range: [from, to],
        closed: true,
        color: 'rgba(180, 83, 9, 0.22)',
        graphType: 'polyline',
        skipTip: true,
        attr: {
          fill: 'rgba(180, 83, 9, 0.22)',
          stroke: 'none',
        },
      },
      {
        fn: graph.expression,
        range,
        color: '#b45309',
        nSamples: 700,
      },
    ];
  }

  if (graph.kind === 'tangent') {
    return [
      {
        fn: graph.expression,
        range,
        color: '#0f766e',
        nSamples: 700,
        derivative: {
          fn: graph.derivativeExpression ?? '0',
          x0: graph.tangentAt ?? 0,
        },
      },
    ];
  }

  return [
    {
      fn: graph.expression,
      range,
      color: '#b45309',
      nSamples: 700,
    },
  ];
}

function buildOptions(
  target: HTMLElement,
  graph: GraphSpec,
  width: number,
): FunctionPlotOptions {
  const options: FunctionPlotOptions = {
    target,
    width,
    height: 390,
    grid: true,
    disableZoom: true,
    xAxis: {
      domain: [graph.xMin ?? -5, graph.xMax ?? 5],
      label: 'x',
    },
    yAxis: {
      label: 'y',
      ...(graph.yMin !== undefined && graph.yMax !== undefined
        ? { domain: [graph.yMin, graph.yMax] }
        : {}),
    },
    tip: { xLine: true, yLine: true },
    data: buildData(graph),
  };

  return options;
}

export function GraphModal({
  open,
  graph,
  onClose,
}: {
  open: boolean;
  graph: GraphSpec | null;
  onClose: () => void;
}): JSX.Element | null {
  const targetRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !graph) return;
    const target = targetRef.current;
    if (!target) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    target.innerHTML = '';

    const render = async () => {
      // 等 Modal 完成布局后再量宽度，否则第一次渲染可能拿到 0。
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (cancelled) return;

      const { default: functionPlot } = await import('function-plot');
      if (cancelled || !targetRef.current) return;

      const width = Math.max(
        300,
        Math.min(720, targetRef.current.clientWidth || 640),
      );
      functionPlot(buildOptions(targetRef.current, graph, width));
      if (!cancelled) setLoading(false);
    };

    void render().catch((renderError: unknown) => {
      if (cancelled) return;
      setLoading(false);
      setError(
        renderError instanceof Error
          ? renderError.message
          : '图像渲染失败，请检查题目表达式。',
      );
    });

    return () => {
      cancelled = true;
      target.innerHTML = '';
    };
  }, [open, graph]);

  if (!graph) return null;

  return (
    <Modal open={open} title="画图" onClose={onClose} wide>
      <div className="graph-modal">
        <div className="graph-caption">
          <span className="graph-formula">y = {graph.expression}</span>
          {graph.note ? <p>{graph.note}</p> : null}
        </div>
        <div className={`graph-canvas ${loading ? 'is-loading' : ''}`}>
          <div ref={targetRef} className="graph-target" />
          {loading ? <span className="graph-loading">正在画图…</span> : null}
          {error ? <span className="graph-error">{error}</span> : null}
        </div>
        <p className="graph-hint">
          {graph.kind === 'tangent'
            ? '青色曲线上的直线为切点处的切线。'
            : graph.kind === 'area'
              ? '阴影区域为积分区间对应的面积。'
              : '拖动鼠标可查看曲线上的点。'}
        </p>
      </div>
    </Modal>
  );
}
