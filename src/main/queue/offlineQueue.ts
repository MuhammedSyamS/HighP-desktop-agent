import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { ActivityEventType } from '../../shared/enums';

export interface QueuedActivityEvent {
  eventId: string;
  type: ActivityEventType;
  applicationName: string;
  processName?: string;
  windowTitleSanitized?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export class OfflineQueue {
  private filePath: string;
  private queue: QueuedActivityEvent[] = [];

  constructor() {
    let baseDir = '.';
    try {
      if (app && app.getPath) {
        baseDir = app.getPath('userData');
      }
    } catch {
      baseDir = '.';
    }

    this.filePath = path.join(baseDir, 'highp-offline-events.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.queue = JSON.parse(raw);
        if (!Array.isArray(this.queue)) {
          this.queue = [];
        }
      }
    } catch (err) {
      console.error('[OfflineQueue] Error loading offline queue from disk:', err);
      this.queue = [];
    }
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2), 'utf-8');
    } catch (err) {
      console.error('[OfflineQueue] Error saving offline queue to disk:', err);
    }
  }

  public enqueue(event: QueuedActivityEvent): void {
    // Avoid unbounded queue growth
    if (this.queue.length > 5000) {
      this.queue.shift(); // Evict oldest
    }
    this.queue.push(event);
    this.saveToDisk();
  }

  public peek(batchSize = 50): QueuedActivityEvent[] {
    return this.queue.slice(0, batchSize);
  }

  public removeEvents(eventIds: string[]): void {
    const idSet = new Set(eventIds);
    this.queue = this.queue.filter((e) => !idSet.has(e.eventId));
    this.saveToDisk();
  }

  public size(): number {
    return this.queue.length;
  }
}
