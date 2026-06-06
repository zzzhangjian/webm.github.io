import type { VideoResource, MessagePayload } from '../shared/types';
import { BADGE_MAX_COUNT, DOWNLOAD_PAGE_BASE_URL, VIDEO_MIME_TYPES } from '../shared/constants';
import { onMessage, sendTabMessage } from '../shared/messaging';

// 按标签页存储视频资源
const tabResources = new Map<number, VideoResource[]>();

// 更新 Badge
function updateBadge(tabId: number, count: number): void {
  const text = count === 0 ? '' : count > BADGE_MAX_COUNT ? '99+' : String(count);
  try {
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#E53935', tabId });
  } catch {
    try {
      browser.action.setBadgeText({ text, tabId });
      browser.action.setBadgeBackgroundColor({ color: '#E53935', tabId });
    } catch {
      // 忽略
    }
  }
}

function getTabId(sender: chrome.runtime.MessageSender): number {
  return sender.tab?.id ?? 0;
}

// 消息处理
onMessage((payload: MessagePayload, sender) => {
  const tabId = getTabId(sender);

  switch (payload.type) {
    case 'WEBM_DETECTED': {
      const existing = tabResources.get(tabId) || [];
      const existingIds = new Set(existing.map((r) => r.id));
      const newResources = payload.resources.filter((r) => !existingIds.has(r.id));
      const merged = [...existing, ...newResources];
      tabResources.set(tabId, merged);
      updateBadge(tabId, merged.length);
      return Promise.resolve({ success: true, count: merged.length });
    }

    case 'GET_WEBM_LIST': {
      const resources = tabResources.get(payload.tabId) || [];
      return Promise.resolve(resources);
    }

    case 'CLEAR_WEBM_LIST': {
      tabResources.delete(payload.tabId);
      updateBadge(payload.tabId, 0);
      return Promise.resolve({ success: true });
    }

    case 'OPEN_DOWNLOAD_PAGE': {
      const params = new URLSearchParams({
        url: payload.url,
        name: payload.name,
      });
      if (payload.size !== null) {
        params.set('size', String(payload.size));
      }
      const downloadUrl = `${DOWNLOAD_PAGE_BASE_URL}?${params.toString()}`;
      chrome.tabs.create({ url: downloadUrl });
      return Promise.resolve({ success: true });
    }

    default:
      return Promise.resolve({ error: 'Unknown message type' });
  }
});

// 标签页关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  tabResources.delete(tabId);
});

// 标签页导航时清理
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabResources.delete(tabId);
    updateBadge(tabId, 0);
  }
});

// 切换 Tab 时触发视频检测
chrome.tabs.onActivated.addListener((activeInfo) => {
  sendTabMessage(activeInfo.tabId, { type: 'TRIGGER_DETECTION' }).catch(() => {
    // content script 未注入时忽略（如 chrome:// 页面）
  });
});

// 拦截网络请求中的视频资源
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;

    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type',
    );
    if (!contentType?.value) return;

    const mime = contentType.value.toLowerCase();
    const isVideo = VIDEO_MIME_TYPES.some((vm) => mime.includes(vm));

    if (isVideo) {
      sendTabMessage(details.tabId, {
        type: 'WEBM_DETECTED',
        resources: [{
          id: generateResourceId(details.url),
          url: details.url,
          fileName: extractFileName(details.url),
          fileSize: getContentLength(details.responseHeaders),
          duration: null,
          thumbnail: null,
          source: 'network' as const,
          detectedAt: Date.now(),
          tabId: details.tabId,
        }],
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders'],
);

function generateResourceId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop() || 'video';
    return decodeURIComponent(name);
  } catch {
    return 'video';
  }
}

function getContentLength(headers?: chrome.webRequest.HttpHeader[]): number | null {
  if (!headers) return null;
  const header = headers.find((h) => h.name.toLowerCase() === 'content-length');
  if (header?.value) {
    const size = parseInt(header.value, 10);
    return isNaN(size) ? null : size;
  }
  return null;
}
