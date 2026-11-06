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
