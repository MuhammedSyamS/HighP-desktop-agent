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
      exe.includes('vivaldi')
    );
  }

  /**
   * Correlate native foreground executable with reported website domain
   * Returns { domain } only if the user is CURRENTLY in a browser window.
   */
  public getActiveWebsite(executableName?: string): { domain: string; browser: string } | null {
    if (!this.isBrowserExecutable(executableName)) {
      return null;
    }

    if (!this.latestActivity || !this.latestActivity.domain) {
      return null;
    }

    // Must have been reported within the last 60 seconds to avoid stale background tabs
    const ageMs = Date.now() - this.latestActivity.lastReportedAt.getTime();
    if (ageMs > 60000) {
      return null;
    }

    return {
      domain: this.latestActivity.domain,
      browser: this.latestActivity.browser
    };
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
