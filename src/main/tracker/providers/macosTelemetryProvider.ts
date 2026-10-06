import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ITelemetryProvider,
  PlatformCapabilities,
  PlatformPermissions,
  NormalizedTelemetryObservation,
  PermissionState
} from '../telemetryProvider';
import { resolveApplication } from '../appResolver';

const execAsync = promisify(exec);

export class MacOSTelemetryProvider implements ITelemetryProvider {
  public readonly platform = 'darwin';
  public readonly architecture: string;

  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private lastObservationTime = Date.now();
  private lastObs?: NormalizedTelemetryObservation;

  private onObservationCb?: (obs: NormalizedTelemetryObservation) => void;
  private onLifecycleCb?: (event: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME') => void;

  private accessibilityPermission: PermissionState = 'NOT_DETERMINED';

  constructor(overrideArch?: string) {
    this.architecture = overrideArch || process.arch;
    this.checkPermissions();
  }

  public checkPermissions(): PlatformPermissions {
    try {
      // Electron systemPreferences check if available
      const electron = require('electron');
      if (electron && electron.systemPreferences && electron.systemPreferences.isTrustedAccessibilityClient) {
        const isTrusted = electron.systemPreferences.isTrustedAccessibilityClient(false);
        this.accessibilityPermission = isTrusted ? 'GRANTED' : 'DENIED';
      }
    } catch {
      this.accessibilityPermission = 'NOT_DETERMINED';
    }

    return this.getPermissions();
  }

  public getCapabilities(): PlatformCapabilities {
    const hasAccessibility = this.accessibilityPermission === 'GRANTED';

    return {
      foregroundApplication: 'SUPPORTED',
      processIdentity: 'SUPPORTED',
      windowIdentity: hasAccessibility ? 'SUPPORTED' : 'REQUIRES_PERMISSION',
      windowTitle: hasAccessibility ? 'SUPPORTED' : 'REQUIRES_PERMISSION',
      idleDetection: 'SUPPORTED',
      lockDetection: 'SUPPORTED',
      sleepDetection: 'SUPPORTED',
      browserTracking: 'SUPPORTED'
    };
  }

  public getPermissions(): PlatformPermissions {
    return {
      accessibility: this.accessibilityPermission,
      screenRecording: 'NOT_DETERMINED',
      inputMonitoring: 'NOT_DETERMINED'
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start 1-second active app & idle check loop
    this.pollTimer = setInterval(async () => {
      try {
        const obs = await this.queryDirect();
        this.lastObservationTime = Date.now();

        // Check if application or window changed
        if (
          !this.lastObs ||
          this.lastObs.bundleId !== obs.bundleId ||
          this.lastObs.processId !== obs.processId ||
          this.lastObs.windowTitle !== obs.windowTitle
        ) {
          this.lastObs = obs;
          if (this.onObservationCb) {
            this.onObservationCb(obs);
          }
        }
      } catch (err: any) {
        // Log telemetry error without crashing
      }
    }, 1000);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  public async queryDirect(): Promise<NormalizedTelemetryObservation> {
    const idleSeconds = await this.queryMacIdleSeconds();
    const frontApp = await this.queryMacFrontmostApp();

    const resolved = resolveApplication({
      executable: frontApp.executable || frontApp.name,
      bundleId: frontApp.bundleId,
      processId: frontApp.pid,
      windowTitle: frontApp.windowTitle,
      platform: 'darwin'
    });

    return {
      platform: 'darwin',
      architecture: this.architecture,
      osRelease: os.release(),
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: process.hrtime.bigint(),
      applicationId: resolved.applicationId,
      applicationName: resolved.name,
      executable: frontApp.executable || frontApp.name,
      bundleId: frontApp.bundleId,
      processId: frontApp.pid,
      windowId: frontApp.windowId || String(frontApp.pid),
      windowTitle: frontApp.windowTitle,
      idleSeconds
    };
  }

  public setOnObservation(callback: (obs: NormalizedTelemetryObservation) => void): void {
    this.onObservationCb = callback;
  }

  public setOnLifecycleEvent(callback: (event: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME') => void): void {
    this.onLifecycleCb = callback;
  }

  public isAvailable(): boolean {
    return process.platform === 'darwin';
  }

  public isConnected(): boolean {
    return this.isRunning;
  }

  public getLastSeen(): string {
    return new Date(this.lastObservationTime).toISOString();
  }

  /**
   * Query macOS system idle time via IOKit / IOHIDSystem (nanoseconds)
   */
  private async queryMacIdleSeconds(): Promise<number> {
    try {
      const { stdout } = await execAsync("ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}'");
      const nano = parseInt(stdout.trim(), 10);
      if (!isNaN(nano) && nano > 0) {
        return Math.max(0, Math.floor(nano / 1e9));
      }
    } catch {}
    return 0;
  }

  /**
   * Query macOS active foreground application via AppleScript / JXA
   */
  private async queryMacFrontmostApp(): Promise<{
    name: string;
    bundleId: string;
    pid: number;
    executable: string;
    windowTitle?: string;
    windowId?: string;
  }> {
    const script = `
      tell application "System Events"
        set frontProc to first process whose frontmost is true
        set procName to name of frontProc
        set procBundle to bundle identifier of frontProc
        set procId to unix id of frontProc
        set winTitle to ""
        try
          set winTitle to name of front window of frontProc
        end try
        return procName & "|||" & procBundle & "|||" & procId & "|||" & winTitle
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      const parts = stdout.trim().split('|||');
      const name = parts[0] || 'Finder';
      const bundleId = parts[1] || 'com.apple.finder';
      const pid = parseInt(parts[2] || '0', 10);
      const windowTitle = parts[3] || undefined;

      return {
        name,
        bundleId,
        pid,
        executable: name,
        windowTitle
      };
    } catch (err: any) {
      // Fallback
      return {
        name: 'Finder',
        bundleId: 'com.apple.finder',
        pid: 0,
        executable: 'Finder'
      };
    }
  }
}
