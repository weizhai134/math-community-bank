import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** public/ 下需要进入离线缓存的固定资源（文件名不带 hash）。 */
const PUBLIC_ASSETS = [
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

/** 改这里可以强制所有已安装客户端更新离线缓存。 */
const SW_REVISION = '1';

function shortHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildServiceWorker(version: string, precache: string[]): string {
  return `/* 由 vite.config.ts 在构建时生成；请勿手改，改源文件后重新 build。 */
const VERSION = ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(precache, null, 2)};

const base = self.location.href;
const scopeRoot = new URL('./', base).href;
const indexURL = new URL('./index.html', base).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, base).href)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function serveIndex(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cachedIndex = await caches.match(indexURL);
    if (cachedIndex) return cachedIndex;
    const cachedRoot = await caches.match(scopeRoot);
    if (cachedRoot) return cachedRoot;
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(serveIndex(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
`;
}

/**
 * 构建时生成 sw.js：预缓存 index.html、全部带 hash 的 JS/CSS/字体与固定图标，
 * 安装后断网也能打开；导航请求走 network-first，离线回退到缓存的 index.html。
 */
function pwaServiceWorker(): Plugin {
  return {
    name: 'gaoshu-pwa-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const builtAssets = Object.keys(bundle)
        .filter((fileName) => /\.(js|css|woff2?|ttf)$/.test(fileName))
        .sort();
      const precache = [
        './',
        './index.html',
        ...builtAssets.map((fileName) => `./${fileName}`),
        ...PUBLIC_ASSETS.map((fileName) => `./${fileName}`),
      ];
      const version = `gaoshu-${shortHash(
        `${SW_REVISION}|${builtAssets.join('|')}|${PUBLIC_ASSETS.join('|')}`,
      )}`;
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: buildServiceWorker(version, precache),
      });
    },
  };
}

export default defineConfig(() => {
  return {
    // 只部署在 Vercel 根目录：资源统一使用根相对路径。
    base: '/',
    plugins: [react(), pwaServiceWorker()],
    server: {
      port: 5173,
      strictPort: true,
      watch: {
        // 忽略临时目录与原子替换产生的临时文件：Windows 上 chokidar 监听到这类
        // 正在被删除/锁定的路径会抛 EBUSY 并让 dev server 退出。
        ignored: [
          '**/.tmp/**',
          '**/.artifacts/**',
          '**/.npm-cache/**',
          '**/*.tmpdir/**',
          '**/.*.tmpdir/**',
          '**/*.tmp',
        ],
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('katex')) return 'katex';
            if (id.includes('dexie')) return 'dexie';
            if (
              id.includes('react') ||
              id.includes('scheduler') ||
              id.includes('zustand') ||
              id.includes('use-sync-external-store')
            ) {
              return 'react-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
