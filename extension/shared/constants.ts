// 常量定义

export const DOWNLOAD_PAGE_BASE_URL = 'https://zzzhangjian.github.io/webm.github.io/';

export const BADGE_MAX_COUNT = 99;

export const WEBM_EXTENSIONS = ['.webm'];

export const WEBM_MIME_TYPES = ['video/webm'];

export const MUTATION_OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
  subtree: true,
};

// 生成资源唯一 ID
export function generateResourceId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// 从 URL 提取文件名
export function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop() || 'video.webm';
    return decodeURIComponent(name);
  } catch {
    return 'video.webm';
  }
}

// 格式化文件大小
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// 格式化时长
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
