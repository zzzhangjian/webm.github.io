# WebM Video Downloader - PRD & 产品设计

## 1. 产品概述

### 1.1 产品名称
WebM Downloader

### 1.2 产品定位
一款跨浏览器（Chrome / Firefox）扩展插件，自动检测当前页面中的 WebM 视频文件，提供可视化列表与一键下载能力，配合外部下载页面完成视频保存。

### 1.3 目标用户
- 经常浏览包含 WebM 视频网站的用户
- 需要批量下载 WebM 视频的内容创作者
- 对网页视频资源有归档需求的用户

### 1.4 核心价值
- **零配置检测**：页面加载后自动识别所有 WebM 资源，无需手动操作
- **一目了然**：Badge 数字 + 列表详情，快速掌握页面视频资源
- **一键下载**：跳转外部页面自动下载，完成后保存到本地

---

## 2. 功能需求

### 2.1 功能架构

```
┌─────────────────────────────────────────────────┐
│                  Browser Extension               │
│                                                   │
│  ┌───────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Content   │  │ Background│  │   Popup      │ │
│  │ Script    │──│ Service   │──│   UI         │ │
│  │ (检测器)  │  │ Worker    │  │  (列表展示)  │ │
│  └───────────┘  └─────┬─────┘  └──────────────┘ │
│                       │                          │
└───────────────────────┼──────────────────────────┘
                        │ 跳转（URL + 参数）
                        ▼
              ┌──────────────────┐
              │  External       │
              │  Download Page  │
              │  (下载 & 保存)  │
              └──────────────────┘
```

### 2.2 功能清单

| 编号 | 功能模块 | 优先级 | 描述 |
|------|---------|--------|------|
| F01 | WebM 自动检测 | P0 | 自动检测页面中所有 WebM 视频资源 |
| F02 | Badge 计数显示 | P0 | 插件图标右上角显示检测到的 WebM 数量 |
| F03 | Popup 列表展示 | P0 | 点击图标弹出 WebM 文件列表 |
| F04 | 列表详情信息 | P0 | 展示文件名、大小、时长、缩略图 |
| F05 | 跳转外部下载页 | P0 | 点击列表项跳转外部网页进行下载 |
| F06 | 自动下载 | P0 | 外部页面自动触发 WebM 文件下载 |
| F07 | 保存到本地 | P0 | 下载完成后点击保存按钮保存文件 |
| F08 | 去重过滤 | P1 | 同一 URL 不重复展示 |
| F09 | 实时更新 | P1 | 页面动态加载新 WebM 时实时更新列表 |
| F10 | 清空列表 | P1 | 支持清空当前页面的检测列表 |
| F11 | 复制链接 | P2 | 支持复制 WebM 文件直链 |
| F12 | 批量下载 | P2 | 支持选择多个文件批量跳转下载 |

---

## 3. 详细设计

### 3.1 F01 - WebM 自动检测

#### 检测策略

| 检测来源 | 检测方式 | 说明 |
|---------|---------|------|
| `<video>` 标签 | DOM 解析 | 遍历 `document.querySelectorAll('video')`，提取 `src` 和 `<source>` 子元素 |
| `<source>` 标签 | DOM 解析 | 遍历 `document.querySelectorAll('source[type*="webm"]')` |
| 网络请求 | Web Request API | 拦截 `Content-Type: video/webm` 的响应，或 URL 以 `.webm` 结尾的请求 |
| `<a>` 链接 | DOM 解析 | 遍历 `document.querySelectorAll('a[href$=".webm"]')` |
| `<embed>` / `<object>` | DOM 解析 | 检测嵌入的 WebM 资源 |

#### 数据模型

```typescript
interface WebMResource {
  id: string;              // 唯一标识（URL hash）
  url: string;             // WebM 文件 URL
  fileName: string;        // 文件名（从 URL 提取）
  fileSize: number | null; // 文件大小（字节，从 Content-Length 获取）
  duration: number | null; // 视频时长（秒，从 video 元素获取）
  thumbnail: string | null;// 缩略图（Data URL，从 video 截帧）
  source: DetectionSource; // 检测来源
  detectedAt: number;      // 检测时间戳
  tabId: number;           // 所属标签页 ID
}

type DetectionSource = 'video-tag' | 'source-tag' | 'network' | 'anchor' | 'embed';
```

#### 检测时机

1. **页面加载完成**：`DOMContentLoaded` 后执行首次检测
2. **DOM 变更**：通过 `MutationObserver` 监听 DOM 变化，增量检测
3. **网络请求**：通过 Background Script 拦截 WebM 请求

### 3.2 F02 - Badge 计数显示

| 规则 | 说明 |
|------|------|
| 显示数字 | 当前标签页检测到的 WebM 数量 |
| 无 WebM | 不显示 Badge（或灰色显示 0） |
| 数量 > 99 | 显示 `99+` |
| 切换标签页 | 根据当前标签页的检测数量动态更新 |
| 颜色 | 红色背景 + 白色文字（Chrome 标准 Badge 样式） |

