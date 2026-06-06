import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';

const target = process.env.VITE_BROWSER || 'chrome';
const root = resolve(__dirname);

// Content Script 构建配置（IIFE 格式，Content Script 不支持 ES Module）
function contentConfig() {
  return defineConfig({
    build: {
      outDir: resolve(root, `.tmp/${target}/content`),
      emptyOutDir: true,
      lib: {
        entry: resolve(root, 'extension/content/content.ts'),
        formats: ['iife'],
        name: 'WebMDownloaderContent',
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
      target: 'es2020',
      minify: false,
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@shared': resolve(root, 'extension/shared'),
      },
    },
  });
}

// 主构建配置（Background + Popup，ES Module 格式）
function mainConfig() {
  return defineConfig({
    base: './',
    build: {
      outDir: resolve(root, `dist/${target}`),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          background: resolve(root, 'extension/background/service-worker.ts'),
          popup: resolve(root, 'extension/popup/popup.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.html')) return '[name]/[name].[ext]';
            return 'assets/[name].[ext]';
          },
        },
      },
      target: 'es2020',
      minify: false,
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@shared': resolve(root, 'extension/shared'),
      },
    },
    plugins: [
      {
        name: 'post-build',
        closeBundle: () => {
          const outDir = resolve(root, `dist/${target}`);

          // 将 content.js 从临时目录复制到输出目录
          const contentSrc = resolve(root, `.tmp/${target}/content/content.js`);
          const contentDest = resolve(outDir, 'content.js');
          if (existsSync(contentSrc)) {
            copyFileSync(contentSrc, contentDest);
          }
          const contentMapSrc = resolve(root, `.tmp/${target}/content/content.js.map`);
          if (existsSync(contentMapSrc)) {
            copyFileSync(contentMapSrc, resolve(outDir, 'content.js.map'));
          }

          // 将 popup.html 移到根目录并修正资源路径
          const popupSrc = resolve(outDir, 'extension/popup/popup.html');
          const popupDest = resolve(outDir, 'popup.html');
          if (existsSync(popupSrc)) {
            let html = readFileSync(popupSrc, 'utf-8');
            html = html.replace(/\.\.\/(?:\.\.\/)?/g, './');
            writeFileSync(popupDest, html);
          }

          // 复制并修正 manifest
          const manifestSrc = resolve(root, `extension/manifest.${target}.json`);
          const manifestDest = resolve(outDir, 'manifest.json');
          if (existsSync(manifestSrc)) {
            copyFileSync(manifestSrc, manifestDest);
            const manifest = JSON.parse(readFileSync(manifestDest, 'utf-8'));
            manifest.background.service_worker = 'background.js';
            manifest.content_scripts[0].js = ['content.js'];
            manifest.action.default_popup = 'popup.html';
            manifest.icons = {
              '16': 'icons/icon16.svg',
              '32': 'icons/icon32.svg',
              '48': 'icons/icon48.svg',
              '128': 'icons/icon128.svg',
            };
            manifest.action.default_icon = {
              '16': 'icons/icon16.svg',
              '32': 'icons/icon32.svg',
            };
            writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
          }

          // 生成占位图标（SVG）
          const iconsDir = resolve(outDir, 'icons');
          if (!existsSync(iconsDir)) {
            mkdirSync(iconsDir, { recursive: true });
          }
          for (const size of [16, 32, 48, 128]) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#E53935"/><text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${Math.round(size * 0.4)}" font-weight="bold" font-family="Arial">W</text></svg>`;
            writeFileSync(resolve(iconsDir, `icon${size}.svg`), svg);
          }

          console.log(`\n✅ Build complete: dist/${target}/`);
        },
      },
    ],
  });
}

export default process.env.VITE_PHASE === 'content' ? contentConfig() : mainConfig();
