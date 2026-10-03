import axios from 'axios';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { nativeBridge } from '../tracker/nativeBridge';
import {
  resolveApplication,
  TrackedApplicationEntry,
  DEFAULT_REGISTRY_ENTRIES
} from '../tracker/appResolver';
import { windowTracker } from '../tracker/windowTracker';
import { OfflineQueue, QueuedActivityItem } from '../queue/offlineQueue';
import { ActivityState, ActivityEventType, BreakReason } from '../../shared/enums';

export interface AgentConfig {
  apiUrl: string;
  idleThresholdMinutes: number;
  heartbeatIntervalSeconds: number;
}

export interface AgentState {
  isLoggedIn: boolean;
  isWorking: boolean;
  isOnBreak: boolean;
  currentStatus: ActivityState;
  currentApplication: string;
  activeSeconds: number;
  idleSeconds: number;
  breakSeconds: number;
  sessionId?: string;
  deviceId?: string;
  userEmail?: string;
  employeeName?: string;
  companyName?: string;
  isOnline: boolean;
  queuedEventsCount: number;
  lastHeartbeatTime?: string;
  lastSyncTime?: string;
  telemetryError?: string;
}

export class AgentService {
  private offlineQueue = new OfflineQueue();

  private config: AgentConfig = {
    apiUrl: process.env.HIGHP_API_URL || 'https://highp-agent-backend.onrender.com',
    idleThresholdMinutes: 5,
    heartbeatIntervalSeconds: 15
  };

  private token: string | null = null;
  private user: any = null;
  private company: any = null;
  private currentSessionId?: string;
  private deviceIdentifier: string;

  private isWorking = false;
  private isOnBreak = false;
  private currentStatus: ActivityState = ActivityState.OFFLINE;

  // Active tracking state
  private previousHwnd: string = '0';
  private previousPid: number = 0;
  private previousExecutable: string = '';
  private currentApp: string = 'Unknown Application';
  private currentProcess: string = 'unknown.exe';
  private currentCategory: string = 'Other';
  private currentExecutablePath: string = '';
  private currentWindowTitle: string = '';
  private currentAppStartTime: Date = new Date();
  private currentAppStartMono: bigint = process.hrtime.bigint();
  private currentAppIsTracked = false;
  private currentAppIsIgnored = false;

  // Application Registry
  private dynamicRegistry: TrackedApplicationEntry[] = [];
  private registryVersion = 0;
  private registryFilePath: string;
  private reportedUnknownExes: Set<string> = new Set();
  private registrySyncTimer: NodeJS.Timeout | null = null;

  // Visual local display counters (synced with server)
  private activeSeconds = 0;
  private idleSeconds = 0;
  private breakSeconds = 0;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private trackingTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;

  private isOnline = true;
  private lastHeartbeatTime?: string;
  private lastSyncTime?: string;
  private telemetryError?: string;

  private onStateChangeCallback?: (state: AgentState) => void;

  constructor() {
    this.deviceIdentifier = `DEV-${os.hostname().toUpperCase()}-${os.platform().toUpperCase()}`;

    let baseDir = '.';
    try {
      if (app && app.getPath) {
        baseDir = app.getPath('userData');
      }
    } catch {
      baseDir = '.';
    }
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch {}
    }
    this.registryFilePath = path.join(baseDir, 'highp-app-registry.json');
    this.loadRegistryFromDisk();