### 3.3 F03 - Popup 列表展示

#### 布局设计

```
┌──────────────────────────────────┐
│  WebM Downloader          [清空] │
├──────────────────────────────────┤
│                                  │
│  ┌────┐  video_name.webm        │
│  │ 🖼 │  2.3 MB · 01:25        │
│  │    │  [下载] [复制链接]       │
│  └────┘                         │
│                                  │
│  ┌────┐  another_video.webm     │
│  │ 🖼 │  5.1 MB · 03:42        │
│  │    │  [下载] [复制链接]       │
│  └────┘                         │
│                                  │
│  ┌────┐  clip.webm              │
│  │ 🖼 │  0.8 MB · 00:15        │
│  │    │  [下载] [复制链接]       │
│  └────┘                         │
│                                  │
├──────────────────────────────────┤
│  检测到 3 个 WebM 文件           │
└──────────────────────────────────┘
```

#### 交互说明

- **空状态**：显示 "当前页面未检测到 WebM 文件" + 刷新按钮
- **列表项点击**：点击 [下载] 按钮跳转外部下载页面
- **缩略图生成**：通过 Canvas 从 `<video>` 元素截取第一帧
- **文件大小格式化**：自动转为 KB / MB / GB
- **时长格式化**：`MM:SS` 或 `HH:MM:SS`

### 3.4 F05 - 跳转外部下载页

#### URL 设计

```
https://download.webm-downloader.com/?url={encodedWebmUrl}&name={encodedFileName}&size={fileSize}
```

参数说明：

| 参数 | 类型 | 必选 | 说明 |
|------|------|------|------|
| url | string | 是 | WebM 文件 URL（URL 编码） |
| name | string | 否 | 建议文件名（URL 编码） |
| size | number | 否 | 文件大小（字节） |

### 3.5 F06 & F07 - 外部下载页

#### 页面流程

```
打开页面 → 解析URL参数 → 显示文件信息 → 自动开始下载
                                          ↓
                                    下载进度展示
                                          ↓
                                    下载完成 → [保存到本地] 按钮
                                          ↓
                                    触发浏览器保存对话框
```

#### 页面布局

```
┌──────────────────────────────────────────────┐
│                                              │
│           WebM Downloader                    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │         🎬 视频预览播放区             │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  文件名: video_name.webm                     │
│  大小:   2.3 MB                              │
│  时长:   01:25                               │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  ████████████░░░░░░░░  65%           │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         [ 保存到本地 ]               │    │
│  └──────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘
```

#### 下载实现方案

使用 `fetch` + `Blob` 方式下载：

```typescript
// 1. fetch 下载文件
const response = await fetch(webmUrl);
const blob = await response.blob();

// 2. 创建下载链接
const url = URL.createObjectURL(blob);

// 3. 用户点击保存按钮时触发
const a = document.createElement('a');
a.href = url;
a.download = fileName;
a.click();

// 4. 释放资源
URL.revokeObjectURL(url);
```

**进度展示**：通过 `response.body.getReader()` 读取流，计算下载进度。

---

## 4. 技术设计

### 4.1 项目结构

```
ai_webm/
├── extension/                    # 浏览器插件
│   ├── manifest.chrome.json      # Chrome Manifest V3
│   ├── manifest.firefox.json     # Firefox Manifest V2/V3
│   ├── background/
│   │   └── service-worker.ts     # Background Service Worker
│   ├── content/
│   │   ├── detector.ts           # WebM 检测逻辑
│   │   └── content.ts            # Content Script 入口
│   ├── popup/
│   │   ├── popup.html            # Popup 页面
│   │   ├── popup.ts              # Popup 逻辑
│   │   └── popup.css             # Popup 样式
│   ├── shared/
│   │   ├── types.ts              # 共享类型定义
│   │   ├── constants.ts          # 常量定义
│   │   └── messaging.ts          # 消息通信协议
│   └── icons/
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
├── download-page/                # 外部下载页面
│   ├── index.html
│   ├── download.ts
│   └── download.css
├── docs/
│   └── PRD.md                    # 本文档
├── package.json
├── tsconfig.json
└── README.md
```

### 4.2 消息通信协议

Content Script ↔ Background ↔ Popup 之间通过消息通信：

```typescript
// 消息类型定义
type MessageType =
  | { type: 'WEBM_DETECTED'; payload: { resources: WebMResource[]; tabId: number } }
  | { type: 'GET_WEBM_LIST'; payload: { tabId: number } }
  | { type: 'CLEAR_WEBM_LIST'; payload: { tabId: number } }
  | { type: 'UPDATE_BADGE'; payload: { tabId: number; count: number } }
  | { type: 'OPEN_DOWNLOAD_PAGE'; payload: { url: string; name: string; size: number | null } };
```

### 4.3 跨浏览器兼容策略

