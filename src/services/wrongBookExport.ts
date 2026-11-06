import katex from 'katex';
import type { WrongItem } from '../domain/types';
import { formatDateTime } from '../lib/date';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function mathHtml(value: string, display: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
    });
  } catch {
    return `<code>${escapeHtml(value)}</code>`;
  }
}

/** 与 MathText 相同：$...$ 行内，$$...$$ 块级。 */
function renderRichText(input: string): string {
  const pattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      result += textHtml(input.slice(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('$$')) {
      result += `<div class="pdf-math-block">${mathHtml(raw.slice(2, -2).trim(), true)}</div>`;
    } else {
      result += `<span class="pdf-math-inline">${mathHtml(raw.slice(1, -1), false)}</span>`;
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < input.length) result += textHtml(input.slice(lastIndex));
  return result;
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function answerBlock(item: WrongItem): string {
  const question = item.questionSnapshot;
  if (question.type === 'choice') {
    const options = question.options ?? [];
    return options
      .map((option, index) => {
        const correct = option.id === String(question.answer);
        return `<div class="pdf-option ${correct ? 'correct' : ''}">
          <strong>${optionLetter(index)}</strong>
          <span>${renderRichText(option.text)}</span>
          ${correct ? '<em>✓</em>' : ''}
        </div>`;
      })
      .join('');
  }
  if (question.type === 'judge') {
    return `<div class="pdf-option correct"><strong>${question.answer === true ? '正确' : '错误'}</strong><em>✓</em></div>`;
  }
  return `<div class="pdf-answer-text">${renderRichText(String(question.answer))}</div>`;
}

function itemHtml(item: WrongItem, index: number): string {
  const question = item.questionSnapshot;
  const scratch = item.scratchImage
    ? `<div class="pdf-scratch">
        <div class="pdf-label">当时保存的草稿</div>
        <img src="${item.scratchImage}" alt="作答草稿" />
      </div>`
    : '';
  return `<section class="pdf-item">
    <div class="pdf-item-head">
      <span class="pdf-index">${String(index + 1).padStart(2, '0')}</span>
      <span>第 ${item.chapter} 章 · ${question.type === 'choice' ? '选择题' : question.type === 'judge' ? '判断题' : '解答题'} · ${item.difficulty}</span>
      <span class="pdf-topic">${escapeHtml(item.topic)}</span>
    </div>
    <div class="pdf-stem">${renderRichText(question.stem)}</div>
    <div class="pdf-section">
      <div class="pdf-label">选项 / 正确答案</div>
      <div class="pdf-options">${answerBlock(item)}</div>
    </div>
    <div class="pdf-section">
      <div class="pdf-label">完整解析</div>
      <div class="pdf-explanation">${renderRichText(question.explanation)}</div>
    </div>
    ${scratch}
    <div class="pdf-workarea">
      <div class="pdf-label">作答区（可手写）</div>
      <div class="pdf-lines"><span></span><span></span><span></span></div>
    </div>
  </section>`;
}

function buildElement(items: WrongItem[], scopeLabel: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'pdf-export-root';
  root.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'width:794px',
    'max-width:794px',
    'padding:30px 34px 36px',
    'background:#ffffff',
    'color:#1d272b',
    'z-index:9998',
    'box-sizing:border-box',
    'font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif',
    'font-size:12px',
    'line-height:1.7',
  ].join(';');

  root.innerHTML = `
    <header class="pdf-header">
      <div class="pdf-brand">高数闯关 · 错题本</div>
      <h1>错题导出</h1>
      <p>${escapeHtml(scopeLabel)} · 共 ${items.length} 道 · ${escapeHtml(formatDateTime(Date.now()))}</p>
      <p class="pdf-note">含题干、选项/正确答案、完整解析与当时草稿；每题下方保留手写作答区。</p>
    </header>
    ${items.map((item, index) => itemHtml(item, index)).join('')}
    <footer class="pdf-footer">高数闯关 · 同济第八版上册 · 错题本导出</footer>
  `;
  return root;
}

export async function exportWrongBookPdf(items: WrongItem[], scopeLabel: string): Promise<void> {
  if (items.length === 0) throw new Error('当前筛选下没有错题');

  const root = buildElement(items, scopeLabel);
  const status = document.createElement('div');
  status.className = 'pdf-export-status';
  status.textContent = '正在生成 PDF…';
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.append(root, status);

  try {
    if (document.fonts) await document.fonts.ready;
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            image.onload = () => resolve();
            image.onerror = () => resolve();
          }),
      ),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // PDF 库按需加载，避免首页/错题本首屏下载 500KB+ 的渲染依赖。
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });
    const contentWidth = 190;
    const pageBottom = 287;
    let cursorY = 10;

    const capture = (element: HTMLElement): Promise<HTMLCanvasElement> =>
      html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
      });

    const header = root.querySelector<HTMLElement>('.pdf-header');
    if (header) {
      const canvas = await capture(header);
      const height = (canvas.height * contentWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, cursorY, contentWidth, height);
      cursorY += height + 6;
    }

    const itemElements = Array.from(root.querySelectorAll<HTMLElement>('.pdf-item'));
    for (const element of itemElements) {
      const canvas = await capture(element);
      const height = (canvas.height * contentWidth) / canvas.width;

      if (height > 277) {
        // 单题超过一页：按整页切片，避免直接裁掉内容。
        if (cursorY > 10) {
          pdf.addPage();
          cursorY = 10;
        }
        const pixelsPerMm = canvas.width / contentWidth;
        const pagePixels = Math.floor(277 * pixelsPerMm);
        let offset = 0;
        while (offset < canvas.height) {
          const sliceHeight = Math.min(pagePixels, canvas.height - offset);
          const slice = document.createElement('canvas');
          slice.width = canvas.width;
          slice.height = sliceHeight;
          const context = slice.getContext('2d');
          if (context) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, slice.width, slice.height);
            context.drawImage(
              canvas,
              0,
              offset,
              canvas.width,
              sliceHeight,
              0,
              0,
              slice.width,
              slice.height,
            );
          }
          const sliceMm = (sliceHeight * contentWidth) / canvas.width;
          pdf.addImage(
            slice.toDataURL('image/jpeg', 0.95),
            'JPEG',
            10,
            cursorY,
            contentWidth,
            sliceMm,
          );
          offset += sliceHeight;
          if (offset < canvas.height) {
            pdf.addPage();
            cursorY = 10;
          } else {
            cursorY += sliceMm + 5;
          }
        }
        continue;
      }

      if (cursorY + height > pageBottom) {
        pdf.addPage();
        cursorY = 10;
      }
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        10,
        cursorY,
        contentWidth,
        height,
      );
      cursorY += height + 5;
    }

    pdf.save(`gaoshu-wrongbook-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    root.remove();
    status.remove();
    document.body.style.overflow = previousOverflow;
  }
}
