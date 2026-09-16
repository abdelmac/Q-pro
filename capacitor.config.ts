import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.qpro.specialtymatch',
  appName: 'Specialty Match',
  webDir: 'dist-mobile',
  // Load bundled assets, including the scoring engine and narratives, offline.
  // Never put a remote server.url or secret/service-role key here.
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
  ios: { contentInset: 'automatic', preferredContentMode: 'mobile' },
};

export default config;
