import { nativeBridge, NativeTelemetryResult } from './nativeBridge';
import { resolveApplication, ResolvedApplication, TrackedApplicationEntry } from './appResolver';

export interface ActiveWindowInfo {
  applicationName: string;
  processName: string;
  executablePath?: string;
  category: string;
  trackingState: 'TRACKED' | 'IGNORED' | 'UNKNOWN';
  windowTitleSanitized: string;
  rawSnapshot: NativeTelemetryResult;
  resolved: ResolvedApplication;
}

export class WindowTracker {
  private dynamicRegistry: TrackedApplicationEntry[] = [];

  public setDynamicRegistry(registry: TrackedApplicationEntry[]): void {
    this.dynamicRegistry = registry;
  }

  public async getActiveWindow(): Promise<ActiveWindowInfo> {
    const raw = nativeBridge.getSnapshot();
    const resolved = resolveApplication(raw.executable || '', raw.executablePath, raw.processId, this.dynamicRegistry, raw.windowTitle);
    return {
      applicationName: resolved.name,
      processName: raw.executable || 'unknown.exe',
      executablePath: raw.executablePath,
      category: resolved.category,
      trackingState: resolved.trackingState,
      windowTitleSanitized: raw.windowTitle || resolved.name,
      rawSnapshot: raw,
      resolved
    };
  }
}

export const windowTracker = new WindowTracker();
