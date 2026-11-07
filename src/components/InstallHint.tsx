import { useEffect, useState } from 'react';
import { Modal } from './Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type BrowserKind =
  | 'ios'
  | 'wechat'
  | 'android-chrome'
  | 'android-builtin'
  | 'edge'
  | 'chrome-desktop'
  | 'other';

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
  if (/MicroMessenger/i.test(ua)) return 'wechat';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) {
    const excluded =
      /UCBrowser|Quark|MiuiBrowser|VivoBrowser|HeyTapBrowser|HuaweiBrowser|MQQBrowser|Weibo|BaiduBox/i.test(
        ua,
      );
    const chromium = /Chrome\/|EdgA\/|SamsungBrowser\//i.test(ua) && !excluded;
    return chromium ? 'android-chrome' : 'android-builtin';
  }
  if (/Edg\//i.test(ua)) return 'edge';
  if (/Chrome\//i.test(ua)) return 'chrome-desktop';
  return 'other';
}

const HELP_COPY: Record<BrowserKind, string> = {
  ios: '用 Safari 打开本页 → 点击底部「分享」按钮 → 选择「添加到主屏幕」。安装后从桌面打开即可全屏使用，首次加载后断网也能刷主线。',
  wechat:
    '微信内不能安装 PWA。点右上角「…」→「在浏览器打开」，然后在系统浏览器中按下方说明安装；如果手机自带浏览器没有安装入口，请复制链接到 Chrome / Safari。',
  'android-chrome':
    '点 Chrome 右上角「⋮」→「安装应用」或「添加到主屏幕」。安装后从桌面打开即可全屏使用，首次加载后断网也能刷主线。',
  'android-builtin':
    '手机自带浏览器通常只能创建“桌面快捷方式”，不能全屏或离线。请点「复制链接」，用 Chrome 打开 → 菜单「⋮」→「安装应用」。',
  edge: 'Edge：点右上角「…」→「应用」→「安装此站点为应用」。Chrome：点地址栏右侧安装图标，或「⋮」→「保存并分享」→「安装页面为应用」。',
  'chrome-desktop':
    'Chrome：点地址栏右侧的安装图标，或右上角「⋮」→「保存并分享」→「安装页面为应用」。',
  other:
    '当前浏览器没有可靠的安装入口。请用 Chrome / Edge / Safari 打开本页，再按浏览器菜单安装；PWA 不是 APK，不能像安装包一样下载。',
};

function getCapturedPrompt(): BeforeInstallPromptEvent | null {
  return (
    (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent | null })
      .__pwaInstallPrompt ?? null
  );
}

/**
 * 首页右下角安装按钮：
 * - Chromium 支持 beforeinstallprompt 时，点击直接触发原生安装弹窗；
 * - iOS / 微信 / 国产自带浏览器没有该事件，点击显示对应安装指引 + 复制链接。
 */
export function InstallHint(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [browser] = useState<BrowserKind>(() => detectBrowser());

  useEffect(() => {
    const singleFileBuild =
      window.location.protocol === 'file:' ||
      (import.meta.env as Record<string, string | undefined>).VITE_SINGLE_FILE === 'true';
    if (
      singleFileBuild ||
      !window.isSecureContext ||
      isStandalone() ||
      !('serviceWorker' in navigator)
    ) {
      return undefined;
    }
    setVisible(true);
    setDeferred(getCapturedPrompt());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onReady = () => setDeferred(getCapturedPrompt());
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('pwa-install-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('pwa-install-ready', onReady);
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
      if (choice.outcome === 'accepted') setVisible(false);
    } catch {
      setDeferred(null);
      setHelpOpen(true);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
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

      <Modal open={helpOpen} title="安装到桌面 / 手机" onClose={() => setHelpOpen(false)}>
        <div className="install-help">
          <p>{HELP_COPY[browser]}</p>
          <div className="install-help-tips">
            <span>PWA 不是 APK，不能像安装包一样下载；它通过浏览器安装。</span>
            <span>首次加载后，核心题库与页面会缓存到本机；社区题库仍需联网。</span>
            <span>安装后从桌面图标打开，可隐藏浏览器地址栏，接近原生 App。</span>
          </div>
          <div className="install-help-actions">
            <button className="button primary" onClick={() => setHelpOpen(false)}>
              我知道了
            </button>
            <button className="button ghost" onClick={() => void copyLink()}>
              {copied ? '已复制链接' : '复制链接'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
