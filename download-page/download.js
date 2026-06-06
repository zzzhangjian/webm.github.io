(function () {
  'use strict';

  // DOM 元素
  const videoPlayer = document.getElementById('video-player');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const fileDurationEl = document.getElementById('file-duration');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');
  const btnRetry = document.getElementById('btn-retry');
  const btnSave = document.getElementById('btn-save');

  // 解析 URL 参数
  const params = new URLSearchParams(window.location.search);
  const webmUrl = params.get('url');
  const fileName = params.get('name') || 'video.webm';
  const fileSize = params.get('size') ? parseInt(params.get('size'), 10) : null;

  // 下载状态
  let downloadedBlob = null;

  // 格式化文件大小
  function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '未知大小';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  // 格式化时长
  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '--:--';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    if (h > 0) {
      return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return m + ':' + String(s).padStart(2, '0');
  }

  // 初始化页面
  function init() {
    if (!webmUrl) {
      showError('缺少下载链接参数');
      return;
    }

    // 填充文件信息
    fileNameEl.textContent = fileName;
    fileSizeEl.textContent = formatFileSize(fileSize);

    // 设置视频源
    videoPlayer.src = webmUrl;
    videoPlayer.addEventListener('loadedmetadata', function () {
      fileDurationEl.textContent = formatDuration(videoPlayer.duration);
    });

    // 自动开始下载
    startDownload();
  }

  // 开始下载
  async function startDownload() {
    progressSection.style.display = 'block';
    errorSection.classList.add('hidden');
    btnSave.disabled = true;
    progressText.textContent = '正在下载...';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';

    try {
      const response = await fetch(webmUrl);

      if (!response.ok) {
        throw new Error('下载失败: HTTP ' + response.status);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : fileSize;

      if (!response.body) {
        // 不支持 ReadableStream，使用传统方式
        const blob = await response.blob();
        downloadedBlob = blob;
        onDownloadComplete(blob);
        return;
      }

      // 使用 ReadableStream 读取进度
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total) {
          const percent = Math.round((receivedLength / total) * 100);
          progressFill.style.width = percent + '%';
          progressPercent.textContent = percent + '%';
          progressText.textContent = '正在下载... ' + formatFileSize(receivedLength) + ' / ' + formatFileSize(total);
        } else {
          progressText.textContent = '正在下载... ' + formatFileSize(receivedLength);
        }
      }

      // 合并 chunks
      const blob = new Blob(chunks, { type: 'video/webm' });
      downloadedBlob = blob;
      onDownloadComplete(blob);
    } catch (err) {
      showError('下载失败: ' + (err.message || '未知错误'));
    }
  }

  // 下载完成
  function onDownloadComplete(blob) {
    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    progressText.textContent = '下载完成! ' + formatFileSize(blob.size);
    fileSizeEl.textContent = formatFileSize(blob.size);
    btnSave.disabled = false;

    // 更新视频源为 blob URL（避免重复请求）
    videoPlayer.src = URL.createObjectURL(blob);
  }

  // 保存到本地
  function saveToLocal() {
    if (!downloadedBlob) return;

    const url = URL.createObjectURL(downloadedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 延迟释放，确保下载已启动
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // 显示错误
  function showError(msg) {
    errorSection.classList.remove('hidden');
    errorMessage.textContent = msg;
    progressSection.style.display = 'none';
  }

  // 事件绑定
  btnSave.addEventListener('click', saveToLocal);
  btnRetry.addEventListener('click', startDownload);

  // 启动
  init();
})();
