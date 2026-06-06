import type { VideoResource, DetectionSource } from '../shared/types';
import { generateResourceId, extractFileName, VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, MUTATION_OBSERVER_CONFIG } from '../shared/constants';
import { sendMessage, onMessage } from '../shared/messaging';

// 当前标签页 ID（由 Background 注入）
let currentTabId = 0;

// 已检测到的资源 URL 集合（去重）
const detectedUrls = new Set<string>();

// 检测所有视频资源
function detectVideoResources(): VideoResource[] {
  const resources: VideoResource[] = [];

  // 1. <video> 标签
  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    if (video.src && isVideoUrl(video.src)) {
      addResource(resources, video.src, 'video-tag', video);
    }
    video.querySelectorAll('source').forEach((source) => {
      const src = source.src || source.getAttribute('src');
      const type = source.type || source.getAttribute('type') || '';
      if (src && (isVideoUrl(src) || isVideoMimeType(type))) {
        addResource(resources, src, 'source-tag', video);
      }
    });
  });

  // 2. 独立 <source> 标签
  document.querySelectorAll('source').forEach((source) => {
    const src = source.src || source.getAttribute('src');
    const type = source.type || source.getAttribute('type') || '';
    if (src && (isVideoUrl(src) || isVideoMimeType(type))) {
      addResource(resources, src, 'source-tag');
    }
  });

  // 3. <a> 链接
  document.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href && isVideoUrl(href)) {
      addResource(resources, resolveUrl(href), 'anchor');
    }
  });

  // 4. <embed> / <object>
  document.querySelectorAll('embed, object').forEach((el) => {
    const src = el.getAttribute('src') || el.getAttribute('data');
    if (src && isVideoUrl(src)) {
      addResource(resources, resolveUrl(src), 'embed');
    }
  });

  // 5. <iframe> 中可能的视频（仅记录 URL，不深入检测）
  document.querySelectorAll('iframe[src]').forEach((iframe) => {
    const src = iframe.getAttribute('src');
    if (src && isVideoUrl(src)) {
      addResource(resources, resolveUrl(src), 'embed');
    }
  });

  return resources;
}

function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url, location.href).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function isVideoMimeType(type: string): boolean {
  const lower = type.toLowerCase();
  return VIDEO_MIME_TYPES.some((mime) => lower.includes(mime));
}

function resolveUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

function addResource(
  resources: VideoResource[],
  url: string,
  source: DetectionSource,
  videoElement?: HTMLVideoElement,
): void {
  if (url.startsWith('blob:') || url.startsWith('data:')) return;
  if (detectedUrls.has(url)) return;
  detectedUrls.add(url);

  const resource: VideoResource = {
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

  if (videoElement) {
    enrichFromVideoElement(resource, videoElement);
  }

  resources.push(resource);
}

function enrichFromVideoElement(resource: VideoResource, video: HTMLVideoElement): void {
  if (video.duration && isFinite(video.duration)) {
    resource.duration = video.duration;
  }

  try {
    if (video.readyState >= 2) {
      resource.thumbnail = captureThumbnail(video);
    } else {
      video.addEventListener('loadeddata', () => {
        resource.duration = video.duration && isFinite(video.duration) ? video.duration : null;
        resource.thumbnail = captureThumbnail(video);
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

function reportDetected(resources: VideoResource[]): void {
  if (resources.length === 0) return;
  sendMessage({ type: 'WEBM_DETECTED', resources });
}

function runDetection(): void {
  const resources = detectVideoResources();
  reportDetected(resources);
}

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

function main(): void {
  runDetection();
  observeDOMChanges();
}

// 监听来自 Background 的检测触发消息（Tab 切换时），只注册一次
onMessage((payload) => {
  if (payload.type === 'TRIGGER_DETECTION') {
    runDetection();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
