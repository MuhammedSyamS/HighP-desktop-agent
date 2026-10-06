import { v4 as uuidv4 } from 'uuid';
import { ActivityEventType, ActivityState } from '../../shared/enums';
import { resolveApplication, TrackedApplicationEntry, DEFAULT_REGISTRY_ENTRIES, mergeRegistries } from './appResolver';
import { browserBridge, ActiveWebsiteInfo, BrowserTabReport, BrowserTelemetryState } from '../browser/browserBridge';
import { OfflineQueue, DurableTrackingEvent } from '../queue/offlineQueue';
import { NormalizedTelemetryObservation } from './telemetryProvider';

export interface WindowsObservation {
  hwnd?: string;
  windowId?: string;
  processId?: number;
  executable?: string;
  executablePath?: string;
  processStartTime?: number | string;
  processInstanceId?: string;
  bundleId?: string;
  desktopEntry?: string;
  windowTitle?: string;
  idleSeconds?: number;
  timestamp?: string;
  platform?: string;
}

export interface TrackingEngineHealth {
  platform: string;
  architecture: string;
  nativeTelemetryConnected: boolean;
  nativeTelemetryLastSeen: string;
  browserBridgeConnected: boolean;
  browserTelemetryLastSeen: string;
  trackingEngineState: ActivityState;
  browserTrackingState: BrowserTelemetryState;
  queueSize: number;
  lastEventCreated?: string;
  lastEventSynced?: string;
  agentInstanceId: string;
  sessionId?: string;
}

export interface ActiveAppInterval {
  eventId: string;
  applicationId: string;
  name: string;
  executable: string;
  executablePath?: string;
  processStartTime?: number | string;
  processInstanceId?: string;
  bundleId?: string;
  desktopEntry?: string;
  pid: number;
  hwnd?: string;
  windowId: string;
  windowTitle?: string;
  category: string;
  trackingState: 'TRACKED' | 'IGNORED' | 'UNKNOWN';
  startedAt: Date;
  monotonicStartNs: bigint;
}

export interface ActiveWebInterval {
  eventId: string;
  domain: string;
  browser: string;
  windowId?: number;
  tabId?: number;
  url?: string;
  title?: string;
  startedAt: Date;
  monotonicStartNs: bigint;
  parentAppEventId: string;
}

export interface ActiveIdleInterval {
  eventId: string;
  startedAt: Date;
  monotonicStartNs: bigint;
}

export class TrackingEngine {
  private agentInstanceId: string;
  private deviceId: string = 'DEV-UNKNOWN';
  private devicePlatform: string = process.platform;
  private deviceArchitecture: string = process.arch;
  private sessionId?: string;
  private isWorking = false;
  private isOnBreak = false;
  private currentState: ActivityState = ActivityState.OFFLINE;
  private lastObservedIdleSeconds: number = 0;

  // Authoritative intervals
  private currentAppInterval: ActiveAppInterval | null = null;
  private currentWebInterval: ActiveWebInterval | null = null;
  private currentIdleInterval: ActiveIdleInterval | null = null;

  // Liveness & telemetry tracking
  private nativeLastSeenTime = 0;
  private sequenceNumber = 0;
  private idleThresholdSeconds = 60;
  private lastEventCreatedIso?: string;
  private lastEventSyncedIso?: string;

  // Application registry
  private dynamicRegistry: TrackedApplicationEntry[] = [...DEFAULT_REGISTRY_ENTRIES];

  // Callback for state updates
  private onStateChangeCallback?: (state: ActivityState, appName: string, domain?: string) => void;

  // Explicit session clock anchor (Requirement 3)
  private sessionStartedWallClock: Date = new Date();
  private sessionStartedMonotonicNs: bigint = process.hrtime.bigint();

  constructor(private queue: OfflineQueue) {
    this.agentInstanceId = uuidv4();
  }

  public getAgentInstanceId(): string {
    return this.agentInstanceId;
  }

  public monotonicToWallClock(monoNs: bigint): Date {
    const diffNs = monoNs - this.sessionStartedMonotonicNs;
    const diffMs = Number(diffNs / 1_000_000n);
    return new Date(this.sessionStartedWallClock.getTime() + diffMs);
  }

  public setDeviceId(id: string): void {
    this.deviceId = id;
  }

  public setPlatformInfo(platform: string, arch: string): void {
    this.devicePlatform = platform;
    this.deviceArchitecture = arch;
  }

