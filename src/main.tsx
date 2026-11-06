import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 容器');

// index.html 里放了一个“正在加载”兜底；JS 成功加载后清掉它再挂载 React。
root.replaceChildren();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 只有生产构建才注册离线缓存；开发模式下 HMR 与 SW 缓存会互相打架。
// 注意：Service Worker 需要安全上下文（HTTPS 或 localhost），
// 用局域网 http://192.168.x.x 打开时只能在线使用，无法安装/离线。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI).href)
      .catch((error: unknown) => {
        console.warn('Service Worker 注册失败，本次只能在线使用：', error);
      });
  });
}
