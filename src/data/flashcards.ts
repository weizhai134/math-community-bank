export interface Flashcard {
  id: string;
  topic: string;
  front: string;
  back: string;
}

/** 高数上册核心公式；公式统一用 $...$ 包裹，由 MathText 渲染。 */
export const FLASHCARDS: Flashcard[] = [
  {
    id: 'equiv-sin',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$\sin x$ 的等价无穷小是什么？`,
    back: String.raw`$\sin x \sim x$。乘除因子可直接替换；加减法中要谨慎，通常需要展开到更高阶。`,
  },
  {
    id: 'equiv-tan',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$\tan x$ 的等价无穷小是什么？`,
    back: String.raw`$\tan x \sim x$。因为 $\tan x=\frac{\sin x}{\cos x}$，而 $\cos x\to 1$。`,
  },
  {
    id: 'equiv-cos',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$1-\cos x$ 与哪个幂函数等价？`,
    back: String.raw`$1-\cos x \sim \frac{x^2}{2}$。这是二阶无穷小，常用在含 $1-\cos x$ 的极限里。`,
  },
  {
    id: 'equiv-ln',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$\ln(1+x)$ 的等价无穷小是什么？`,
    back: String.raw`$\ln(1+x) \sim x$。更一般地，$\ln(1+u)\sim u$（$u\to 0$）。`,
  },
  {
    id: 'equiv-exp',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$e^x-1$ 的等价无穷小是什么？`,
    back: String.raw`$e^x-1 \sim x$。更一般地，$a^x-1\sim x\ln a$（$a>0,\ a\ne 1$）。`,
  },
  {
    id: 'equiv-power',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$(1+x)^\alpha-1$ 的等价无穷小是什么？`,
    back: String.raw`$(1+x)^\alpha-1 \sim \alpha x$（$\alpha\ne 0$）。这是二项式展开的一阶项。`,
  },
  {
    id: 'equiv-arcsin',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$\arcsin x$ 的等价无穷小是什么？`,
    back: String.raw`$\arcsin x \sim x$。因为 $\arcsin x$ 与 $\sin x$ 在 $0$ 附近互为反函数，一阶行为相同。`,
  },
  {
    id: 'equiv-arctan',
    topic: '等价无穷小',
    front: String.raw`当 $x\to 0$ 时，$\arctan x$ 的等价无穷小是什么？`,
    back: String.raw`$\arctan x \sim x$。它与 $\tan x$ 在 $0$ 附近的一阶行为一致。`,
  },
  {
    id: 'deriv-power',
    topic: '基本导数',
    front: String.raw`求 $(x^\alpha)'$，其中 $\alpha$ 为常数。`,
    back: String.raw`$(x^\alpha)'=\alpha x^{\alpha-1}$。特别注意 $\alpha=0$ 时为 $0$，$\alpha=1$ 时为 $1$。`,
  },
  {
    id: 'deriv-exp',
    topic: '基本导数',
    front: String.raw`求 $(a^x)'$ 与 $(e^x)'$。`,
    back: String.raw`$(a^x)'=a^x\ln a$（$a>0,\ a\ne1$）；$(e^x)'=e^x$。`,
  },
  {
    id: 'deriv-log',
    topic: '基本导数',
    front: String.raw`求 $(\log_a x)'$ 与 $(\ln x)'$。`,
    back: String.raw`$(\log_a x)'=\frac{1}{x\ln a}$；$(\ln x)'=\frac{1}{x}$（$x>0$）。`,
  },
  {
    id: 'deriv-sin-cos',
    topic: '基本导数',
    front: String.raw`求 $(\sin x)'$ 与 $(\cos x)'$。`,
    back: String.raw`$(\sin x)'=\cos x$；$(\cos x)'=-\sin x$。注意余弦求导后的负号。`,
  },
  {
    id: 'deriv-tan',
    topic: '基本导数',
    front: String.raw`求 $(\tan x)'$。`,
    back: String.raw`$(\tan x)'=\sec^2 x=\frac{1}{\cos^2 x}$。定义域内 $\cos x\ne0$。`,
  },
  {
    id: 'deriv-arcsin',
    topic: '基本导数',
    front: String.raw`求 $(\arcsin x)'$。`,
    back: String.raw`$(\arcsin x)'=\frac{1}{\sqrt{1-x^2}}$（$|x|<1$）。`,
  },
  {
    id: 'deriv-arctan',
    topic: '基本导数',
    front: String.raw`求 $(\arctan x)'$。`,
    back: String.raw`$(\arctan x)'=\frac{1}{1+x^2}$（$x\in\mathbb{R}$）。`,
  },
  {
    id: 'int-power',
    topic: '基本积分',
    front: String.raw`求 $\int x^\alpha\,dx$（$\alpha\ne-1$）。`,
    back: String.raw`$\int x^\alpha\,dx=\frac{x^{\alpha+1}}{\alpha+1}+C$（$\alpha\ne-1$）。`,
  },
  {
    id: 'int-recip',
    topic: '基本积分',
    front: String.raw`求 $\int \frac{1}{x}\,dx$。`,
    back: String.raw`$\int \frac{1}{x}\,dx=\ln|x|+C$。绝对值不能省，因为 $x$ 可取负值。`,
  },
  {
    id: 'int-exp',
    topic: '基本积分',
    front: String.raw`求 $\int e^x\,dx$ 与 $\int a^x\,dx$。`,
    back: String.raw`$\int e^x\,dx=e^x+C$；$\int a^x\,dx=\frac{a^x}{\ln a}+C$（$a>0,\ a\ne1$）。`,
  },
  {
    id: 'int-sin-cos',
    topic: '基本积分',
    front: String.raw`求 $\int \sin x\,dx$ 与 $\int \cos x\,dx$。`,
    back: String.raw`$\int \sin x\,dx=-\cos x+C$；$\int \cos x\,dx=\sin x+C$。`,
  },
  {
    id: 'int-sec2',
    topic: '基本积分',
    front: String.raw`求 $\int \sec^2 x\,dx$ 与 $\int \frac{1}{\cos^2 x}\,dx$。`,
    back: String.raw`二者相同：$\int \sec^2 x\,dx=\tan x+C$。`,
  },
  {
    id: 'int-arctan',
    topic: '基本积分',
    front: String.raw`求 $\int \frac{1}{1+x^2}\,dx$。`,
    back: String.raw`$\int \frac{1}{1+x^2}\,dx=\arctan x+C$。这是 $\arctan x$ 求导公式的逆用。`,
  },
  {
    id: 'int-arcsin',
    topic: '基本积分',
    front: String.raw`求 $\int \frac{1}{\sqrt{1-x^2}}\,dx$。`,
    back: String.raw`$\int \frac{1}{\sqrt{1-x^2}}\,dx=\arcsin x+C$（$|x|<1$）。`,
  },
  {
    id: 'int-tan',
    topic: '基本积分',
    front: String.raw`求 $\int \tan x\,dx$。`,
    back: String.raw`$\int \tan x\,dx=-\ln|\cos x|+C=\ln|\sec x|+C$。`,
  },
  {
    id: 'taylor-exp',
    topic: '泰勒展开',
    front: String.raw`写出 $e^x$ 的麦克劳林展开（带通项）。`,
    back: String.raw`$e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots$，收敛域 $(-\infty,+\infty)$。`,
  },
  {
    id: 'taylor-sin',
    topic: '泰勒展开',
    front: String.raw`写出 $\sin x$ 的麦克劳林展开（带通项）。`,
    back: String.raw`$\sin x=\sum_{n=0}^{\infty}\frac{(-1)^n x^{2n+1}}{(2n+1)!}=x-\frac{x^3}{3!}+\frac{x^5}{5!}-\cdots$，收敛域 $(-\infty,+\infty)$。`,
  },
  {
    id: 'taylor-cos',
    topic: '泰勒展开',
    front: String.raw`写出 $\cos x$ 的麦克劳林展开（带通项）。`,
    back: String.raw`$\cos x=\sum_{n=0}^{\infty}\frac{(-1)^n x^{2n}}{(2n)!}=1-\frac{x^2}{2!}+\frac{x^4}{4!}-\cdots$，收敛域 $(-\infty,+\infty)$。`,
  },
  {
    id: 'taylor-ln',
    topic: '泰勒展开',
    front: String.raw`写出 $\ln(1+x)$ 的麦克劳林展开及其收敛域。`,
    back: String.raw`$\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}x^n}{n}=x-\frac{x^2}{2}+\frac{x^3}{3}-\cdots$，收敛域 $-1<x\le 1$。`,
  },
  {
    id: 'taylor-binomial',
    topic: '泰勒展开',
    front: String.raw`写出 $(1+x)^\alpha$ 的麦克劳林展开（前两项即可）。`,
    back: String.raw`$(1+x)^\alpha=1+\alpha x+\frac{\alpha(\alpha-1)}{2!}x^2+\cdots$，收敛域 $|x|<1$（端点视 $\alpha$ 而定）。`,
  },
  {
    id: 'taylor-geometric',
    topic: '泰勒展开',
    front: String.raw`写出 $\frac{1}{1-x}$ 的麦克劳林展开及收敛域。`,
    back: String.raw`$\frac{1}{1-x}=1+x+x^2+x^3+\cdots=\sum_{n=0}^{\infty}x^n$，收敛域 $|x|<1$。`,
  },
  {
    id: 'mvt-rolle',
    topic: '中值定理',
    front: String.raw`罗尔定理的条件和结论分别是什么？`,
    back: String.raw`条件：$f$ 在 $[a,b]$ 上连续、在 $(a,b)$ 内可导，且 $f(a)=f(b)$。结论：存在 $\xi\in(a,b)$，使 $f'(\xi)=0$。`,
  },
  {
    id: 'mvt-lagrange',
    topic: '中值定理',
    front: String.raw`拉格朗日中值定理的条件和结论分别是什么？`,
    back: String.raw`条件：$f$ 在 $[a,b]$ 上连续、在 $(a,b)$ 内可导。结论：存在 $\xi\in(a,b)$，使 $f'(\xi)=\frac{f(b)-f(a)}{b-a}$。`,
  },
  {
    id: 'mvt-cauchy',
    topic: '中值定理',
    front: String.raw`柯西中值定理的条件和结论分别是什么？`,
    back: String.raw`条件：$f,g$ 在 $[a,b]$ 上连续、在 $(a,b)$ 内可导，且 $g'(x)\ne0$。结论：存在 $\xi\in(a,b)$，使 $\frac{f'(\xi)}{g'(\xi)}=\frac{f(b)-f(a)}{g(b)-g(a)}$。`,
  },
  {
    id: 'mvt-integral',
    topic: '中值定理',
    front: String.raw`积分中值定理的内容是什么？`,
    back: String.raw`若 $f$ 在 $[a,b]$ 上连续，则存在 $\xi\in[a,b]$，使 $\int_a^b f(x)\,dx=f(\xi)(b-a)$。`,
  },
];
