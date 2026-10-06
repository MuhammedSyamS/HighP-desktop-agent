import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { ActivityEventType } from '../../shared/enums';

export type EventQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface EventApplicationData {
  applicationId?: string;
  name: string;
  executable: string;
  executablePath?: string;
  bundleId?: string;
  desktopEntry?: string;
  pid?: number;
  hwnd?: string;
  windowId?: string;
  windowTitle?: string;
  category?: string;
}

export interface EventWebsiteData {
  browser?: string;
  windowId?: number;
  tabId?: number;
  domain?: string;
  url?: string;
  title?: string;
}

export interface DurableTrackingEvent {
  eventId: string;
  sessionId: string;
  deviceId?: string;
  sequenceNumber?: number;
  platform?: string;
  architecture?: string;
  eventType: ActivityEventType;
  timestamp: string; // UTC ISO
  monotonicTimestamp?: string;
  startedAt?: string;
  endedAt?: string;
  wallClockStart?: string;
  wallClockEnd?: string;
  monotonicStartNs?: string;
  monotonicEndNs?: string;
  durationMs?: number;
  durationSeconds: number;
  duration?: number;
  clockSource?: 'MONOTONIC' | 'WALL_CLOCK_FALLBACK';
  source?: string;
  state?: any;
  applicationId?: string;
  processId?: number;
  monotonicStart?: string;
  monotonicEnd?: string;
  metadata?: Record<string, any>;
  application?: EventApplicationData;
  process?: string;
  pid?: number;
  hwnd?: string;
  windowId?: string | number;
  website?: EventWebsiteData | null;
  browser?: string;
  tabId?: number;
  syncStatus: EventQueueStatus;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: number;
  errorMessage?: string;
}

// Backward-compatibility payload alias for existing code
export interface QueuedActivityPayload {
  applicationName: string;
  processName?: string;
  windowTitleSanitized?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  domain?: string;
}

export interface QueuedActivityItem {
  id: string;
  eventId: string;
  type: ActivityEventType;
  payload: QueuedActivityPayload;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: number;
  status: EventQueueStatus;
}

export class OfflineQueue {
  private baseDir: string;
  private filePath: string;
  private journalPath: string;
  private items: Map<string, DurableTrackingEvent> = new Map();
  private maxCapacity = 50000;

  constructor(customBaseDir?: string) {
    try {
      this.baseDir = customBaseDir || (app && app.getPath ? app.getPath('userData') : '.');
    } catch {
      this.baseDir = customBaseDir || '.';
    }

    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch {}
    }

