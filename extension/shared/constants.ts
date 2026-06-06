// 常量定义

export const DOWNLOAD_PAGE_BASE_URL = 'https://zzzhangjian.github.io/webm.github.io/download-page/';

export const BADGE_MAX_COUNT = 99;

// 支持的视频格式
export const VIDEO_EXTENSIONS = [
  '.webm', '.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.m4v', '.ogv', '.3gp', '.ts', '.m3u8',
];

export const VIDEO_MIME_TYPES = [
  'video/webm',
  'video/mp4',
  'video/x-matroska',    // mkv
  'video/avi',
  'video/x-msvideo',     // avi
  'video/quicktime',     // mov
  'video/x-flv',         // flv
  'video/x-ms-wmv',      // wmv
  'video/x-m4v',         // m4v
  'video/ogg',           // ogv
  'video/3gpp',          // 3gp
  'video/mp2t',          // ts
  'application/x-mpegurl', // m3u8
  'application/vnd.apple.mpegurl', // m3u8
];

// 文件扩展名 → MIME 类型映射（用于下载页识别输入格式）
export const EXT_TO_MIME: Record<string, string> = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/x-m4v',
  '.ogv': 'video/ogg',
  '.3gp': 'video/3gpp',
  '.ts': 'video/mp2t',
};

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
    const name = pathname.split('/').pop() || 'video';
    return decodeURIComponent(name);
  } catch {
    return 'video';
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
