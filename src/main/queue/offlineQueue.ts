import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { ActivityEventType } from '../../shared/enums';

export type EventQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface QueuedActivityPayload {
  applicationName: string;
  processName?: string;
  windowTitleSanitized?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
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
  private filePath: string;
  private items: QueuedActivityItem[] = [];

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

    this.filePath = path.join(baseDir, 'highp-offline-events.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Reset any in-flight 'SYNCING' items from a previous process crash back to 'PENDING'
          this.items = parsed.map((item) => {
            if (item.status === 'SYNCING') {
              return { ...item, status: 'PENDING' };
            }
            // Migrate legacy format if needed
            if (!item.payload && item.applicationName) {
              return {
                id: item.eventId,
                eventId: item.eventId,
                type: item.type,
                payload: {
                  applicationName: item.applicationName,
                  processName: item.processName,
                  windowTitleSanitized: item.windowTitleSanitized,
                  startedAt: item.startedAt,
                  endedAt: item.endedAt,
                  durationSeconds: item.durationSeconds
                },
                createdAt: item.startedAt || new Date().toISOString(),
                attempts: 0,
                status: 'PENDING'
              };
            }
            return item;
          });
        }
      }
    } catch (err) {
      console.error('[OfflineQueue] Error loading queue from disk:', err);
      this.items = [];
    }
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[OfflineQueue] Error saving queue to disk:', err);
    }
  }

  public enqueue(
    eventId: string,
    type: ActivityEventType,
    payload: QueuedActivityPayload
  ): void {
    // Avoid unbounded queue growth: limit to 10,000 events
    if (this.items.length >= 10000) {
      this.items.shift();
    }

    const newItem: QueuedActivityItem = {
      id: eventId,
      eventId,
      type,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING'
    };

    this.items.push(newItem);
    this.saveToDisk();
  }

  public getPendingBatch(batchSize = 50): QueuedActivityItem[] {
    const now = Date.now();
    const readyItems = this.items.filter((item) => {
      if (item.status === 'SYNCED') return false;
      if (item.status === 'SYNCING') return false;
      if (item.nextRetryAt && now < item.nextRetryAt) return false;
      return true;
    });

    const batch = readyItems.slice(0, batchSize);
    for (const item of batch) {
      item.status = 'SYNCING';
      item.attempts += 1;
      item.lastAttemptAt = new Date().toISOString();
    }
    this.saveToDisk();
    return batch;
  }

  public markSynced(eventIds: string[]): void {
    const idSet = new Set(eventIds);
    // Remove confirmed synced items from disk queue
    this.items = this.items.filter((item) => !idSet.has(item.eventId));
    this.saveToDisk();
  }

  public markFailed(eventIds: string[], errorMessage?: string): void {
    const idSet = new Set(eventIds);
    const now = Date.now();

    for (const item of this.items) {
      if (idSet.has(item.eventId)) {
        item.status = 'PENDING';
        // Exponential backoff: 5s, 10s, 20s, 40s, 80s, max 5 minutes (300s)
        const delayMs = Math.min(300000, 5000 * Math.pow(2, Math.min(6, item.attempts)));
        item.nextRetryAt = now + delayMs;
      }
    }
    this.saveToDisk();
  }

  public size(): number {
    return this.items.filter((i) => i.status !== 'SYNCED').length;
  }

  public clear(): void {
    this.items = [];
    this.saveToDisk();
  }
}
