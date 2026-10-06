import http from 'http';

export interface BrowserActivityRecord {
  browser: string;
  domain: string;
  tabActivatedAt: Date;
  lastReportedAt: Date;
}

export class BrowserBridge {
  private server: http.Server | null = null;
  private port: number = 41789;
  private latestActivity: BrowserActivityRecord | null = null;
  private onDomainSwitchCallback?: (previousDomain: string | null, newDomain: string) => void;

  constructor(port = 41789) {
    this.port = port;
  }

  public setOnDomainSwitch(callback: (prev: string | null, newDomain: string) => void): void {
    this.onDomainSwitchCallback = callback;
  }

  /**
   * Start localhost-only HTTP server to receive active tabs from the HighP browser extension
   */
  public start(): void {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      // CORS headers allowing browser extension requests
      res.setHeader('Access-Control-Allow-Origin', '*');
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
        res.end(JSON.stringify({ status: 'ok', domain: this.latestActivity?.domain || null }));
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/browser/activity') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 10240) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
            req.destroy();
          }
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const rawDomain = (data.domain || '').trim();
            const cleanDomain = this.normalizeDomain(rawDomain);
            const browser = (data.browser || 'Browser').trim();

            if (cleanDomain) {
              const previousDomain = this.latestActivity?.domain || null;
              const isSwitch = previousDomain !== cleanDomain;

              this.latestActivity = {
                browser,
                domain: cleanDomain,
                tabActivatedAt: data.tabActivatedAt ? new Date(data.tabActivatedAt) : new Date(),
                lastReportedAt: new Date()
              };

              if (isSwitch && this.onDomainSwitchCallback) {
                this.onDomainSwitchCallback(previousDomain, cleanDomain);
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, domain: cleanDomain }));
              return;
            }
          } catch (err: any) {
            console.warn('[BrowserBridge] Error parsing activity payload:', err.message);
          }

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid domain' }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.server.on('error', (err: any) => {
      console.warn(`[BrowserBridge] Local HTTP server error on port ${this.port}:`, err.message);
    });

    // Listen strictly on localhost IPv4 (127.0.0.1)
    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[BrowserBridge] Privacy-Safe Browser Extension Bridge listening on http://127.0.0.1:${this.port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.latestActivity = null;
  }

  /**
   * Returns true if executable represents a recognized web browser
   */
  public isBrowserExecutable(executableName?: string): boolean {
    if (!executableName) return false;
    const exe = executableName.toLowerCase();
    return (
      exe.includes('brave') ||
      exe.includes('chrome') ||
      exe.includes('msedge') ||
      exe.includes('edge') ||
      exe.includes('firefox') ||
      exe.includes('opera') ||
      exe.includes('vivaldi') ||
      exe.includes('arc') ||
      exe.includes('chromium') ||
      exe.includes('waterfox')
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
   * Correlate native foreground executable and window title with reported website domain.
   * Multi-layer accuracy:
   * 1. Extension reported active domain (highest fidelity from active tab URL)
   * 2. Intelligent Window Title Domain & Web Application Extractor (instant native fallback)
   */
  public getActiveWebsite(
    executableName?: string,
    windowTitle?: string
  ): { domain: string; browser: string } | null {
    if (!this.isBrowserExecutable(executableName)) {
      return null;
    }

    const browser = this.resolveBrowserName(executableName);

    // 1. Check direct report from HighP Browser Extension
    if (this.latestActivity && this.latestActivity.domain) {
      const ageMs = Date.now() - this.latestActivity.lastReportedAt.getTime();
      // Keep active for up to 3 minutes or while current browser is continuously focused
      if (ageMs <= 180000) {
        return {
          domain: this.latestActivity.domain,
          browser: this.latestActivity.browser || browser
        };
      }
    }

    // 2. Intelligent Window Title Domain & Platform Extractor
    if (windowTitle) {
      const titleDomain = this.extractDomainFromTitle(windowTitle);
      if (titleDomain) {
        return {
          domain: titleDomain,
          browser
        };
      }
    }

    return null;
  }

  /**
   * High-accuracy domain and web application extractor from native browser window titles.
   * Recognizes explicit domains, local dev servers, and standard web application titles.
   */
  public extractDomainFromTitle(windowTitle?: string): string | null {
    if (!windowTitle || typeof windowTitle !== 'string') return null;
    const title = windowTitle.trim();
    if (!title) return null;

    // Pattern A: Match explicit domain in title (e.g. "high-p-agent.vercel.app/dashboard", "github.com/org/repo")
    const domainRegex = /\b(?:https?:\/\/)?([a-zA-Z0-9-]+\.(?:com|org|net|io|so|app|ai|dev|co|in|edu|gov|xyz|live|tech|agency|cloud|store|info|me|online|site|tv|cc)(?::[0-9]+)?)\b/i;
    const match = title.match(domainRegex);
    if (match && match[1]) {
      const rawDomain = match[1].toLowerCase().replace(/^www\./, '');
      const cleanHost = rawDomain.split(':')[0];
      // Exclude browser names themselves
      if (
        !cleanHost.includes('chrome') &&
        !cleanHost.includes('edge') &&
        !cleanHost.includes('firefox') &&
        !cleanHost.includes('brave') &&
        !cleanHost.includes('opera')
      ) {
        return cleanHost;
      }
    }

    // Pattern B: Localhost development servers (e.g. "localhost:3000", "localhost:3001", "127.0.0.1:5173")
    const localMatch = title.match(/\b(localhost(?::[0-9]+)?)\b/i);
    if (localMatch && localMatch[1]) {
      return localMatch[1].toLowerCase();
    }
    const ipMatch = title.match(/\b(127\.0\.0\.1(?::[0-9]+)?)\b/);
    if (ipMatch && ipMatch[1]) {
      return ipMatch[1];
    }

    // Pattern C: Authoritative Web Platforms & Services in Title
    const lower = title.toLowerCase();

    // Developer & Cloud Tools
    if (lower.includes('github')) return 'github.com';
    if (lower.includes('gitlab')) return 'gitlab.com';
    if (lower.includes('bitbucket')) return 'bitbucket.org';
    if (lower.includes('stackoverflow') || lower.includes('stack overflow')) return 'stackoverflow.com';
    if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt.com';
    if (lower.includes('claude') || lower.includes('anthropic')) return 'claude.ai';
    if (lower.includes('vercel')) return 'vercel.com';
    if (lower.includes('netlify')) return 'netlify.com';
    if (lower.includes('render.com') || lower.includes('render dashboard')) return 'render.com';
    if (lower.includes('aws management console') || lower.includes('amazon web services')) return 'aws.amazon.com';
    if (lower.includes('azure portal') || lower.includes('microsoft azure')) return 'portal.azure.com';
    if (lower.includes('linear –') || lower.includes('linear -')) return 'linear.app';
    if (lower.includes('postman')) return 'web.postman.co';

    // Collaboration & Design
    if (lower.includes('figma')) return 'figma.com';
    if (lower.includes('notion')) return 'notion.so';
    if (lower.includes('canva')) return 'canva.com';
    if (lower.includes('miro')) return 'miro.com';

    // Google Workspace & Productivity
    if (lower.includes('gmail') || lower.includes('google mail')) return 'mail.google.com';
    if (lower.includes('google meet')) return 'meet.google.com';
    if (lower.includes('google doc')) return 'docs.google.com';
    if (lower.includes('google sheet')) return 'sheets.google.com';
    if (lower.includes('google slide')) return 'slides.google.com';
    if (lower.includes('google drive')) return 'drive.google.com';
    if (lower.includes('google calendar')) return 'calendar.google.com';

    // Communication & Project Management
    if (lower.includes('slack')) return 'slack.com';
    if (lower.includes('trello')) return 'trello.com';
    if (lower.includes('jira') || lower.includes('atlassian') || lower.includes('confluence')) return 'atlassian.net';
    if (lower.includes('asana')) return 'asana.com';
    if (lower.includes('clickup')) return 'clickup.com';
    if (lower.includes('whatsapp')) return 'web.whatsapp.com';
    if (lower.includes('telegram')) return 'web.telegram.org';
    if (lower.includes('discord')) return 'discord.com';

    // Media & Social
    if (lower.includes('youtube')) return 'youtube.com';
    if (lower.includes('linkedin')) return 'linkedin.com';
    if (lower.includes('twitter') || lower.includes(' x.com') || lower.includes(' / x')) return 'x.com';
    if (lower.includes('reddit')) return 'reddit.com';

    return null;
  }

  /**
   * Privacy-Safe Domain Normalization (Section 8)
   */
  public normalizeDomain(rawUrlOrDomain: string): string | null {
    if (!rawUrlOrDomain || typeof rawUrlOrDomain !== 'string') return null;
    try {
      let input = rawUrlOrDomain.trim().toLowerCase();
      // Drop internal browser schemes
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
        // May be a domain like 'notion.so/workspace'
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
