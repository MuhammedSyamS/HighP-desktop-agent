"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdleTracker = void 0;
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
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
class IdleTracker {
    lastIdleSeconds = 0;
    async getSystemIdleSeconds() {
        if (process.platform !== 'win32') {
            return 0;
        }
        try {
            const { stdout } = await execAsync(IDLE_POWERSHELL_COMMAND, { timeout: 3000 });
            const sec = parseInt(stdout.trim(), 10);
            this.lastIdleSeconds = isNaN(sec) ? 0 : sec;
            return this.lastIdleSeconds;
        }
        catch (error) {
            return this.lastIdleSeconds;
        }
    }
}
exports.IdleTracker = IdleTracker;
