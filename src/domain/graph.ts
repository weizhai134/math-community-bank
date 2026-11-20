export type GraphKind = 'curve' | 'tangent' | 'area';

/**
 * 题目配套的轻量绘图描述。
 * expression 使用 function-plot / built-in-math-eval 支持的表达式语法，
 * 例如 `x^3 - 3*x`、`exp(2*x)`、`1/x`。
 */
export interface GraphSpec {
  expression: string;
  kind: GraphKind;
  /** 切线题使用：f'(x) 的表达式与切点横坐标。 */
  derivativeExpression?: string;
  tangentAt?: number;
  /** 面积题使用：积分区间。 */
  areaFrom?: number;
  areaTo?: number;
  /** 备用：需要同时画出第二条曲线时使用。 */
  secondaryExpression?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  note?: string;
}
