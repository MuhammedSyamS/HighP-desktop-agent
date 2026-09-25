import axios from 'axios';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { WindowTracker, ActiveWindowInfo } from '../tracker/windowTracker';
import { IdleTracker } from '../tracker/idleTracker';
import { OfflineQueue, QueuedActivityEvent } from '../queue/offlineQueue';
import { ActivityState, ActivityEventType, BreakReason } from '@highp/shared';

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
}

export class AgentService {
  private windowTracker = new WindowTracker();
  private idleTracker = new IdleTracker();
  private offlineQueue = new OfflineQueue();

  private config: AgentConfig = {
    apiUrl: 'http://localhost:5000',
    idleThresholdMinutes: 5,
    heartbeatIntervalSeconds: 30
  };

  private token: string | null = null;
  private user: any = null;
  private company: any = null;
  private currentSessionId?: string;
  private deviceIdentifier: string;

  private isWorking = false;
  private isOnBreak = false;
  private currentStatus: ActivityState = ActivityState.OFFLINE;
  private currentApp: string = 'Desktop';
  private currentProcess: string = 'explorer';
  private currentAppStartTime: Date = new Date();

  private activeSeconds = 0;
  private idleSeconds = 0;
  private breakSeconds = 0;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private trackingTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isOnline = true;

  private onStateChangeCallback?: (state: AgentState) => void;

  constructor() {
    this.deviceIdentifier = `DEV-${os.hostname()}-${os.platform()}`;
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
      queuedEventsCount: this.offlineQueue.size()
    };
  }

  private notifyStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState());
    }
  }

  public async login(apiUrl: string, email: string, password: string): Promise<boolean> {
    this.config.apiUrl = apiUrl.replace(/\/$/, '');
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
    } catch (err) {
      console.error('[AgentService] Login error:', err);
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
    } catch (err) {
      console.error('[AgentService] Device registration failed (will retry):', err);
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
      this.notifyStateChange();
    } catch (err) {
      // Offline fallback: start session locally
      this.currentSessionId = `local-${uuidv4()}`;
      this.isWorking = true;
      this.isOnBreak = false;
      this.currentStatus = ActivityState.ACTIVE;
      this.currentAppStartTime = new Date();
      this.notifyStateChange();
    }
  }

  public async endWork(): Promise<void> {
    this.flushCurrentAppEvent();

    if (this.token && this.currentSessionId && !this.currentSessionId.startsWith('local-')) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/agent/session/end`,
          { sessionId: this.currentSessionId, endReason: 'Agent Stopped' },
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch (err) {
        console.error('[AgentService] Error ending session online:', err);
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
    this.flushCurrentAppEvent();

    if (this.token) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/breaks/start`,
          { reason, note },
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch (err) {
        console.error('[AgentService] Error starting break:', err);
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
      } catch (err) {
        console.error('[AgentService] Error ending break:', err);
      }
    }

    this.isOnBreak = false;
    this.currentStatus = ActivityState.ACTIVE;
    this.currentAppStartTime = new Date();
    this.notifyStateChange();
  }

  private flushCurrentAppEvent(): void {
    if (!this.isWorking || this.isOnBreak || !this.currentSessionId) return;

    const now = new Date();
    const durationSeconds = Math.max(0, Math.round((now.getTime() - this.currentAppStartTime.getTime()) / 1000));

    if (durationSeconds > 0 && this.currentApp) {
      const event: QueuedActivityEvent = {
        eventId: uuidv4(),
        type: ActivityEventType.APPLICATION_FOCUS,
        applicationName: this.currentApp,
        processName: this.currentProcess,
        startedAt: this.currentAppStartTime.toISOString(),
        endedAt: now.toISOString(),
        durationSeconds
      };

      this.offlineQueue.enqueue(event);
      this.currentAppStartTime = now;
    }
  }

  private startLoops(): void {
    this.stopLoops();

    // 1. High-frequency tracking loop (every 2 seconds)
    this.trackingTimer = setInterval(async () => {
      await this.runTrackingTick();
    }, 2000);

    // 2. Heartbeat loop (every 15-30 seconds)
    const hbIntervalMs = (this.config.heartbeatIntervalSeconds || 30) * 1000;
    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, hbIntervalMs);

    // 3. Offline queue sync loop (every 10 seconds)
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
      this.breakSeconds += 2;
      this.notifyStateChange();
      return;
    }

    // 1. Check Idle Status
    const sysIdleSec = await this.idleTracker.getSystemIdleSeconds();
    const idleThresholdSec = this.config.idleThresholdMinutes * 60;

    const isSystemIdle = sysIdleSec >= idleThresholdSec;

    if (isSystemIdle) {
      if (this.currentStatus !== ActivityState.IDLE) {
        this.flushCurrentAppEvent();
        this.currentStatus = ActivityState.IDLE;
        this.notifyStateChange();
      }
      this.idleSeconds += 2;
    } else {
      if (this.currentStatus === ActivityState.IDLE) {
        this.currentStatus = ActivityState.ACTIVE;
        this.currentAppStartTime = new Date();
        this.notifyStateChange();
      }
      this.activeSeconds += 2;

      // 2. Check Foreground Window
      const winInfo = await this.windowTracker.getActiveWindow();
      if (winInfo.applicationName !== this.currentApp) {
        // App switch detected! Flush previous app event
        this.flushCurrentAppEvent();
        this.currentApp = winInfo.applicationName;
        this.currentProcess = winInfo.processName;
        this.currentAppStartTime = new Date();
        this.notifyStateChange();
      }
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.token || !this.isWorking) return;

    try {
      await axios.post(
        `${this.config.apiUrl}/api/agent/heartbeat`,
        {
          deviceId: this.deviceIdentifier,
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString(),
          status: this.currentStatus,
          currentApplication: this.currentApp,
          idleSeconds: await this.idleTracker.getSystemIdleSeconds(),
          recentDurationSeconds: this.config.heartbeatIntervalSeconds
        },
        { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 }
      );

      this.isOnline = true;
    } catch (err) {
      this.isOnline = false;
    }
    this.notifyStateChange();
  }

  private async syncQueuedEvents(): Promise<void> {
    if (!this.token || this.offlineQueue.size() === 0 || !this.currentSessionId) return;

    const batch = this.offlineQueue.peek(50);
    if (batch.length === 0) return;

    try {
      const res = await axios.post(
        `${this.config.apiUrl}/api/agent/sync`,
        {
          deviceId: this.deviceIdentifier,
          sessionId: this.currentSessionId,
          events: batch
        },
        { headers: { Authorization: `Bearer ${this.token}` }, timeout: 10000 }
      );

      if (res.status === 200) {
        const syncedIds = batch.map((b) => b.eventId);
        this.offlineQueue.removeEvents(syncedIds);
        this.isOnline = true;
        this.notifyStateChange();
      }
    } catch (err) {
      this.isOnline = false;
      this.notifyStateChange();
    }
  }
}
