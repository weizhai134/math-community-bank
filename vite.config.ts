import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon.svg',
      ],
      manifest: {
        id: '/',
        name: '高数闯关',
        short_name: '高数闯关',
        description:
          '同济版高等数学第八版上册：七章、二十一关、一百零五道题，主线闯关、错题复习、公式闪卡与模拟考场。',
        lang: 'zh-CN',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#f4f0e6',
        theme_color: '#f4f0e6',
        categories: ['education'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: '章节地图',
            short_name: '地图',
            url: '/#/map',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: '错题本',
            short_name: '错题',
            url: '/#/wrong',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: '公式闪卡',
            short_name: '闪卡',
            url: '/#/flashcards',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2,ttf}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
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
          // PDF 依赖由 wrongBookExport 动态 import，交给 Rollup 单独切异步 chunk。
          if (id.includes('html2canvas') || id.includes('jspdf')) return undefined;
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
});
