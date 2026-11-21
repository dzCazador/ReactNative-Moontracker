import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'MoonTracker',
  slug: 'backTracker',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.moonTracker.app',
  },
  android: {
    package: 'com.moonTracker.app',
    adaptiveIcon: {
      backgroundColor: '#0f172a',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'WAKE_LOCK',
      'POST_NOTIFICATIONS',
      'INTERNET',
    ],
  },
  plugins: [
    'expo-sqlite',
    'expo-document-picker',
    ['expo-audio', { enableBackgroundPlayback: true }],
  ],
  experiments: {
    tsconfigPaths: true,
  },
  extra: {
    eas: {
      projectId: 'dbabc8a9-6155-4d48-8da8-78de9e82c18d',
    },
  },
};

export default config;
