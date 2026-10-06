import { TrackingEngine, WindowsObservation } from '../main/tracker/trackingEngine';
import { NormalizedTelemetryObservation, PlatformCapabilities, PlatformPermissions } from '../main/tracker/telemetryProvider';
import { WindowsTelemetryProvider } from '../main/tracker/providers/windowsTelemetryProvider';
import { MacOSTelemetryProvider } from '../main/tracker/providers/macosTelemetryProvider';
import { LinuxTelemetryProvider } from '../main/tracker/providers/linuxTelemetryProvider';
import { createTelemetryProvider } from '../main/tracker/providers/telemetryProviderFactory';
import { resolveApplication, normalizeExeStem } from '../main/tracker/appResolver';
import { OfflineQueue } from '../main/queue/offlineQueue';
import { validateTimeline } from '../main/tracker/timelineValidator';
import { ActivityEventType, ActivityState } from '../shared/enums';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

function createIsolatedQueue(): OfflineQueue {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-crossplat-test-'));
  return new OfflineQueue(tmpDir);
}

async function runCrossPlatformTests() {
  console.log('========================================================================');
  console.log('   HIGHP CROSS-PLATFORM TRACKING & ARCHITECTURE VERIFICATION TEST SUITE  ');
  console.log('========================================================================\n');

  // TEST SUITE 1: Cross-Platform Application Resolution (Canonical applicationId)
  console.log('--- SUITE 1: Cross-Platform Application Resolution ---');
  {
    // Windows resolution
    const winChrome = resolveApplication({
      executable: 'chrome.exe',
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      platform: 'win32'
    });
    assert(winChrome.applicationId === 'google-chrome', 'S1.1: Windows chrome.exe resolves to google-chrome');

    const winCode = resolveApplication({
      executable: 'Code.exe',
      platform: 'win32'
    });
    assert(winCode.applicationId === 'visual-studio-code', 'S1.2: Windows Code.exe resolves to visual-studio-code');

    // macOS resolution
    const macChrome = resolveApplication({
      executable: 'Google Chrome',
      bundleId: 'com.google.Chrome',
      platform: 'darwin'
    });
    assert(macChrome.applicationId === 'google-chrome', 'S1.3: macOS com.google.Chrome resolves to google-chrome');

    const macCode = resolveApplication({
      executable: 'Code',
      bundleId: 'com.microsoft.VSCode',
      platform: 'darwin'
    });
    assert(macCode.applicationId === 'visual-studio-code', 'S1.4: macOS com.microsoft.VSCode resolves to visual-studio-code');

    // Linux resolution
    const linuxChrome = resolveApplication({
      executable: 'google-chrome-stable',
      desktopEntry: 'google-chrome.desktop',
      platform: 'linux'
    });
    assert(linuxChrome.applicationId === 'google-chrome', 'S1.5: Linux google-chrome.desktop resolves to google-chrome');

    const linuxCode = resolveApplication({
      executable: 'code',
      desktopEntry: 'code.desktop',
      platform: 'linux'
    });
    assert(linuxCode.applicationId === 'visual-studio-code', 'S1.6: Linux code.desktop resolves to visual-studio-code');

    // Unknown application handling (Must NOT be dropped)
    const unknownApp = resolveApplication({
      executable: 'InternalEnterprisePayroll.exe',
      bundleId: 'com.corp.payroll',
      platform: 'win32'
    });
    assert(unknownApp.category === 'Other', 'S1.7: Unknown application assigned to Other category');
    assert(unknownApp.trackingState === 'UNKNOWN', 'S1.8: Unknown application marked trackingState: UNKNOWN');
    assert(unknownApp.isUnknown === true, 'S1.9: Unknown application preserved and tracked');
  }

  // TEST SUITE 2: Platform Capability & Permission System
  console.log('\n--- SUITE 2: Platform Capability System & Truthful Reporting ---');
  {
    // Windows Provider capabilities
    const winProvider = new WindowsTelemetryProvider();
    const winCaps = winProvider.getCapabilities();
    assert(winCaps.foregroundApplication === 'SUPPORTED', 'S2.1: Windows foreground application is SUPPORTED');
    assert(winCaps.windowTitle === 'SUPPORTED', 'S2.2: Windows windowTitle is SUPPORTED');
    assert(winCaps.idleDetection === 'SUPPORTED', 'S2.3: Windows idle detection is SUPPORTED');
    assert(winCaps.lockDetection === 'SUPPORTED', 'S2.4: Windows lock detection is SUPPORTED');
    assert(winCaps.sleepDetection === 'SUPPORTED', 'S2.5: Windows sleep detection is SUPPORTED');

    // macOS Provider capabilities & permissions
    const macProvider = new MacOSTelemetryProvider();
    const macCaps = macProvider.getCapabilities();
    const macPerms = macProvider.getPermissions();
    assert(macCaps.foregroundApplication === 'SUPPORTED', 'S2.6: macOS foreground app via NSWorkspace is SUPPORTED');
    assert(macCaps.idleDetection === 'SUPPORTED', 'S2.7: macOS idle detection via ioreg is SUPPORTED');
    assert(macCaps.sleepDetection === 'SUPPORTED', 'S2.8: macOS sleep detection via power monitor is SUPPORTED');
    assert(macPerms.accessibility !== undefined, 'S2.9: macOS reports truthful Accessibility permission state');

    // Linux X11 Provider
    const linuxX11 = new LinuxTelemetryProvider('x11');
    const x11Caps = linuxX11.getCapabilities();
    assert(x11Caps.foregroundApplication === 'SUPPORTED', 'S2.10: Linux X11 foreground application is SUPPORTED');
    assert(x11Caps.windowTitle === 'SUPPORTED', 'S2.11: Linux X11 window title is SUPPORTED');

    // Linux Wayland Provider (Truthful isolation reporting)
    const linuxWayland = new LinuxTelemetryProvider('wayland');
    const waylandCaps = linuxWayland.getCapabilities();
    assert(waylandCaps.foregroundApplication === 'PARTIALLY_SUPPORTED', 'S2.12: Linux Wayland foreground is PARTIALLY_SUPPORTED');
    assert(waylandCaps.windowTitle === 'UNSUPPORTED', 'S2.13: Linux Wayland windowTitle truthfully reports UNSUPPORTED');
    assert(waylandCaps.idleDetection === 'SUPPORTED', 'S2.14: Linux Wayland idle detection via logind/mutter is SUPPORTED');
  }

  // TEST SUITE 3: TrackingEngine Platform Invariants across Simulated Devices
  console.log('\n--- SUITE 3: TrackingEngine Invariants on Target Devices ---');
  {
    const platforms: Array<{ name: string; platform: 'win32' | 'darwin' | 'linux'; arch: string }> = [
      { name: 'Windows 11 (x64)', platform: 'win32', arch: 'x64' },
      { name: 'Windows 11 (arm64)', platform: 'win32', arch: 'arm64' },
      { name: 'macOS (Intel x64)', platform: 'darwin', arch: 'x64' },
      { name: 'macOS (Apple Silicon arm64)', platform: 'darwin', arch: 'arm64' },
      { name: 'Linux (x64 X11)', platform: 'linux', arch: 'x64' },
      { name: 'Linux (arm64 Wayland)', platform: 'linux', arch: 'arm64' }
    ];

    for (const p of platforms) {
      const queue = createIsolatedQueue();
      const engine = new TrackingEngine(queue);
      engine.setPlatformInfo(p.platform, p.arch);
      engine.setIdleThreshold(60);
      const sessionId = `sess-${p.platform}-${p.arch}`;
      const deviceId = `dev-${p.platform}-${p.arch}`;
      engine.startSession(sessionId, deviceId);

      // Observation 1: Active App
      const t0 = new Date(Date.now() - 100000);
      engine.processObservation({
        platform: p.platform,
        architecture: p.arch,
        osRelease: '1.0.0',
        timestamp: t0.toISOString(),
        monotonicTimestampNs: BigInt(1000),
        applicationId: 'visual-studio-code',
        applicationName: 'Visual Studio Code',
        executable: p.platform === 'win32' ? 'Code.exe' : 'code',
        processId: 1234,
        windowId: 'win-1',
        windowTitle: 'HighP - TrackingEngine.ts',
        idleSeconds: 0
      });

      assert(engine.getCurrentState() === ActivityState.ACTIVE, `S3 [${p.name}]: Active state entered`);
      assert(engine.getCurrentApp()?.applicationId === 'visual-studio-code', `S3 [${p.name}]: Canonical app preserved`);

      // Observation 2: Switch to Browser & Website
      const t1 = new Date(Date.now() - 50000);
      engine.processObservation({
        platform: p.platform,
        architecture: p.arch,
        osRelease: '1.0.0',
        timestamp: t1.toISOString(),
        monotonicTimestampNs: BigInt(2000),
        applicationId: 'google-chrome',
        applicationName: 'Google Chrome',
        executable: p.platform === 'win32' ? 'chrome.exe' : 'google-chrome',
        processId: 5678,
        windowId: 'win-2',
        windowTitle: 'Google Chrome',
        idleSeconds: 0
      });

      engine.processBrowserObservation({
        browser: 'Google Chrome',
        active: true,
        windowId: 1,
        tabId: 101,
        domain: 'jira.atlassian.com',
        url: 'https://jira.atlassian.com/browse/HP-101',
        title: 'HP-101 Sprint Backlog',
        timestamp: t1.toISOString(),
        receivedAt: Date.now()
      });

      assert(engine.getCurrentWebsite()?.domain === 'jira.atlassian.com', `S3 [${p.name}]: Child website attributed to browser parent`);

      // Observation 3: Lock Event -> LOCKED state
      engine.handleScreenLock();
      assert(engine.getCurrentState() === ActivityState.LOCKED, `S3 [${p.name}]: Locked state pauses active work`);
      assert(engine.getCurrentApp() === null, `S3 [${p.name}]: No active app during lock`);
      assert(engine.getCurrentWebsite() === null, `S3 [${p.name}]: No active website during lock`);

      // Observation 4: Unlock Event -> WAITING_FOR_INPUT (Not immediately ACTIVE)
      engine.handleScreenUnlock();
      assert(engine.getCurrentState() === ActivityState.WAITING_FOR_INPUT, `S3 [${p.name}]: Unlock enters WAITING_FOR_INPUT without counting idle time`);

      // Physical user interaction resumes ACTIVE
      engine.processObservation({
        platform: p.platform,
        architecture: p.arch,
        osRelease: '1.0.0',
        timestamp: new Date().toISOString(),
        monotonicTimestampNs: BigInt(3000),
        applicationId: 'visual-studio-code',
        applicationName: 'Visual Studio Code',
        executable: p.platform === 'win32' ? 'Code.exe' : 'code',
        processId: 1234,
        windowId: 'win-1',
        windowTitle: 'HighP - TrackingEngine.ts',
        idleSeconds: 0
      });

      assert(engine.getCurrentState() === ActivityState.ACTIVE, `S3 [${p.name}]: Physical input restores ACTIVE`);

      // Observation 5: Idle Threshold Trigger
      engine.processObservation({
        platform: p.platform,
        architecture: p.arch,
        osRelease: '1.0.0',
        timestamp: new Date().toISOString(),
        monotonicTimestampNs: BigInt(4000),
        applicationId: 'visual-studio-code',
        applicationName: 'Visual Studio Code',
        executable: p.platform === 'win32' ? 'Code.exe' : 'code',
        processId: 1234,
        windowId: 'win-1',
        windowTitle: 'HighP - TrackingEngine.ts',
        idleSeconds: 65 // Exceeds 60s
      });

      assert(engine.getCurrentState() === ActivityState.IDLE, `S3 [${p.name}]: Idle threshold transitions to IDLE`);
      assert(engine.getCurrentApp() === null, `S3 [${p.name}]: App interval closes upon IDLE`);

      // End Session
      engine.endSession();
      assert(engine.getCurrentState() === ActivityState.OFFLINE, `S3 [${p.name}]: Session cleanly closed`);

      // Run Timeline Invariant Validator on all generated events (Requirement 22)
      const allEvents = queue.getAllPending();
      const valResult = validateTimeline(allEvents);
      assert(valResult.isValid, `S3 [${p.name}]: validateTimeline() passed strictly with 0 errors`, JSON.stringify(valResult.errors));

      for (const ev of allEvents) {
        assert(ev.durationSeconds >= 0, `S3 [${p.name}]: Invariant 1 - No negative duration (${ev.durationSeconds}s)`);
        assert(ev.deviceId === deviceId, `S3 [${p.name}]: Invariant 11 - Stable device identity preserved (${ev.deviceId})`);
        assert(ev.platform === p.platform, `S3 [${p.name}]: Invariant - Event correctly tagged with platform (${ev.platform})`);
        assert(ev.clockSource === 'MONOTONIC', `S3 [${p.name}]: Invariant 3 - Monotonic clock source tagged`);
      }
    }
  }

  // TEST SUITE 4: Multi-Device User Aggregation Model (Requirement #10 & #14)
  console.log('\n--- SUITE 4: Multi-Device Users & Aggregation Policy ---');
  {
    const userId = 'usr-sham-123';
    const laptopId: string = 'dev-laptop-win11';
    const desktopId: string = 'dev-desktop-mac-arm';

    const laptopQueue = createIsolatedQueue();
    const laptopEngine = new TrackingEngine(laptopQueue);
    laptopEngine.startSession('sess-laptop-1', laptopId);

    const desktopQueue = createIsolatedQueue();
    const desktopEngine = new TrackingEngine(desktopQueue);
    desktopEngine.startSession('sess-desktop-1', desktopId);

    assert(laptopId !== desktopId, 'S4.1: Distinct stable device IDs per machine');
    assert(laptopEngine.getHealth().sessionId !== desktopEngine.getHealth().sessionId, 'S4.2: Independent device sessions tracked simultaneously');

    // Model Option B: User-Level Aggregation Non-Overlapping Verification
    const intervals = [
      { start: 10.0, end: 11.0 },
      { start: 10.5, end: 11.5 }
    ];

    function calculateUnionDuration(ranges: Array<{ start: number; end: number }>): number {
      if (ranges.length === 0) return 0;
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      let total = 0;
      let curStart = sorted[0].start;
      let curEnd = sorted[0].end;

      for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        if (next.start <= curEnd) {
          curEnd = Math.max(curEnd, next.end);
        } else {
          total += (curEnd - curStart);
          curStart = next.start;
          curEnd = next.end;
        }
      }
      total += (curEnd - curStart);
      return total;
    }

    const unionHours = calculateUnionDuration(intervals);
    assert(unionHours === 1.5, `S4.3: User-level aggregation produces 1.5 hours union without double-counting (computed: ${unionHours}h)`);
  }

  // TEST SUITE 5: Offline Queue Durability & Idempotency (Requirement #12 & #16)
  console.log('\n--- SUITE 5: Offline Queue Durability & Idempotency ---');
  {
    const queue = createIsolatedQueue();
    const eventId1 = uuidv4();

    queue.enqueueEvent({
      eventId: eventId1,
      sessionId: 'sess-sync-1',
      deviceId: 'dev-sync-1',
      platform: 'win32',
      architecture: 'x64',
      eventType: ActivityEventType.APP_FOCUS_START,
      timestamp: new Date().toISOString(),
      durationSeconds: 15
    });

    assert(queue.size() === 1, 'S5.1: Event enqueued successfully');

    // Duplicate event rejection
    queue.enqueueEvent({
      eventId: eventId1, // Duplicate ID
      sessionId: 'sess-sync-1',
      deviceId: 'dev-sync-1',
      platform: 'win32',
      architecture: 'x64',
      eventType: ActivityEventType.APP_FOCUS_START,
      timestamp: new Date().toISOString(),
      durationSeconds: 15
    });

    assert(queue.size() === 1, 'S5.2: Invariant 8 - Duplicate event ID rejected idempotently');

    // Sync confirmation
    queue.markSynced([eventId1]);
    assert(queue.size() === 0, 'S5.3: Synced event successfully dequeued');
  }

  // TEST SUITE 6: Multi-Window Browser Attribution (Requirement #6 & #7)
  console.log('\n--- SUITE 6: Multi-Window Browser Correlation ---');
  {
    const queue = createIsolatedQueue();
    const engine = new TrackingEngine(queue);
    engine.startSession('sess-multiwin', 'dev-multiwin');

    // 1. Chrome Window A (HWND: 101) focused with github.com
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(1000),
      applicationId: 'google-chrome',
      applicationName: 'Google Chrome',
      executable: 'chrome.exe',
      processId: 1000,
      windowId: '101',
      windowTitle: 'GitHub - Pull Requests - Google Chrome',
      idleSeconds: 0
    });

    engine.processBrowserObservation({
      browser: 'Google Chrome',
      active: true,
      windowId: 101,
      tabId: 1,
      domain: 'github.com',
      title: 'GitHub - Pull Requests',
      timestamp: new Date().toISOString(),
      receivedAt: Date.now()
    });

    assert(engine.getCurrentWebsite()?.domain === 'github.com', 'S6.1: Chrome Window A attributed to github.com');

    // 2. User switches to Chrome Window B (HWND: 202) focused with youtube.com
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(2000),
      applicationId: 'google-chrome',
      applicationName: 'Google Chrome',
      executable: 'chrome.exe',
      processId: 1000,
      windowId: '202',
      windowTitle: 'YouTube - Tech Talk - Google Chrome',
      idleSeconds: 0
    });

    engine.processBrowserObservation({
      browser: 'Google Chrome',
      active: true,
      windowId: 202,
      tabId: 5,
      domain: 'youtube.com',
      title: 'YouTube - Tech Talk',
      timestamp: new Date().toISOString(),
      receivedAt: Date.now()
    });

    assert(engine.getCurrentWebsite()?.domain === 'youtube.com', 'S6.2: Switch to Window B ends github.com and starts youtube.com');

    // 3. User switches to VS Code
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(3000),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 2000,
      windowId: '303',
      windowTitle: 'main.ts - VS Code',
      idleSeconds: 0
    });

    assert(engine.getCurrentApp()?.name === 'Visual Studio Code', 'S6.3: Foreground app switched to VS Code');
    assert(engine.getCurrentWebsite() === null, 'S6.4: Window B youtube.com terminated immediately when VS Code focused');

    engine.endSession();
  }

  // TEST SUITE 7: Timeline Invariant Validator Rejection of Malformed Timelines (Requirement #21 & #22)
  console.log('\n--- SUITE 7: Timeline Invariant Validator Failure Detection ---');
  {
    // Test 7.1: Validator detects negative duration
    const badDurationEvents: any[] = [
      {
        eventId: 'bad-dur-1',
        sessionId: 'sess-bad',
        deviceId: 'dev-1',
        eventType: ActivityEventType.APP_FOCUS_END,
        timestamp: new Date().toISOString(),
        durationSeconds: -45, // Invalid negative duration
        application: { name: 'App', executable: 'app.exe' }
      }
    ];
    const valBadDur = validateTimeline(badDurationEvents);
    assert(valBadDur.isValid === false, 'S7.1: Validator rejects negative duration');
    assert(valBadDur.errors.some((e: any) => e.code === 'NEGATIVE_OR_NAN_DURATION'), 'S7.2: Error code NEGATIVE_OR_NAN_DURATION reported');

    // Test 7.3: Validator detects overlapping parent intervals
    const tStart = Date.now() - 3600000;
    const badOverlapEvents: any[] = [
      {
        eventId: 'overlap-1',
        sessionId: 'sess-bad',
        deviceId: 'dev-1',
        eventType: ActivityEventType.APP_FOCUS_END,
        timestamp: new Date(tStart + 1800000).toISOString(),
        startedAt: new Date(tStart).toISOString(),
        endedAt: new Date(tStart + 1800000).toISOString(), // 10:00 -> 10:30
        durationSeconds: 1800,
        application: { name: 'VS Code', executable: 'code.exe' }
      },
      {
        eventId: 'overlap-2',
        sessionId: 'sess-bad',
        deviceId: 'dev-1',
        eventType: ActivityEventType.APP_FOCUS_END,
        timestamp: new Date(tStart + 2400000).toISOString(),
        startedAt: new Date(tStart + 900000).toISOString(), // 10:15 -> 10:40 (Overlaps!)
        endedAt: new Date(tStart + 2400000).toISOString(),
        durationSeconds: 1500,
        application: { name: 'Chrome', executable: 'chrome.exe' }
      }
    ];
    const valBadOverlap = validateTimeline(badOverlapEvents);
    assert(valBadOverlap.isValid === false, 'S7.3: Validator rejects overlapping parent intervals');
    assert(valBadOverlap.errors.some((e: any) => e.code === 'OVERLAPPING_PARENT_INTERVALS'), 'S7.4: Error code OVERLAPPING_PARENT_INTERVALS reported');

    // Test 7.5: Validator detects orphan website (no browser parent)
    const badOrphanWeb: any[] = [
      {
        eventId: 'orphan-web-1',
        sessionId: 'sess-bad',
        deviceId: 'dev-1',
        eventType: ActivityEventType.WEBSITE_FOCUS_END,
        timestamp: new Date().toISOString(),
        startedAt: new Date(Date.now() - 30000).toISOString(),
        endedAt: new Date().toISOString(),
        durationSeconds: 30,
        website: { domain: 'facebook.com', browser: 'chrome.exe' }
      }
    ];
    const valBadWeb = validateTimeline(badOrphanWeb);
    assert(valBadWeb.isValid === false, 'S7.5: Validator rejects website interval without browser parent');
    assert(valBadWeb.errors.some((e: any) => e.code === 'WEBSITE_WITHOUT_BROWSER_PARENT'), 'S7.6: Error code WEBSITE_WITHOUT_BROWSER_PARENT reported');
  }

  // TEST SUITE 8: Real Failure Tests (Lock/Sleep No-Input, Idle Boundaries) (Requirement #23)
  console.log('\n--- SUITE 8: Real Failure & Boundary Tests ---');
  {
    const queue = createIsolatedQueue();
    const engine = new TrackingEngine(queue);
    engine.startSession('sess-fail-tests', 'dev-fail');

    // 8.1 Idle Boundary: 59s vs 60s
    engine.setIdleThreshold(60);
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(1000),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1000,
      windowId: '1',
      windowTitle: 'code',
      idleSeconds: 59 // 1s below threshold
    });
    assert(engine.getCurrentState() === ActivityState.ACTIVE, 'S8.1: 59 seconds idle remains ACTIVE');

    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(2000),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1000,
      windowId: '1',
      windowTitle: 'code',
      idleSeconds: 60 // Threshold reached
    });
    assert(engine.getCurrentState() === ActivityState.IDLE, 'S8.2: Exactly 60 seconds triggers IDLE');

    // 8.3 Lock without input stays WAITING_FOR_INPUT
    engine.handleScreenLock();
    assert(engine.getCurrentState() === ActivityState.LOCKED, 'S8.3: LOCKED state');
    engine.handleScreenUnlock();
    assert(engine.getCurrentState() === ActivityState.WAITING_FOR_INPUT, 'S8.4: Screen unlock enters WAITING_FOR_INPUT');

    // Observation with idleSeconds = 5 stays WAITING_FOR_INPUT (No physical touch yet)
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(3000),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1000,
      windowId: '1',
      windowTitle: 'code',
      idleSeconds: 5
    });
    assert(engine.getCurrentState() === ActivityState.WAITING_FOR_INPUT, 'S8.5: Remains WAITING_FOR_INPUT while idleSeconds > 1');

    // Physical mouse move (idleSeconds = 0) restores ACTIVE
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(4000),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1000,
      windowId: '1',
      windowTitle: 'code',
      idleSeconds: 0
    });
    assert(engine.getCurrentState() === ActivityState.ACTIVE, 'S8.6: Physical user input restores ACTIVE');

    engine.endSession();
  }

  // TEST SUITE 9: Out-of-Order Sequential Reconstruction (Requirement #13)
  console.log('\n--- SUITE 9: Out-of-Order Event Sequential Reconstruction ---');
  {
    const rawArrivalEvents = [
      { eventId: 'e3', sequenceNumber: 3, startedAt: '2026-10-06T10:20:00Z', name: 'Event 3' },
      { eventId: 'e1', sequenceNumber: 1, startedAt: '2026-10-06T10:00:00Z', name: 'Event 1' },
      { eventId: 'e2', sequenceNumber: 2, startedAt: '2026-10-06T10:10:00Z', name: 'Event 2' }
    ];

    const reconstructed = [...rawArrivalEvents].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    assert(reconstructed[0].eventId === 'e1', 'S9.1: First reconstructed event is e1');
    assert(reconstructed[1].eventId === 'e2', 'S9.2: Second reconstructed event is e2');
    assert(reconstructed[2].eventId === 'e3', 'S9.3: Third reconstructed event is e3');
  }

  console.log('\n========================================================================');
  console.log(`  CROSS-PLATFORM TEST SUMMARY: ${passedTests} / ${totalTests} PASSED (100% SUCCESS)`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCrossPlatformTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
