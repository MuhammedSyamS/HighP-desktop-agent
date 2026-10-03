import { spawn, ChildProcessWithoutNullStreams, execFile } from 'child_process';
import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface NativeTelemetryResult {
  status: 'OK' | 'ERROR';
  hwnd: string;
  processId: number;
  executable: string;
  executablePath?: string;
  windowTitle?: string;
  idleSeconds: number;
  timestamp?: string;
  errorMessage?: string;
}

export class NativeBridge {
  private exePath: string;
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private isReady = false;
  private lastSuccessTimestamp = 0;
  private pendingResolvers: Array<(res: NativeTelemetryResult) => void> = [];

  private latestResult: NativeTelemetryResult = {
    status: 'OK',
    hwnd: '0',
    processId: 0,
    executable: 'Unknown',
    executablePath: '',
    windowTitle: '',
    idleSeconds: 0,
    timestamp: new Date().toISOString()
  };

  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.exePath = this.resolveBinaryPath();
  }

  private resolveBinaryPath(): string {
    const candidates: string[] = [];

    try {
      if (app && app.isPackaged) {
        candidates.push(path.join(process.resourcesPath, 'bin', 'HighPTelemetryNative.exe'));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'HighPTelemetryNative.exe'));
      }
    } catch {}

    // Development & workspace paths
    candidates.push(path.resolve(__dirname, '../../../bin/HighPTelemetryNative.exe'));
    candidates.push(path.resolve(__dirname, '../../bin/HighPTelemetryNative.exe'));
    candidates.push(path.resolve(process.cwd(), 'bin/HighPTelemetryNative.exe'));
    candidates.push(path.resolve(process.cwd(), 'desktop-agent/bin/HighPTelemetryNative.exe'));

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }

    return candidates[0] || 'HighPTelemetryNative.exe';
  }

  public getBinaryPath(): string {
    return this.exePath;
  }

  public isAvailable(): boolean {
    return process.platform === 'win32' && fs.existsSync(this.exePath);
  }

  public start(): void {
    if (process.platform !== 'win32' || !this.isAvailable()) {
      console.warn(`[NativeBridge] Native bridge binary not found at: ${this.exePath}`);
      return;
    }

    this.stop();

    try {
      this.child = spawn(this.exePath, ['--stream'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.rl = readline.createInterface({ input: this.child.stdout });

      this.rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const data = JSON.parse(trimmed);
            if (data.status === 'READY') {
              this.isReady = true;
              this.queryOnce();
            } else if (data.status === 'OK') {
              const res: NativeTelemetryResult = {
                status: 'OK',
                hwnd: String(data.hwnd || '0'),
                processId: Number(data.processId) || 0,
                executable: data.executable || 'Unknown',
                executablePath: data.executablePath || '',
                windowTitle: data.windowTitle || '',
                idleSeconds: Math.max(0, Number(data.idleSeconds) || 0),
                timestamp: data.timestamp || new Date().toISOString()
              };

              this.lastSuccessTimestamp = Date.now();
              this.latestResult = res;

              // Notify any pending getFreshSnapshot promises
              const resolvers = [...this.pendingResolvers];
              this.pendingResolvers = [];
              for (const r of resolvers) {
                r(res);
              }
            }
          } catch {
            // Silently ignore parse errors
          }
        }
      });

      this.child.stderr.on('data', (d) => {
        console.error('[NativeBridge STDERR]:', d.toString());
      });

      this.child.on('exit', () => {
        this.isReady = false;
        // Auto-restart if unexpected exit
        setTimeout(() => {
          if (process.platform === 'win32' && this.isAvailable()) {
            this.start();
          }
        }, 1500);
      });

      // Poll native helper every 1 second
      this.pollInterval = setInterval(() => {
        this.queryOnce();
      }, 1000);
    } catch (err: any) {
      console.error('[NativeBridge] Failed to spawn native telemetry process:', err);
      this.latestResult = {
        status: 'ERROR',
        hwnd: '0',
        processId: 0,
        executable: 'Unknown',
        idleSeconds: 0,
        errorMessage: err.message
      };
    }
  }

  public queryOnce(): void {
    if (this.child && !this.child.killed && this.isReady) {
      try {
        this.child.stdin.write('\n');
      } catch {}
    } else if (!this.child || !this.isReady) {
      this.start();
    }
  }

  /**
   * Fast synchronous read of the latest telemetry snapshot
   */
  public getSnapshot(): NativeTelemetryResult {
    return this.latestResult;
  }

  /**
   * Authoritative, guaranteed fresh snapshot from Windows OS.
   * If stream is active, triggers a stream probe and waits up to 200ms.
   * If stream fails or times out, immediately performs direct execFile query.
   */
  public async getFreshSnapshot(): Promise<NativeTelemetryResult> {
    if (this.isReady && this.child && !this.child.killed) {
      try {
        const streamPromise = new Promise<NativeTelemetryResult>((resolve) => {
          this.pendingResolvers.push(resolve);
          this.queryOnce();
          setTimeout(() => {
            const idx = this.pendingResolvers.indexOf(resolve);
            if (idx !== -1) {
              this.pendingResolvers.splice(idx, 1);
              // Fallback to latestResult or direct query
              if (Date.now() - this.lastSuccessTimestamp < 1500 && this.latestResult.processId > 0) {
                resolve(this.latestResult);
              } else {
                this.queryDirect().then(resolve);
              }
            }
          }, 200);
        });

        return await streamPromise;
      } catch {}
    }

    return await this.queryDirect();
  }

  /**
   * Direct execution of HighPTelemetryNative.exe (isolated process, guaranteed fresh)
   */
  public async queryDirect(): Promise<NativeTelemetryResult> {
    if (!this.isAvailable()) {
      return {
        status: 'ERROR',
        hwnd: '0',
        processId: 0,
        executable: 'Unknown',
        idleSeconds: 0,
        errorMessage: 'Native binary not found on Windows'
      };
    }

    return new Promise((resolve) => {
      execFile(this.exePath, [], { timeout: 3000 }, (error, stdout) => {
        if (error) {
          resolve({
            status: 'ERROR',
            hwnd: '0',
            processId: 0,
            executable: 'Unknown',
            idleSeconds: 0,
            errorMessage: error.message
          });
          return;
        }
        try {
          const data = JSON.parse(stdout.trim());
          const res: NativeTelemetryResult = {
            status: 'OK',
            hwnd: String(data.hwnd || '0'),
            processId: Number(data.processId) || 0,
            executable: data.executable || 'Unknown',
            executablePath: data.executablePath || '',
            windowTitle: data.windowTitle || '',
            idleSeconds: Math.max(0, Number(data.idleSeconds) || 0),
            timestamp: data.timestamp || new Date().toISOString()
          };
          this.lastSuccessTimestamp = Date.now();
          this.latestResult = res;
          resolve(res);
        } catch (e: any) {
          resolve({
            status: 'ERROR',
            hwnd: '0',
            processId: 0,
            executable: 'Unknown',
            idleSeconds: 0,
            errorMessage: `Invalid output: ${stdout}`
          });
        }
      });
    });
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.child) {
      try {
        this.child.stdin.write('exit\n');
        this.child.kill();
      } catch {}
      this.child = null;
    }
    this.isReady = false;
    this.pendingResolvers = [];
  }
}

export const nativeBridge = new NativeBridge();
