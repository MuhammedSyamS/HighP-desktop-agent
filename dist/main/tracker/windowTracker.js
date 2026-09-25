"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowTracker = exports.sanitizeAppName = void 0;
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
// Friendly process name mappings for Windows
const KNOWN_PROCESS_NAMES = {
    code: 'VS Code',
    devenv: 'Visual Studio',
    chrome: 'Google Chrome',
    msedge: 'Microsoft Edge',
    firefox: 'Firefox',
    brave: 'Brave Browser',
    opera: 'Opera Browser',
    slack: 'Slack',
    teams: 'Microsoft Teams',
    discord: 'Discord',
    figma: 'Figma',
    postman: 'Postman',
    notepad: 'Notepad',
    notepadplusplus: 'Notepad++',
    explorer: 'File Explorer',
    powershell: 'PowerShell',
    cmd: 'Command Prompt',
    windowsterminal: 'Windows Terminal',
    spotify: 'Spotify',
    zoom: 'Zoom Meeting',
    excel: 'Microsoft Excel',
    winword: 'Microsoft Word',
    powerpnt: 'Microsoft PowerPoint',
    outlook: 'Microsoft Outlook',
    notion: 'Notion',
    obsidian: 'Obsidian'
};
const POWERSHELL_COMMAND = `powershell -NoProfile -NonInteractive -Command "
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinUtil {
    [DllImport(\\"user32.dll\\")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport(\\"user32.dll\\", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport(\\"user32.dll\\", SetLastError=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
'@ -ErrorAction SilentlyContinue

$hwnd = [WinUtil]::GetForegroundWindow()
if ($hwnd -ne [IntPtr]::Zero) {
    $pidOut = 0
    [WinUtil]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
    $sb = New-Object System.Text.StringBuilder 256
    [WinUtil]::GetWindowText($hwnd, $sb, 256) | Out-Null
    $title = $sb.ToString()
    $p = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
    $procName = if ($p) { $p.ProcessName } else { 'Unknown' }
    [PSCustomObject]@{ Process = $procName; Title = $title } | ConvertTo-Json -Compress
} else {
    [PSCustomObject]@{ Process = 'Idle'; Title = 'Desktop' } | ConvertTo-Json -Compress
}
"`;
const sanitizeAppName = (processName, title) => {
    const cleanProc = (processName || '').toLowerCase().trim();
    if (KNOWN_PROCESS_NAMES[cleanProc]) {
        return KNOWN_PROCESS_NAMES[cleanProc];
    }
    // Capitalize clean process name if not in map
    if (processName && processName !== 'Unknown') {
        return processName.charAt(0).toUpperCase() + processName.slice(1);
    }
    return 'Desktop / Unknown';
};
exports.sanitizeAppName = sanitizeAppName;
class WindowTracker {
    lastInfo = {
        applicationName: 'System / Desktop',
        processName: 'explorer',
        windowTitleSanitized: 'Desktop'
    };
    async getActiveWindow() {
        // Only run real Windows Win32 query on Windows platforms
        if (process.platform !== 'win32') {
            return this.lastInfo;
        }
        try {
            const { stdout } = await execAsync(POWERSHELL_COMMAND, { timeout: 3000 });
            const parsed = JSON.parse(stdout.trim());
            const proc = parsed.Process || 'Unknown';
            const title = parsed.Title || '';
            const appName = (0, exports.sanitizeAppName)(proc, title);
            this.lastInfo = {
                applicationName: appName,
                processName: proc,
                windowTitleSanitized: appName // Keep privacy safe: do not store personal tab contents
            };
            return this.lastInfo;
        }
        catch (err) {
            return this.lastInfo;
        }
    }
}
exports.WindowTracker = WindowTracker;
