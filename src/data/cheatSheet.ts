export interface FormulaEntry {
  id: string;
  name: string;
  latex: string;
  note?: string;
}

export interface FormulaCategory {
  id: string;
  title: string;
  entries: FormulaEntry[];
}

/** 静态公式速查，只含通用公式，不包含任何题目答案。 */
export const CHEAT_SHEET: FormulaCategory[] = [
  {
    id: 'equivalents',
    title: '等价无穷小',
    entries: [
      { id: 'eq-sin', name: 'sin x', latex: String.raw`\sin x \sim x` },
      { id: 'eq-tan', name: 'tan x', latex: String.raw`\tan x \sim x` },
      { id: 'eq-cos', name: '1 - cos x', latex: String.raw`1-\cos x \sim \frac{x^2}{2}` },
      { id: 'eq-ln', name: 'ln(1+x)', latex: String.raw`\ln(1+x) \sim x` },
      { id: 'eq-exp', name: 'e^x - 1', latex: String.raw`e^x-1 \sim x` },
      {
        id: 'eq-power',
        name: '(1+x)^a - 1',
        latex: String.raw`(1+x)^\alpha-1 \sim \alpha x`,
        note: String.raw`$\alpha\ne 0$`,
      },
      { id: 'eq-arcsin', name: 'arcsin x', latex: String.raw`\arcsin x \sim x` },
      { id: 'eq-arctan', name: 'arctan x', latex: String.raw`\arctan x \sim x` },
    ],
  },
  {
    id: 'derivatives',
    title: '导数表',
    entries: [
      {
        id: 'd-power',
        name: '幂函数',
        latex: String.raw`(x^\alpha)'=\alpha x^{\alpha-1}`,
      },
      { id: 'd-exp', name: '指数函数', latex: String.raw`(a^x)'=a^x\ln a` },
      {
        id: 'd-log',
        name: '对数函数',
        latex: String.raw`(\log_a x)'=\frac{1}{x\ln a}`,
      },
      { id: 'd-sin', name: '正弦', latex: String.raw`(\sin x)'=\cos x` },
      { id: 'd-cos', name: '余弦', latex: String.raw`(\cos x)'=-\sin x` },
      { id: 'd-tan', name: '正切', latex: String.raw`(\tan x)'=\sec^2 x` },
      {
        id: 'd-arcsin',
        name: '反正弦',
        latex: String.raw`(\arcsin x)'=\frac{1}{\sqrt{1-x^2}}`,
      },
      {
        id: 'd-arctan',
        name: '反正切',
        latex: String.raw`(\arctan x)'=\frac{1}{1+x^2}`,
      },
    ],
  },
  {
    id: 'integrals',
    title: '积分表',
    entries: [
      {
        id: 'i-power',
        name: '幂函数',
        latex: String.raw`\int x^\alpha\,dx=\frac{x^{\alpha+1}}{\alpha+1}+C`,
        note: String.raw`$\alpha\ne -1$`,
      },
      {
        id: 'i-recip',
        name: '1/x',
        latex: String.raw`\int \frac{1}{x}\,dx=\ln|x|+C`,
      },
      { id: 'i-exp', name: '指数函数', latex: String.raw`\int e^x\,dx=e^x+C` },
      {
        id: 'i-aexp',
        name: 'a^x',
        latex: String.raw`\int a^x\,dx=\frac{a^x}{\ln a}+C`,
      },
      { id: 'i-sin', name: '正弦', latex: String.raw`\int \sin x\,dx=-\cos x+C` },
      { id: 'i-cos', name: '余弦', latex: String.raw`\int \cos x\,dx=\sin x+C` },
      {
        id: 'i-sec2',
        name: 'sec² x',
        latex: String.raw`\int \sec^2 x\,dx=\tan x+C`,
      },
      {
        id: 'i-arctan',
        name: '1/(1+x²)',
        latex: String.raw`\int \frac{1}{1+x^2}\,dx=\arctan x+C`,
      },
      {
        id: 'i-arcsin',
        name: '1/√(1-x²)',
        latex: String.raw`\int \frac{1}{\sqrt{1-x^2}}\,dx=\arcsin x+C`,
      },
    ],
  },
  {
    id: 'taylor',
    title: '泰勒展开',
    entries: [
      {
        id: 't-exp',
        name: 'e^x',
        latex: String.raw`e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}=1+x+\frac{x^2}{2!}+\cdots`,
        note: String.raw`$x\in(-\infty,+\infty)$`,
      },
      {
        id: 't-sin',
        name: 'sin x',
        latex: String.raw`\sin x=\sum_{n=0}^{\infty}\frac{(-1)^n x^{2n+1}}{(2n+1)!}=x-\frac{x^3}{3!}+\cdots`,
        note: String.raw`$x\in(-\infty,+\infty)$`,
      },
      {
        id: 't-cos',
        name: 'cos x',
        latex: String.raw`\cos x=\sum_{n=0}^{\infty}\frac{(-1)^n x^{2n}}{(2n)!}=1-\frac{x^2}{2!}+\cdots`,
        note: String.raw`$x\in(-\infty,+\infty)$`,
      },
      {
        id: 't-ln',
        name: 'ln(1+x)',
        latex: String.raw`\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}x^n}{n}=x-\frac{x^2}{2}+\cdots`,
        note: String.raw`$-1<x\le 1$`,
      },
      {
        id: 't-binomial',
        name: '(1+x)^a',
        latex: String.raw`(1+x)^\alpha=1+\alpha x+\frac{\alpha(\alpha-1)}{2!}x^2+\cdots`,
        note: String.raw`$|x|<1$`,
      },
      {
        id: 't-geometric',
        name: '1/(1-x)',
        latex: String.raw`\frac{1}{1-x}=\sum_{n=0}^{\infty}x^n=1+x+x^2+\cdots`,
        note: String.raw`$|x|<1$`,
      },
    ],
  },
  {
    id: 'mvt',
    title: '中值定理',
    entries: [
      {
        id: 'm-rolle',
        name: '罗尔定理',
        latex: String.raw`f\in C[a,b],\ f(a)=f(b)\ \Rightarrow\ \exists \xi\in(a,b),\ f'(\xi)=0`,
        note: String.raw`条件：$[a,b]$ 连续、$(a,b)$ 可导。`,
      },
      {
        id: 'm-lagrange',
        name: '拉格朗日',
        latex: String.raw`f'(\xi)=\frac{f(b)-f(a)}{b-a}`,
        note: String.raw`条件：$[a,b]$ 连续、$(a,b)$ 可导，$\xi\in(a,b)$。`,
      },
      {
        id: 'm-cauchy',
        name: '柯西中值',
        latex: String.raw`\frac{f'(\xi)}{g'(\xi)}=\frac{f(b)-f(a)}{g(b)-g(a)}`,
        note: String.raw`条件：$f,g$ 连续可导，$g'(x)\ne 0$，$\xi\in(a,b)$。`,
      },
      {
        id: 'm-integral',
        name: '积分中值',
        latex: String.raw`\int_a^b f(x)\,dx=f(\xi)(b-a)`,
        note: String.raw`条件：$f$ 在 $[a,b]$ 连续，$\xi\in[a,b]$。`,
      },
    ],
  },
];
