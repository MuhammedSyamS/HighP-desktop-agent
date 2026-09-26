import { win32Bridge } from './win32Bridge';

export interface ActiveWindowInfo {
  applicationName: string;
  processName: string;
  windowTitleSanitized: string;
}

// Friendly process name mappings for Windows
const KNOWN_PROCESS_NAMES: Record<string, string> = {
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

export const sanitizeAppName = (processName: string, title?: string): string => {
  const cleanProc = (processName || '').toLowerCase().trim();
  if (KNOWN_PROCESS_NAMES[cleanProc]) {
    return KNOWN_PROCESS_NAMES[cleanProc];
  }

  // Capitalize clean process name if not in map
  if (processName && processName !== 'Unknown' && processName !== 'Idle') {
    return processName.charAt(0).toUpperCase() + processName.slice(1);
  }

  return 'Desktop / Unknown';
};

export class WindowTracker {
  private lastInfo: ActiveWindowInfo = {
    applicationName: 'System / Desktop',
    processName: 'explorer',
    windowTitleSanitized: 'Desktop'
  };

  public async getActiveWindow(): Promise<ActiveWindowInfo> {
    if (process.platform !== 'win32') {
      return this.lastInfo;
    }

    try {
      const snapshot = win32Bridge.getSnapshot();
      const proc = snapshot.processName || 'Unknown';
      const title = snapshot.windowTitle || '';
      const appName = sanitizeAppName(proc, title);

      this.lastInfo = {
        applicationName: appName,
        processName: proc,
        windowTitleSanitized: appName
      };

      return this.lastInfo;
    } catch {
      return this.lastInfo;
    }
  }
}