    // Start native Win32 bridge on initialization
    nativeBridge.start();
  }

  private loadRegistryFromDisk(): void {
    try {
      if (fs.existsSync(this.registryFilePath)) {
        const raw = fs.readFileSync(this.registryFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.applications)) {
          this.registryVersion = parsed.version || 0;
          this.dynamicRegistry = parsed.applications;
          windowTracker.setDynamicRegistry(this.dynamicRegistry);
          return;
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          this.dynamicRegistry = parsed;
          windowTracker.setDynamicRegistry(this.dynamicRegistry);
          return;
        }
      }
    } catch (e: any) {
      console.warn('[AgentService] Could not read registry from disk, using defaults:', e.message);
    }
    this.dynamicRegistry = [...DEFAULT_REGISTRY_ENTRIES];
    windowTracker.setDynamicRegistry(this.dynamicRegistry);
  }

  private saveRegistryToDisk(): void {
    try {
      const payload = {
        version: this.registryVersion,
        applications: this.dynamicRegistry
      };
      fs.writeFileSync(this.registryFilePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('[AgentService] Could not save registry to disk:', e.message);
    }
  }

  public async syncApplicationRegistry(): Promise<void> {
    if (!this.token) return;
    try {
      const res = await axios.get(`${this.config.apiUrl}/api/agent/applications/config?version=${this.registryVersion}`, {
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 5000
      });
      if (res.data?.data) {
        if (res.data.data.upToDate) {
          return;
        }
        if (Array.isArray(res.data.data.applications)) {
          this.registryVersion = res.data.data.version || Date.now();
          this.dynamicRegistry = res.data.data.applications;
          windowTracker.setDynamicRegistry(this.dynamicRegistry);
          this.saveRegistryToDisk();
          console.log(`[AgentService] Application Registry updated to version ${this.registryVersion} (${this.dynamicRegistry.length} apps)`);
        }
      }
    } catch (err: any) {
      console.warn('[AgentService] Registry sync warning (using cached registry):', err.message);
    }
  }

  private async reportUnknownApp(executable: string, executablePath?: string, windowTitle?: string): Promise<void> {
    const key = (executable || '').trim().toLowerCase();
    if (!this.token || !key || this.reportedUnknownExes.has(key)) return;
    this.reportedUnknownExes.add(key);

    try {
      await axios.post(
        `${this.config.apiUrl}/api/agent/applications/discovered`,
        {
          executableName: executable,
          executablePath: executablePath || '',
          windowTitle: windowTitle || ''
        },
        { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 }
      );
    } catch {}
  }

  public setStateChangeCallback(cb: (state: AgentState) => void): void {
    this.onStateChangeCallback = cb;
  }

  public getState(): AgentState {
    return {
      isLoggedIn: !!this.token,
      isWorking: this.isWorking,
      isOnBreak: this.isOnBreak,
      currentStatus: this.currentStatus,
      currentApplication: this.currentApp,
      activeSeconds: this.activeSeconds,
      idleSeconds: this.idleSeconds,
      breakSeconds: this.breakSeconds,
      sessionId: this.currentSessionId,
      deviceId: this.deviceIdentifier,
      userEmail: this.user?.email,
      employeeName: this.user ? `${this.user.firstName} ${this.user.lastName}` : undefined,
      companyName: this.company?.name,
      isOnline: this.isOnline,
      queuedEventsCount: this.offlineQueue.size(),
      lastHeartbeatTime: this.lastHeartbeatTime,
      lastSyncTime: this.lastSyncTime,
      telemetryError: this.telemetryError
    };
  }

  private notifyStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState());
    }
  }

  private normalizeApiUrl(url?: string): string {
    const raw = (url || process.env.HIGHP_API_URL || 'https://highp-agent-backend.onrender.com').trim();
    return raw.replace(/\/+$/, '').replace(/\/api$/, '');
  }

  public async login(apiUrl: string, email: string, password: string): Promise<boolean> {
    this.config.apiUrl = this.normalizeApiUrl(apiUrl);
    try {
      const res = await axios.post(`${this.config.apiUrl}/api/auth/login`, { email, password });
      if (res.data && res.data.data) {
        this.token = res.data.data.tokens.accessToken;
        this.user = res.data.data.user;
        this.company = res.data.data.company;

        if (this.company?.config) {
          if (this.company.config.idleThresholdMinutes) {
            this.config.idleThresholdMinutes = this.company.config.idleThresholdMinutes;
          }
          if (this.company.config.heartbeatIntervalSeconds) {
            this.config.heartbeatIntervalSeconds = this.company.config.heartbeatIntervalSeconds;
          }
        }

        await this.registerDevice();
        await this.syncApplicationRegistry();
        this.startLoops();
        this.notifyStateChange();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[AgentService] Login error:', err.message);
      throw err;
    }
  }

  public async logout(): Promise<void> {
    if (this.isWorking) {
      await this.endWork();
    }
    this.stopLoops();
    this.token = null;
    this.user = null;
    this.company = null;
    this.currentStatus = ActivityState.OFFLINE;
    this.notifyStateChange();
  }

  private async registerDevice(): Promise<void> {
    if (!this.token) return;
    try {
      await axios.post(
        `${this.config.apiUrl}/api/agent/register`,
        {
          deviceIdentifier: this.deviceIdentifier,
          deviceName: os.hostname(),
          osInfo: {
            platform: os.platform(),
            release: os.release(),
            arch: os.arch(),
            hostname: os.hostname()
          },
          agentVersion: '1.0.0'
        },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      this.isOnline = true;
    } catch (err: any) {
      console.warn('[AgentService] Device registration error:', err.message);
    }
  }

  public async startWork(): Promise<void> {
    if (!this.token) throw new Error('Must be logged in to start work');
    try {
      const res = await axios.post(
        `${this.config.apiUrl}/api/agent/session/start`,
        { deviceId: this.deviceIdentifier },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      this.currentSessionId = res.data.data._id;
      this.isWorking = true;
      this.isOnBreak = false;
      this.currentStatus = ActivityState.ACTIVE;
      this.currentAppStartTime = new Date();
      this.currentAppStartMono = process.hrtime.bigint();
      this.notifyStateChange();
    } catch (err: any) {
      console.warn('[AgentService] Start session online failed, using offline session:', err.message);
      this.currentSessionId = `local-${uuidv4()}`;
      this.isWorking = true;
      this.isOnBreak = false;
      this.currentStatus = ActivityState.ACTIVE;
      this.currentAppStartTime = new Date();
      this.currentAppStartMono = process.hrtime.bigint();
      this.notifyStateChange();
    }
  }

  public async endWork(): Promise<void> {
    this.flushCurrentInterval();

    if (this.token && this.currentSessionId && !this.currentSessionId.startsWith('local-')) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/agent/session/end`,
          { sessionId: this.currentSessionId, endReason: 'Agent Stopped' },
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch (err: any) {
        console.warn('[AgentService] Error ending session online:', err.message);
      }
    }

    this.isWorking = false;
    this.isOnBreak = false;
    this.currentStatus = ActivityState.OFFLINE;
    this.currentSessionId = undefined;
    this.notifyStateChange();
  }

  public async startBreak(reason: BreakReason | string = BreakReason.OTHER, note?: string): Promise<void> {
    if (!this.isWorking) return;
    this.flushCurrentInterval();

    if (this.token) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/breaks/start`,
          { reason, note },
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch (err: any) {
        console.warn('[AgentService] Error starting break online:', err.message);
      }
    }

    this.isOnBreak = true;
    this.currentStatus = ActivityState.BREAK;
    this.notifyStateChange();
  }

  public async endBreak(): Promise<void> {
    if (!this.isOnBreak) return;

    if (this.token) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/breaks/end`,
          {},
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch (err: any) {
        console.warn('[AgentService] Error ending break online:', err.message);
      }
    }

    this.isOnBreak = false;
    this.currentStatus = ActivityState.ACTIVE;
    this.currentAppStartTime = new Date();
    this.currentAppStartMono = process.hrtime.bigint();
    this.notifyStateChange();
  }

  // Close active interval and enqueue to offline queue using monotonic elapsed duration
  // Only records activity if the application is TRACKED according to the Application Registry
  private flushCurrentInterval(type: ActivityEventType = ActivityEventType.APPLICATION_FOCUS): void {
    if (!this.isWorking || this.isOnBreak || !this.currentSessionId) return;

    const now = new Date();
    const elapsedNs = process.hrtime.bigint() - this.currentAppStartMono;
    const durationSeconds = Math.max(0, Math.round(Number(elapsedNs) / 1e9));

    const isSelfApp =
      this.currentApp.toLowerCase().includes('highp') ||
      this.currentApp.toLowerCase().includes('electron') ||
      this.currentApp === 'Unknown Application';

    // Only record if duration >= 1s and application is TRACKED and not ignored
    if (
      durationSeconds >= 1 &&
      this.currentApp &&
      this.currentAppIsTracked &&
      !this.currentAppIsIgnored &&
      !isSelfApp
    ) {
      const eventId = uuidv4();
      console.log(`[EVENT]\neventId=${eventId}\napplication=${this.currentApp}\nduration=${durationSeconds}s`);
      this.offlineQueue.enqueue(eventId, type, {
        applicationName: this.currentApp,
        processName: this.currentProcess,
        windowTitleSanitized: this.currentWindowTitle || this.currentApp,
        startedAt: this.currentAppStartTime.toISOString(),
        endedAt: now.toISOString(),
        durationSeconds
      });
    }

    this.currentAppStartTime = now;
    this.currentAppStartMono = process.hrtime.bigint();
  }

  private startLoops(): void {
    this.stopLoops();

    // 1. High-frequency tracking loop (every 1 second)
    this.trackingTimer = setInterval(async () => {
      await this.runTrackingTick();
    }, 1000);

    // 2. Heartbeat presence loop (every 15 seconds)
    const hbIntervalMs = (this.config.heartbeatIntervalSeconds || 15) * 1000;
    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, hbIntervalMs);

    // 3. Resilient offline queue sync loop (every 10 seconds)
    this.syncTimer = setInterval(async () => {
      await this.syncQueuedEvents();
    }, 10000);

    // 4. Registry configuration sync loop (every 60 seconds)
    this.registrySyncTimer = setInterval(async () => {
      await this.syncApplicationRegistry();
    }, 60000);
  }

  private stopLoops(): void {
    if (this.trackingTimer) clearInterval(this.trackingTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.registrySyncTimer) clearInterval(this.registrySyncTimer);
  }

  private async runTrackingTick(): Promise<void> {
    if (!this.isWorking) return;

    if (this.isOnBreak) {
      this.breakSeconds += 1;
      this.notifyStateChange();
      return;
    }

    // 1. Query Native Windows Bridge (returns hwnd, processId, executable, executablePath, idleSeconds)
    const snapshot = nativeBridge.getSnapshot();

    if (snapshot.status === 'ERROR') {
      this.telemetryError = snapshot.errorMessage || 'Native telemetry error';
      this.notifyStateChange();
      return;
    }

    this.telemetryError = undefined;

    // 2. Check System Idle State
    const idleThresholdSec = (this.config.idleThresholdMinutes || 5) * 60;
    const isSystemIdle = snapshot.idleSeconds >= idleThresholdSec;

    if (isSystemIdle) {
      if (this.currentStatus !== ActivityState.IDLE) {
        // Transition from ACTIVE to IDLE: close active app interval
        this.flushCurrentInterval(ActivityEventType.APPLICATION_FOCUS);
        this.currentStatus = ActivityState.IDLE;
        this.notifyStateChange();
      }
      this.idleSeconds += 1;
    } else {
      if (this.currentStatus === ActivityState.IDLE) {
        // Transition from IDLE back to ACTIVE: record idle interval
        this.flushCurrentInterval(ActivityEventType.IDLE_INTERVAL);
        this.currentStatus = ActivityState.ACTIVE;
        this.currentAppStartTime = new Date();
        this.currentAppStartMono = process.hrtime.bigint();
        this.notifyStateChange();
      }
      this.activeSeconds += 1;

      // 3. Authoritative Foreground Application Resolution
      const resolved = resolveApplication(
        snapshot.executable,
        snapshot.executablePath,
        snapshot.processId,
        this.dynamicRegistry
      );

      const isAgentSelf =
        resolved.category === 'System' ||
        snapshot.processId === process.pid ||
        (snapshot.executable || '').toLowerCase().includes('highp');

      if (isAgentSelf) {
        if (this.currentApp !== 'HighP Agent') {
          this.flushCurrentInterval(ActivityEventType.APPLICATION_FOCUS);
          this.previousHwnd = snapshot.hwnd;
          this.previousPid = snapshot.processId;
          this.previousExecutable = snapshot.executable || '';
          this.currentApp = 'HighP Agent';
          this.currentProcess = snapshot.executable || 'HighPAgent.exe';
          this.currentCategory = 'System';
          this.currentExecutablePath = snapshot.executablePath || '';
          this.currentAppIsTracked = false;
          this.currentAppIsIgnored = true;
          this.currentWindowTitle = snapshot.windowTitle || 'HighP Agent';
          this.currentAppStartTime = new Date();
          this.currentAppStartMono = process.hrtime.bigint();
          this.notifyStateChange();
          this.sendHeartbeat().catch(() => {});
        }
        const isSameApplication =
          resolved.name === this.currentApp &&
          resolved.executableName.toLowerCase() === (this.currentProcess || '').toLowerCase() &&
          resolved.tracked === this.currentAppIsTracked &&
          resolved.category === this.currentCategory;

        if (!isSameApplication) {
          const prevApp = this.currentApp;
          // Application switch detected: flush previous application interval
          this.flushCurrentInterval(ActivityEventType.APPLICATION_FOCUS);

          this.previousHwnd = snapshot.hwnd;
          this.previousPid = snapshot.processId;
          this.previousExecutable = snapshot.executable || '';
          this.currentApp = resolved.name;
          this.currentProcess = resolved.executableName;
          this.currentCategory = resolved.category;
          this.currentExecutablePath = snapshot.executablePath || '';
          this.currentAppIsTracked = resolved.tracked;
          this.currentAppIsIgnored = resolved.ignored;
          this.currentWindowTitle = snapshot.windowTitle || resolved.name;
          this.currentAppStartTime = new Date();
          this.currentAppStartMono = process.hrtime.bigint();

          // Section 28 Diagnostic Logging
          console.log(`[Telemetry]\nPID: ${snapshot.processId}\nExecutable: ${snapshot.executable}`);
          if (resolved.trackingState === 'UNKNOWN' || resolved.isUnknown) {
            console.log(`[Resolver]\nUnknown executable:\n${snapshot.executable}`);
            this.reportUnknownApp(snapshot.executable, snapshot.executablePath, snapshot.windowTitle);
          } else if (resolved.trackingState === 'IGNORED' || resolved.ignored) {
            console.log(`[Resolver]\n${resolved.name}\nState: IGNORED\nActivity suppressed`);
          } else {
            console.log(`[Resolver]\nApplication: ${resolved.name}\nCategory: ${resolved.category}\nState: TRACKED`);
            console.log(`[WindowTracker]\nApplication changed:\n${prevApp} → ${resolved.name}`);
            console.log(`[Activity]\nSession started:\n${resolved.name}`);
          }

          this.notifyStateChange();

          // Instantly send live heartbeat and sync queued events
          this.sendHeartbeat().catch(() => {});
          if (this.currentAppIsTracked) {
            this.syncQueuedEvents().catch(() => {});
          }
        } else {
          this.currentWindowTitle = snapshot.windowTitle || this.currentWindowTitle;
          this.notifyStateChange();
        }
      }
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.token || !this.isWorking) return;

    try {
      const snap = nativeBridge.getSnapshot();
      // Only report as tracked currentApplication if tracking is enabled in Application Registry
      const cleanApp =
        this.currentAppIsTracked &&
        !this.currentAppIsIgnored &&
        this.currentApp &&
        !this.currentApp.toLowerCase().includes('highp') &&
        !this.currentApp.toLowerCase().includes('electron')
          ? this.currentApp
          : '';

      const elapsedNs = process.hrtime.bigint() - this.currentAppStartMono;
      const activeDurSec = Math.max(0, Math.round(Number(elapsedNs) / 1e9));

      await axios.post(
        `${this.config.apiUrl}/api/agent/heartbeat`,
        {
          deviceId: this.deviceIdentifier,
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString(),
          status: this.currentStatus,
          currentApplication: cleanApp,
          executable: this.currentProcess,
          pid: snap.processId || null,
          hwnd: snap.hwnd && snap.hwnd !== '0' ? parseInt(snap.hwnd, 10) : null,
          startedAt: this.currentAppStartTime.toISOString(),
          activeDurationSeconds: activeDurSec,
          idleSeconds: snap.idleSeconds,
          windowTitle: this.currentWindowTitle || cleanApp,
          recentDurationSeconds: this.config.heartbeatIntervalSeconds
        },
        { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 }
      );

      this.isOnline = true;
      this.lastHeartbeatTime = new Date().toLocaleTimeString();
    } catch (err: any) {
      this.isOnline = false;
      if (err.response?.status === 403) {
        console.error('[AgentService] Device has been revoked by admin');
        this.telemetryError = 'Device revoked by administrator.';
        this.stopLoops();
      }
    }
    this.notifyStateChange();
  }

  private async syncQueuedEvents(): Promise<void> {
    if (!this.token || this.offlineQueue.size() === 0 || !this.currentSessionId) return;

    const batch = this.offlineQueue.getPendingBatch(50);
    if (batch.length === 0) return;

    const eventsPayload = batch.map((item) => ({
      eventId: item.eventId,
      type: item.type,
      applicationName: item.payload.applicationName,
      processName: item.payload.processName,
      windowTitleSanitized: item.payload.windowTitleSanitized,
      startedAt: item.payload.startedAt,
      endedAt: item.payload.endedAt,
      durationSeconds: item.payload.durationSeconds
    }));

    try {
      console.log(`[SYNC]\napplication=${eventsPayload.map((e) => e.applicationName).join(', ')}`);
      const res = await axios.post(
        `${this.config.apiUrl}/api/agent/sync`,
        {
          deviceId: this.deviceIdentifier,
          sessionId: this.currentSessionId,
          events: eventsPayload
        },
        { headers: { Authorization: `Bearer ${this.token}` }, timeout: 10000 }
      );

      if (res.status === 200 && res.data?.data) {
        const accepted = res.data.data.accepted || [];
        const duplicates = res.data.data.duplicates || [];
        const confirmedIds = [...accepted, ...duplicates];

        this.offlineQueue.markSynced(confirmedIds);

        // If any failed, mark for exponential backoff
        const failed = res.data.data.failed || [];
        if (failed.length > 0) {
          const failedIds = failed.map((f: any) => f.eventId);
          this.offlineQueue.markFailed(failedIds);
        }

        this.isOnline = true;
        this.lastSyncTime = new Date().toLocaleTimeString();
        this.notifyStateChange();
      }
    } catch (err: any) {
      this.isOnline = false;
      const allBatchIds = batch.map((b) => b.eventId);
      this.offlineQueue.markFailed(allBatchIds, err.message);
      this.notifyStateChange();
    }
  }

  // Handlers for PowerMonitor (suspend, resume, lock, unlock)
  public handleSystemSleep(): void {
    console.log('[AgentService] System sleep detected. Flushing active intervals.');
    this.flushCurrentInterval(ActivityEventType.APPLICATION_FOCUS);
    this.currentStatus = ActivityState.IDLE;
    this.notifyStateChange();
  }

  public handleSystemResume(): void {
    console.log('[AgentService] System resume detected.');
    if (this.isWorking && !this.isOnBreak) {
      this.currentStatus = ActivityState.ACTIVE;
      this.currentAppStartTime = new Date();
      this.currentAppStartMono = process.hrtime.bigint();
      this.notifyStateChange();
    }
  }

  public handleScreenLock(): void {
    console.log('[AgentService] Workstation locked.');
    this.flushCurrentInterval(ActivityEventType.APPLICATION_FOCUS);
    this.currentStatus = ActivityState.IDLE;
    this.notifyStateChange();
  }

  public handleScreenUnlock(): void {
    console.log('[AgentService] Workstation unlocked.');
    if (this.isWorking && !this.isOnBreak) {
      this.currentStatus = ActivityState.ACTIVE;
      this.currentAppStartTime = new Date();
      this.currentAppStartMono = process.hrtime.bigint();
      this.notifyStateChange();
    }
  }
}
