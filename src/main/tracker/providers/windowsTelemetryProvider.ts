import os from 'os';
import {
  ITelemetryProvider,
  PlatformCapabilities,
  PlatformPermissions,
  NormalizedTelemetryObservation
} from '../telemetryProvider';
import { nativeBridge, NativeTelemetryResult } from '../nativeBridge';
import { resolveApplication } from '../appResolver';

export class WindowsTelemetryProvider implements ITelemetryProvider {
  public readonly platform = 'win32';
  public readonly architecture: string;

  private onObservationCb?: (obs: NormalizedTelemetryObservation) => void;
  private onLifecycleCb?: (event: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME') => void;

  constructor(overrideArch?: string) {
    this.architecture = overrideArch || process.arch;
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      foregroundApplication: 'SUPPORTED',
      processIdentity: 'SUPPORTED',
      windowIdentity: 'SUPPORTED',
      windowTitle: 'SUPPORTED',
      idleDetection: 'SUPPORTED',
      lockDetection: 'SUPPORTED',
      sleepDetection: 'SUPPORTED',
      browserTracking: 'SUPPORTED'
    };
  }

  public getPermissions(): PlatformPermissions {
    return {
      accessibility: 'NOT_APPLICABLE',
      screenRecording: 'NOT_APPLICABLE',
      inputMonitoring: 'NOT_APPLICABLE'
    };
  }

  public async start(): Promise<void> {
    nativeBridge.setOnForegroundChange((res: NativeTelemetryResult) => {
      if (this.onObservationCb && res.status !== 'ERROR') {
        this.onObservationCb(this.normalize(res));
      }
    });

    nativeBridge.start();
  }

  public async stop(): Promise<void> {
    nativeBridge.stop();
  }

  public async queryDirect(): Promise<NormalizedTelemetryObservation> {
    const raw = await nativeBridge.queryDirect();
    return this.normalize(raw);
  }

  public setOnObservation(callback: (obs: NormalizedTelemetryObservation) => void): void {
    this.onObservationCb = callback;
  }

  public setOnLifecycleEvent(callback: (event: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME') => void): void {
    this.onLifecycleCb = callback;
  }

  public isAvailable(): boolean {
    return nativeBridge.isAvailable();
  }

  public isConnected(): boolean {
    return nativeBridge.isConnected();
  }

  public getLastSeen(): string {
    const ts = nativeBridge.getLastSeen();
    return ts ? new Date(ts).toISOString() : 'Never';
  }

  private normalize(raw: NativeTelemetryResult): NormalizedTelemetryObservation {
    const resolved = resolveApplication({
      executable: raw.executable || '',
      executablePath: raw.executablePath,
      processId: raw.processId || 0,
      windowTitle: raw.windowTitle,
      platform: 'win32'
    });

    return {
      platform: 'win32',
      architecture: this.architecture,
      osRelease: os.release(),
      timestamp: raw.timestamp || new Date().toISOString(),
      monotonicTimestampNs: process.hrtime.bigint(),
      applicationId: resolved.applicationId,
      applicationName: resolved.name,
      executable: raw.executable || 'unknown.exe',
      executablePath: raw.executablePath,
      processId: raw.processId || 0,
      windowId: raw.hwnd || '0',
      windowTitle: raw.windowTitle || '',
      idleSeconds: Math.max(0, raw.idleSeconds || 0)
    };
  }
}
