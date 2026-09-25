"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const axios_1 = __importDefault(require("axios"));
const os_1 = __importDefault(require("os"));
const uuid_1 = require("uuid");
const windowTracker_1 = require("../tracker/windowTracker");
const idleTracker_1 = require("../tracker/idleTracker");
const offlineQueue_1 = require("../queue/offlineQueue");
const shared_1 = require("@highp/shared");
class AgentService {
    windowTracker = new windowTracker_1.WindowTracker();
    idleTracker = new idleTracker_1.IdleTracker();
    offlineQueue = new offlineQueue_1.OfflineQueue();
    config = {
        apiUrl: 'http://localhost:5000',
        idleThresholdMinutes: 5,
        heartbeatIntervalSeconds: 30
    };
    token = null;
    user = null;
    company = null;
    currentSessionId;
    deviceIdentifier;
    isWorking = false;
    isOnBreak = false;
    currentStatus = shared_1.ActivityState.OFFLINE;
    currentApp = 'Desktop';
    currentProcess = 'explorer';
    currentAppStartTime = new Date();
    activeSeconds = 0;
    idleSeconds = 0;
    breakSeconds = 0;
    heartbeatTimer = null;
    trackingTimer = null;
    syncTimer = null;
    isOnline = true;
    onStateChangeCallback;
    constructor() {
        this.deviceIdentifier = `DEV-${os_1.default.hostname()}-${os_1.default.platform()}`;
    }
    setStateChangeCallback(cb) {
        this.onStateChangeCallback = cb;
    }
    getState() {
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
    notifyStateChange() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.getState());
        }
    }
    async login(apiUrl, email, password) {
        this.config.apiUrl = apiUrl.replace(/\/$/, '');
        try {
            const res = await axios_1.default.post(`${this.config.apiUrl}/api/auth/login`, { email, password });
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
        }
        catch (err) {
            console.error('[AgentService] Login error:', err);
            throw err;
        }
    }
    async logout() {
        if (this.isWorking) {
            await this.endWork();
        }
        this.stopLoops();
        this.token = null;
        this.user = null;
        this.company = null;
        this.currentStatus = shared_1.ActivityState.OFFLINE;
        this.notifyStateChange();
    }
    async registerDevice() {
        if (!this.token)
            return;
        try {
            await axios_1.default.post(`${this.config.apiUrl}/api/agent/register`, {
                deviceIdentifier: this.deviceIdentifier,
                deviceName: os_1.default.hostname(),
                osInfo: {
                    platform: os_1.default.platform(),
                    release: os_1.default.release(),
                    arch: os_1.default.arch(),
                    hostname: os_1.default.hostname()
                },
                agentVersion: '1.0.0'
            }, { headers: { Authorization: `Bearer ${this.token}` } });
            this.isOnline = true;
        }
        catch (err) {
            console.error('[AgentService] Device registration failed (will retry):', err);
        }
    }
    async startWork() {
        if (!this.token)
            throw new Error('Must be logged in to start work');
        try {
            const res = await axios_1.default.post(`${this.config.apiUrl}/api/agent/session/start`, { deviceId: this.deviceIdentifier }, { headers: { Authorization: `Bearer ${this.token}` } });
            this.currentSessionId = res.data.data._id;
            this.isWorking = true;
            this.isOnBreak = false;
            this.currentStatus = shared_1.ActivityState.ACTIVE;
            this.currentAppStartTime = new Date();
            this.notifyStateChange();
        }
        catch (err) {
            // Offline fallback: start session locally
            this.currentSessionId = `local-${(0, uuid_1.v4)()}`;
            this.isWorking = true;
            this.isOnBreak = false;
            this.currentStatus = shared_1.ActivityState.ACTIVE;
            this.currentAppStartTime = new Date();
            this.notifyStateChange();
        }
    }
    async endWork() {
        this.flushCurrentAppEvent();
        if (this.token && this.currentSessionId && !this.currentSessionId.startsWith('local-')) {
            try {
                await axios_1.default.post(`${this.config.apiUrl}/api/agent/session/end`, { sessionId: this.currentSessionId, endReason: 'Agent Stopped' }, { headers: { Authorization: `Bearer ${this.token}` } });
            }
            catch (err) {
                console.error('[AgentService] Error ending session online:', err);
            }
        }
        this.isWorking = false;
        this.isOnBreak = false;
        this.currentStatus = shared_1.ActivityState.OFFLINE;
        this.currentSessionId = undefined;
        this.notifyStateChange();
    }
    async startBreak(reason = shared_1.BreakReason.OTHER, note) {
        if (!this.isWorking)
            return;
        this.flushCurrentAppEvent();
        if (this.token) {
            try {
                await axios_1.default.post(`${this.config.apiUrl}/api/breaks/start`, { reason, note }, { headers: { Authorization: `Bearer ${this.token}` } });
            }
            catch (err) {
                console.error('[AgentService] Error starting break:', err);
            }
        }
        this.isOnBreak = true;
        this.currentStatus = shared_1.ActivityState.BREAK;
        this.notifyStateChange();
    }
    async endBreak() {
        if (!this.isOnBreak)
            return;
        if (this.token) {
            try {
                await axios_1.default.post(`${this.config.apiUrl}/api/breaks/end`, {}, { headers: { Authorization: `Bearer ${this.token}` } });
            }
            catch (err) {
                console.error('[AgentService] Error ending break:', err);
            }
        }
        this.isOnBreak = false;
        this.currentStatus = shared_1.ActivityState.ACTIVE;
        this.currentAppStartTime = new Date();
        this.notifyStateChange();
    }
    flushCurrentAppEvent() {
        if (!this.isWorking || this.isOnBreak || !this.currentSessionId)
            return;
        const now = new Date();
        const durationSeconds = Math.max(0, Math.round((now.getTime() - this.currentAppStartTime.getTime()) / 1000));
        if (durationSeconds > 0 && this.currentApp) {
            const event = {
                eventId: (0, uuid_1.v4)(),
                type: shared_1.ActivityEventType.APPLICATION_FOCUS,
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
    startLoops() {
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
    stopLoops() {
        if (this.trackingTimer)
            clearInterval(this.trackingTimer);
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        if (this.syncTimer)
            clearInterval(this.syncTimer);
    }
    async runTrackingTick() {
        if (!this.isWorking)
            return;
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
            if (this.currentStatus !== shared_1.ActivityState.IDLE) {
                this.flushCurrentAppEvent();
                this.currentStatus = shared_1.ActivityState.IDLE;
                this.notifyStateChange();
            }
            this.idleSeconds += 2;
        }
        else {
            if (this.currentStatus === shared_1.ActivityState.IDLE) {
                this.currentStatus = shared_1.ActivityState.ACTIVE;
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
    async sendHeartbeat() {
        if (!this.token || !this.isWorking)
            return;
        try {
            await axios_1.default.post(`${this.config.apiUrl}/api/agent/heartbeat`, {
                deviceId: this.deviceIdentifier,
                sessionId: this.currentSessionId,
                timestamp: new Date().toISOString(),
                status: this.currentStatus,
                currentApplication: this.currentApp,
                idleSeconds: await this.idleTracker.getSystemIdleSeconds(),
                recentDurationSeconds: this.config.heartbeatIntervalSeconds
            }, { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 });
            this.isOnline = true;
        }
        catch (err) {
            this.isOnline = false;
        }
        this.notifyStateChange();
    }
    async syncQueuedEvents() {
        if (!this.token || this.offlineQueue.size() === 0 || !this.currentSessionId)
            return;
        const batch = this.offlineQueue.peek(50);
        if (batch.length === 0)
            return;
        try {
            const res = await axios_1.default.post(`${this.config.apiUrl}/api/agent/sync`, {
                deviceId: this.deviceIdentifier,
                sessionId: this.currentSessionId,
                events: batch
            }, { headers: { Authorization: `Bearer ${this.token}` }, timeout: 10000 });
            if (res.status === 200) {
                const syncedIds = batch.map((b) => b.eventId);
                this.offlineQueue.removeEvents(syncedIds);
                this.isOnline = true;
                this.notifyStateChange();
            }
        }
        catch (err) {
            this.isOnline = false;
            this.notifyStateChange();
        }
    }
}
exports.AgentService = AgentService;
