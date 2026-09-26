import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import readline from 'readline';

export interface TelemetrySnapshot {
  processName: string;
  windowTitle: string;
  idleSeconds: number;
}

const INIT_SCRIPT = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
}
public class WinTelemetry {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", SetLastError=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport("kernel32.dll")]
    public static extern uint GetTickCount();
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

function Get-HighPTelemetry {
    $hwnd = [WinTelemetry]::GetForegroundWindow()
    $pidOut = 0
    [WinTelemetry]::GetWindowThreadProcessId($hwnd, [ref]$pidOut) | Out-Null
    $sb = New-Object System.Text.StringBuilder 256
    [WinTelemetry]::GetWindowText($hwnd, $sb, 256) | Out-Null
    $p = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
    $procName = if ($p) { $p.ProcessName } else { 'Unknown' }

    $lii = New-Object LASTINPUTINFO
    $lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii)
    $idleSec = 0
    if ([WinTelemetry]::GetLastInputInfo([ref]$lii)) {
        $ticks = [WinTelemetry]::GetTickCount()
        $idleSec = [Math]::Max(0, [Math]::Round(($ticks - $lii.dwTime) / 1000))
    }

    [PSCustomObject]@{
        Process = $procName
        Title = $sb.ToString()
        IdleSeconds = [int]$idleSec
    } | ConvertTo-Json -Compress
}
Write-Output "HIGHP_READY"
`;

class Win32Bridge {
  private ps: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private isReady = false;
  private latestSnapshot: TelemetrySnapshot = {
    processName: 'explorer',
    windowTitle: 'Desktop',
    idleSeconds: 0
  };
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (process.platform === 'win32') {
      this.initProcess();
    }
  }

  private initProcess(): void {
    try {
      this.ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.rl = readline.createInterface({ input: this.ps.stdout });

      this.rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (trimmed === 'HIGHP_READY') {
          this.isReady = true;
          this.startPolling();
        } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            this.latestSnapshot = {
              processName: parsed.Process || 'Unknown',
              windowTitle: parsed.Title || '',
              idleSeconds: Number(parsed.IdleSeconds) || 0
            };
          } catch {
            // Ignore parse errors from shell noise
          }
        }
      });

      this.ps.on('exit', () => {
        this.isReady = false;
        if (this.pollInterval) clearInterval(this.pollInterval);
        // Restart after brief pause if on Windows
        if (process.platform === 'win32') {
          setTimeout(() => this.initProcess(), 2000);
        }
      });

      this.ps.stdin.write(INIT_SCRIPT + '\r\n');
    } catch (err) {
      console.error('[Win32Bridge] Spawn error:', err);
    }
  }

  private startPolling(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Send query every 1.5 seconds to persistent powershell process
    this.pollInterval = setInterval(() => {
      if (this.isReady && this.ps && !this.ps.killed) {
        try {
          this.ps.stdin.write('Get-HighPTelemetry\r\n');
        } catch {
          // Stdin closed
        }
      }
    }, 1500);
  }

  public getSnapshot(): TelemetrySnapshot {
    return this.latestSnapshot;
  }

  public dispose(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.ps) {
      try {
        this.ps.kill();
      } catch {}
    }
  }
}

export const win32Bridge = new Win32Bridge();
