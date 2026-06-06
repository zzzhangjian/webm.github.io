// WebM 资源数据模型

export type DetectionSource = 'video-tag' | 'source-tag' | 'network' | 'anchor' | 'embed';

export interface WebMResource {
  id: string;
  url: string;
  fileName: string;
  fileSize: number | null;
  duration: number | null;
  thumbnail: string | null;
  source: DetectionSource;
  detectedAt: number;
  tabId: number;
}

// 消息类型定义

export type MessagePayload =
  | { type: 'WEBM_DETECTED'; resources: WebMResource[] }
  | { type: 'GET_WEBM_LIST'; tabId: number }
  | { type: 'WEBM_LIST_RESPONSE'; resources: WebMResource[] }
  | { type: 'CLEAR_WEBM_LIST'; tabId: number }
  | { type: 'UPDATE_BADGE'; tabId: number; count: number }
  | { type: 'OPEN_DOWNLOAD_PAGE'; url: string; name: string; size: number | null }
  | { type: 'TAB_UPDATED'; tabId: number };
