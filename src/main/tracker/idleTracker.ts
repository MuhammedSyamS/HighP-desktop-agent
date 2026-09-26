import { nativeBridge } from './nativeBridge';

export class IdleTracker {
  public async getSystemIdleSeconds(): Promise<number> {
    if (process.platform !== 'win32') {
      return 0;
    }
    const snapshot = nativeBridge.getSnapshot();
    return Math.max(0, snapshot.idleSeconds || 0);
  }
}
