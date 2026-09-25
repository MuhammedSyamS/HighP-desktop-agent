import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

const IDLE_POWERSHELL_COMMAND = `powershell -NoProfile -NonInteractive -Command "
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
}
public class WinIdle {
    [DllImport(\\"user32.dll\\")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport(\\"kernel32.dll\\")]
    public static extern uint GetTickCount();
}
'@ -ErrorAction SilentlyContinue

$lii = New-Object LASTINPUTINFO
$lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii)
if ([WinIdle]::GetLastInputInfo([ref]$lii)) {
    $ticks = [WinIdle]::GetTickCount()
    $diff = $ticks - $lii.dwTime
    [Math]::Round($diff / 1000)
} else {
    0
}
"`;

export class IdleTracker {
  private lastIdleSeconds = 0;

  public async getSystemIdleSeconds(): Promise<number> {
    if (process.platform !== 'win32') {
      return 0;
    }

    try {
      const { stdout } = await execAsync(IDLE_POWERSHELL_COMMAND, { timeout: 3000 });
      const sec = parseInt(stdout.trim(), 10);
      this.lastIdleSeconds = isNaN(sec) ? 0 : sec;
      return this.lastIdleSeconds;
    } catch (error) {
      return this.lastIdleSeconds;
    }
  }
}
