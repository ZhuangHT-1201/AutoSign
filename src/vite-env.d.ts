/// <reference types="vite/client" />

interface CampusBridge {
  platform: 'electron' | 'android';
  request(input: {
    url: string;
    method?: 'GET' | 'POST' | 'HEAD';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    redirect?: boolean;
  }): Promise<{
    status: number;
    body: string;
    url: string;
    contentType: string;
  }>;
  openAuth(input: {
    startUrl: string;
    successMarkers: string[];
    title?: string;
  }): Promise<{ success: boolean; url: string; cancelled?: boolean }>;
  clearSession(): Promise<void>;
  openExternal(url: string): Promise<void>;
}

interface Window {
  CampusBridge?: CampusBridge;
  Capacitor?: {
    Plugins?: {
      CampusBridge?: {
        request(input: Record<string, unknown>): Promise<{
          status: number;
          body: string;
          url: string;
          contentType: string;
        }>;
        openAuth(input: Record<string, unknown>): Promise<{
          success: boolean;
          url: string;
          cancelled?: boolean;
        }>;
        clearSession(): Promise<void>;
        openExternal(input: { url: string }): Promise<void>;
      };
    };
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
}
