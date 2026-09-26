export interface ResolvedApp {
  applicationName: string;
  processName: string;
  category: string;
  isRecognized: boolean;
}

const KNOWN_EXECUTABLES: Record<string, { name: string; category: string }> = {
  // Development
  'code.exe': { name: 'Visual Studio Code', category: 'Development' },
  'devenv.exe': { name: 'Visual Studio', category: 'Development' },
  'idea64.exe': { name: 'IntelliJ IDEA', category: 'Development' },
  'webstorm64.exe': { name: 'WebStorm', category: 'Development' },
  'pycharm64.exe': { name: 'PyCharm', category: 'Development' },
  'postman.exe': { name: 'Postman', category: 'Development' },
  'dbeaver.exe': { name: 'DBeaver', category: 'Development' },
  'powershell.exe': { name: 'PowerShell', category: 'Development' },
  'cmd.exe': { name: 'Command Prompt', category: 'Development' },
  'windowsterminal.exe': { name: 'Windows Terminal', category: 'Development' },
  'git-bash.exe': { name: 'Git Bash', category: 'Development' },
  'githubdesktop.exe': { name: 'GitHub Desktop', category: 'Development' },
  'cursor.exe': { name: 'Cursor IDE', category: 'Development' },
  'antigravity.exe': { name: 'Antigravity IDE', category: 'Development' },

  // Browsers
  'chrome.exe': { name: 'Google Chrome', category: 'Productivity' },
  'msedge.exe': { name: 'Microsoft Edge', category: 'Productivity' },
  'firefox.exe': { name: 'Mozilla Firefox', category: 'Productivity' },
  'brave.exe': { name: 'Brave Browser', category: 'Productivity' },
  'opera.exe': { name: 'Opera Browser', category: 'Productivity' },

  // Design & Media
  'figma.exe': { name: 'Figma', category: 'Design' },
  'photoshop.exe': { name: 'Adobe Photoshop', category: 'Design' },
  'illustrator.exe': { name: 'Adobe Illustrator', category: 'Design' },
  'xd.exe': { name: 'Adobe XD', category: 'Design' },
  'blender.exe': { name: 'Blender', category: 'Design' },

  // Communication & Meetings
  'slack.exe': { name: 'Slack', category: 'Communication' },
  'teams.exe': { name: 'Microsoft Teams', category: 'Communication' },
  'discord.exe': { name: 'Discord', category: 'Communication' },
  'zoom.exe': { name: 'Zoom Meeting', category: 'Communication' },

  // Office & Productivity
  'excel.exe': { name: 'Microsoft Excel', category: 'Productivity' },
  'winword.exe': { name: 'Microsoft Word', category: 'Productivity' },
  'powerpnt.exe': { name: 'Microsoft PowerPoint', category: 'Productivity' },
  'outlook.exe': { name: 'Microsoft Outlook', category: 'Productivity' },
  'notion.exe': { name: 'Notion', category: 'Productivity' },
  'obsidian.exe': { name: 'Obsidian', category: 'Productivity' },
  'notepad.exe': { name: 'Notepad', category: 'Productivity' },
  'notepad++.exe': { name: 'Notepad++', category: 'Productivity' },
  'explorer.exe': { name: 'File Explorer', category: 'Productivity' },
  'spotify.exe': { name: 'Spotify', category: 'Media' }
};

export const resolveApplication = (executable: string): ResolvedApp => {
  const raw = (executable || '').trim();
  const normalizedKey = raw.toLowerCase().endsWith('.exe') ? raw.toLowerCase() : `${raw.toLowerCase()}.exe`;

  // Internal agent processes should never be tracked as user work applications
  if (
    normalizedKey.includes('highp') ||
    normalizedKey === 'electron.exe' ||
    normalizedKey.includes('telemetry')
  ) {
    return {
      applicationName: 'HighP Agent',
      processName: normalizedKey,
      category: 'System',
      isRecognized: false
    };
  }

  if (KNOWN_EXECUTABLES[normalizedKey]) {
    const entry = KNOWN_EXECUTABLES[normalizedKey];
    return {
      applicationName: entry.name,
      processName: normalizedKey,
      category: entry.category,
      isRecognized: true
    };
  }

  // Handle generic / unknown
  const baseName = raw.replace(/\.exe$/i, '').trim();
  if (!baseName || baseName.toLowerCase() === 'unknown' || baseName.toLowerCase() === 'idle') {
    return {
      applicationName: 'Unknown Application',
      processName: normalizedKey || 'unknown.exe',
      category: 'Other',
      isRecognized: false
    };
  }

  // Capitalize clean base name if not in dictionary
  const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  return {
    applicationName: formattedName,
    processName: normalizedKey,
    category: 'Other',
    isRecognized: true
  };
};
