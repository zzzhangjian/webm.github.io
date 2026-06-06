(function () {
  'use strict';

  // DOM 元素
  var videoPlayer = document.getElementById('video-player');
  var fileNameEl = document.getElementById('file-name');
  var fileFormatEl = document.getElementById('file-format');
  var fileSizeEl = document.getElementById('file-size');
  var fileDurationEl = document.getElementById('file-duration');
  var progressSection = document.getElementById('progress-section');
  var progressFill = document.getElementById('progress-fill');
  var progressText = document.getElementById('progress-text');
  var progressPercent = document.getElementById('progress-percent');
  var convertSection = document.getElementById('convert-section');
  var convertFill = document.getElementById('convert-fill');
  var convertText = document.getElementById('convert-text');
  var convertPercent = document.getElementById('convert-percent');
  var errorSection = document.getElementById('error-section');
  var errorMessage = document.getElementById('error-message');
  var btnRetry = document.getElementById('btn-retry');
  var btnSave = document.getElementById('btn-save');
  var formatRadios = document.querySelectorAll('input[name="output-format"]');

  // URL 参数
  var params = new URLSearchParams(window.location.search);
  var videoUrl = params.get('url');
  var fileName = params.get('name') || 'video';
  var fileSize = params.get('size') ? parseInt(params.get('size'), 10) : null;

  // 状态
  var downloadedBlob = null;
  var outputBlob = null;
  var outputFileName = fileName;
  var ffmpegInstance = null;
  var ffmpegLoaded = false;
  var downloadCompleted = false;
  var converting = false;

  // 从文件名提取扩展名
  function getExtension(name) {
    var lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot).toLowerCase() : '';
  }

  // 源文件扩展名
  var sourceExt = getExtension(fileName) || '.mp4';

  // 扩展名 → 显示名称
  var EXT_DISPLAY = {
    '.webm': 'WebM',
    '.mp4': 'MP4',
    '.mkv': 'MKV',
    '.avi': 'AVI',
    '.mov': 'MOV',
    '.flv': 'FLV',
    '.wmv': 'WMV',
    '.m4v': 'M4V',
    '.ogv': 'OGV',
    '.3gp': '3GP',
    '.ts': 'TS',
  };

  // 格式配置：输出格式 → FFmpeg 编码参数
  var FORMAT_CONFIG = {
    mp4: { ext: '.mp4', codec: '-c:v libx264 -preset fast -crf 23 -c:a aac', mimeType: 'video/mp4' },
    webm: { ext: '.webm', codec: '-c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus', mimeType: 'video/webm' },
    mov: { ext: '.mov', codec: '-c:v libx264 -preset fast -crf 23 -c:a aac -f mov', mimeType: 'video/quicktime' },
    avi: { ext: '.avi', codec: '-c:v libx264 -preset fast -crf 23 -c:a mp3 -f avi', mimeType: 'video/x-msvideo' },
    mkv: { ext: '.mkv', codec: '-c:v libx264 -preset fast -crf 23 -c:a aac -f matroska', mimeType: 'video/x-matroska' },
  };

  // 获取当前选择的格式
  function getSelectedFormat() {
    for (var i = 0; i < formatRadios.length; i++) {
      if (formatRadios[i].checked) return formatRadios[i].value;
    }
    return 'keep';
  }

  // 判断是否需要转码
  function needsConversion(selectedFormat) {
    if (selectedFormat === 'keep') return false;
    var targetExt = FORMAT_CONFIG[selectedFormat].ext;
    return sourceExt !== targetExt;
  }

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

  // 替换文件扩展名
  function replaceExtension(name, newExt) {
    var lastDot = name.lastIndexOf('.');
    var baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
    return baseName + newExt;
  }

  // 初始化 ffmpeg.wasm
  async function initFFmpeg() {
    if (ffmpegLoaded) return true;

    try {
      if (typeof FFmpeg === 'undefined' || typeof FFmpegUtil === 'undefined') {
        console.warn('ffmpeg.wasm CDN 未加载，跳过转码功能');
        return false;
      }

      var FFmpegClass = FFmpeg.FFmpeg;
      ffmpegInstance = new FFmpegClass();

      ffmpegInstance.on('progress', function (info) {
        var percent = Math.min(Math.round(info.progress * 100), 100);
        convertFill.style.width = percent + '%';
        convertPercent.textContent = percent + '%';
        convertText.textContent = '正在转码... ' + percent + '%';
      });

      var baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
      var toBlobURL = FFmpegUtil.toBlobURL;

      // 先获取 wasm 的 blob URL
      var wasmBlobURL = await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm');

      // ffmpeg-core.js 的 locateFile 会从 coreURL 的 # 后缀中解析 wasmURL
      // 格式: blob:...#{"wasmURL":"blob:...","workerURL":""}
      var configJSON = JSON.stringify({ wasmURL: wasmBlobURL, workerURL: '' });
      var configBase64 = btoa(configJSON);
      var coreBlobURL = await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript');
      var coreURLWithConfig = coreBlobURL + '#' + configBase64;

      await ffmpegInstance.load({
        coreURL: coreURLWithConfig,
        wasmURL: wasmBlobURL,
      });

      ffmpegLoaded = true;
      return true;
    } catch (err) {
      console.error('ffmpeg.wasm 加载失败:', err);
      return false;
    }
  }

  // 初始化页面
  function init() {
    if (!videoUrl) {
      showError('缺少下载链接参数');
      return;
    }

    fileNameEl.textContent = fileName;
    fileFormatEl.textContent = EXT_DISPLAY[sourceExt] || sourceExt.toUpperCase();
    fileSizeEl.textContent = formatFileSize(fileSize);

    videoPlayer.src = videoUrl;
    videoPlayer.addEventListener('loadedmetadata', function () {
      fileDurationEl.textContent = formatDuration(videoPlayer.duration);
    });

    // 格式切换时更新文件名预览，下载完成后自动触发转码
    formatRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        var fmt = getSelectedFormat();
        if (fmt === 'keep') {
          fileNameEl.textContent = fileName;
          if (downloadCompleted && !converting) {
            outputBlob = downloadedBlob;
            outputFileName = fileName;
            convertSection.classList.add('hidden');
            btnSave.disabled = false;
          }
        } else {
          var config = FORMAT_CONFIG[fmt];
          fileNameEl.textContent = replaceExtension(fileName, config.ext);
          if (downloadCompleted && !converting && needsConversion(fmt)) {
            convertFormat(fmt);
          }
        }
      });
    });

    startDownload();
  }

  // 开始下载
  async function startDownload() {
    progressSection.style.display = 'block';
    convertSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    btnSave.disabled = true;
    outputBlob = null;
    progressText.textContent = '正在下载...';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';

    try {
      var response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error('下载失败: HTTP ' + response.status);
      }

      var contentLength = response.headers.get('content-length');
      var total = contentLength ? parseInt(contentLength, 10) : fileSize;

      if (!response.body) {
        var blob = await response.blob();
        downloadedBlob = blob;
        onDownloadComplete(blob);
        return;
      }

      var reader = response.body.getReader();
      var chunks = [];
      var receivedLength = 0;

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        chunks.push(result.value);
        receivedLength += result.value.length;

        if (total) {
          var percent = Math.round((receivedLength / total) * 100);
          progressFill.style.width = percent + '%';
          progressPercent.textContent = percent + '%';
          progressText.textContent = '正在下载... ' + formatFileSize(receivedLength) + ' / ' + formatFileSize(total);
        } else {
          progressText.textContent = '正在下载... ' + formatFileSize(receivedLength);
        }
      }

      var mergedBlob = new Blob(chunks, { type: 'video/webm' });
      downloadedBlob = mergedBlob;
      onDownloadComplete(mergedBlob);
    } catch (err) {
      showError('下载失败: ' + (err.message || '未知错误'));
    }
  }

  // 下载完成
  async function onDownloadComplete(blob) {
    downloadCompleted = true;
    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    progressText.textContent = '下载完成! ' + formatFileSize(blob.size);
    fileSizeEl.textContent = formatFileSize(blob.size);

    videoPlayer.src = URL.createObjectURL(blob);

    var fmt = getSelectedFormat();
    if (fmt === 'keep' || !needsConversion(fmt)) {
      // 保持原格式，无需转码
      outputBlob = downloadedBlob;
      outputFileName = fileName;
      btnSave.disabled = false;
    } else {
      await convertFormat(fmt);
    }
  }

  // 格式转码
  async function convertFormat(fmt) {
    var config = FORMAT_CONFIG[fmt];
    outputFileName = replaceExtension(fileName, config.ext);
    converting = true;

    convertSection.classList.remove('hidden');
    convertFill.style.width = '0%';
    convertPercent.textContent = '0%';
    convertText.textContent = '正在加载转码引擎...';
    btnSave.disabled = true;

    try {
      var ffmpegReady = await initFFmpeg();

      if (!ffmpegReady) {
        convertText.textContent = '转码引擎加载失败，将保存为原始格式';
        outputBlob = downloadedBlob;
        outputFileName = fileName;
        converting = false;
        btnSave.disabled = false;
        return;
      }

      convertText.textContent = '正在写入文件...';

      var fetchFile = FFmpegUtil.fetchFile;
      var inputData = await fetchFile(downloadedBlob);
      var inputName = 'input' + sourceExt;
      await ffmpegInstance.writeFile(inputName, inputData);

      // 执行转码
      convertText.textContent = '正在转码...';

      var codecParts = config.codec.split(' ');
      var ffmpegArgs = ['-i', inputName];
      for (var i = 0; i < codecParts.length; i++) {
        ffmpegArgs.push(codecParts[i]);
      }
      ffmpegArgs.push('output' + config.ext);

      await ffmpegInstance.exec(ffmpegArgs);

      // 读取输出文件
      var outputData = await ffmpegInstance.readFile('output' + config.ext);
      outputBlob = new Blob([outputData.buffer], { type: config.mimeType });

      // 清理临时文件
      try {
        await ffmpegInstance.deleteFile(inputName);
        await ffmpegInstance.deleteFile('output' + config.ext);
      } catch (e) {
        // 忽略清理错误
      }

      convertFill.style.width = '100%';
      convertPercent.textContent = '100%';
      convertText.textContent = '转码完成! ' + formatFileSize(outputBlob.size);

      converting = false;
      btnSave.disabled = false;
    } catch (err) {
      console.error('转码失败:', err);
      convertText.textContent = '转码失败: ' + (err.message || '未知错误') + '，将保存为原始格式';
      outputBlob = downloadedBlob;
      outputFileName = fileName;
      converting = false;
      btnSave.disabled = false;
    }
  }

  // 保存到本地
  function saveToLocal() {
    var blobToSave = outputBlob || downloadedBlob;
    if (!blobToSave) return;

    var url = URL.createObjectURL(blobToSave);
    var a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

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