| 差异点 | Chrome (MV3) | Firefox (MV2/MV3) | 兼容方案 |
|--------|-------------|-------------------|---------|
| Manifest | V3 | V2 或 V3 | 构建时根据目标生成不同 manifest |
| Background | Service Worker | Background Page/Script | 统一使用 Service Worker，Firefox MV3 也支持 |
| Web Request | `declarativeNetRequest` | `webRequest` | 优先使用 `webRequest`（MV3 中需 `host_permissions`） |
| Browser API | `chrome.*` | `browser.*` | 使用 `webextension-polyfill` 统一 API |
| Promise | 部分回调 | 原生 Promise | `webextension-polyfill` 自动转换 |

### 4.4 技术选型

| 类别 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全，提升代码质量 |
| 构建 | Vite + CRXJS | 快速构建，原生支持浏览器插件开发 |
| 跨浏览器 | webextension-polyfill | 统一 Chrome/Firefox API 差异 |
| UI 框架 | 原生 HTML/CSS/JS | Popup 页面轻量，无需引入框架 |
| 下载页 | 原生 HTML/CSS/JS | 独立部署，保持轻量 |
| 缩略图 | Canvas API | 从 video 元素截帧，无需额外依赖 |

---

## 5. 非功能需求

### 5.1 性能要求

| 指标 | 目标值 |
|------|--------|
| 首次检测耗时 | < 500ms（100 个 DOM 元素内） |
| MutationObserver 增量检测 | < 100ms |
| Popup 打开响应 | < 200ms |
| 内存占用 | < 50MB（正常使用） |
| 缩略图生成 | < 300ms / 个 |

### 5.2 安全要求

| 项目 | 措施 |
|------|------|
| URL 校验 | 仅处理 `http/https` 协议的 WebM URL |
| XSS 防护 | 所有动态内容转义后再渲染 |
| 权限最小化 | 仅申请必要权限（`tabs`, `webRequest`, `storage`） |
| CSP | 严格 Content-Security-Policy |
| 敏感数据 | 不存储用户隐私数据，仅缓存当前会话的 WebM 列表 |

### 5.3 兼容性要求

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 88+（MV3 支持） |
| Firefox | 109+（MV3 支持） |
| Edge | 88+（基于 Chromium） |

---

## 6. 权限设计

### Chrome (Manifest V3)

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "webRequest"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

### Firefox (Manifest V3)

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "webRequest",
    "<all_urls>"
  ]
}
```

---

## 7. 交互流程图

### 7.1 主流程

```
用户打开网页
    │
    ▼
Content Script 自动检测 WebM ──── 无 WebM ──── Badge 不显示
    │
    │ 检测到 WebM
    ▼
发送消息到 Background
    │
    ▼
Background 更新 Badge 数字
    │
    ▼
用户点击插件图标
    │
    ▼
Popup 展示 WebM 列表（缩略图 + 文件名 + 大小 + 时长）
    │
    ▼
用户点击 [下载]
    │
    ▼
打开新标签页跳转外部下载页（URL 携带参数）
    │
    ▼
下载页自动 fetch 下载文件 ──── 展示进度条
    │
    ▼
下载完成 ──── [保存到本地] 按钮激活
    │
    ▼
用户点击 [保存到本地]
    │
    ▼
浏览器弹出保存对话框 ──── 文件保存到本地
```

### 7.2 实时更新流程

```
MutationObserver 监听 DOM 变化
    │
    ▼
检测新增的 video/source/a 元素
    │
    │ 发现新 WebM
    ▼
发送增量更新到 Background
    │
    ▼
Background 更新 Badge + 通知 Popup
    │
    ▼
Popup 实时追加新列表项（如已打开）
```

---

## 8. 里程碑规划

| 阶段 | 内容 | 交付物 |
|------|------|--------|
| M1 | 核心检测 + Badge + Popup 列表 | 可用的 Chrome 插件 MVP |
| M2 | 外部下载页 + 自动下载 + 保存 | 完整下载流程 |
| M3 | Firefox 兼容 + 构建适配 | 跨浏览器支持 |
| M4 | 去重 + 实时更新 + 批量下载 | 功能完善 |
| M5 | 性能优化 + 安全加固 | 生产就绪 |

---

## 9. 风险与应对

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| CORS 限制导致 fetch 下载失败 | 下载功能不可用 | 高 | 优先通过 Background Script 代理下载；备选方案：直接打开 URL 让浏览器处理 |
| 部分 WebM URL 为 Blob URL | 无法在外部页面下载 | 中 | 在 Content Script 中将 Blob URL 转为 Data URL 传递 |
| 动态加载页面检测遗漏 | 漏检 WebM 文件 | 中 | MutationObserver + 网络请求拦截双重保障 |
| Firefox MV3 兼容性差异 | 功能异常 | 中 | 构建时分离 manifest，运行时 polyfill |
| 大文件下载内存溢出 | 浏览器崩溃 | 低 | 使用 Stream API 分块下载，避免全量 Blob |

---

## 10. 开放问题

- [ ] 外部下载页的部署域名和托管方案
- [ ] 是否需要支持其他视频格式（mp4, ogg 等）
- [ ] 是否需要下载历史记录功能
- [ ] CORS 限制下的最终下载方案选择
- [ ] 是否需要支持暗色主题
