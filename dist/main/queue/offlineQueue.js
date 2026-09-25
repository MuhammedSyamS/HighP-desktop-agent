"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineQueue = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
class OfflineQueue {
    filePath;
    queue = [];
    constructor() {
        let baseDir = '.';
        try {
            if (electron_1.app && electron_1.app.getPath) {
                baseDir = electron_1.app.getPath('userData');
            }
        }
        catch {
            baseDir = '.';
        }
        this.filePath = path_1.default.join(baseDir, 'highp-offline-events.json');
        this.loadFromDisk();
    }
    loadFromDisk() {
        try {
            if (fs_1.default.existsSync(this.filePath)) {
                const raw = fs_1.default.readFileSync(this.filePath, 'utf-8');
                this.queue = JSON.parse(raw);
                if (!Array.isArray(this.queue)) {
                    this.queue = [];
                }
            }
        }
        catch (err) {
            console.error('[OfflineQueue] Error loading offline queue from disk:', err);
            this.queue = [];
        }
    }
    saveToDisk() {
        try {
            fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[OfflineQueue] Error saving offline queue to disk:', err);
        }
    }
    enqueue(event) {
        // Avoid unbounded queue growth
        if (this.queue.length > 5000) {
            this.queue.shift(); // Evict oldest
        }
        this.queue.push(event);
        this.saveToDisk();
    }
    peek(batchSize = 50) {
        return this.queue.slice(0, batchSize);
    }
    removeEvents(eventIds) {
        const idSet = new Set(eventIds);
        this.queue = this.queue.filter((e) => !idSet.has(e.eventId));
        this.saveToDisk();
    }
    size() {
        return this.queue.length;
    }
}
exports.OfflineQueue = OfflineQueue;
