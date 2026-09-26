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
  idleSeconds: number;
  errorMessage?: string;
}

export class NativeBridge {
  private exePath: string;
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private isReady = false;
  private latestResult: NativeTelemetryResult = {
    status: 'OK',
    hwnd: '0',
    processId: 0,
    executable: 'Unknown',
    idleSeconds: 0
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
              this.latestResult = {
                status: 'OK',
                hwnd: String(data.hwnd || '0'),
                processId: Number(data.processId) || 0,
                executable: data.executable || 'Unknown',
                idleSeconds: Math.max(0, Number(data.idleSeconds) || 0)
              };
            }
          } catch (e: any) {
            // Silently ignore parse errors
          }
        }
      });

      this.child.stderr.on('data', (d) => {
        console.error('[NativeBridge STDERR]:', d.toString());
      });

      this.child.on('exit', (code) => {
        this.isReady = false;
        if (this.pollInterval) clearInterval(this.pollInterval);
        // Auto-restart if unexpected exit
        setTimeout(() => {
          if (process.platform === 'win32' && this.isAvailable()) {
            this.start();
          }
        }, 2000);
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
    }
  }

  public getSnapshot(): NativeTelemetryResult {
    return this.latestResult;
  }

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
          resolve({
            status: 'OK',
            hwnd: String(data.hwnd || '0'),
            processId: Number(data.processId) || 0,
            executable: data.executable || 'Unknown',
            idleSeconds: Math.max(0, Number(data.idleSeconds) || 0)
          });
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
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.child) {
      try {
        this.child.stdin.write('exit\n');
        this.child.kill();
      } catch {}
      this.child = null;
    }
  }
}

export const nativeBridge = new NativeBridge();
