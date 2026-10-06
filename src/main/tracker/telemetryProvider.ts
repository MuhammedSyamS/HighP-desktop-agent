import os from 'os';

export type PlatformType = 'win32' | 'darwin' | 'linux';
export type LinuxSessionType = 'x11' | 'wayland' | 'unknown';

export type CapabilityStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'REQUIRES_PERMISSION' | 'UNSUPPORTED';
export type PermissionState = 'GRANTED' | 'DENIED' | 'NOT_DETERMINED' | 'NOT_APPLICABLE';

export interface PlatformCapabilities {
  foregroundApplication: CapabilityStatus;
  processIdentity: CapabilityStatus;
  windowIdentity: CapabilityStatus;
  windowTitle: CapabilityStatus;
  idleDetection: CapabilityStatus;
  lockDetection: CapabilityStatus;
  sleepDetection: CapabilityStatus;
  browserTracking: CapabilityStatus;
}

export interface PlatformPermissions {
  accessibility: PermissionState;
  screenRecording: PermissionState;
  inputMonitoring: PermissionState;
}

export interface NormalizedTelemetryObservation {
  platform: PlatformType;
  architecture: string;
  osRelease: string;
  timestamp: string;
  monotonicTimestampNs: bigint;

  // Normalized Application Identity
  applicationId: string;       // Normalized slug: e.g. 'google-chrome', 'visual-studio-code'
  applicationName: string;     // Friendly name: e.g. 'Google Chrome'
  executable: string;          // Binary name: e.g. 'chrome.exe', 'Google Chrome', 'chrome'
  executablePath?: string;     // Full binary path where permitted
  bundleId?: string;           // macOS bundle identifier: e.g. 'com.google.Chrome'
  desktopEntry?: string;       // Linux .desktop file: e.g. 'google-chrome.desktop'
  processId: number;
  processStartTime?: number | string; // Process creation timestamp
  processInstanceId?: string; // Strong process instance identity: platform:pid:startTime:exePath

  // Window Identity
  windowId: string;            // Window HWND / AXUIElement ID / XID
  windowTitle?: string;        // Window title (if permitted / supported)

  // Physical Inactivity
  idleSeconds: number;

  // Lifecycle Event (optional)
  lifecycleEvent?: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME';
}

export interface ITelemetryProvider {
  readonly platform: PlatformType;
  readonly architecture: string;
  readonly sessionType?: LinuxSessionType;

  getCapabilities(): PlatformCapabilities;
  getPermissions(): PlatformPermissions;

  start(): Promise<void>;
  stop(): Promise<void>;

  queryDirect(): Promise<NormalizedTelemetryObservation>;
  setOnObservation(callback: (obs: NormalizedTelemetryObservation) => void): void;
  setOnLifecycleEvent?(callback: (event: 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESUME') => void): void;

  isAvailable(): boolean;
  isConnected(): boolean;
  getLastSeen(): string;
}
