import axios from 'axios';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { nativeBridge } from '../tracker/nativeBridge';
import { resolveApplication } from '../tracker/appResolver';
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
    apiUrl: process.env.HIGHP_API_URL || 'http://localhost:5000',
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
  private currentApp: string = 'Unknown Application';
  private currentProcess: string = 'unknown.exe';
  private currentCategory: string = 'Other';
  private currentAppStartTime: Date = new Date();
  private currentAppStartMono: bigint = process.hrtime.bigint();

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
    // Start native Win32 bridge on initialization
    nativeBridge.start();
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

  public async login(apiUrl: string, email: string, password: string): Promise<boolean> {
    this.config.apiUrl = (apiUrl || 'http://localhost:5000').replace(/\/$/, '');
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
  private flushCurrentInterval(type: ActivityEventType = ActivityEventType.APPLICATION_FOCUS): void {
    if (!this.isWorking || this.isOnBreak || !this.currentSessionId) return;

    const now = new Date();
    // Calculate elapsed time from monotonic clock to prevent clock drift / adjustments
    const elapsedNs = process.hrtime.bigint() - this.currentAppStartMono;
    const durationSeconds = Math.max(0, Math.round(Number(elapsedNs) / 1e9));

    if (durationSeconds >= 1 && this.currentApp && this.currentApp !== 'Unknown Application') {
      this.offlineQueue.enqueue(uuidv4(), type, {
        applicationName: this.currentApp,
        processName: this.currentProcess,
        windowTitleSanitized: this.currentApp,
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
  }

  private stopLoops(): void {
    if (this.trackingTimer) clearInterval(this.trackingTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  private async runTrackingTick(): Promise<void> {
    if (!this.isWorking) return;

    if (this.isOnBreak) {
      this.breakSeconds += 1;
      this.notifyStateChange();
      return;
    }

    // 1. Query Native Windows Bridge
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

      // 3. Resolve Foreground Application
      const resolved = resolveApplication(snapshot.executable);
      if (resolved.applicationName !== this.currentApp && resolved.isRecognized) {
        // Window switch detected: close previous app interval and open new one
        this.flushCurrentInterval(ActivityEventType.APPLICATION_FOCUS);
        this.currentApp = resolved.applicationName;
        this.currentProcess = resolved.processName;
        this.currentCategory = resolved.category;
        this.currentAppStartTime = new Date();
        this.currentAppStartMono = process.hrtime.bigint();
        this.notifyStateChange();
      }
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.token || !this.isWorking) return;

    try {
      const snap = nativeBridge.getSnapshot();
      await axios.post(
        `${this.config.apiUrl}/api/agent/heartbeat`,
        {
          deviceId: this.deviceIdentifier,
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString(),
          status: this.currentStatus,
          currentApplication: this.currentApp,
          idleSeconds: snap.idleSeconds,
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
