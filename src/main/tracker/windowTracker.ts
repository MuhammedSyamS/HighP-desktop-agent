import { nativeBridge } from './nativeBridge';
import { resolveApplication } from './appResolver';

export interface ActiveWindowInfo {
  applicationName: string;
  processName: string;
  windowTitleSanitized: string;
}

export class WindowTracker {
  public async getActiveWindow(): Promise<ActiveWindowInfo> {
    const raw = nativeBridge.getSnapshot();
    const resolved = resolveApplication(raw.executable || '');
    return {
      applicationName: resolved.applicationName,
      processName: raw.executable || 'unknown.exe',
      windowTitleSanitized: resolved.applicationName
    };
  }
}
