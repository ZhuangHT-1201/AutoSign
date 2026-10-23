import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.classmark.mobile',
  appName: '课迹',
  webDir: 'dist',
  backgroundColor: '#f3f5f0',
  android: {
    allowMixedContent: true,
    backgroundColor: '#f3f5f0',
  },
};

export default config;
