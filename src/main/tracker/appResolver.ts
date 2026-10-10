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
  {
    applicationId: 'notepad',
    name: 'Notepad',
    executableNames: ['notepad.exe', 'notepad', 'notepadapp.exe'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'notepad-plus-plus',
    name: 'Notepad++',
    executableNames: ['notepad++.exe', 'notepad++'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'wordpad',
    name: 'WordPad',
    executableNames: ['wordpad.exe', 'write.exe'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-powerpoint',
    name: 'Microsoft PowerPoint',
    executableNames: ['powerpnt.exe'],
    bundleIds: ['com.microsoft.Powerpoint'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    executableNames: ['outlook.exe', 'olk.exe'],
    bundleIds: ['com.microsoft.Outlook'],
    category: 'Communication',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'microsoft-onenote',
    name: 'Microsoft OneNote',
    executableNames: ['onenote.exe', 'onenotem.exe'],
    bundleIds: ['com.microsoft.onenote.mac'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'adobe-acrobat',
    name: 'Adobe Acrobat Reader',
    executableNames: ['acrobat.exe', 'acrord32.exe', 'acroread.exe'],
    bundleIds: ['com.adobe.Reader', 'com.adobe.Acrobat.Pro'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'paint',
    name: 'Paint',
    executableNames: ['mspaint.exe', 'paint.exe', 'pbrush.exe'],
    category: 'Design',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'snipping-tool',
    name: 'Snipping Tool',
    executableNames: ['snippingtool.exe', 'screensketch.exe'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'file-archiver',
    name: '7-Zip / WinRAR',
    executableNames: ['7zfm.exe', '7z.exe', 'winrar.exe'],
    category: 'Productivity',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'opera',
    name: 'Opera',
    executableNames: ['opera.exe', 'operagx.exe', 'opera'],
    bundleIds: ['com.operasoftware.Opera'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'vivaldi',
    name: 'Vivaldi',
    executableNames: ['vivaldi.exe', 'vivaldi'],
    bundleIds: ['com.vivaldi.Vivaldi'],
    category: 'Browsers',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'windows-settings',
    name: 'Windows Settings',
    executableNames: ['systemsettings.exe', 'systemsettingsadminflows.exe'],
    category: 'System',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'task-manager',
    name: 'Task Manager',
    executableNames: ['taskmgr.exe'],
    category: 'System',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'remote-desktop',
    name: 'Remote Desktop',
    executableNames: ['mstsc.exe'],
    category: 'System',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'datagrip',
    name: 'DataGrip',
    executableNames: ['datagrip64.exe', 'datagrip.exe', 'datagrip'],
    bundleIds: ['com.jetbrains.datagrip'],
    category: 'Development',
    tracked: true,
    ignored: false,
    isSystemApp: false
  },
  {
    applicationId: 'pgadmin',
    name: 'pgAdmin',
    executableNames: ['pgadmin4.exe', 'pgadmin.exe'],
    category: 'Development',
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

  // 4.5. Title-based Resolution for UWP Wrappers (ApplicationFrameHost) and Generic Containers
  const cleanTitle = (title || '').trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const isWrapperOrUnknown =
    normalizedStem === 'applicationframehost' ||
    normalizedStem === 'unknown' ||
    normalizedStem === 'electron' ||
    normalizedStem === '';

  if (isWrapperOrUnknown && cleanTitle) {
    // Check known application title matches
    const titleMatches: Array<{ pattern: RegExp; id: string; name: string; category: string }> = [
      { pattern: /\b(windows\s+)?settings\b/i, id: 'windows-settings', name: 'Windows Settings', category: 'System' },
      { pattern: /\bcalculator\b/i, id: 'calculator', name: 'Calculator', category: 'Productivity' },
      { pattern: /\b(microsoft\s+)?photos\b/i, id: 'microsoft-photos', name: 'Microsoft Photos', category: 'Media' },
      { pattern: /\b(snipping\s+tool|snip\s*&\s*sketch)\b/i, id: 'snipping-tool', name: 'Snipping Tool', category: 'Productivity' },
      { pattern: /\bsticky\s+notes\b/i, id: 'sticky-notes', name: 'Sticky Notes', category: 'Productivity' },
      { pattern: /\b(windows\s+)?terminal\b/i, id: 'terminal', name: 'Windows Terminal', category: 'Development' },
      { pattern: /\bpowershell\b/i, id: 'terminal', name: 'PowerShell', category: 'Development' },
      { pattern: /\b(command\s+prompt|cmd\.exe)\b/i, id: 'terminal', name: 'Command Prompt', category: 'Development' },
      { pattern: /\b(google\s+)?chrome\b/i, id: 'google-chrome', name: 'Google Chrome', category: 'Browsers' },
      { pattern: /\bbrave\b/i, id: 'brave', name: 'Brave', category: 'Browsers' },
      { pattern: /\bmicrosoft\s+edge\b/i, id: 'microsoft-edge', name: 'Microsoft Edge', category: 'Browsers' },
      { pattern: /\b(mozilla\s+)?firefox\b/i, id: 'mozilla-firefox', name: 'Mozilla Firefox', category: 'Browsers' },
      { pattern: /\bvisual\s+studio\s+code\b/i, id: 'visual-studio-code', name: 'Visual Studio Code', category: 'Development' },
      { pattern: /\bantigravity\b/i, id: 'antigravity-ide', name: 'Antigravity IDE', category: 'Development' },
      { pattern: /\bcursor\b/i, id: 'cursor', name: 'Cursor', category: 'Development' },
      { pattern: /\bnotepad\+\+/i, id: 'notepad-plus-plus', name: 'Notepad++', category: 'Development' },
      { pattern: /\bnotepad\b/i, id: 'notepad', name: 'Notepad', category: 'Productivity' },
      { pattern: /\bword\b/i, id: 'microsoft-word', name: 'Microsoft Word', category: 'Productivity' },
      { pattern: /\bexcel\b/i, id: 'microsoft-excel', name: 'Microsoft Excel', category: 'Productivity' },
      { pattern: /\bpowerpoint\b/i, id: 'microsoft-powerpoint', name: 'Microsoft PowerPoint', category: 'Productivity' },
      { pattern: /\boutlook\b/i, id: 'microsoft-outlook', name: 'Microsoft Outlook', category: 'Communication' },
      { pattern: /\bslack\b/i, id: 'slack', name: 'Slack', category: 'Communication' },
      { pattern: /\bmicrosoft\s+teams\b/i, id: 'microsoft-teams', name: 'Microsoft Teams', category: 'Communication' },
      { pattern: /\bdiscord\b/i, id: 'discord', name: 'Discord', category: 'Communication' },
      { pattern: /\btelegram\b/i, id: 'telegram', name: 'Telegram', category: 'Communication' },
      { pattern: /\bwhatsapp\b/i, id: 'whatsapp', name: 'WhatsApp', category: 'Communication' },
      { pattern: /\bzoom\b/i, id: 'zoom', name: 'Zoom', category: 'Communication' },
      { pattern: /\bfigma\b/i, id: 'figma', name: 'Figma', category: 'Design' },
      { pattern: /\bcanva\b/i, id: 'canva', name: 'Canva', category: 'Design' },
      { pattern: /\bspotify\b/i, id: 'spotify', name: 'Spotify', category: 'Media' },
      { pattern: /\bvlc\b/i, id: 'vlc-media-player', name: 'VLC Media Player', category: 'Media' }
    ];

    for (const tm of titleMatches) {
      if (tm.pattern.test(cleanTitle)) {
        return {
          applicationId: tm.id,
          name: tm.name,
          applicationName: tm.name,
          executableName: rawExe || `${tm.id}.exe`,
          processName: rawExe || `${tm.id}.exe`,
          executablePath: normalizedPath,
          bundleId,
          desktopEntry,
          processId: pid,
          category: tm.category,
          trackingState: 'TRACKED',
          tracked: true,
          ignored: false,
          isUnknown: false,
          isRecognized: true,
          confidence: 'high'
        };
      }
    }

    // Attempt to extract trailing application name after separator (e.g. "Document1 - WordPad" -> "WordPad")
    const sepMatch = cleanTitle.match(/(?:[-–—|]\s*)([A-Za-z0-9\s+._]{2,30})$/);
    if (sepMatch && sepMatch[1]) {
      const extractedName = sepMatch[1].trim();
      const extractedSlug = slugify(extractedName);
      if (extractedSlug && extractedSlug !== 'unknown' && extractedSlug !== 'desktop') {
        const foundInDefault = DEFAULT_REGISTRY_ENTRIES.find((d) => slugify(d.name) === extractedSlug || d.executableNames.some((e) => normalizeExeStem(e) === extractedSlug));
        if (foundInDefault) {
          return {
            applicationId: foundInDefault.applicationId || slugify(foundInDefault.name),
            name: foundInDefault.name,
            applicationName: foundInDefault.name,
            executableName: rawExe || foundInDefault.name,
            processName: rawExe || foundInDefault.name,
            executablePath: normalizedPath,
            bundleId,
            desktopEntry,
            processId: pid,
            category: foundInDefault.category,
            trackingState: foundInDefault.tracked ? 'TRACKED' : 'IGNORED',
            tracked: Boolean(foundInDefault.tracked),
            ignored: Boolean(foundInDefault.ignored),
            isUnknown: false,
            isRecognized: true,
            confidence: 'high'
          };
        }
      }
    }
  }

  // 5. Fallback for Unknown Application
  // Critical invariant: Unknown applications are preserved and tracked under 'Other' / 'UNKNOWN'
  const isGenericUnknown = !normalizedStem || normalizedStem === 'unknown' || normalizedStem === 'idle';
  let displayName = 'Unknown Application';
  let inferredCategory = 'Other';

  if (!isGenericUnknown) {
    displayName = normalizedStem.charAt(0).toUpperCase() + normalizedStem.slice(1);

    const lowerStem = normalizedStem.toLowerCase();
    if (/code|dev|studio|git|sql|db|term|cli|sdk|debug|compiler|ide|vim|emacs|query/.test(lowerStem)) {
      inferredCategory = 'Development';
    } else if (/doc|sheet|calc|note|pdf|text|office|task|todo|word|excel|presentation|writer/.test(lowerStem)) {
      inferredCategory = 'Productivity';
    } else if (/chat|talk|call|meet|mail|msg|teams|slack|discord|zoom|telegram|whatsapp|phone/.test(lowerStem)) {
      inferredCategory = 'Communication';
    } else if (/draw|paint|design|photo|image|video|3d|blend|render|art|cad|sketch/.test(lowerStem)) {
      inferredCategory = 'Design';
    } else if (/chrome|edge|firefox|browser|brave|opera|vivaldi|arc|tor|web|surf/.test(lowerStem)) {
      inferredCategory = 'Browsers';
    } else if (/music|media|sound|audio|player|spotify|vlc|stream|radio|movie/.test(lowerStem)) {
      inferredCategory = 'Media';
    }
  } else if (cleanTitle) {
    if (cleanTitle !== 'Program Manager' && cleanTitle !== 'Taskbar' && cleanTitle !== 'Desktop') {
      displayName = cleanTitle.length > 36 ? cleanTitle.slice(0, 36) + '...' : cleanTitle;
    }
  }

  const generatedAppId = slugify(displayName) || 'unknown-application';

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
    category: inferredCategory,
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
