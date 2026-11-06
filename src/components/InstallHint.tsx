import { useEffect, useState } from 'react';
import { Modal } from './Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type BrowserKind = 'ios' | 'chromium' | 'other';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

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

const HELP_COPY: Record<BrowserKind, string> = {
  ios: '用 Safari 打开本页 → 点击底部「分享」按钮 → 选择「添加到主屏幕」。安装后从桌面打开即可全屏使用，首次加载后断网也能刷主线。',
  chromium:
    '点击浏览器右上角「⋮」→「安装应用」或「添加到主屏幕」。安装后从桌面打开即可全屏使用，首次加载后断网也能刷主线。',
  other:
    '当前浏览器没有安装入口。请复制网址，用 Chrome / Edge / Safari 打开后再安装；安装后首次加载过的内容可离线使用。',
};

/**
 * 首页右下角安装按钮：
 * - Chromium 支持 beforeinstallprompt 时，点击直接触发原生安装弹窗；
 * - iOS / 其他浏览器没有该事件，点击显示对应浏览器的“添加到主屏幕”指引。
 */
export function InstallHint(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [browser] = useState<BrowserKind>(() => detectBrowser());

  useEffect(() => {
    if (!window.isSecureContext || isStandalone() || !('serviceWorker' in navigator)) {
      return undefined;
    }
    setVisible(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (!deferred) {
      setHelpOpen(true);
      return;
    }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') {
        setVisible(false);
      }
    } catch {
      setDeferred(null);
      setHelpOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className="install-fab"
        onClick={() => void install()}
        aria-label="安装高数闯关到桌面"
      >
        <span className="install-fab-icon" aria-hidden="true">
          ↓
        </span>
        <span>
          <strong>安装到桌面</strong>
          <small>全屏 · 离线可用</small>
        </span>
      </button>

      <Modal
        open={helpOpen}
        title="安装到桌面"
        onClose={() => setHelpOpen(false)}
      >
        <div className="install-help">
          <p>{HELP_COPY[browser]}</p>
          <div className="install-help-tips">
            <span>首次加载后，核心题库与页面会缓存到本机。</span>
            <span>社区题库仍需联网；主线、错题复习、闪卡可离线打开。</span>
          </div>
          <button className="button primary" onClick={() => setHelpOpen(false)}>
            我知道了
          </button>
        </div>
      </Modal>
    </>
  );
}
