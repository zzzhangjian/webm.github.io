import type { MessagePayload } from './types';

// 统一消息通信封装，兼容 Chrome / Firefox

type SendResponse = (response?: unknown) => void;

// 发送消息到 Background
export function sendMessage(payload: MessagePayload): Promise<unknown> {
  if (typeof browser !== 'undefined') {
    return browser.runtime.sendMessage(payload);
  }
  return chrome.runtime.sendMessage(payload);
}

// 发送消息到指定 Tab 的 Content Script
export function sendTabMessage(tabId: number, payload: MessagePayload): Promise<unknown> {
  if (typeof browser !== 'undefined') {
    return browser.tabs.sendMessage(tabId, payload);
  }
  return chrome.tabs.sendMessage(tabId, payload);
}

// 监听消息
export function onMessage(
  handler: (payload: MessagePayload, sender: chrome.runtime.MessageSender | browser.runtime.MessageSender) => Promise<unknown> | unknown,
): void {
  const listener = (
    message: MessagePayload,
    sender: chrome.runtime.MessageSender | browser.runtime.MessageSender,
    sendResponse: SendResponse,
  ) => {
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(console.error);
      return true; // 保持 sendResponse 通道开放
    }
    sendResponse(result);
    return false;
  };

  if (typeof browser !== 'undefined') {
    browser.runtime.onMessage.addListener(listener as Parameters<typeof browser.runtime.onMessage.addListener>[0]);
  } else {
    chrome.runtime.onMessage.addListener(listener);
  }
}
