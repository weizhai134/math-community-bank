/**
 * html2canvas 体积较大，按需加载；卡片最大宽度固定为 750px，
 * 输出使用 2 倍像素比，方便手机端长按保存后保持清晰。
 */
export async function renderShareCard(element: HTMLElement): Promise<string> {
  await document.fonts.ready;
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#f7f1e3',
    useCORS: true,
    logging: false,
    width: 750,
    height: 1000,
    windowWidth: 750,
    windowHeight: 1000,
  });
  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl || dataUrl === 'data:,') throw new Error('战报生成失败，请稍后重试');
  return dataUrl;
}