    this.filePath = path.join(this.baseDir, 'highp-durable-events.json');
    this.journalPath = path.join(this.baseDir, 'highp-events.journal');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    // 1. Check legacy file for migration if primary doesn't exist yet
    const legacyPath = path.join(this.baseDir, 'highp-offline-events.json');
    if (!fs.existsSync(this.filePath) && fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, 'utf-8');
        const legacyItems = JSON.parse(raw);
        if (Array.isArray(legacyItems)) {
          for (const item of legacyItems) {
            const ev: DurableTrackingEvent = {
              eventId: item.eventId || item.id,
              sessionId: item.sessionId || 'legacy-session',
              eventType: item.type || ActivityEventType.APPLICATION_FOCUS,
              timestamp: item.createdAt || new Date().toISOString(),
              startedAt: item.payload?.startedAt || item.startedAt,
              endedAt: item.payload?.endedAt || item.endedAt,
              durationSeconds: item.payload?.durationSeconds ?? item.durationSeconds ?? 0,
              application: {
                name: item.payload?.applicationName || item.applicationName || 'Unknown Application',
                executable: item.payload?.processName || item.processName || 'unknown.exe',
                windowTitle: item.payload?.windowTitleSanitized || item.windowTitleSanitized
              },
              process: item.payload?.processName || item.processName,
              website: item.payload?.domain ? { domain: item.payload.domain } : undefined,
              syncStatus: 'PENDING',
              retryCount: item.attempts || 0,
              createdAt: item.createdAt || new Date().toISOString()
            };
            this.items.set(ev.eventId, ev);
          }
        }
        this.persistToDisk();
      } catch (err: any) {
        console.warn('[OfflineQueue] Legacy migration warning:', err.message);
      }
    }

    // 2. Load primary state snapshot
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            // Reset in-flight SYNCING status from interrupted sessions back to PENDING
            if (item.syncStatus === 'SYNCING') {
              item.syncStatus = 'PENDING';
            }
            item.nextRetryAt = undefined;
            this.items.set(item.eventId, item);
          }
        }
      }
    } catch (err: any) {
      console.warn('[OfflineQueue] Warning reading state snapshot, recovering from journal:', err.message);
    }

    // Clean up any stale temp files from past crashes during startup
    try {
      const files = fs.readdirSync(this.baseDir);
      for (const f of files) {
        if (f.includes('.tmp.') || f.endsWith('.tmp') || f.startsWith('events.tmp.')) {
          try { fs.unlinkSync(path.join(this.baseDir, f)); } catch {}
        }
      }
    } catch {}

    // 3. Always replay journal to catch any entries written after snapshot
    this.recoverFromJournal();
  }

  private recoverFromJournal(): void {
    if (!fs.existsSync(this.journalPath)) return;
    try {
      const raw = fs.readFileSync(this.journalPath, 'utf-8');
      const lines = raw.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed);
          if (entry.eventId && typeof entry.eventId === 'string') {
            if (entry._action === 'DELETE') {
              this.items.delete(entry.eventId);
            } else {
              if (entry.syncStatus === 'SYNCING') entry.syncStatus = 'PENDING';
              // Invariant: enforce non-negative durations
              if (typeof entry.durationSeconds === 'number' && entry.durationSeconds < 0) {
                entry.durationSeconds = 0;
              }
              if (typeof entry.durationMs === 'number' && entry.durationMs < 0) {
                entry.durationMs = 0;
              }
              this.items.set(entry.eventId, entry);
            }
          }
        } catch {
          // Gracefully skip corrupt or truncated lines from crash mid-write (Requirement 12)
        }
      }
      this.persistToDisk();
    } catch (err: any) {
      console.error('[OfflineQueue] Journal recovery failed:', err.message);
    }
  }

  private persistToDisk(): void {
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    try {
      const dataArray = Array.from(this.items.values()).filter((e) => e.syncStatus !== 'SYNCED');
      fs.writeFileSync(tempPath, JSON.stringify(dataArray, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err: any) {
      console.error('[OfflineQueue] Atomic write error:', err.message);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
    }

    // Clean up any stale temp files from past crashes
    try {
      const files = fs.readdirSync(this.baseDir);
      for (const f of files) {
        if ((f.includes('.tmp.') || f.endsWith('.tmp') || f.startsWith('events.tmp.')) && f !== path.basename(tempPath)) {
          try { fs.unlinkSync(path.join(this.baseDir, f)); } catch {}
        }
      }
    } catch {}
  }

  private appendJournal(event: DurableTrackingEvent, action: 'UPSERT' | 'DELETE'): void {
    try {
      const line = JSON.stringify({ ...event, _action: action }) + '\n';
      fs.appendFileSync(this.journalPath, line, 'utf-8');
    } catch {}
  }

  /**
   * Enqueue a full event conforming to the required event model
   */
  public enqueueEvent(event: Omit<DurableTrackingEvent, 'syncStatus' | 'retryCount' | 'createdAt'>): void {
    if (this.items.has(event.eventId)) {
      // Invariant: Duplicate event IDs are rejected idempotently
      return;
    }

    if (this.items.size >= this.maxCapacity) {
      console.warn(`[SYNC] STORAGE_CAPACITY_WARNING: Offline queue reached ${this.items.size} events. No silent deletion.`);
    }

    const fullEvent: DurableTrackingEvent = {
      ...event,
      syncStatus: 'PENDING',
      retryCount: 0,
      createdAt: new Date().toISOString()
    };

    this.items.set(fullEvent.eventId, fullEvent);
    this.appendJournal(fullEvent, 'UPSERT');
    this.persistToDisk();
  }

  /**
   * Backward-compatible enqueue method
   */
  public enqueue(
    eventId: string,
    type: ActivityEventType,
    payload: QueuedActivityPayload,
    sessionId = 'unknown-session'
  ): void {
    this.enqueueEvent({
      eventId,
      sessionId,
      eventType: type,
      timestamp: payload.startedAt || new Date().toISOString(),
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      durationSeconds: payload.durationSeconds,
      application: {
        name: payload.applicationName,
        executable: payload.processName || 'unknown.exe',
        windowTitle: payload.windowTitleSanitized
      },
      process: payload.processName,
      website: payload.domain ? { domain: payload.domain } : undefined
    });
  }

  /**
   * Fetch ready batch of events for upload
   */
  public getPendingBatch(batchSize = 50): DurableTrackingEvent[] {
    const now = Date.now();
    const readyItems: DurableTrackingEvent[] = [];

    for (const item of this.items.values()) {
      if (item.syncStatus === 'SYNCED') continue;

      // Auto-recover stale in-flight SYNCING items if interrupted or timed out (> 45s)
      if (item.syncStatus === 'SYNCING') {
        const attemptAge = item.lastAttemptAt ? now - new Date(item.lastAttemptAt).getTime() : Infinity;
        if (attemptAge > 45000) {
          item.syncStatus = 'PENDING';
        } else {
          continue;
        }
      }

      if (item.nextRetryAt && now < item.nextRetryAt) continue;

      readyItems.push(item);
      if (readyItems.length >= batchSize) break;
    }

    for (const item of readyItems) {
      item.syncStatus = 'SYNCING';
      item.retryCount += 1;
      item.lastAttemptAt = new Date().toISOString();
    }

    if (readyItems.length > 0) {
      this.persistToDisk();
    }

    return readyItems;
  }

  /**
   * Mark confirmed event IDs as SYNCED (idempotent; safe against duplicates)
   */
  public markSynced(eventIds: string[]): void {
    if (!eventIds || eventIds.length === 0) return;
    for (const id of eventIds) {
      const item = this.items.get(id);
      if (item) {
        item.syncStatus = 'SYNCED';
        this.appendJournal(item, 'DELETE');
        this.items.delete(id);
      }
    }
    this.persistToDisk();
  }

  /**
   * Mark events that failed with exponential backoff
   */
  public markFailed(eventIds: string[], errorMessage?: string): void {
    if (!eventIds || eventIds.length === 0) return;
    const now = Date.now();
    for (const id of eventIds) {
      const item = this.items.get(id);
      if (item) {
        item.syncStatus = 'PENDING';
        item.errorMessage = errorMessage;
        // Exponential backoff: 3s, 6s, 12s, 24s, 48s, max 5 minutes (300s)
        const delayMs = Math.min(300000, 3000 * Math.pow(2, Math.min(6, item.retryCount)));
        item.nextRetryAt = now + delayMs;
      }
    }
    this.persistToDisk();
  }

  public size(): number {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.syncStatus !== 'SYNCED') count++;
    }
    return count;
  }

  public getAllPending(): DurableTrackingEvent[] {
    return Array.from(this.items.values()).filter((e) => e.syncStatus !== 'SYNCED');
  }

  public clear(): void {
    this.items.clear();
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
      if (fs.existsSync(this.journalPath)) fs.unlinkSync(this.journalPath);
    } catch {}
  }
}
