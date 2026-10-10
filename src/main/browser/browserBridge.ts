import http from 'http';

export type BrowserTelemetryState =
  | 'BROWSER_ACTIVE_WEBSITE_KNOWN'
  | 'BROWSER_ACTIVE_WEBSITE_UNKNOWN'
  | 'BROWSER_TELEMETRY_STALE'
  | 'NOT_BROWSER';

export interface BrowserTabReport {
  eventType?: string;
  browser: string;
  active: boolean;
  windowId: number;
  tabId: number;
  domain: string;
  url?: string;
  title?: string;
  timestamp: string;
  receivedAt: number;
}

export interface ActiveWebsiteInfo {
  domain: string;
  browser: string;
  windowId?: number;
  tabId?: number;
  url?: string;
  title?: string;
  source: 'extension' | 'title';
}

export interface BrowserResolutionResult {
  website: ActiveWebsiteInfo | null;
  state: BrowserTelemetryState;
}

export class BrowserBridge {
  private server: http.Server | null = null;
  private port: number = 41789;
  private latestReportsByBrowser: Map<string, BrowserTabReport> = new Map();
  private reportsByWindowId: Map<number, BrowserTabReport> = new Map();
  private freshnessWindowMs: number = 6000; // 6 seconds maximum freshness window
  private lastAnyReportAt: number = 0;
  private onWebsiteEventCallback?: (report: BrowserTabReport) => void;

  constructor(port = 41789, freshnessWindowMs = 6000) {
    this.port = port;
    this.freshnessWindowMs = freshnessWindowMs;
  }

  public setFreshnessWindow(ms: number): void {
    this.freshnessWindowMs = Math.max(2000, ms);
  }

  public setOnWebsiteEvent(callback: (report: BrowserTabReport) => void): void {
    this.onWebsiteEventCallback = callback;
  }

  public getLastReportTime(): number {
    return this.lastAnyReportAt;
  }

  public isConnected(): boolean {
    return this.lastAnyReportAt > 0 && (Date.now() - this.lastAnyReportAt < 15000);
  }

