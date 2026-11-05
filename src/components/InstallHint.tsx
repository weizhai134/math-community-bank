import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../db/db';

const DISMISS_KEY = 'installHintDismissed';

type BrowserKind = 'ios' | 'chromium' | 'other';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/**
 * 不同浏览器安装入口完全不同：iOS Safari 是“分享 → 添加到主屏幕”，
 * Chromium 系是菜单里的“安装应用”，而多数国产/厂商浏览器根本没有安装入口。
 * 与其让用户在找不到的菜单里翻，不如直接说清楚该用什么浏览器。
 */
function detectBrowser(): BrowserKind {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (!/Android/i.test(ua)) return 'other';
  const excluded =
    /UCBrowser|Quark|MiuiBrowser|VivoBrowser|HeyTapBrowser|HuaweiBrowser|MQQBrowser|MicroMessenger|Weibo|BaiduBox/i.test(
      ua,
    );
  const chromium = /Chrome\/|EdgA\/|SamsungBrowser\//i.test(ua) && !excluded;
  return chromium ? 'chromium' : 'other';
}

const COPY: Record<BrowserKind, string> = {
  ios: 'iPhone：用 Safari 打开本页 → 底部「分享」→「添加到主屏幕」。装好后离线也能闯关。',
  chromium: '点浏览器右上角「⋮」→「安装应用」（部分版本叫「添加到主屏幕」）。装好后离线也能闯关。',
  other:
    '当前浏览器没有安装入口：复制网址，用 Chrome 打开后再安装。装好后离线也能闯关。',
};

/**
 * 手机端安装引导。只在安全上下文（HTTPS / localhost）且尚未安装时出现；
 * 关掉后写入 IndexedDB，下次不再打扰。
 */
export function InstallHint(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [browser] = useState<BrowserKind>(() => detectBrowser());

  useEffect(() => {
    let active = true;
    if (!window.isSecureContext || isStandalone()) return undefined;
    if (!('serviceWorker' in navigator)) return undefined;
    getSetting<boolean>(DISMISS_KEY)
      .then((dismissed) => {
        if (active && !dismissed) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    void setSetting(DISMISS_KEY, true);
  };

  return (
    <section className="install-hint" aria-label="安装到手机桌面">
      <div>
        <strong>装到手机桌面，断网也能刷</strong>
        <p>{COPY[browser]}</p>
      </div>
      <button className="button small ghost" onClick={dismiss}>
        知道了
      </button>
    </section>
  );
}
