import path from 'path';

export interface ResolvedApplication {
  applicationId: string;
  name: string;
  applicationName: string;
  executableName: string;
  processName: string;
  executablePath?: string;
  bundleId?: string;
  desktopEntry?: string;
  processId: number;
  category: string;
  trackingState: 'TRACKED' | 'IGNORED' | 'UNKNOWN';
  tracked: boolean;
  ignored: boolean;
  isUnknown: boolean;
  isRecognized: boolean;
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
  applicationId?: string;
  name: string;
  executableNames: string[];
  executablePaths?: string[];
  bundleIds?: string[];
  desktopEntries?: string[];
  category: string;
  tracked: boolean;
  ignored: boolean;
  isSystemApp?: boolean;
}

export interface ApplicationResolutionQuery {
  executable?: string;
  executablePath?: string;
  processId?: number;
  bundleId?: string;
  desktopEntry?: string;
  windowTitle?: string;
  platform?: 'win32' | 'darwin' | 'linux';
  dynamicRegistry?: TrackedApplicationEntry[];
}

// Built-in offline fallback registry (cross-platform executable -> application mappings)
export const DEFAULT_REGISTRY_ENTRIES: TrackedApplicationEntry[] = [
  // Development
  {
    applicationId: 'visual-studio-code',
    name: 'Visual Studio Code',
    executableNames: ['code.exe', 'code', 'vscodium.exe', 'vscodium', 'code - oss.exe', 'code-oss'],
    bundleIds: ['com.microsoft.VSCode', 'com.vscodium', 'com.visualstudio.code.oss'],
    desktopEntries: ['code.desktop', 'vscodium.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'cursor',
    name: 'Cursor',
    executableNames: ['cursor.exe', 'cursor'],
    bundleIds: ['com.todesktop.230313mzl4w4u92'],
    desktopEntries: ['cursor.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'antigravity-ide',
    name: 'Antigravity IDE',
    executableNames: ['antigravity.exe', 'antigravity ide.exe', 'antigravity'],
    bundleIds: ['com.deepmind.antigravity', 'com.google.antigravity'],
    desktopEntries: ['antigravity.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'visual-studio',
    name: 'Visual Studio',
    executableNames: ['devenv.exe'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'intellij-idea',
    name: 'IntelliJ IDEA',
    executableNames: ['idea64.exe', 'idea.exe', 'idea'],
    bundleIds: ['com.jetbrains.intellij', 'com.jetbrains.intellij.ce'],
    desktopEntries: ['intellij-idea.desktop', 'idea.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'webstorm',
    name: 'WebStorm',
    executableNames: ['webstorm64.exe', 'webstorm.exe', 'webstorm'],
    bundleIds: ['com.jetbrains.WebStorm'],
    desktopEntries: ['webstorm.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'android-studio',
    name: 'Android Studio',
    executableNames: ['studio64.exe', 'studio.exe', 'studio'],
    bundleIds: ['com.google.android.studio'],
    desktopEntries: ['android-studio.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'pycharm',
    name: 'PyCharm',
    executableNames: ['pycharm64.exe', 'pycharm.exe', 'pycharm'],
    bundleIds: ['com.jetbrains.pycharm'],
    desktopEntries: ['pycharm.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'sublime-text',
    name: 'Sublime Text',
    executableNames: ['sublime_text.exe', 'sublime_text', 'subl'],
    bundleIds: ['com.sublimetext.4', 'com.sublimetext.3'],
    desktopEntries: ['sublime_text.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'git',
    name: 'Git',
    executableNames: ['git.exe', 'git-bash.exe', 'git'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'github-desktop',
    name: 'GitHub Desktop',
    executableNames: ['githubdesktop.exe', 'github desktop.exe', 'github-desktop'],
    bundleIds: ['com.github.GitHubClient'],
    desktopEntries: ['github-desktop.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'gitkraken',
    name: 'GitKraken',
    executableNames: ['gitkraken.exe', 'gitkraken'],
    bundleIds: ['com.axosoft.gitkraken'],
    desktopEntries: ['gitkraken.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'sourcetree',
    name: 'SourceTree',
    executableNames: ['sourcetree.exe'],
    bundleIds: ['com.torusknot.SourceTreeNotMAS'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'terminal',
    name: 'Terminal',
    executableNames: ['windowsterminal.exe', 'wt.exe', 'powershell.exe', 'pwsh.exe', 'cmd.exe', 'terminal', 'gnome-terminal', 'konsole', 'kitty', 'alacritty'],
    bundleIds: ['com.apple.Terminal', 'com.googlecode.iterm2'],
    desktopEntries: ['org.gnome.Terminal.desktop', 'kitty.desktop', 'alacritty.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'postman',
    name: 'Postman',
    executableNames: ['postman.exe', 'postman'],
    bundleIds: ['com.postmanlabs.mac'],
    desktopEntries: ['postman.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'insomnia',
    name: 'Insomnia',
    executableNames: ['insomnia.exe', 'insomnia'],
    bundleIds: ['com.insomnia.app'],
    desktopEntries: ['insomnia.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'docker-desktop',
    name: 'Docker Desktop',
    executableNames: ['docker desktop.exe', 'com.docker.backend.exe', 'docker.exe', 'docker'],
    bundleIds: ['com.docker.docker'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'dbeaver',
    name: 'DBeaver',
    executableNames: ['dbeaver.exe', 'dbeaver'],
    bundleIds: ['org.jkiss.dbeaver.core.product'],
    desktopEntries: ['dbeaver.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'mongodb-compass',
    name: 'MongoDB Compass',
    executableNames: ['mongodbcompass.exe', 'mongodb-compass'],
    bundleIds: ['com.mongodb.compass'],
    desktopEntries: ['mongodb-compass.desktop'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },

  // Design
  {
    applicationId: 'figma',
    name: 'Figma',
    executableNames: ['figma.exe', 'figma', 'figma-linux'],
    bundleIds: ['com.figma.Desktop'],
    desktopEntries: ['figma.desktop', 'figma-linux.desktop'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'adobe-photoshop',
    name: 'Adobe Photoshop',
    executableNames: ['photoshop.exe'],
    bundleIds: ['com.adobe.Photoshop'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'adobe-illustrator',
    name: 'Adobe Illustrator',
    executableNames: ['illustrator.exe'],
    bundleIds: ['com.adobe.illustrator'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'adobe-premiere-pro',
    name: 'Adobe Premiere Pro',
    executableNames: ['premiere.exe', 'premierepro.exe', 'adobe premiere pro.exe'],
    bundleIds: ['com.adobe.PremierePro'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'adobe-after-effects',
    name: 'Adobe After Effects',
    executableNames: ['afterfx.exe'],
    bundleIds: ['com.adobe.AfterEffects'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'canva',
    name: 'Canva',
    executableNames: ['canva.exe', 'canva'],
    bundleIds: ['com.canva.CanvaDesktop'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'blender',
    name: 'Blender',
    executableNames: ['blender.exe', 'blender'],
    bundleIds: ['org.blenderfoundation.blender'],
    desktopEntries: ['blender.desktop'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },

  // Communication
  {
    applicationId: 'slack',
    name: 'Slack',
    executableNames: ['slack.exe', 'slack'],
    bundleIds: ['com.tinyspeck.slackmacgap'],
    desktopEntries: ['slack.desktop'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'calculator',
    name: 'Calculator',
    executableNames: ['calc.exe', 'calculator.exe', 'calculatorapp.exe', 'gnome-calculator', 'kcalc'],
    bundleIds: ['com.apple.calculator'],
    desktopEntries: ['org.gnome.Calculator.desktop'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-teams',
    name: 'Microsoft Teams',
    executableNames: ['teams.exe', 'ms-teams.exe', 'msteams.exe', 'teams'],
    bundleIds: ['com.microsoft.teams', 'com.microsoft.teams2'],
    desktopEntries: ['teams.desktop'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'discord',
    name: 'Discord',
    executableNames: ['discord.exe', 'discord'],
    bundleIds: ['com.hnc.Discord'],
    desktopEntries: ['discord.desktop'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'zoom',
    name: 'Zoom',
    executableNames: ['zoom.exe', 'zoom'],
    bundleIds: ['us.zoom.xos'],
    desktopEntries: ['Zoom.desktop', 'zoom.desktop'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'whatsapp',
    name: 'WhatsApp',
    executableNames: ['whatsapp.exe'],
    bundleIds: ['net.whatsapp.WhatsApp'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'telegram',
    name: 'Telegram',
    executableNames: ['telegram.exe', 'telegram'],
    bundleIds: ['ru.keepcoder.Telegram'],
    desktopEntries: ['telegramdesktop.desktop'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },

  // Browsers
  {
    applicationId: 'google-chrome',
    name: 'Google Chrome',
    executableNames: ['chrome.exe', 'chrome', 'google-chrome', 'google chrome'],
    bundleIds: ['com.google.Chrome'],
    desktopEntries: ['google-chrome.desktop'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-edge',
    name: 'Microsoft Edge',
    executableNames: ['msedge.exe', 'msedge', 'microsoft-edge'],
    bundleIds: ['com.microsoft.edgemac'],
    desktopEntries: ['microsoft-edge.desktop'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'mozilla-firefox',
    name: 'Mozilla Firefox',
    executableNames: ['firefox.exe', 'firefox'],
    bundleIds: ['org.mozilla.firefox'],
    desktopEntries: ['firefox.desktop'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'safari',
    name: 'Safari',
    executableNames: ['safari'],
    bundleIds: ['com.apple.Safari'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'brave',
    name: 'Brave',
    executableNames: ['brave.exe', 'brave', 'brave-browser'],
    bundleIds: ['com.brave.Browser'],
    desktopEntries: ['brave-browser.desktop'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'arc-browser',
    name: 'Arc Browser',
    executableNames: ['arc.exe', 'arc'],
    bundleIds: ['company.thebrowser.Browser'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },

  // Productivity
  {
    applicationId: 'notion',
    name: 'Notion',
    executableNames: ['notion.exe', 'notion'],
    bundleIds: ['notion.id'],
    desktopEntries: ['notion.desktop'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-word',
    name: 'Microsoft Word',
    executableNames: ['winword.exe'],
    bundleIds: ['com.microsoft.Word'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-excel',
    name: 'Microsoft Excel',
    executableNames: ['excel.exe'],
    bundleIds: ['com.microsoft.Excel'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'obsidian',
    name: 'Obsidian',
    executableNames: ['obsidian.exe', 'obsidian'],
    bundleIds: ['md.obsidian'],
    desktopEntries: ['obsidian.desktop'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },

  // Media
  {
    applicationId: 'spotify',
    name: 'Spotify',
    executableNames: ['spotify.exe', 'spotify', 'spotifylauncher.exe', 'spotify_cli.exe'],
    bundleIds: ['com.spotify.client'],
    desktopEntries: ['spotify.desktop'],
    category: 'Media',
    tracked: false,
    ignored: true,
    isSystemApp: false
  },
  {
    applicationId: 'vlc-media-player',
    name: 'VLC Media Player',
    executableNames: ['vlc.exe', 'vlc'],
    bundleIds: ['org.videolan.vlc'],
    desktopEntries: ['vlc.desktop'],
    category: 'Media',
    tracked: false,
    ignored: true,
    isSystemApp: false
  },

  // Internal / System
  {
    applicationId: 'highp-agent',
    name: 'HighP Agent',
    executableNames: ['highp agent.exe', 'highpagent.exe', 'highp agent', 'highptelemetrynative.exe', 'electron.exe', 'electron'],
    bundleIds: ['com.highphaus.desktopagent'],
    category: 'Other',
    tracked: false,
    ignored: true,
    isSystemApp: true
  }
];

export const normalizeExeKey = (raw: string): string => {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return '';
  const base = path.basename(trimmed);
  return base.endsWith('.exe') ? base : `${base}.exe`;
};

export const normalizeExeStem = (raw: string): string => {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return '';
  const base = path.basename(trimmed);
  return base.replace(/\.exe$/i, '');
};

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Authoritative Cross-Platform Application Resolver
 * Supports both legacy parameter lists and modern query objects.
 */
export function resolveApplication(
  queryOrExecutable: string | ApplicationResolutionQuery,
  executablePathOrTitle?: string,
  processId: number = 0,
  dynamicRegistry: TrackedApplicationEntry[] = [],
  windowTitle?: string
): ResolvedApplication & ResolvedApp {
  let rawExe = '';
  let rawPath = '';
  let pid = processId;
  let bundleId = '';
  let desktopEntry = '';
  let title = '';
  let dynReg = dynamicRegistry;

  if (typeof queryOrExecutable === 'object' && queryOrExecutable !== null) {
    rawExe = queryOrExecutable.executable || '';
    rawPath = queryOrExecutable.executablePath || '';
    pid = queryOrExecutable.processId || 0;
    bundleId = queryOrExecutable.bundleId || '';
    desktopEntry = queryOrExecutable.desktopEntry || '';
    title = queryOrExecutable.windowTitle || '';
    dynReg = queryOrExecutable.dynamicRegistry || dynamicRegistry;
  } else {
    rawExe = (queryOrExecutable || '').trim();
    rawPath = (executablePathOrTitle && (executablePathOrTitle.includes('\\') || executablePathOrTitle.includes('/')) ? executablePathOrTitle.trim().toLowerCase() : '');
    title = windowTitle || (!executablePathOrTitle?.includes('\\') && !executablePathOrTitle?.includes('/') ? executablePathOrTitle : '') || '';
  }

  const normalizedKey = normalizeExeKey(rawExe);
  const normalizedStem = normalizeExeStem(rawExe);
  const normalizedPath = rawPath.toLowerCase();
  const lowerBundle = bundleId.toLowerCase();
  const lowerDesktop = desktopEntry.toLowerCase();

  // 1. Internal Agent Process Check
  if (
    normalizedKey.includes('highp') ||
    normalizedStem.includes('highp') ||
    normalizedStem === 'electron' ||
    normalizedStem.includes('telemetry')
  ) {
    return {
      applicationId: 'highp-agent',
      name: 'HighP Agent',
      applicationName: 'HighP Agent',
      executableName: rawExe || 'HighPAgent',
      processName: rawExe || 'HighPAgent',
      executablePath: normalizedPath,
      bundleId,
      desktopEntry,
      processId: pid,
      category: 'System',
      trackingState: 'IGNORED',
      tracked: false,
      ignored: true,
      isUnknown: false,
      isRecognized: false,
      confidence: 'high'
    };
  }

  // 2. Windows Shell (explorer.exe) vs macOS Shell (Finder)
  if (
    normalizedKey === 'explorer.exe' ||
    normalizedStem === 'shellexperiencehost' ||
    normalizedStem === 'startmenuexperiencehost' ||
    normalizedStem === 'searchhost' ||
    normalizedStem === 'lockapp' ||
    normalizedStem === 'finder' ||
    lowerBundle === 'com.apple.finder'
  ) {
    const rawTitle = title.trim();
    const lowerTitle = rawTitle.toLowerCase();
    const isShellBackground =
      !lowerTitle ||
      lowerTitle === 'program manager' ||
      lowerTitle === 'task switching' ||
      lowerTitle === 'taskbar' ||
      lowerTitle === 'desktop' ||
      lowerTitle.includes('windows shell') ||
      lowerTitle.includes('windows input experience');

    if (isShellBackground) {
      const shellName = normalizedStem === 'finder' || lowerBundle === 'com.apple.finder' ? 'macOS Desktop' : 'Windows Desktop';
      return {
        applicationId: slugify(shellName),
        name: shellName,
        applicationName: shellName,
        executableName: rawExe,
        processName: rawExe,
        executablePath: normalizedPath,
        bundleId,
        desktopEntry,
        processId: pid,
        category: 'System',
        trackingState: 'IGNORED',
        tracked: false,
        ignored: true,
        isUnknown: false,
        isRecognized: true,
        confidence: 'high'
      };
    } else {
      const fileMgrName = normalizedStem === 'finder' || lowerBundle === 'com.apple.finder' ? 'Finder' : 'Windows File Explorer';
      return {
        applicationId: slugify(fileMgrName),
        name: fileMgrName,
        applicationName: fileMgrName,
        executableName: rawExe,
        processName: rawExe,
        executablePath: normalizedPath,
        bundleId,
        desktopEntry,
        processId: pid,
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

  // Helper matcher function
  const matchEntry = (entry: TrackedApplicationEntry): boolean => {
    if (lowerBundle && entry.bundleIds?.some((b) => b.toLowerCase() === lowerBundle)) return true;
    if (lowerDesktop && entry.desktopEntries?.some((d) => d.toLowerCase() === lowerDesktop)) return true;
    if (normalizedPath && entry.executablePaths?.some((p) => p.toLowerCase() === normalizedPath)) return true;
    if (normalizedKey && entry.executableNames.some((e) => normalizeExeKey(e) === normalizedKey)) return true;
    if (normalizedStem && entry.executableNames.some((e) => normalizeExeStem(e) === normalizedStem)) return true;
    return false;
  };

  // 3. Dynamic Registry (Server-synced)
  if (dynReg && dynReg.length > 0) {
    for (const app of dynReg) {
      if (matchEntry(app)) {
        const isTracked = Boolean(app.tracked);
        return {
          applicationId: app.applicationId || app.id || slugify(app.name),
          name: app.name,
          applicationName: app.name,
          executableName: rawExe || app.name,
          processName: rawExe || app.name,
          executablePath: normalizedPath,
          bundleId,
          desktopEntry,
          processId: pid,
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

  // 4. Built-in Default Registry
  for (const app of DEFAULT_REGISTRY_ENTRIES) {
    if (matchEntry(app)) {
      const isTracked = Boolean(app.tracked);
      return {
        applicationId: app.applicationId || slugify(app.name),
        name: app.name,
        applicationName: app.name,
        executableName: rawExe || app.name,
        processName: rawExe || app.name,
        executablePath: normalizedPath,
        bundleId,
        desktopEntry,
        processId: pid,
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

  // 5. Fallback for Unknown Application
  // Critical invariant: Unknown applications are preserved and tracked under 'Other' / 'UNKNOWN'
  const baseName = normalizedStem || lowerBundle || 'unknown';
  const displayName = baseName && baseName !== 'unknown' && baseName !== 'idle'
    ? baseName.charAt(0).toUpperCase() + baseName.slice(1)
    : 'Unknown Application';

  const generatedAppId = slugify(displayName);

  return {
    applicationId: generatedAppId,
    name: displayName,
    applicationName: displayName,
    executableName: rawExe || 'unknown',
    processName: rawExe || 'unknown',
    executablePath: normalizedPath,
    bundleId,
    desktopEntry,
    processId: pid,
    category: 'Other',
    trackingState: 'UNKNOWN',
    tracked: true,
    ignored: false,
    isUnknown: true,
    isRecognized: false,
    confidence: 'unknown'
  };
}

/**
 * Merges server dynamic registry with built-in default registry entries.
 */
export const mergeRegistries = (
  defaultEntries: TrackedApplicationEntry[] = DEFAULT_REGISTRY_ENTRIES,
  serverEntries: TrackedApplicationEntry[] = []
): TrackedApplicationEntry[] => {
  if (!serverEntries || serverEntries.length === 0) {
    return [...defaultEntries];
  }

  const merged: TrackedApplicationEntry[] = [...serverEntries];
  const serverExes = new Set<string>();

  for (const entry of serverEntries) {
    if (Array.isArray(entry.executableNames)) {
      for (const exe of entry.executableNames) {
        serverExes.add(normalizeExeKey(exe));
      }
    }
  }

  for (const def of defaultEntries) {
    const hasOverlap = def.executableNames.some((exe) => serverExes.has(normalizeExeKey(exe)));
    if (!hasOverlap) {
      merged.push(def);
    }
  }

  return merged;
};
