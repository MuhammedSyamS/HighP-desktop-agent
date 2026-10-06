import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ITelemetryProvider,
  PlatformCapabilities,
  PlatformPermissions,
  NormalizedTelemetryObservation,
  LinuxSessionType
} from '../telemetryProvider';
import { resolveApplication } from '../appResolver';

const execAsync = promisify(exec);

export class LinuxTelemetryProvider implements ITelemetryProvider {
  public readonly platform = 'linux';
  public readonly architecture: string;
  public readonly sessionType: LinuxSessionType;

  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private lastObservationTime = Date.now();
  private lastObs?: NormalizedTelemetryObservation;

  private onObservationCb?: (obs: NormalizedTelemetryObservation) => void;
  private onLifecycleCb?: (event: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME') => void;

  constructor(overrideSessionType?: LinuxSessionType, overrideArch?: string) {
    this.architecture = overrideArch || process.arch;
    this.sessionType = overrideSessionType || this.detectSessionType();
  }

  private detectSessionType(): LinuxSessionType {
    const xdgSession = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
    const waylandDisplay = process.env.WAYLAND_DISPLAY;

    if (xdgSession === 'wayland' || waylandDisplay) {
      return 'wayland';
    } else if (xdgSession === 'x11' || process.env.DISPLAY) {
      return 'x11';
    }
    return 'unknown';
  }

  public getCapabilities(): PlatformCapabilities {
    if (this.sessionType === 'wayland') {
      return {
        foregroundApplication: 'PARTIALLY_SUPPORTED',
        processIdentity: 'PARTIALLY_SUPPORTED',
        windowIdentity: 'UNSUPPORTED',     // Wayland security restricts non-compositor window enumeration
        windowTitle: 'UNSUPPORTED',        // Wayland security prevents reading title of arbitrary client
        idleDetection: 'SUPPORTED',        // Available via DBus org.freedesktop.ScreenSaver
        lockDetection: 'SUPPORTED',        // Available via systemd login1
        sleepDetection: 'SUPPORTED',
        browserTracking: 'SUPPORTED'
      };
    }

    // X11 capabilities
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
    if (this.isRunning) return;
    this.isRunning = true;

    this.pollTimer = setInterval(async () => {
      try {
        const obs = await this.queryDirect();
        this.lastObservationTime = Date.now();

        if (
          !this.lastObs ||
          this.lastObs.executable !== obs.executable ||
          this.lastObs.processId !== obs.processId ||
          this.lastObs.windowTitle !== obs.windowTitle
        ) {
          this.lastObs = obs;
          if (this.onObservationCb) {
            this.onObservationCb(obs);
          }
        }
      } catch (err) {}
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
    const idleSeconds = await this.queryLinuxIdleSeconds();
    const frontApp = await this.queryLinuxFrontApp();

    const resolved = resolveApplication({
      executable: frontApp.executable,
      desktopEntry: frontApp.desktopEntry,
      processId: frontApp.pid,
      windowTitle: frontApp.windowTitle,
      platform: 'linux'
    });

    return {
      platform: 'linux',
      architecture: this.architecture,
      osRelease: os.release(),
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: process.hrtime.bigint(),
      applicationId: resolved.applicationId,
      applicationName: resolved.name,
      executable: frontApp.executable,
      desktopEntry: frontApp.desktopEntry,
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
    return process.platform === 'linux';
  }

  public isConnected(): boolean {
    return this.isRunning;
  }

  public getLastSeen(): string {
    return new Date(this.lastObservationTime).toISOString();
  }

  /**
   * Query Linux system idle time via xprintidle or DBus org.freedesktop.ScreenSaver
   */
  private async queryLinuxIdleSeconds(): Promise<number> {
    // 1. Try xprintidle (X11)
    if (this.sessionType === 'x11') {
      try {
        const { stdout } = await execAsync('xprintidle');
        const ms = parseInt(stdout.trim(), 10);
        if (!isNaN(ms)) return Math.max(0, Math.floor(ms / 1000));
      } catch {}
    }

    // 2. Try DBus ScreenSaver GetSessionIdleTime (works on Wayland and X11 GNOME/KDE)
    try {
      const { stdout } = await execAsync(
        'dbus-send --print-reply --dest=org.freedesktop.ScreenSaver /org/freedesktop/ScreenSaver org.freedesktop.ScreenSaver.GetSessionIdleTime'
      );
      const match = stdout.match(/uint32\s+(\d+)/);
      if (match && match[1]) {
        const ms = parseInt(match[1], 10);
        return Math.max(0, Math.floor(ms / 1000));
      }
    } catch {}

    return 0;
  }

  /**
   * Query active foreground window/app on Linux
   */
  private async queryLinuxFrontApp(): Promise<{
    executable: string;
    pid: number;
    windowId?: string;
    windowTitle?: string;
    desktopEntry?: string;
  }> {
    if (this.sessionType === 'wayland') {
      // Truthful Wayland handling: window titles are restricted
      return {
        executable: 'gnome-shell',
        pid: 0,
        windowTitle: undefined // Explicitly undefined on Wayland
      };
    }

    // X11 implementation via xprop / xdotool
    try {
      const { stdout: winIdStr } = await execAsync('xdotool getactivewindow');
      const winId = winIdStr.trim();
      if (!winId) throw new Error('No active window');

      // Query PID and Title
      const { stdout: xpropOut } = await execAsync(`xprop -id ${winId} _NET_WM_PID _NET_WM_NAME WM_CLASS`);
      
      let pid = 0;
      let windowTitle: string | undefined;
      let executable = 'unknown';

      const pidMatch = xpropOut.match(/_NET_WM_PID\(CARDINAL\)\s*=\s*(\d+)/);
      if (pidMatch) pid = parseInt(pidMatch[1], 10);

      const titleMatch = xpropOut.match(/_NET_WM_NAME\(UTF8_STRING\)\s*=\s*"(.*)"/);
      if (titleMatch) windowTitle = titleMatch[1];

      const classMatch = xpropOut.match(/WM_CLASS\(STRING\)\s*=\s*".*?",\s*"(.*?)"/);
      if (classMatch) executable = classMatch[1].toLowerCase();

      // Read executable from /proc/<pid>/comm if pid available
      if (pid > 0) {
        try {
          const comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf-8').trim();
          if (comm) executable = comm;
        } catch {}
      }

      return {
        executable,
        pid,
        windowId: winId,
        windowTitle
      };
    } catch {
      return {
        executable: 'desktop',
        pid: 0
      };
    }
  }
}
