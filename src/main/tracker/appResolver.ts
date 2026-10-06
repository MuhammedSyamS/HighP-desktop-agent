import path from 'path';

export interface ResolvedApplication {
  applicationId?: string;
  name: string;
  executableName: string;
  executablePath?: string;
  processId: number;
  category: string;
  trackingState: 'TRACKED' | 'IGNORED' | 'UNKNOWN';
  tracked: boolean;
  ignored: boolean;
  isUnknown: boolean;
  confidence: 'high' | 'medium' | 'unknown';
}

// Backward-compatible alias for existing code
export type ResolvedApp = {
  applicationId?: string;
  applicationName: string;
  processName: string;
  category: string;
  trackingState?: 'TRACKED' | 'IGNORED' | 'UNKNOWN';
  isRecognized: boolean;
  tracked?: boolean;
  ignored?: boolean;
};

export interface TrackedApplicationEntry {
  id?: string;
  name: string;
  executableNames: string[];
  executablePaths?: string[];
  category: string;
  tracked: boolean;
  ignored: boolean;
  isSystemApp?: boolean;
}

// Built-in offline fallback registry (authoritative executable -> application mappings)
export const DEFAULT_REGISTRY_ENTRIES: TrackedApplicationEntry[] = [
  // Development
  { name: 'Visual Studio Code', executableNames: ['code.exe', 'vscodium.exe', 'code - oss.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Cursor', executableNames: ['cursor.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Antigravity IDE', executableNames: ['antigravity.exe', 'antigravity ide.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Visual Studio', executableNames: ['devenv.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'IntelliJ IDEA', executableNames: ['idea64.exe', 'idea.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'WebStorm', executableNames: ['webstorm64.exe', 'webstorm.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Android Studio', executableNames: ['studio64.exe', 'studio.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'PyCharm', executableNames: ['pycharm64.exe', 'pycharm.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Sublime Text', executableNames: ['sublime_text.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Git', executableNames: ['git.exe', 'git-bash.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'GitHub Desktop', executableNames: ['githubdesktop.exe', 'github desktop.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'GitKraken', executableNames: ['gitkraken.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'SourceTree', executableNames: ['sourcetree.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Windows Terminal', executableNames: ['windowsterminal.exe', 'wt.exe', 'powershell.exe', 'pwsh.exe', 'cmd.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Postman', executableNames: ['postman.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Insomnia', executableNames: ['insomnia.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Docker Desktop', executableNames: ['docker desktop.exe', 'com.docker.backend.exe', 'docker.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'DBeaver', executableNames: ['dbeaver.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'MongoDB Compass', executableNames: ['mongodbcompass.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'MySQL Workbench', executableNames: ['mysqlworkbench.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },
  { name: 'pgAdmin', executableNames: ['pgadmin4.exe'], category: 'Development', tracked: true, ignored: false, isSystemApp: false },

  // Design
  { name: 'Figma', executableNames: ['figma.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Adobe Photoshop', executableNames: ['photoshop.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Adobe Illustrator', executableNames: ['illustrator.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Adobe Premiere Pro', executableNames: ['premiere.exe', 'premierepro.exe', 'adobe premiere pro.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Adobe After Effects', executableNames: ['afterfx.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Adobe XD', executableNames: ['xd.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Canva', executableNames: ['canva.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Blender', executableNames: ['blender.exe'], category: 'Design', tracked: true, ignored: false, isSystemApp: false },

  // Communication
  { name: 'Slack', executableNames: ['slack.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft Teams', executableNames: ['teams.exe', 'ms-teams.exe', 'msteams.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Discord', executableNames: ['discord.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Zoom', executableNames: ['zoom.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },
  { name: 'WhatsApp', executableNames: ['whatsapp.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Telegram', executableNames: ['telegram.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Skype', executableNames: ['skype.exe'], category: 'Communication', tracked: true, ignored: false, isSystemApp: false },

  // Browsers
  { name: 'Google Chrome', executableNames: ['chrome.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft Edge', executableNames: ['msedge.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Mozilla Firefox', executableNames: ['firefox.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Brave', executableNames: ['brave.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Opera', executableNames: ['opera.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Vivaldi', executableNames: ['vivaldi.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Arc Browser', executableNames: ['arc.exe'], category: 'Browsers', tracked: true, ignored: false, isSystemApp: false },

  // Productivity & Office
  { name: 'Notion', executableNames: ['notion.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft Word', executableNames: ['winword.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft Excel', executableNames: ['excel.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft PowerPoint', executableNames: ['powerpnt.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft Outlook', executableNames: ['outlook.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Microsoft OneNote', executableNames: ['onenote.exe', 'onenotem.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Notepad', executableNames: ['notepad.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Notepad++', executableNames: ['notepad++.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Obsidian', executableNames: ['obsidian.exe'], category: 'Productivity', tracked: true, ignored: false, isSystemApp: false },

  // Project Management
  { name: 'Jira', executableNames: ['jira.exe'], category: 'Project Management', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Trello', executableNames: ['trello.exe'], category: 'Project Management', tracked: true, ignored: false, isSystemApp: false },
  { name: 'ClickUp', executableNames: ['clickup.exe'], category: 'Project Management', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Asana', executableNames: ['asana.exe'], category: 'Project Management', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Linear', executableNames: ['linear.exe'], category: 'Project Management', tracked: true, ignored: false, isSystemApp: false },

  // Marketing
  { name: 'Google Ads', executableNames: ['googleads.exe', 'google-ads.exe'], category: 'Marketing', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Google Analytics', executableNames: ['googleanalytics.exe'], category: 'Marketing', tracked: true, ignored: false, isSystemApp: false },
  { name: 'Meta Business Suite', executableNames: ['metabusiness.exe', 'meta business suite.exe'], category: 'Marketing', tracked: true, ignored: false, isSystemApp: false },

  // File Management (Note: explorer.exe is resolved dynamically via windowTitle to separate Desktop Shell from Folders)
  { name: 'OneDrive', executableNames: ['onedrive.exe'], category: 'File Management', tracked: true, ignored: false, isSystemApp: false },

  // Media
  { name: 'Spotify', executableNames: ['spotify.exe', 'spotifylauncher.exe', 'spotify_cli.exe'], category: 'Media', tracked: false, ignored: true, isSystemApp: false },
  { name: 'VLC Media Player', executableNames: ['vlc.exe'], category: 'Media', tracked: false, ignored: true, isSystemApp: false },

  // Internal / System
  { name: 'HighP Agent', executableNames: ['highp agent.exe', 'highptelemetrynative.exe', 'electron.exe'], category: 'Other', tracked: false, ignored: true, isSystemApp: true }
];

export const normalizeExeKey = (raw: string): string => {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return '';
  const base = path.basename(trimmed);
  return base.endsWith('.exe') ? base : `${base}.exe`;
};

/**
 * Authoritative Application Resolver
 * Resolution Hierarchy:
 * 1. Internal self-agent check
 * 2. Exact executable path match in dynamic registry
 * 3. Exact executable name match in dynamic registry
 * 4. Exact executable name match in default registry
 * 5. Registered executable aliases
 * 6. Unknown application (not silently misidentified!)
 * Window title is never used as the primary identifier.
 */
export const resolveApplication = (
  executable: string,
  executablePathOrTitle?: string,
  processId: number = 0,
  dynamicRegistry: TrackedApplicationEntry[] = [],
  windowTitle?: string
): ResolvedApplication & ResolvedApp => {
  const rawExe = (executable || '').trim();
  const normalizedKey = normalizeExeKey(rawExe);
  const normalizedPath = (executablePathOrTitle && executablePathOrTitle.includes('\\') ? executablePathOrTitle.trim().toLowerCase() : '');

  // 1. Internal Agent Process Check
  if (
    normalizedKey.includes('highp') ||
    normalizedKey === 'electron.exe' ||
    normalizedKey.includes('telemetry')
  ) {
    return {
      applicationId: undefined,
      name: 'HighP Agent',
      applicationName: 'HighP Agent',
      executableName: normalizedKey || 'HighPAgent.exe',
      processName: normalizedKey || 'HighPAgent.exe',
      executablePath: normalizedPath,
      processId,
      category: 'System',
      trackingState: 'IGNORED',
      tracked: false,
      ignored: true,
      isUnknown: false,
      isRecognized: false,
      confidence: 'high'
    };
  }

  // 1b. Windows Desktop Shell vs actual File Explorer folder
  // explorer.exe owns the desktop ("Program Manager"), taskbar, Alt-Tab switcher, etc.
  // ShellExperienceHost, StartMenu, SearchHost are also Windows OS shell background.
  if (
    normalizedKey === 'explorer.exe' ||
    normalizedKey === 'shellexperiencehost.exe' ||
    normalizedKey === 'startmenuexperiencehost.exe' ||
    normalizedKey === 'searchhost.exe' ||
    normalizedKey === 'lockapp.exe'
  ) {
    const rawTitle = (windowTitle || (!executablePathOrTitle?.includes('\\') ? executablePathOrTitle : '') || '').trim();
    const lowerTitle = rawTitle.toLowerCase();
    const isShellBackground =
      normalizedKey !== 'explorer.exe' ||
      !lowerTitle ||
      lowerTitle === 'program manager' ||
      lowerTitle === 'task switching' ||
      lowerTitle === 'taskbar' ||
      lowerTitle === 'running applications' ||
      lowerTitle.includes('windows shell') ||
      lowerTitle.includes('windows input experience');

    if (isShellBackground) {
      return {
        applicationId: undefined,
        name: 'Windows Desktop',
        applicationName: 'Windows Desktop',
        executableName: normalizedKey,
        processName: normalizedKey,
        executablePath: normalizedPath,
        processId,
        category: 'System',
        trackingState: 'IGNORED',
        tracked: false,
        ignored: true,
        isUnknown: false,
        isRecognized: true,
        confidence: 'high'
      };
    } else {
      return {
        applicationId: undefined,
        name: 'Windows File Explorer',
        applicationName: 'Windows File Explorer',
        executableName: 'explorer.exe',
        processName: 'explorer.exe',
        executablePath: normalizedPath,
        processId,
        category: 'File Management',
        trackingState: 'TRACKED',
        tracked: true,
        ignored: false,
        isUnknown: false,
        isRecognized: true,
        confidence: 'high'
      };
    }
  }

  // 2. Exact Path Match in Dynamic Registry
  if (normalizedPath && dynamicRegistry.length > 0) {
    for (const app of dynamicRegistry) {
      if (app.executablePaths && app.executablePaths.some((p) => p.toLowerCase() === normalizedPath)) {
        const isTracked = Boolean(app.tracked);
        return {
          applicationId: app.id,
          name: app.name,
          applicationName: app.name,
          executableName: normalizedKey,
          processName: normalizedKey,
          executablePath: normalizedPath,
          processId,
          category: app.category,
          trackingState: isTracked ? 'TRACKED' : 'IGNORED',
          tracked: isTracked,
          ignored: Boolean(app.ignored !== undefined ? app.ignored : !isTracked),
          isUnknown: false,
          isRecognized: true,
          confidence: 'high'
        };
      }
    }
  }

  // 3. Exact Executable Name Match in Dynamic Registry (Synced from Server)
  if (normalizedKey && dynamicRegistry.length > 0) {
    for (const app of dynamicRegistry) {
      const match = app.executableNames.some((e) => normalizeExeKey(e) === normalizedKey);
      if (match) {
        const isTracked = Boolean(app.tracked);
        return {
          applicationId: app.id,
          name: app.name,
          applicationName: app.name,
          executableName: normalizedKey,
          processName: normalizedKey,
          executablePath: normalizedPath,
          processId,
          category: app.category,
          trackingState: isTracked ? 'TRACKED' : 'IGNORED',
          tracked: isTracked,
          ignored: Boolean(app.ignored !== undefined ? app.ignored : !isTracked),
          isUnknown: false,
          isRecognized: true,
          confidence: 'high'
        };
      }
    }
  }

  // 4. Exact Executable Name Match in Built-in Default Registry
  if (normalizedKey) {
    for (const app of DEFAULT_REGISTRY_ENTRIES) {
      const match = app.executableNames.some((e) => normalizeExeKey(e) === normalizedKey);
      if (match) {
        const isTracked = Boolean(app.tracked);
        return {
          applicationId: app.id,
          name: app.name,
          applicationName: app.name,
          executableName: normalizedKey,
          processName: normalizedKey,
          executablePath: normalizedPath,
          processId,
          category: app.category,
          trackingState: isTracked ? 'TRACKED' : 'IGNORED',
          tracked: isTracked,
          ignored: Boolean(app.ignored !== undefined ? app.ignored : !isTracked),
          isUnknown: false,
          isRecognized: true,
          confidence: 'high'
        };
      }
    }
  }

  // 5. Registered Executable Aliases (Safe prefix / substring checks)
  if (normalizedKey.includes('spotify')) {
    return {
      applicationId: undefined,
      name: 'Spotify',
      applicationName: 'Spotify',
      executableName: normalizedKey,
      processName: normalizedKey,
      executablePath: normalizedPath,
      processId,
      category: 'Media',
      trackingState: 'IGNORED',
      tracked: false,
      ignored: true,
      isUnknown: false,
      isRecognized: true,
      confidence: 'high'
    };
  }

  if (normalizedKey.includes('antigravity')) {
    return {
      applicationId: undefined,
      name: 'Antigravity IDE',
      applicationName: 'Antigravity IDE',
      executableName: normalizedKey,
      processName: normalizedKey,
      executablePath: normalizedPath,
      processId,
      category: 'Development',
      trackingState: 'TRACKED',
      tracked: true,
      ignored: false,
      isUnknown: false,
      isRecognized: true,
      confidence: 'high'
    };
  }

  if (normalizedKey.includes('cursor')) {
    return {
      applicationId: undefined,
      name: 'Cursor',
      applicationName: 'Cursor',
      executableName: normalizedKey,
      processName: normalizedKey,
      executablePath: normalizedPath,
      processId,
      category: 'Development',
      trackingState: 'TRACKED',
      tracked: true,
      ignored: false,
      isUnknown: false,
      isRecognized: true,
      confidence: 'high'
    };
  }

  // 6. Unknown Application
  // Critical requirement: Do not guess or silently reclassify unknown applications as known apps!
  const baseName = rawExe.replace(/\.exe$/i, '').trim();
  const displayName = baseName && baseName.toLowerCase() !== 'unknown' && baseName.toLowerCase() !== 'idle'
    ? baseName.charAt(0).toUpperCase() + baseName.slice(1)
    : 'Unknown Application';

  return {
    applicationId: undefined,
    name: displayName,
    applicationName: displayName,
    executableName: normalizedKey || 'unknown.exe',
    processName: normalizedKey || 'unknown.exe',
    executablePath: normalizedPath,
    processId,
    category: 'Other',
    trackingState: 'UNKNOWN',
    tracked: false,
    ignored: false,
    isUnknown: true,
    isRecognized: false,
    confidence: 'unknown'
  };
};
