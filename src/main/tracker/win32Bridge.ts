import { nativeBridge } from './nativeBridge';

export interface TelemetrySnapshot {
  processName: string;
  windowTitle: string;
  idleSeconds: number;
}

class Win32Bridge {
  public start(): void {
    nativeBridge.start();
  }

  public stop(): void {
    nativeBridge.stop();
  }

  public dispose(): void {
    nativeBridge.stop();
  }

  public getSnapshot(): TelemetrySnapshot {
    const raw = nativeBridge.getSnapshot();
    return {
      processName: raw.executable ? raw.executable.replace(/\.exe$/i, '') : 'Unknown',
      windowTitle: raw.status || '',
      idleSeconds: raw.idleSeconds || 0
    };
  }
}

export const win32Bridge = new Win32Bridge();
