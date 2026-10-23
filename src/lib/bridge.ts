import { Capacitor, registerPlugin } from '@capacitor/core';

export interface BridgeRequestInput {
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  redirect?: boolean;
}

export interface BridgeResponse {
  status: number;
  body: string;
  url: string;
  contentType: string;
}

interface NativeCampusPlugin {
  request(input: Record<string, unknown>): Promise<BridgeResponse>;
  openAuth(input: Record<string, unknown>): Promise<{
    success: boolean;
    url: string;
    cancelled?: boolean;
  }>;
  clearSession(): Promise<void>;
  openExternal(input: { url: string }): Promise<void>;
}

const nativePlugin = registerPlugin<NativeCampusPlugin>('CampusBridge');

export function isNativeShell(): boolean {
  return Boolean(window.CampusBridge) || Capacitor.isNativePlatform();
}

export function platformLabel(): 'Windows' | 'Android' | 'Web' {
  if (window.CampusBridge?.platform === 'electron') return 'Windows';
  if (Capacitor.getPlatform() === 'android') return 'Android';
  return 'Web';
}

export async function bridgeRequest(input: BridgeRequestInput): Promise<BridgeResponse> {
  if (window.CampusBridge) return window.CampusBridge.request(input);
  if (Capacitor.isNativePlatform()) {
    return nativePlugin.request(input as unknown as Record<string, unknown>);
  }
  throw new Error('当前预览环境不支持校园网络请求，请使用桌面端或安卓端。');
}

export async function openOfficialAuth(input: {
  startUrl: string;
  successMarkers: string[];
  title?: string;
}): Promise<{ success: boolean; url: string; cancelled?: boolean }> {
  if (window.CampusBridge) return window.CampusBridge.openAuth(input);
  if (Capacitor.isNativePlatform()) {
    return nativePlugin.openAuth(input);
  }
  throw new Error('请在桌面端或安卓端中完成统一认证登录。');
}

export async function clearNativeSession(): Promise<void> {
  if (window.CampusBridge) return window.CampusBridge.clearSession();
  if (Capacitor.isNativePlatform()) return nativePlugin.clearSession();
}

export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error('不支持的外部链接');
  if (window.CampusBridge) return window.CampusBridge.openExternal(url);
  if (Capacitor.isNativePlatform()) return nativePlugin.openExternal({ url });
  window.open(url, '_blank', 'noopener,noreferrer');
}
