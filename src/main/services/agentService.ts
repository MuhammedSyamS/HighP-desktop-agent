import axios from 'axios';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  TrackedApplicationEntry,
  DEFAULT_REGISTRY_ENTRIES,
  mergeRegistries
} from '../tracker/appResolver';
import { OfflineQueue, DurableTrackingEvent } from '../queue/offlineQueue';
import { ActivityState, ActivityEventType, BreakReason } from '../../shared/enums';
import { browserBridge, ActiveWebsiteInfo } from '../browser/browserBridge';
import { TrackingEngine, TrackingEngineHealth } from '../tracker/trackingEngine';
import {
  ITelemetryProvider,
  PlatformCapabilities,
  PlatformPermissions,
  NormalizedTelemetryObservation
} from '../tracker/telemetryProvider';
import { createTelemetryProvider } from '../tracker/providers/telemetryProviderFactory';

export interface AgentConfig {
  apiUrl: string;
  idleThresholdMinutes: number;
  heartbeatIntervalSeconds: number;
  debugLogging: boolean;
}

export interface CurrentApplicationInfo {
  name: string;
  executableName: string;
  executablePath: string;
  category: string;
  trackingState: 'TRACKED' | 'IGNORED' | 'UNKNOWN';
  processId: number;
  hwnd?: string | number;
  windowTitle?: string;
  startedAt: string;
  lastSeenAt: string;
}

export interface AgentState {
  isLoggedIn: boolean;
  isWorking: boolean;
  isOnBreak: boolean;
  currentStatus: ActivityState;
  currentApplication: string;
  currentApplicationInfo?: CurrentApplicationInfo | null;
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
  currentWebsite?: { domain: string } | null;
  health?: TrackingEngineHealth;
  platform?: string;
  architecture?: string;
  capabilities?: PlatformCapabilities;
  permissions?: PlatformPermissions;
}

export class AgentService {
  private offlineQueue = new OfflineQueue();
  private trackingEngine: TrackingEngine;

  private config: AgentConfig = {
    apiUrl: process.env.HIGHP_API_URL || 'https://highp-agent-backend.onrender.com',
    idleThresholdMinutes: 1,
    heartbeatIntervalSeconds: 15,
    debugLogging: true
  };

  private token: string | null = null;
  private user: any = null;
  private company: any = null;
  private currentSessionId?: string;
  private deviceIdentifier: string;

  private isWorking = false;
  private isOnBreak = false;

  // Visual display counters (derived and synchronized)
  private activeSeconds = 0;
  private idleSeconds = 0;
  private breakSeconds = 0;

  // Application registry
  private dynamicRegistry: TrackedApplicationEntry[] = [];
  private registryVersion = 0;
  private registryFilePath: string;
  private crashRecoveryFilePath: string;
  private reportedUnknownExes: Set<string> = new Set();
  private registrySyncTimer: NodeJS.Timeout | null = null;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private trackingTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;

  private isOnline = true;
  private lastHeartbeatTime?: string;
  private lastSyncTime?: string;
  private telemetryError?: string;

  private onStateChangeCallback?: (state: AgentState) => void;

  private telemetryProvider: ITelemetryProvider;

  constructor() {
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
    this.crashRecoveryFilePath = path.join(baseDir, 'highp-crash-recovery.json');

    // 1. Stable, persistent Device Identity across restarts (Requirement 8)
    const idFile = path.join(baseDir, 'highp-device-identity.json');
    if (fs.existsSync(idFile)) {
      try {
        const idData = JSON.parse(fs.readFileSync(idFile, 'utf-8'));
        this.deviceIdentifier = idData.deviceId || `device-${uuidv4()}`;
      } catch {
        this.deviceIdentifier = `device-${uuidv4()}`;
      }
    } else {
      this.deviceIdentifier = `device-${uuidv4()}`;
      try {
        fs.writeFileSync(idFile, JSON.stringify({ deviceId: this.deviceIdentifier, createdAt: new Date().toISOString() }));
      } catch {}
    }

    // 2. Cross-platform telemetry provider
    this.telemetryProvider = createTelemetryProvider();

    this.trackingEngine = new TrackingEngine(this.offlineQueue);
    this.trackingEngine.setDeviceId(this.deviceIdentifier);
    this.trackingEngine.setPlatformInfo(this.telemetryProvider.platform, this.telemetryProvider.architecture);

    this.loadRegistryFromDisk();
    this.recoverPreviousCrashInterval();

    // Hook trackingEngine to state changes
    this.trackingEngine.setOnStateChange((_state, _app, _domain) => {
      this.saveCrashRecoveryCheckpoint();
      this.notifyStateChange();
    });

    // Wire up event-driven cross-platform observations
    this.telemetryProvider.setOnObservation((obs) => {
      this.trackingEngine.processObservation(obs);
    });

    // Wire up event-driven Browser extension observations
    browserBridge.setOnWebsiteEvent((report) => {
      this.trackingEngine.processBrowserObservation(report);
    });

    // Start native provider and browser extension bridge
    this.telemetryProvider.start().catch((err: any) => {
      console.warn('[AgentService] Telemetry provider start warning:', err.message);
    });
    browserBridge.start();
  }