  /**
   * Start localhost-only HTTP server to receive active tabs from the HighP companion extension
   */
  public start(): void {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      // Security Validation (Requirement 27): Validate request origin
      const origin = (req.headers['origin'] || '').toLowerCase();
      const isAllowedOrigin =
        !origin ||
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('moz-extension://') ||
        origin.startsWith('edge-extension://') ||
        origin.startsWith('safari-web-extension://') ||
        origin.includes('127.0.0.1') ||
        origin.includes('localhost');

      if (!isAllowedOrigin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Forbidden origin' }));
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-HighP-Extension, Authorization');
      res.setHeader('Connection', 'close');

      req.on('error', (err) => {
        console.warn('[BrowserBridge] Request socket error:', err.message);
      });

      const urlPath = (req.url || '').split('?')[0];

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && urlPath === '/api/browser/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          connected: this.isConnected(),
          lastReportAt: this.lastAnyReportAt ? new Date(this.lastAnyReportAt).toISOString() : null,
          browsersTracking: Array.from(this.latestReportsByBrowser.keys())
        }));
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/browser/activity') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 32768) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
            req.destroy();
          }
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data || typeof data !== 'object') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
              return;
            }

            const browser = String(data.browser || 'Browser').trim().slice(0, 64);
            const normalizedBrowserKey = this.normalizeBrowserKey(browser);
            const windowId = Number(data.windowId) || 0;
            const tabId = Number(data.tabId) || 0;
            this.lastAnyReportAt = Date.now();

            if (data.active === false || !data.domain) {
              // Window blurred, tab closed, or blank internal page
              this.latestReportsByBrowser.delete(normalizedBrowserKey);
              if (windowId) this.reportsByWindowId.delete(windowId);

              if (this.onWebsiteEventCallback) {
                this.onWebsiteEventCallback({
                  eventType: data.eventType || 'BLURRED',
                  browser,
                  active: false,
                  windowId,
                  tabId,
                  domain: '',
                  timestamp: data.timestamp || new Date().toISOString(),
                  receivedAt: Date.now()
                });
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, active: false }));
              return;
            }

            const cleanDomain = this.normalizeDomain(String(data.domain || ''));
            if (cleanDomain) {
              const report: BrowserTabReport = {
                eventType: data.eventType || 'NAVIGATED',
                browser,
                active: true,
                windowId,
                tabId,
                domain: cleanDomain,
                url: data.url ? String(data.url).slice(0, 500) : undefined,
                title: data.title ? String(data.title).slice(0, 300) : cleanDomain,
                timestamp: data.timestamp || new Date().toISOString(),
                receivedAt: Date.now()
              };

              this.latestReportsByBrowser.set(normalizedBrowserKey, report);
              if (windowId) this.reportsByWindowId.set(windowId, report);

              if (this.onWebsiteEventCallback) {
                this.onWebsiteEventCallback(report);
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, domain: cleanDomain }));
              return;
            }
          } catch (err: any) {
            console.warn('[BrowserBridge] Error parsing activity payload:', err.message);
          }

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.server.on('error', (err: any) => {
      console.warn(`[BrowserBridge] Local HTTP server error on port ${this.port}:`, err.message);
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[BrowserBridge] Event-driven Browser Companion Bridge listening on http://127.0.0.1:${this.port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.latestReportsByBrowser.clear();
    this.reportsByWindowId.clear();
  }

  public recordReport(report: BrowserTabReport): void {
    const normalizedBrowserKey = this.normalizeBrowserKey(report.browser);
    this.lastAnyReportAt = Date.now();
    if (report.active === false || !report.domain) {
      this.latestReportsByBrowser.delete(normalizedBrowserKey);
      if (report.windowId) this.reportsByWindowId.delete(report.windowId);
      if (this.onWebsiteEventCallback) {
        this.onWebsiteEventCallback({
          eventType: report.eventType || 'BLURRED',
          browser: report.browser,
          active: false,
          windowId: report.windowId,
          tabId: report.tabId,
          domain: '',
          timestamp: report.timestamp || new Date().toISOString(),
          receivedAt: Date.now()
        });
      }
      return;
    }

    const cleanDomain = this.normalizeDomain(report.domain);
    if (cleanDomain) {
      const fullReport: BrowserTabReport = {
        eventType: report.eventType || 'NAVIGATED',
        browser: report.browser,
        active: true,
        windowId: report.windowId,
        tabId: report.tabId,
        domain: cleanDomain,
        url: report.url,
        title: report.title || cleanDomain,
        timestamp: report.timestamp || new Date().toISOString(),
        receivedAt: report.receivedAt || Date.now()
      };
      this.latestReportsByBrowser.set(normalizedBrowserKey, fullReport);
      if (report.windowId) this.reportsByWindowId.set(report.windowId, fullReport);
      if (this.onWebsiteEventCallback) {
        this.onWebsiteEventCallback(fullReport);
      }
    }
  }

  public normalizeBrowserKey(raw: string): string {
    const lower = (raw || '').toLowerCase();
    if (lower.includes('chrome')) return 'chrome';
    if (lower.includes('edge')) return 'edge';
    if (lower.includes('brave')) return 'brave';
    if (lower.includes('firefox')) return 'firefox';
    if (lower.includes('opera')) return 'opera';
    if (lower.includes('arc')) return 'arc';
    if (lower.includes('vivaldi')) return 'vivaldi';
    return lower || 'browser';
  }

  public isBrowserExecutable(executableName?: string): boolean {
    if (!executableName) return false;
    const exe = executableName.toLowerCase();
    return (
      exe === 'chrome.exe' ||
      exe === 'msedge.exe' ||
      exe === 'brave.exe' ||
      exe === 'firefox.exe' ||
      exe === 'opera.exe' ||
      exe === 'vivaldi.exe' ||
      exe === 'arc.exe' ||
      exe.includes('chrome') ||
      exe.includes('msedge') ||
      exe.includes('brave') ||
      exe.includes('firefox') ||
      exe.includes('opera') ||
      exe.includes('vivaldi') ||
      exe.includes('arc')
    );
  }

  public resolveBrowserName(executableName?: string): string {
    if (!executableName) return 'Browser';
    const exe = executableName.toLowerCase();
    if (exe.includes('brave')) return 'Brave';
    if (exe.includes('msedge') || exe.includes('edge')) return 'Microsoft Edge';
    if (exe.includes('chrome')) return 'Google Chrome';
    if (exe.includes('firefox')) return 'Mozilla Firefox';
    if (exe.includes('opera')) return 'Opera';
    if (exe.includes('vivaldi')) return 'Vivaldi';
    if (exe.includes('arc')) return 'Arc Browser';
    return 'Web Browser';
  }

  /**
   * Resolves website attribution state with clean separation:
   * 1. Browser is active
   * 2. Website identity is known vs unknown vs telemetry stale
   */
  public resolveWebsiteState(
    executableName?: string,
    windowTitle?: string,
    windowId?: number | string
  ): BrowserResolutionResult {
    if (!this.isBrowserExecutable(executableName)) {
      return { website: null, state: 'NOT_BROWSER' };
    }

    const browserName = this.resolveBrowserName(executableName);
    const browserKey = this.normalizeBrowserKey(executableName || '');

    // 1. Try window-specific report first if windowId provided
    const numericWinId = typeof windowId === 'number' ? windowId : (typeof windowId === 'string' && !isNaN(Number(windowId)) ? Number(windowId) : 0);
    let report = numericWinId ? this.reportsByWindowId.get(numericWinId) : undefined;

    // 2. Try matching by windowTitle across window reports
    if (!report && windowTitle) {
      for (const r of this.reportsByWindowId.values()) {
        if (r.active && r.title && (windowTitle.includes(r.title) || r.title.includes(windowTitle))) {
          report = r;
          break;
        }
      }
    }

    // 3. Fallback to latest report for this browser family
    if (!report) {
      report = this.latestReportsByBrowser.get(browserKey);
    }

    if (report) {
      if (!report.active || !report.domain) {
        return { website: null, state: 'BROWSER_ACTIVE_WEBSITE_UNKNOWN' };
      }

      const ageMs = Date.now() - report.receivedAt;
      if (ageMs > this.freshnessWindowMs) {
        // Telemetry is STALE! Do NOT continue attributing time to the old website!
        return { website: null, state: 'BROWSER_TELEMETRY_STALE' };
      }

      // Fresh, active report from companion extension
      return {
        website: {
          domain: report.domain,
          browser: report.browser || browserName,
          windowId: report.windowId,
          tabId: report.tabId,
          url: report.url,
          title: report.title,
          source: 'extension'
        },
        state: 'BROWSER_ACTIVE_WEBSITE_KNOWN'
      };
    }

    // Fallback: Native Window Title Domain Extractor
    if (windowTitle) {
      const titleDomain = this.extractDomainFromTitle(windowTitle);
      if (titleDomain) {
        return {
          website: {
            domain: titleDomain,
            browser: browserName,
            title: windowTitle,
            source: 'title'
          },
          state: 'BROWSER_ACTIVE_WEBSITE_KNOWN'
        };
      }
    }

    return { website: null, state: 'BROWSER_ACTIVE_WEBSITE_UNKNOWN' };
  }

  public getActiveWebsite(executableName?: string, windowTitle?: string): ActiveWebsiteInfo | null {
    return this.resolveWebsiteState(executableName, windowTitle).website;
  }

  public extractDomainFromTitle(windowTitle?: string): string | null {
    if (!windowTitle || typeof windowTitle !== 'string') return null;
    const title = windowTitle.trim();
    if (!title) return null;

    // Strip common browser title suffixes
    const strippedTitle = title
      .replace(/\s*[-–—|]\s*(Google Chrome|Brave|Microsoft\s*Edge|Mozilla Firefox|Opera|Vivaldi|Arc)(\s*and\s*\d+\s*more\s*pages)?$/i, '')
      .trim();

    // 1. Direct domain match in title (com, org, net, io, app, ai, dev, etc.)
    const domainRegex = /\b(?:https?:\/\/)?([a-zA-Z0-9-]+\.(?:com|org|net|io|so|app|ai|dev|co|in|edu|gov|xyz|live|tech|agency|cloud|store|info|me|online|site|tv|cc|ca|uk|us|de|fr|jp|br|au|ru|it|nl|eu|world|pro|space|fun|club|design|shop|top|vip|work|mobi|gg|link)(?::[0-9]+)?)\b/i;
    const match = title.match(domainRegex) || strippedTitle.match(domainRegex);
    if (match && match[1]) {
      const rawDomain = match[1].toLowerCase().replace(/^www\./, '');
      const cleanHost = rawDomain.split(':')[0];
      if (
        !cleanHost.includes('chrome') &&
        !cleanHost.includes('edge') &&
        !cleanHost.includes('firefox') &&
        !cleanHost.includes('brave') &&
        !cleanHost.includes('opera') &&
        !cleanHost.includes('vivaldi')
      ) {
        return cleanHost;
      }
    }

    // 2. Localhost & Private IP ports
    const localMatch = title.match(/\b(localhost(?::[0-9]+)?)\b/i);
    if (localMatch && localMatch[1]) {
      return localMatch[1].toLowerCase();
    }
    const ipMatch = title.match(/\b(127\.0\.0\.1(?::[0-9]+)?)\b/);
    if (ipMatch && ipMatch[1]) {
      return ipMatch[1];
    }

    const lower = title.toLowerCase();
    const lowerStripped = strippedTitle.toLowerCase();

    // 3. Known Top Platforms & Work Websites
    if (lower.includes('github')) return 'github.com';
    if (lower.includes('gitlab')) return 'gitlab.com';
    if (lower.includes('bitbucket')) return 'bitbucket.org';
    if (lower.includes('stackoverflow') || lower.includes('stack overflow')) return 'stackoverflow.com';
    if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt.com';
    if (lower.includes('claude') || lower.includes('anthropic')) return 'claude.ai';
    if (lower.includes('perplexity')) return 'perplexity.ai';
    if (lower.includes('deepseek')) return 'deepseek.com';
    if (lower.includes('leetcode')) return 'leetcode.com';
    if (lower.includes('hackerrank')) return 'hackerrank.com';
    if (lower.includes('geeksforgeeks')) return 'geeksforgeeks.org';
    if (lower.includes('mdn web docs') || lower.includes('developer.mozilla')) return 'developer.mozilla.org';
    if (lower.includes('w3schools')) return 'w3schools.com';
    if (lower.includes('vercel')) return 'vercel.com';
    if (lower.includes('netlify')) return 'netlify.com';
    if (lower.includes('render.com') || lower.includes('render dashboard')) return 'render.com';
    if (lower.includes('supabase')) return 'supabase.com';
    if (lower.includes('firebase')) return 'firebase.google.com';
    if (lower.includes('aws management console') || lower.includes('amazon web services')) return 'aws.amazon.com';
    if (lower.includes('azure portal') || lower.includes('microsoft azure')) return 'portal.azure.com';
    if (lower.includes('linear –') || lower.includes('linear -') || lower.includes('linear |')) return 'linear.app';
    if (lower.includes('postman')) return 'web.postman.co';
    if (lower.includes('figma')) return 'figma.com';
    if (lower.includes('notion')) return 'notion.so';
    if (lower.includes('canva')) return 'canva.com';
    if (lower.includes('miro')) return 'miro.com';
    if (lower.includes('gmail') || lower.includes('google mail')) return 'mail.google.com';
    if (lower.includes('google meet')) return 'meet.google.com';
    if (lower.includes('google doc')) return 'docs.google.com';
    if (lower.includes('google sheet')) return 'sheets.google.com';
    if (lower.includes('google slide')) return 'slides.google.com';
    if (lower.includes('google drive')) return 'drive.google.com';
    if (lower.includes('google calendar')) return 'calendar.google.com';
    if (lower.includes('google search') || lowerStripped === 'google') return 'google.com';
    if (lower.includes('slack')) return 'slack.com';
    if (lower.includes('trello')) return 'trello.com';
    if (lower.includes('jira') || lower.includes('atlassian') || lower.includes('confluence')) return 'atlassian.net';
    if (lower.includes('asana')) return 'asana.com';
    if (lower.includes('clickup')) return 'clickup.com';
    if (lower.includes('whatsapp')) return 'web.whatsapp.com';
    if (lower.includes('telegram')) return 'web.telegram.org';
    if (lower.includes('discord')) return 'discord.com';
    if (lower.includes('youtube')) return 'youtube.com';
    if (lower.includes('linkedin')) return 'linkedin.com';
    if (lower.includes('twitter') || lower.includes(' x.com') || lower.includes(' / x') || lowerStripped === 'x') return 'x.com';
    if (lower.includes('reddit')) return 'reddit.com';
    if (lower.includes('wikipedia')) return 'wikipedia.org';
    if (lower.includes('amazon')) return 'amazon.com';
    if (lower.includes('flipkart')) return 'flipkart.com';
    if (lower.includes('netflix')) return 'netflix.com';
    if (lower.includes('coursera')) return 'coursera.org';
    if (lower.includes('udemy')) return 'udemy.com';
    if (lower.includes('medium')) return 'medium.com';
    if (lower.includes('dev.to')) return 'dev.to';
    if (lower.includes('hashnode')) return 'hashnode.com';
    if (lower.includes('spotify')) return 'open.spotify.com';
    if (lower.includes('twitch')) return 'twitch.tv';
    if (lower.includes('pinterest')) return 'pinterest.com';
    if (lower.includes('quora')) return 'quora.com';
    if (lower.includes('dropbox')) return 'dropbox.com';
    if (lower.includes('zoom')) return 'zoom.us';
    if (lower.includes('npm')) return 'npmjs.com';

    // 4. Popular Documentation & Libraries
    if (lower.includes('react')) return 'react.dev';
    if (lower.includes('vue')) return 'vuejs.org';
    if (lower.includes('angular')) return 'angular.dev';
    if (lower.includes('next.js') || lower.includes('nextjs')) return 'nextjs.org';
    if (lower.includes('tailwind')) return 'tailwindcss.com';
    if (lower.includes('typescript')) return 'typescriptlang.org';
    if (lower.includes('python')) return 'python.org';

    return null;
  }

  public normalizeDomain(rawUrlOrDomain: string): string | null {
    if (!rawUrlOrDomain || typeof rawUrlOrDomain !== 'string') return null;
    try {
      let input = rawUrlOrDomain.trim().toLowerCase();
      if (
        input.startsWith('chrome://') ||
        input.startsWith('brave://') ||
        input.startsWith('edge://') ||
        input.startsWith('about:') ||
        input.startsWith('data:') ||
        input.startsWith('file:') ||
        input.startsWith('devtools:')
      ) {
        return null;
      }

      let host = input;
      if (host.includes('://')) {
        const parsed = new URL(rawUrlOrDomain.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return null;
        }
        host = parsed.hostname;
      } else {
        host = host.split('/')[0].split('?')[0].split('#')[0];
      }
      host = host.toLowerCase().trim();
      if (host.startsWith('www.')) {
        host = host.slice(4);
      }
      if (host.includes(':')) {
        host = host.split(':')[0];
      }
      return host || null;
    } catch {
      return null;
    }
  }
}

export const browserBridge = new BrowserBridge();
