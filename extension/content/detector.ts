import type { WebMResource, DetectionSource } from '../shared/types';
import { generateResourceId, extractFileName, WEBM_EXTENSIONS, WEBM_MIME_TYPES, MUTATION_OBSERVER_CONFIG } from '../shared/constants';
import { sendMessage } from '../shared/messaging';

// 当前标签页 ID（由 Background 注入）
let currentTabId = 0;

// 已检测到的资源 URL 集合（去重）
const detectedUrls = new Set<string>();

// 检测所有 WebM 资源
function detectWebMResources(): WebMResource[] {
  const resources: WebMResource[] = [];

  // 1. <video> 标签
  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    // 检查 src 属性
    if (video.src && isWebMUrl(video.src)) {
      addResource(resources, video.src, 'video-tag', video);
    }
    // 检查 <source> 子元素
    video.querySelectorAll('source').forEach((source) => {
      const src = source.src || source.getAttribute('src');
      const type = source.type || source.getAttribute('type') || '';
      if (src && (isWebMUrl(src) || isWebMMimeType(type))) {
        addResource(resources, src, 'source-tag', video);
      }
    });
  });

  // 2. 独立 <source> 标签
  document.querySelectorAll('source').forEach((source) => {
    const src = source.src || source.getAttribute('src');
    const type = source.type || source.getAttribute('type') || '';
    if (src && (isWebMUrl(src) || isWebMMimeType(type))) {
      addResource(resources, src, 'source-tag');
    }
  });

  // 3. <a> 链接
  document.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href && isWebMUrl(href)) {
      addResource(resources, resolveUrl(href), 'anchor');
    }
  });

  // 4. <embed> / <object>
  document.querySelectorAll('embed, object').forEach((el) => {
    const src = el.getAttribute('src') || el.getAttribute('data');
    if (src && isWebMUrl(src)) {
      addResource(resources, resolveUrl(src), 'embed');
    }
  });

  return resources;
}

function isWebMUrl(url: string): boolean {
  try {
    const pathname = new URL(url, location.href).pathname.toLowerCase();
    return WEBM_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function isWebMMimeType(type: string): boolean {
  return WEBM_MIME_TYPES.some((mime) => type.toLowerCase().includes(mime));
}

function resolveUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

function addResource(
  resources: WebMResource[],
  url: string,
  source: DetectionSource,
  videoElement?: HTMLVideoElement,
): void {
  // 跳过 blob: 和 data: URL（MVP 阶段暂不支持）
  if (url.startsWith('blob:') || url.startsWith('data:')) return;

  // 去重
  if (detectedUrls.has(url)) return;
  detectedUrls.add(url);

  const resource: WebMResource = {
    id: generateResourceId(url),
    url,
    fileName: extractFileName(url),
    fileSize: null,
    duration: null,
    thumbnail: null,
    source,
    detectedAt: Date.now(),
    tabId: currentTabId,
  };

  // 尝试从 video 元素获取时长和缩略图
  if (videoElement) {
    enrichFromVideoElement(resource, videoElement);
  }

  resources.push(resource);
}

function enrichFromVideoElement(resource: WebMResource, video: HTMLVideoElement): void {
  // 获取时长
  if (video.duration && isFinite(video.duration)) {
    resource.duration = video.duration;
  }

  // 生成缩略图
  try {
    if (video.readyState >= 2) {
      resource.thumbnail = captureThumbnail(video);
    } else {
      video.addEventListener('loadeddata', () => {
        resource.duration = video.duration && isFinite(video.duration) ? video.duration : null;
        resource.thumbnail = captureThumbnail(video);
        // 通知更新
        sendMessage({ type: 'WEBM_DETECTED', resources: [resource] });
      }, { once: true });
    }
  } catch {
    // 缩略图生成失败不影响主流程
  }
}

function captureThumbnail(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    const maxDim = 160;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}

// 通知 Background 检测结果
function reportDetected(resources: WebMResource[]): void {
  if (resources.length === 0) return;
  sendMessage({ type: 'WEBM_DETECTED', resources });
}

// 首次检测
function runDetection(): void {
  const resources = detectWebMResources();
  reportDetected(resources);
}

// 监听 DOM 变化，增量检测
function observeDOMChanges(): void {
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (hasNewNodes) {
      runDetection();
    }
  });

  observer.observe(document.body || document.documentElement, MUTATION_OBSERVER_CONFIG);
}

// 接收来自 Background 的 tabId
function initTabId(): void {
  // 通过 URL query 或 runtime 获取 tabId 不太方便
  // 改为在首次发送消息时由 Background 识别
}

// 入口
function main(): void {
  initTabId();
  runDetection();
  observeDOMChanges();
}

// 确保在 DOM 就绪后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