  private loadRegistryFromDisk(): void {
    try {
      if (fs.existsSync(this.registryFilePath)) {
        const raw = fs.readFileSync(this.registryFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.applications)) {
          this.registryVersion = parsed.version || 0;
          this.dynamicRegistry = mergeRegistries(DEFAULT_REGISTRY_ENTRIES, parsed.applications);
          this.trackingEngine.setDynamicRegistry(this.dynamicRegistry);
          return;
        }
      }
    } catch {}
    this.dynamicRegistry = [...DEFAULT_REGISTRY_ENTRIES];
    this.trackingEngine.setDynamicRegistry(this.dynamicRegistry);
  }

  private saveRegistryToDisk(): void {
    try {
      const payload = {
        version: this.registryVersion,
        applications: this.dynamicRegistry
      };
      fs.writeFileSync(this.registryFilePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {}
  }

  public async syncApplicationRegistry(): Promise<void> {
    if (!this.token) return;
    try {
      const res = await axios.get(`${this.config.apiUrl}/api/agent/applications/config?version=${this.registryVersion}`, {
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 5000
      });
      if (res.data?.data) {
        if (res.data.data.upToDate) return;
        if (Array.isArray(res.data.data.applications)) {
          this.registryVersion = res.data.data.version || Date.now();
          this.dynamicRegistry = mergeRegistries(DEFAULT_REGISTRY_ENTRIES, res.data.data.applications);
          this.trackingEngine.setDynamicRegistry(this.dynamicRegistry);
          this.saveRegistryToDisk();
        }
      }
    } catch {}
  }

  private recoverPreviousCrashInterval(): void {
    try {
      if (fs.existsSync(this.crashRecoveryFilePath)) {
        const raw = fs.readFileSync(this.crashRecoveryFilePath, 'utf-8');
        const record = JSON.parse(raw);
        if (record && record.sessionId && record.startedAt) {
          const startTime = new Date(record.startedAt).getTime();
          const checkpointTime = record.lastCheckpointAt ? new Date(record.lastCheckpointAt).getTime() : startTime;
          const recoveredSec = Math.max(0, Math.min(86400, Math.round((checkpointTime - startTime) / 1000)));

          if (recoveredSec > 0 && record.applicationName) {
            this.offlineQueue.enqueueEvent({
              eventId: record.appFocusEventId || uuidv4(),
              sessionId: record.sessionId,
              deviceId: this.deviceIdentifier,
              eventType: ActivityEventType.APP_FOCUS_END,
              timestamp: new Date(checkpointTime).toISOString(),
              startedAt: record.startedAt,
              endedAt: new Date(checkpointTime).toISOString(),
              wallClockStart: record.startedAt,
              wallClockEnd: new Date(checkpointTime).toISOString(),
              durationMs: recoveredSec * 1000,
              durationSeconds: recoveredSec,
              clockSource: 'WALL_CLOCK_FALLBACK',
              application: {
                name: record.applicationName,
                executable: record.processName,
                executablePath: record.executablePath,
                pid: record.pid,
                hwnd: record.hwnd,
                windowTitle: record.windowTitle,
                category: record.category
              },
              process: record.processName,
              pid: record.pid,
              hwnd: record.hwnd
            });
          }

          if (record.domain && recoveredSec > 0) {
            this.offlineQueue.enqueueEvent({
              eventId: record.websiteFocusEventId || uuidv4(),
              sessionId: record.sessionId,
              deviceId: this.deviceIdentifier,
              eventType: ActivityEventType.WEBSITE_FOCUS_END,
              timestamp: new Date(checkpointTime).toISOString(),
              startedAt: record.startedAt,
              endedAt: new Date(checkpointTime).toISOString(),
              wallClockStart: record.startedAt,
              wallClockEnd: new Date(checkpointTime).toISOString(),
              durationMs: recoveredSec * 1000,
              durationSeconds: recoveredSec,
              clockSource: 'WALL_CLOCK_FALLBACK',
              website: {
                domain: record.domain,
                browser: record.applicationName
              }
            });
          }

          // Explicitly close old crashed session (Requirement 11)
          this.offlineQueue.enqueueEvent({
            eventId: `recovery-sess-end-${record.sessionId}`,
            sessionId: record.sessionId,
            deviceId: this.deviceIdentifier,
            eventType: ActivityEventType.SESSION_END,
            timestamp: new Date(checkpointTime).toISOString(),
            startedAt: record.startedAt,
            endedAt: new Date(checkpointTime).toISOString(),
            durationSeconds: 0,
            durationMs: 0,
            clockSource: 'WALL_CLOCK_FALLBACK'
          });
        }
        fs.unlinkSync(this.crashRecoveryFilePath);
      }
    } catch {
      try {
        if (fs.existsSync(this.crashRecoveryFilePath)) fs.unlinkSync(this.crashRecoveryFilePath);
      } catch {}
    }
  }

  private saveCrashRecoveryCheckpoint(): void {
    if (!this.isWorking || !this.currentSessionId || this.trackingEngine.getCurrentState() !== ActivityState.ACTIVE) {
      try {
        if (fs.existsSync(this.crashRecoveryFilePath)) fs.unlinkSync(this.crashRecoveryFilePath);
      } catch {}
      return;
    }

    try {
      const currentApp = this.trackingEngine.getCurrentApp();
      const currentWeb = this.trackingEngine.getCurrentWebsite();
      if (!currentApp) return;

      const record = {
        sessionId: this.currentSessionId,
        agentInstanceId: this.trackingEngine.getAgentInstanceId(),
        appFocusEventId: currentApp.eventId,
        websiteFocusEventId: currentWeb?.eventId,
        applicationName: currentApp.name,
        processName: currentApp.executable,
        executablePath: currentApp.executablePath,
        pid: currentApp.pid,
        hwnd: currentApp.hwnd,
        windowTitle: currentApp.windowTitle,
        category: currentApp.category,
        domain: currentWeb?.domain,
        startedAt: currentApp.startedAt.toISOString(),
        lastCheckpointAt: new Date().toISOString()
      };
      const tempPath = `${this.crashRecoveryFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(record, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.crashRecoveryFilePath);
    } catch {}
  }

  public setStateChangeCallback(cb: (state: AgentState) => void): void {
    this.onStateChangeCallback = cb;
  }

  public getState(): AgentState {
    const currentApp = this.trackingEngine.getCurrentApp();
    const currentWeb = this.trackingEngine.getCurrentWebsite();
    const currentState = this.trackingEngine.getCurrentState();

    const appInfo: CurrentApplicationInfo | null = currentApp ? {
      name: currentApp.name,
      executableName: currentApp.executable,
      executablePath: currentApp.executablePath || '',
      category: currentApp.category,
      trackingState: currentApp.trackingState,
      processId: currentApp.pid,
      hwnd: currentApp.hwnd,
      windowTitle: currentApp.windowTitle,
      startedAt: currentApp.startedAt.toISOString(),
      lastSeenAt: new Date().toISOString()
    } : null;

    return {
      isLoggedIn: !!this.token,
      isWorking: this.isWorking,
      isOnBreak: this.isOnBreak,
      currentStatus: currentState,
      currentApplication: currentApp?.name || (currentState === ActivityState.IDLE ? 'System Idle' : 'None'),
      currentApplicationInfo: appInfo,
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
      telemetryError: this.telemetryError,
      currentWebsite: currentWeb ? { domain: currentWeb.domain } : null,
      health: this.trackingEngine.getHealth(),
      platform: this.telemetryProvider.platform,
      architecture: this.telemetryProvider.architecture,
      capabilities: this.telemetryProvider.getCapabilities(),
      permissions: this.telemetryProvider.getPermissions()
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
            this.trackingEngine.setIdleThreshold(this.config.idleThresholdMinutes * 60);
          }
          if (this.company.config.heartbeatIntervalSeconds) {
            this.config.heartbeatIntervalSeconds = this.company.config.heartbeatIntervalSeconds;
          }
        }

        await this.registerDevice();
        await this.syncApplicationRegistry();

        try {
          const sessRes = await axios.get(`${this.config.apiUrl}/api/agent/session/current`, {
            headers: { Authorization: `Bearer ${this.token}` }
          });
          if (sessRes.data?.data && sessRes.data.data.status === 'ACTIVE') {
            this.currentSessionId = sessRes.data.data._id;
            this.isWorking = true;
            this.isOnBreak = false;
            this.activeSeconds = sessRes.data.data.activeSeconds || 0;
            this.idleSeconds = sessRes.data.data.idleSeconds || 0;
            this.breakSeconds = sessRes.data.data.breakSeconds || 0;
            this.trackingEngine.startSession(this.currentSessionId!, this.deviceIdentifier);
          }
        } catch {}

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
    this.stopLoops();
    this.token = null;
    this.user = null;
    this.company = null;
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
          platform: this.telemetryProvider.platform,
          architecture: this.telemetryProvider.architecture,
          osInfo: {
            platform: this.telemetryProvider.platform,
            release: os.release(),
            arch: this.telemetryProvider.architecture,
            hostname: os.hostname()
          },
          capabilities: this.telemetryProvider.getCapabilities(),
          permissions: this.telemetryProvider.getPermissions(),
          agentVersion: '2.0.0'
        },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      this.isOnline = true;
    } catch {}
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
      this.activeSeconds = res.data.data?.activeSeconds || 0;
      this.idleSeconds = res.data.data?.idleSeconds || 0;
      this.breakSeconds = res.data.data?.breakSeconds || 0;
    } catch {
      this.currentSessionId = `local-${uuidv4()}`;
      this.isWorking = true;
      this.isOnBreak = false;
      this.activeSeconds = 0;
      this.idleSeconds = 0;
      this.breakSeconds = 0;
    }

    this.trackingEngine.startSession(this.currentSessionId!, this.deviceIdentifier);
    this.saveCrashRecoveryCheckpoint();
    this.notifyStateChange();
  }

  public async endWork(): Promise<void> {
    const endingSessionId = this.currentSessionId;
    if (!endingSessionId) return;

    this.trackingEngine.endSession();

    if (this.token && !endingSessionId.startsWith('local-')) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/agent/session/end`,
          { sessionId: endingSessionId, endReason: 'Agent Stopped' },
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch {}
    }

    this.isWorking = false;
    this.isOnBreak = false;
    this.currentSessionId = undefined;
    this.activeSeconds = 0;
    this.idleSeconds = 0;
    this.breakSeconds = 0;

    try {
      if (fs.existsSync(this.crashRecoveryFilePath)) fs.unlinkSync(this.crashRecoveryFilePath);
    } catch {}

    this.notifyStateChange();
    await this.syncQueuedEvents();
  }

  public async startBreak(reason: BreakReason | string = BreakReason.OTHER, note?: string): Promise<void> {
    if (!this.isWorking) return;
    this.trackingEngine.startBreak();

    if (this.token) {
      try {
        await axios.post(
          `${this.config.apiUrl}/api/breaks/start`,
          { reason, note },
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
      } catch {}
    }

    this.isOnBreak = true;
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
      } catch {}
    }

    this.isOnBreak = false;
    this.trackingEngine.endBreak();
    this.notifyStateChange();
  }

  private startLoops(): void {
    this.stopLoops();

    // 1. Authoritative 1-second fallback/health tick
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

    browserBridge.start();
  }

  private stopLoops(): void {
    if (this.trackingTimer) clearInterval(this.trackingTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.registrySyncTimer) clearInterval(this.registrySyncTimer);
    browserBridge.stop();
  }

  private async runTrackingTick(): Promise<void> {
    if (!this.isWorking) return;

    if (this.isOnBreak) {
      this.breakSeconds += 1;
      this.notifyStateChange();
      return;
    }

    // Query cross-platform telemetry provider
    try {
      const obs = await this.telemetryProvider.queryDirect();
      this.telemetryError = undefined;

      // Send observation to Authoritative Tracking Engine
      this.trackingEngine.processObservation(obs);
    } catch (err: any) {
      this.telemetryError = err.message || 'Telemetry provider error';
      this.notifyStateChange();
      return;
    }

    // Increment visual display counters based on authoritative state
    const currentState = this.trackingEngine.getCurrentState();
    if (currentState === ActivityState.ACTIVE) {
      this.activeSeconds += 1;
    } else if (currentState === ActivityState.IDLE) {
      this.idleSeconds += 1;
    }

    this.notifyStateChange();
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.token || !this.isWorking) return;

    try {
      const currentApp = this.trackingEngine.getCurrentApp();
      const currentWeb = this.trackingEngine.getCurrentWebsite();
      const currentState = this.trackingEngine.getCurrentState();
      const isIdleNow = currentState === ActivityState.IDLE;
      const lastIdleSec = this.trackingEngine.getLastObservedIdleSeconds();

      const cleanApp = (!isIdleNow && currentApp) ? currentApp.name : '';
      const focusDurSec = (!isIdleNow && currentApp)
        ? Math.max(0, Math.floor((Date.now() - currentApp.startedAt.getTime()) / 1000))
        : 0;

      const res = await axios.post(
        `${this.config.apiUrl}/api/agent/heartbeat`,
        {
          deviceId: this.deviceIdentifier,
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString(),
          status: currentState,
          currentApplication: cleanApp,
          executable: currentApp?.executable || '',
          category: currentApp?.category || 'Other',
          trackingState: currentApp?.trackingState || 'IGNORED',
          pid: currentApp?.pid || null,
          hwnd: currentApp?.hwnd ? (isNaN(Number(currentApp.hwnd)) ? null : parseInt(currentApp.hwnd, 10)) : null,
          startedAt: currentApp?.startedAt.toISOString() || null,
          activeDurationSeconds: focusDurSec,
          totalActiveSeconds: this.activeSeconds,
          totalIdleSeconds: this.idleSeconds,
          idleSeconds: lastIdleSec,
          windowTitle: isIdleNow ? 'System Idle' : (currentApp?.windowTitle || cleanApp),
          website: currentWeb ? { domain: currentWeb.domain } : null,
          recentDurationSeconds: this.config.heartbeatIntervalSeconds
        },
        { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 }
      );

      if (res.data?.sessionEnded || res.data?.status === 'OFFLINE') {
        this.trackingEngine.endSession();
        this.isWorking = false;
        this.isOnBreak = false;
        this.currentSessionId = undefined;
        this.activeSeconds = 0;
        this.idleSeconds = 0;
        this.breakSeconds = 0;
        this.notifyStateChange();
        return;
      }

      this.isOnline = true;
      this.lastHeartbeatTime = new Date().toLocaleTimeString();
    } catch (err: any) {
      this.isOnline = false;
      if (err.response?.status === 403) {
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
      type: item.eventType,
      sequenceNumber: item.sequenceNumber,
      applicationName: item.application?.name || item.process || 'Unknown Application',
      processName: item.process || item.application?.executable || 'unknown.exe',
      windowTitleSanitized: item.application?.windowTitle || item.application?.name || '',
      domain: item.website?.domain || undefined,
      startedAt: item.startedAt || item.timestamp,
      endedAt: item.endedAt || item.timestamp,
      wallClockStart: item.wallClockStart || item.startedAt || item.timestamp,
      wallClockEnd: item.wallClockEnd || item.endedAt || item.timestamp,
      durationMs: item.durationMs ?? (item.durationSeconds ? item.durationSeconds * 1000 : 0),
      durationSeconds: item.durationSeconds || 0,
      clockSource: item.clockSource || 'MONOTONIC',
      sessionId: item.sessionId,
      deviceId: item.deviceId || this.deviceIdentifier,
      pid: item.pid,
      hwnd: item.hwnd,
      browser: item.browser || item.website?.browser,
      windowId: item.windowId || item.website?.windowId,
      tabId: item.tabId || item.website?.tabId
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
        const accepted: string[] = res.data.data.accepted || [];
        const duplicates: string[] = res.data.data.duplicates || [];
        const confirmedIds = [...accepted, ...duplicates];

        this.offlineQueue.markSynced(confirmedIds);

        // Handle partial batch failures safely
        const failed: any[] = res.data.data.failed || [];
        if (failed.length > 0) {
          const failedIds = failed.map((f: any) => f.eventId);
          this.offlineQueue.markFailed(failedIds);
        }

        this.isOnline = true;
        this.lastSyncTime = new Date().toLocaleTimeString();
        this.trackingEngine.markSyncedAt(new Date().toISOString());
        this.notifyStateChange();
      }
    } catch (err: any) {
      this.isOnline = false;
      const allBatchIds = batch.map((b) => b.eventId);
      this.offlineQueue.markFailed(allBatchIds, err.message);
      this.notifyStateChange();
    }
  }

  // Windows PowerMonitor Handlers
  public handleScreenLock(): void {
    this.trackingEngine.handleScreenLock();
    this.notifyStateChange();
  }

  public handleScreenUnlock(): void {
    this.trackingEngine.handleScreenUnlock();
    this.notifyStateChange();
  }

  public handleSystemSleep(): void {
    this.trackingEngine.handleSystemSleep();
    this.notifyStateChange();
  }

  public handleSystemResume(): void {
    this.trackingEngine.handleSystemResume();
    this.notifyStateChange();
  }

  public handleAppShutdown(): void {
    if (this.isWorking && this.currentSessionId) {
      this.saveCrashRecoveryCheckpoint();
      this.trackingEngine.endSession();
    }
  }
}
