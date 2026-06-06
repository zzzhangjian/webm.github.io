import type { WebMResource } from '../shared/types';
import { formatFileSize, formatDuration } from '../shared/constants';

const listEl = document.getElementById('webm-list')!;
const emptyEl = document.getElementById('empty-state')!;
const statusEl = document.getElementById('status-text')!;
const btnClear = document.getElementById('btn-clear')!;
const btnRefresh = document.getElementById('btn-refresh')!;

// 获取当前标签页
async function getCurrentTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab!;
}

// 加载 WebM 列表
async function loadWebMList(): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab.id) return;

  const response = await chrome.runtime.sendMessage({
    type: 'GET_WEBM_LIST',
    tabId: tab.id,
  });

  const resources = (response as WebMResource[]) || [];
  renderList(resources);
}

// 渲染列表
function renderList(resources: WebMResource[]): void {
  listEl.innerHTML = '';

  if (resources.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    statusEl.textContent = '未检测到 WebM 文件';
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  statusEl.textContent = `检测到 ${resources.length} 个 WebM 文件`;

  resources.forEach((resource) => {
    const item = createListItem(resource);
    listEl.appendChild(item);
  });
}

// 创建列表项
function createListItem(resource: WebMResource): HTMLElement {
  const item = document.createElement('div');
  item.className = 'webm-item';

  // 缩略图
  const thumb = document.createElement('div');
  thumb.className = 'webm-thumbnail';
  if (resource.thumbnail) {
    const img = document.createElement('img');
    img.src = resource.thumbnail;
    img.alt = resource.fileName;
    thumb.appendChild(img);
  } else {
    const noThumb = document.createElement('span');
    noThumb.className = 'no-thumb';
    noThumb.textContent = '🎬';
    thumb.appendChild(noThumb);
  }

  // 信息区
  const info = document.createElement('div');
  info.className = 'webm-info';

  const name = document.createElement('div');
  name.className = 'webm-name';
  name.textContent = resource.fileName;
  name.title = resource.url;

  const meta = document.createElement('div');
  meta.className = 'webm-meta';
  const sizeText = formatFileSize(resource.fileSize);
  const durationText = formatDuration(resource.duration);
  meta.textContent = `${sizeText} · ${durationText}`;

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'webm-actions';

  const btnDownload = document.createElement('button');
  btnDownload.className = 'btn-download';
  btnDownload.textContent = '下载';
  btnDownload.addEventListener('click', () => handleDownload(resource));

  const btnCopy = document.createElement('button');
  btnCopy.className = 'btn-copy';
  btnCopy.textContent = '复制链接';
  btnCopy.addEventListener('click', () => handleCopy(resource.url));

  actions.appendChild(btnDownload);
  actions.appendChild(btnCopy);

  info.appendChild(name);
  info.appendChild(meta);
  info.appendChild(actions);

  item.appendChild(thumb);
  item.appendChild(info);

  return item;
}

// 下载处理
async function handleDownload(resource: WebMResource): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'OPEN_DOWNLOAD_PAGE',
    url: resource.url,
    name: resource.fileName,
    size: resource.fileSize,
  });
}

// 复制链接
async function handleCopy(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    showToast('链接已复制');
  } catch {
    showToast('复制失败');
  }
}

// 清空列表
async function handleClear(): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab.id) return;
  await chrome.runtime.sendMessage({
    type: 'CLEAR_WEBM_LIST',
    tabId: tab.id,
  });
  renderList([]);
}

// 重新检测
async function handleRefresh(): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab.id) return;
  await chrome.tabs.reload(tab.id);
  window.close();
}

// Toast 提示
function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

// 事件绑定
btnClear.addEventListener('click', handleClear);
btnRefresh.addEventListener('click', handleRefresh);

// 初始化
loadWebMList();
