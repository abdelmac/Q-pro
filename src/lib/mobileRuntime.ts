import { Capacitor } from '@capacitor/core';
import type { AsyncKeyValueStorage } from '@/lib/questionnairePersistence';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** Browser storage is local, not encrypted. Call only after offering local-save controls. */
export function createBrowserStorage(storage: Storage): AsyncKeyValueStorage {
  return {
    requiresCrossTabLock: true,
    getItem: async (key) => storage.getItem(key),
    setItem: async (key, value) => storage.setItem(key, value),
    removeItem: async (key) => storage.removeItem(key),
  };
}

let appStorage: Promise<AsyncKeyValueStorage> | undefined;

/** Never fall back to plaintext when the native keychain/keystore is unavailable. */
export function getAppStorage(): Promise<AsyncKeyValueStorage> {
  if (!appStorage) {
    appStorage = (async () => {
      if (!isNativeApp()) return createBrowserStorage(window.localStorage);
      const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.setKeyPrefix('qpro_');
      await SecureStorage.setSynchronize(false);
      await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
      return {
        getItem: (key: string) => SecureStorage.getItem(key),
        setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
        removeItem: (key: string) => SecureStorage.removeItem(key),
      };
    })().catch((error: unknown) => {
      appStorage = undefined;
      throw error;
    });
  }
  return appStorage;
}

/** Native app resume/background and Android hardware back use the shared web flow. */
export async function installMobileLifecycle(callbacks: {
  onResume: () => void;
  onPause?: () => void;
  onBack?: () => void;
}): Promise<() => void> {
  if (!isNativeApp()) return () => undefined;
  const { App } = await import('@capacitor/app');
  const handles = await Promise.all([
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) callbacks.onResume();
      else callbacks.onPause?.();
    }),
    ...(callbacks.onBack ? [App.addListener('backButton', callbacks.onBack)] : []),
  ]);
  return () => { handles.forEach((handle) => { void handle.remove(); }); };
}
