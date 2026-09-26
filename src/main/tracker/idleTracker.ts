import { win32Bridge } from './win32Bridge';

export class IdleTracker {
  private lastIdleSeconds = 0;

  public async getSystemIdleSeconds(): Promise<number> {
    if (process.platform !== 'win32') {
      return 0;
    }

    try {
      const snapshot = win32Bridge.getSnapshot();
      this.lastIdleSeconds = Math.max(0, snapshot.idleSeconds || 0);
      return this.lastIdleSeconds;
    } catch {
      return this.lastIdleSeconds;
    }
  }
}