  public getLastObservedIdleSeconds(): number {
    return this.lastObservedIdleSeconds;
  }

  public setDynamicRegistry(registry: TrackedApplicationEntry[]): void {
    this.dynamicRegistry = mergeRegistries(DEFAULT_REGISTRY_ENTRIES, registry);
  }

  public setIdleThreshold(seconds: number): void {
    this.idleThresholdSeconds = Math.max(15, seconds);
  }

  public setOnStateChange(cb: (state: ActivityState, appName: string, domain?: string) => void): void {
    this.onStateChangeCallback = cb;
  }

  private notifyChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(
        this.currentState,
        this.currentAppInterval?.name || 'None',
        this.currentWebInterval?.domain
      );
    }
  }

  public getHealth(): TrackingEngineHealth {
    const browserRes = this.currentAppInterval
      ? browserBridge.resolveWebsiteState(this.currentAppInterval.executable, this.currentAppInterval.windowTitle)
      : { website: null, state: 'NOT_BROWSER' as BrowserTelemetryState };

    return {
      platform: this.devicePlatform,
      architecture: this.deviceArchitecture,
      nativeTelemetryConnected: Date.now() - this.nativeLastSeenTime < 5000,
      nativeTelemetryLastSeen: this.nativeLastSeenTime ? new Date(this.nativeLastSeenTime).toISOString() : 'Never',
      browserBridgeConnected: browserBridge.isConnected(),
      browserTelemetryLastSeen: browserBridge.getLastReportTime() ? new Date(browserBridge.getLastReportTime()).toISOString() : 'Never',
      trackingEngineState: this.currentState,
      browserTrackingState: browserRes.state,
      queueSize: this.queue.size(),
      lastEventCreated: this.lastEventCreatedIso,
      lastEventSynced: this.lastEventSyncedIso,
      agentInstanceId: this.agentInstanceId,
      sessionId: this.sessionId
    };
  }

  public getCurrentState(): ActivityState {
    return this.currentState;
  }

  public getCurrentApp(): ActiveAppInterval | null {
    return this.currentAppInterval;
  }

  public getCurrentWebsite(): ActiveWebInterval | null {
    return this.currentWebInterval;
  }

  // --- Session Control ---

  public startSession(sessionId: string, deviceId: string): void {
    this.sessionId = sessionId;
    this.deviceId = deviceId;
    this.isWorking = true;
    this.isOnBreak = false;
    this.currentState = ActivityState.ACTIVE;
    this.sessionStartedWallClock = new Date();
    this.sessionStartedMonotonicNs = process.hrtime.bigint();

    const eventId = uuidv4();
    const now = this.sessionStartedWallClock;
    this.emitEvent({
      eventId,
      sessionId,
      eventType: ActivityEventType.SESSION_START,
      timestamp: now.toISOString(),
      durationSeconds: 0
    });

    this.notifyChange();
  }

  public endSession(): void {
    if (!this.sessionId) return;
    const endingSession = this.sessionId;

    this.closeWebInterval();
    this.closeAppInterval();
    if (this.currentState === ActivityState.IDLE) {
      this.closeIdleInterval();
    }

    const eventId = uuidv4();
    const now = new Date();
    this.emitEvent({
      eventId,
      sessionId: endingSession,
      eventType: ActivityEventType.SESSION_END,
      timestamp: now.toISOString(),
      durationSeconds: 0
    });

    this.isWorking = false;
    this.isOnBreak = false;
    this.currentState = ActivityState.OFFLINE;
    this.sessionId = undefined;
    this.notifyChange();
  }

  public startBreak(): void {
    if (!this.isWorking) return;
    this.closeWebInterval();
    this.closeAppInterval();
    this.isOnBreak = true;
    this.currentState = ActivityState.BREAK;
    this.notifyChange();
  }

  public endBreak(): void {
    if (!this.isOnBreak) return;
    this.isOnBreak = false;
    this.currentState = ActivityState.ACTIVE;
    this.notifyChange();
  }

  // --- Core Telemetry Processors ---

  /**
   * Authoritative Cross-Platform Telemetry Processor
   * Consumes normalized observations from Windows, macOS, or Linux providers
   */
  public processObservation(obs: NormalizedTelemetryObservation): void {
    this.nativeLastSeenTime = Date.now();
    this.lastObservedIdleSeconds = obs.idleSeconds ?? 0;
    if (!this.isWorking || this.isOnBreak || !this.sessionId) return;

    // 1. Handle WAITING_FOR_INPUT state (after unlock or resume)
    if (this.currentState === ActivityState.WAITING_FOR_INPUT) {
      if (obs.idleSeconds <= 1) {
        this.currentState = ActivityState.ACTIVE;
        this.notifyChange();
      } else {
        // Still waiting for physical input
        return;
      }
    }

    // 2. Idle State Evaluation
    const isSystemIdle = obs.idleSeconds >= this.idleThresholdSeconds;
    if (isSystemIdle) {
      if (this.currentState === ActivityState.ACTIVE) {
        // Active -> Idle transition (Requirement 4)
        // idleStart = max(lastPhysicalInput + idleThreshold, currentInterval.start)
        const nowMonoNs = process.hrtime.bigint();
        const overThresholdSeconds = Math.max(0, obs.idleSeconds - this.idleThresholdSeconds);
        const overThresholdNs = BigInt(overThresholdSeconds) * BigInt(1e9);
        let idleStartMonotonicNs = nowMonoNs - overThresholdNs;

        // Clamp to current app start time so idle transition never precedes app start
        if (this.currentAppInterval) {
          if (idleStartMonotonicNs < this.currentAppInterval.monotonicStartNs) {
            idleStartMonotonicNs = this.currentAppInterval.monotonicStartNs;
          }
        }

        const idleStartTime = this.monotonicToWallClock(idleStartMonotonicNs);

        this.closeWebInterval(idleStartTime, idleStartMonotonicNs);
        this.closeAppInterval(idleStartTime, idleStartMonotonicNs);

        const idleEventId = uuidv4();
        this.currentIdleInterval = {
          eventId: idleEventId,
          startedAt: idleStartTime,
          monotonicStartNs: idleStartMonotonicNs
        };

        this.currentState = ActivityState.IDLE;
        this.emitEvent({
          eventId: idleEventId,
          sessionId: this.sessionId,
          eventType: ActivityEventType.IDLE_START,
          timestamp: idleStartTime.toISOString(),
          wallClockStart: idleStartTime.toISOString(),
          monotonicStartNs: idleStartMonotonicNs.toString(),
          durationSeconds: 0,
          durationMs: 0,
          clockSource: 'MONOTONIC',
          source: 'physical_input_monitor'
        });

        this.notifyChange();
      }
      return; // Stop processing applications while idle
    } else {
      // Physically active
      if (this.currentState === ActivityState.IDLE) {
        // Idle -> Active transition
        this.closeIdleInterval();
        this.currentState = ActivityState.ACTIVE;
        this.notifyChange();
      }
    }

    // 3. Foreground Window Identity Evaluation
    const isHighPSelf = this.isAgentSelfProcess(obs);
    if (isHighPSelf) {
      if (this.currentAppInterval && this.currentAppInterval.name !== 'HighP Agent') {
        this.closeWebInterval();
        this.closeAppInterval();
        this.notifyChange();
      }
      return;
    }

    const resolved = resolveApplication({
      executable: obs.executable,
      executablePath: obs.executablePath,
      bundleId: obs.bundleId,
      desktopEntry: obs.desktopEntry,
      processId: obs.processId,
      windowTitle: obs.windowTitle,
      platform: (obs.platform || this.devicePlatform) as any,
      dynamicRegistry: this.dynamicRegistry
    });

    // Filter desktop shell background without terminating work app
    if ((resolved.name === 'Windows Desktop' || resolved.name === 'macOS Desktop') && this.currentAppInterval && this.currentAppInterval.name !== 'None') {
      return;
    }

    // Check if window or process instance changed (PID, HWND, start time, executable path, or app identity)
    const obsInstanceId =
      obs.processInstanceId ||
      this.buildProcessInstanceId(
        obs.platform || this.devicePlatform,
        obs.processId,
        obs.processStartTime,
        obs.executablePath,
        obs.executable
      );

    const isWindowChanged =
      !this.currentAppInterval ||
      this.currentAppInterval.windowId !== obs.windowId ||
      this.currentAppInterval.pid !== obs.processId ||
      this.currentAppInterval.name !== resolved.name ||
      Boolean(
        this.currentAppInterval.processInstanceId &&
        obsInstanceId &&
        this.currentAppInterval.processInstanceId !== obsInstanceId
      ) ||
      Boolean(
        this.currentAppInterval.processStartTime !== undefined &&
        obs.processStartTime !== undefined &&
        this.currentAppInterval.processStartTime !== obs.processStartTime
      );

    if (isWindowChanged) {
      // Close previous intervals
      this.closeWebInterval();
      this.closeAppInterval();

      // Start new App interval
      const appEventId = uuidv4();
      const now = new Date();
      this.currentAppInterval = {
        eventId: appEventId,
        applicationId: resolved.applicationId,
        name: resolved.name,
        executable: resolved.executableName,
        executablePath: obs.executablePath,
        processStartTime: obs.processStartTime,
        processInstanceId: obsInstanceId,
        bundleId: obs.bundleId,
        desktopEntry: obs.desktopEntry,
        pid: obs.processId,
        hwnd: obs.windowId,
        windowId: obs.windowId,
        windowTitle: obs.windowTitle,
        category: resolved.category,
        trackingState: resolved.trackingState,
        startedAt: now,
        monotonicStartNs: process.hrtime.bigint()
      };

      if (resolved.trackingState !== 'IGNORED' && !resolved.ignored) {
        this.emitEvent({
          eventId: appEventId,
          sessionId: this.sessionId,
          eventType: ActivityEventType.APP_FOCUS_START,
          timestamp: now.toISOString(),
          durationSeconds: 0,
          application: {
            applicationId: resolved.applicationId,
            name: resolved.name,
            executable: resolved.executableName,
            executablePath: obs.executablePath,
            bundleId: obs.bundleId,
            desktopEntry: obs.desktopEntry,
            pid: obs.processId,
            hwnd: obs.windowId,
            windowId: obs.windowId,
            windowTitle: obs.windowTitle,
            category: resolved.category
          },
          process: resolved.executableName,
          pid: obs.processId,
          hwnd: obs.windowId,
          metadata: {
            processInstanceId: obsInstanceId,
            processStartTime: obs.processStartTime
          }
        });
      }

      // Check if new foreground window is a browser with an active website
      const websiteRes = browserBridge.resolveWebsiteState(obs.executable, obs.windowTitle, obs.windowId);
      if (websiteRes.state === 'BROWSER_ACTIVE_WEBSITE_KNOWN' && websiteRes.website) {
        this.openWebInterval(websiteRes.website);
      }

      this.notifyChange();
    } else {
      // Same window: check for website changes inside this browser
      if (this.currentAppInterval) {
        this.currentAppInterval.windowTitle = obs.windowTitle || this.currentAppInterval.windowTitle;
        const websiteRes = browserBridge.resolveWebsiteState(obs.executable, obs.windowTitle);

        if (websiteRes.state === 'BROWSER_ACTIVE_WEBSITE_KNOWN' && websiteRes.website) {
          if (!this.currentWebInterval || this.currentWebInterval.domain !== websiteRes.website.domain) {
            this.closeWebInterval();
            this.openWebInterval(websiteRes.website);
            this.notifyChange();
          }
        } else if (websiteRes.state === 'BROWSER_TELEMETRY_STALE' || websiteRes.state === 'BROWSER_ACTIVE_WEBSITE_UNKNOWN') {
          if (this.currentWebInterval) {
            this.closeWebInterval();
            this.notifyChange();
          }
        }
      }
    }
  }

  public buildProcessInstanceId(
    platform: string,
    pid: number,
    startTime?: number | string,
    exePath?: string,
    exe?: string
  ): string {
    const timeKey = startTime !== undefined && startTime !== null ? String(startTime) : 'notime';
    const pathKey = (exePath || exe || 'unknown').toLowerCase();
    return `${platform}:${pid}:${timeKey}:${pathKey}`;
  }

  /**
   * Backwards-compatible Windows Observation handler
   */
  public processWindowsObservation(obs: WindowsObservation): void {
    const procStartTime = obs.processStartTime;
    const procInstId =
      obs.processInstanceId ||
      this.buildProcessInstanceId('win32', obs.processId || 0, procStartTime, obs.executablePath, obs.executable);

    const normalized: NormalizedTelemetryObservation = {
      platform: 'win32',
      architecture: this.deviceArchitecture,
      osRelease: '',
      timestamp: obs.timestamp || new Date().toISOString(),
      monotonicTimestampNs: process.hrtime.bigint(),
      applicationId: '',
      applicationName: '',
      executable: obs.executable || 'unknown.exe',
      executablePath: obs.executablePath,
      processStartTime: procStartTime,
      processInstanceId: procInstId,
      bundleId: obs.bundleId,
      desktopEntry: obs.desktopEntry,
      processId: obs.processId || 0,
      windowId: obs.hwnd || obs.windowId || '0',
      windowTitle: obs.windowTitle,
      idleSeconds: obs.idleSeconds ?? 0
    };
    this.processObservation(normalized);
  }

  /**
   * Process event-driven Browser Companion Extension Report
   */
  public processBrowserObservation(report: BrowserTabReport): void {
    if (!this.isWorking || this.isOnBreak || !this.sessionId || this.currentState !== ActivityState.ACTIVE) {
      return;
    }

    // Only attribute if current foreground app is actually this browser!
    if (!this.currentAppInterval || !browserBridge.isBrowserExecutable(this.currentAppInterval.executable)) {
      return;
    }

    if (!report.active || !report.domain) {
      // Tab closed or blurred
      if (this.currentWebInterval) {
        this.closeWebInterval();
        this.notifyChange();
      }
      return;
    }

    // Website tab, window, or domain changed inside active browser
    const isDomainChanged = !this.currentWebInterval || this.currentWebInterval.domain !== report.domain;
    const isWindowChanged = Boolean(this.currentWebInterval && report.windowId && this.currentWebInterval.windowId !== report.windowId);
    const isTabChanged = Boolean(this.currentWebInterval && report.tabId && this.currentWebInterval.tabId !== report.tabId);

    if (isDomainChanged || isWindowChanged || isTabChanged) {
      this.closeWebInterval();
      this.openWebInterval({
        domain: report.domain,
        browser: report.browser,
        windowId: report.windowId,
        tabId: report.tabId,
        url: report.url,
        title: report.title,
        source: 'extension'
      });
      this.notifyChange();
    }
  }

  // --- Power & OS Lifecycle Events ---

  public handleScreenLock(): void {
    if (!this.isWorking || !this.sessionId) return;
    this.closeWebInterval();
    this.closeAppInterval();

    const eventId = uuidv4();
    this.emitEvent({
      eventId,
      sessionId: this.sessionId,
      eventType: ActivityEventType.LOCK,
      timestamp: new Date().toISOString(),
      durationSeconds: 0
    });

    this.currentState = ActivityState.LOCKED;
    this.notifyChange();
  }

  public handleScreenUnlock(): void {
    if (!this.isWorking || !this.sessionId) return;

    const eventId = uuidv4();
    this.emitEvent({
      eventId,
      sessionId: this.sessionId,
      eventType: ActivityEventType.UNLOCK,
      timestamp: new Date().toISOString(),
      durationSeconds: 0
    });

    // Move to WAITING_FOR_INPUT (not active yet)
    this.currentState = ActivityState.WAITING_FOR_INPUT;
    this.notifyChange();
  }

  public handleSystemSleep(): void {
    if (!this.isWorking || !this.sessionId) return;
    this.closeWebInterval();
    this.closeAppInterval();

    const eventId = uuidv4();
    this.emitEvent({
      eventId,
      sessionId: this.sessionId,
      eventType: ActivityEventType.SLEEP,
      timestamp: new Date().toISOString(),
      durationSeconds: 0
    });

    this.currentState = ActivityState.SLEEPING;
    this.notifyChange();
  }

  public handleSystemResume(): void {
    if (!this.isWorking || !this.sessionId) return;

    const eventId = uuidv4();
    this.emitEvent({
      eventId,
      sessionId: this.sessionId,
      eventType: ActivityEventType.RESUME,
      timestamp: new Date().toISOString(),
      durationSeconds: 0
    });

    this.currentState = ActivityState.WAITING_FOR_INPUT;
    this.notifyChange();
  }

  // --- Interval Closers with Invariants ---

  private openWebInterval(info: ActiveWebsiteInfo): void {
    if (!this.sessionId || !this.currentAppInterval) return;

    const eventId = uuidv4();
    const now = new Date();
    const nowMonoNs = process.hrtime.bigint();
    this.currentWebInterval = {
      eventId,
      domain: info.domain,
      browser: info.browser,
      windowId: info.windowId,
      tabId: info.tabId,
      url: info.url,
      title: info.title,
      startedAt: now,
      monotonicStartNs: nowMonoNs,
      parentAppEventId: this.currentAppInterval.eventId
    };

    this.emitEvent({
      eventId,
      sessionId: this.sessionId,
      eventType: ActivityEventType.WEBSITE_FOCUS_START,
      timestamp: now.toISOString(),
      wallClockStart: now.toISOString(),
      monotonicStartNs: nowMonoNs.toString(),
      durationSeconds: 0,
      durationMs: 0,
      clockSource: 'MONOTONIC',
      website: {
        browser: info.browser,
        windowId: info.windowId,
        tabId: info.tabId,
        domain: info.domain,
        title: info.title
      },
      browser: info.browser,
      windowId: info.windowId,
      tabId: info.tabId
    });
  }

  private closeWebInterval(customEndTime?: Date, customEndMonotonicNs?: bigint): void {
    if (!this.currentWebInterval || !this.sessionId) return;

    let endTime = customEndTime || new Date();
    let endMonoNs = customEndMonotonicNs ?? process.hrtime.bigint();

    if (endTime.getTime() < this.currentWebInterval.startedAt.getTime()) {
      endTime = new Date(this.currentWebInterval.startedAt.getTime());
    }
    if (endMonoNs < this.currentWebInterval.monotonicStartNs) {
      endMonoNs = this.currentWebInterval.monotonicStartNs;
    }

    const elapsedNs = endMonoNs > this.currentWebInterval.monotonicStartNs
      ? endMonoNs - this.currentWebInterval.monotonicStartNs
      : 0n;
    const durationMs = Math.max(0, Number(elapsedNs / 1_000_000n));
    const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

    this.emitEvent({
      eventId: uuidv4(),
      sessionId: this.sessionId,
      eventType: ActivityEventType.WEBSITE_FOCUS_END,
      timestamp: endTime.toISOString(),
      startedAt: this.currentWebInterval.startedAt.toISOString(),
      endedAt: endTime.toISOString(),
      wallClockStart: this.currentWebInterval.startedAt.toISOString(),
      wallClockEnd: endTime.toISOString(),
      monotonicStartNs: this.currentWebInterval.monotonicStartNs.toString(),
      monotonicEndNs: endMonoNs.toString(),
      durationMs,
      durationSeconds,
      clockSource: 'MONOTONIC',
      website: {
        browser: this.currentWebInterval.browser,
        windowId: this.currentWebInterval.windowId,
        tabId: this.currentWebInterval.tabId,
        domain: this.currentWebInterval.domain,
        title: this.currentWebInterval.title
      },
      browser: this.currentWebInterval.browser,
      windowId: this.currentWebInterval.windowId,
      tabId: this.currentWebInterval.tabId
    });

    this.currentWebInterval = null;
  }

  private closeAppInterval(customEndTime?: Date, customEndMonotonicNs?: bigint): void {
    if (!this.currentAppInterval || !this.sessionId) return;

    let endTime = customEndTime || new Date();
    let endMonoNs = customEndMonotonicNs ?? process.hrtime.bigint();

    if (endTime.getTime() < this.currentAppInterval.startedAt.getTime()) {
      endTime = new Date(this.currentAppInterval.startedAt.getTime());
    }
    if (endMonoNs < this.currentAppInterval.monotonicStartNs) {
      endMonoNs = this.currentAppInterval.monotonicStartNs;
    }

    const elapsedNs = endMonoNs > this.currentAppInterval.monotonicStartNs
      ? endMonoNs - this.currentAppInterval.monotonicStartNs
      : 0n;
    const durationMs = Math.max(0, Number(elapsedNs / 1_000_000n));
    const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

    if (this.currentAppInterval.trackingState !== 'IGNORED') {
      this.emitEvent({
        eventId: uuidv4(),
        sessionId: this.sessionId,
        eventType: ActivityEventType.APP_FOCUS_END,
        timestamp: endTime.toISOString(),
        startedAt: this.currentAppInterval.startedAt.toISOString(),
        endedAt: endTime.toISOString(),
        wallClockStart: this.currentAppInterval.startedAt.toISOString(),
        wallClockEnd: endTime.toISOString(),
        monotonicStartNs: this.currentAppInterval.monotonicStartNs.toString(),
        monotonicEndNs: endMonoNs.toString(),
        durationMs,
        durationSeconds,
        clockSource: 'MONOTONIC',
        application: {
          applicationId: this.currentAppInterval.applicationId,
          name: this.currentAppInterval.name,
          executable: this.currentAppInterval.executable,
          executablePath: this.currentAppInterval.executablePath,
          bundleId: this.currentAppInterval.bundleId,
          desktopEntry: this.currentAppInterval.desktopEntry,
          pid: this.currentAppInterval.pid,
          hwnd: this.currentAppInterval.windowId,
          windowId: this.currentAppInterval.windowId,
          windowTitle: this.currentAppInterval.windowTitle,
          category: this.currentAppInterval.category
        },
        process: this.currentAppInterval.executable,
        pid: this.currentAppInterval.pid,
        hwnd: this.currentAppInterval.windowId,
        metadata: {
          processInstanceId: this.currentAppInterval.processInstanceId,
          processStartTime: this.currentAppInterval.processStartTime
        }
      });
    }

    this.currentAppInterval = null;
  }

  private closeIdleInterval(customEndTime?: Date, customEndMonotonicNs?: bigint): void {
    if (!this.currentIdleInterval || !this.sessionId) return;

    let endTime = customEndTime || new Date();
    let endMonoNs = customEndMonotonicNs ?? process.hrtime.bigint();

    if (endTime.getTime() < this.currentIdleInterval.startedAt.getTime()) {
      endTime = new Date(this.currentIdleInterval.startedAt.getTime());
    }
    if (endMonoNs < this.currentIdleInterval.monotonicStartNs) {
      endMonoNs = this.currentIdleInterval.monotonicStartNs;
    }

    const elapsedNs = endMonoNs > this.currentIdleInterval.monotonicStartNs
      ? endMonoNs - this.currentIdleInterval.monotonicStartNs
      : 0n;
    const durationMs = Math.max(0, Number(elapsedNs / 1_000_000n));
    const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

    this.emitEvent({
      eventId: uuidv4(),
      sessionId: this.sessionId,
      eventType: ActivityEventType.IDLE_END,
      timestamp: endTime.toISOString(),
      startedAt: this.currentIdleInterval.startedAt.toISOString(),
      endedAt: endTime.toISOString(),
      wallClockStart: this.currentIdleInterval.startedAt.toISOString(),
      wallClockEnd: endTime.toISOString(),
      monotonicStartNs: this.currentIdleInterval.monotonicStartNs.toString(),
      monotonicEndNs: endMonoNs.toString(),
      durationMs,
      durationSeconds,
      clockSource: 'MONOTONIC',
      application: {
        applicationId: 'system-idle',
        name: 'System Idle',
        executable: 'idle',
        windowTitle: 'System Idle',
        category: 'Other'
      },
      process: 'idle'
    });

    this.currentIdleInterval = null;
  }

  private emitEvent(event: Omit<DurableTrackingEvent, 'syncStatus' | 'retryCount' | 'createdAt'>): void {
    this.sequenceNumber++;
    this.lastEventCreatedIso = event.timestamp;
    const nowMonoNs = process.hrtime.bigint();
    this.queue.enqueueEvent({
      ...event,
      sequenceNumber: this.sequenceNumber,
      deviceId: this.deviceId,
      platform: this.devicePlatform,
      architecture: this.deviceArchitecture,
      state: event.state || this.currentState,
      source: event.source || 'tracking_engine',
      clockSource: event.clockSource || 'MONOTONIC',
      monotonicTimestamp: nowMonoNs.toString(),
      monotonicStart: event.monotonicStartNs || event.monotonicStart || nowMonoNs.toString(),
      monotonicEnd: event.monotonicEndNs || event.monotonicEnd || nowMonoNs.toString(),
      applicationId: event.applicationId || (event.application ? event.application.applicationId : undefined),
      metadata: {
        ...(event.application ? { executable: event.application.executable, name: event.application.name } : {}),
        ...(event.process ? { executable: event.process } : {}),
        ...(event.metadata || {})
      }
    });
  }

  public markSyncedAt(isoString: string): void {
    this.lastEventSyncedIso = isoString;
  }

  private isAgentSelfProcess(obs: { processId?: number; executable?: string; bundleId?: string }): boolean {
    if (obs.processId && obs.processId === process.pid) return true;
    const exe = (obs.executable || '').toLowerCase();
    const bundle = (obs.bundleId || '').toLowerCase();
    return (
      exe === 'highp agent.exe' ||
      exe === 'highpagent.exe' ||
      exe === 'highptelemetrynative.exe' ||
      exe === 'highp agent' ||
      exe === 'highpagent' ||
      exe === 'electron' ||
      exe === 'electron.exe' ||
      bundle === 'com.highphaus.desktopagent'
    );
  }
}
