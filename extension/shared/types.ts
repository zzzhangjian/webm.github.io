// 视频资源数据模型

export type DetectionSource = 'video-tag' | 'source-tag' | 'network' | 'anchor' | 'embed';

export interface VideoResource {
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

// 兼容旧名称
export type WebMResource = VideoResource;

// 消息类型定义

export type MessagePayload =
  | { type: 'WEBM_DETECTED'; resources: VideoResource[] }
  | { type: 'GET_WEBM_LIST'; tabId: number }
  | { type: 'WEBM_LIST_RESPONSE'; resources: VideoResource[] }
  | { type: 'CLEAR_WEBM_LIST'; tabId: number }
  | { type: 'UPDATE_BADGE'; tabId: number; count: number }
  | { type: 'OPEN_DOWNLOAD_PAGE'; url: string; name: string; size: number | null }
  | { type: 'TAB_UPDATED'; tabId: number };
