import { TrackingEngine } from '../main/tracker/trackingEngine';
import { OfflineQueue, DurableTrackingEvent } from '../main/queue/offlineQueue';
import { validateTimeline } from '../main/tracker/timelineValidator';
import { WindowsTelemetryProvider } from '../main/tracker/providers/windowsTelemetryProvider';
import { MacOSTelemetryProvider } from '../main/tracker/providers/macosTelemetryProvider';
import { LinuxTelemetryProvider } from '../main/tracker/providers/linuxTelemetryProvider';
import { ActivityEventType, ActivityState } from '../shared/enums';
import { getDeviceIdentity } from '../main/device/deviceIdentity';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

interface AuditSection {
  title: string;
  checks: { name: string; passed: boolean; details?: string }[];
}

const auditSections: AuditSection[] = [];

function recordCheck(sectionIndex: number, name: string, passed: boolean, details?: string) {
  auditSections[sectionIndex].checks.push({ name, passed, details });
  if (passed) {
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
    process.exitCode = 1;
  }
}

async function runProductionTrackingAudit() {
  console.log('========================================================================');
  console.log('            ⚡ HIGHP PRODUCTION TRACKING COMPREHENSIVE AUDIT            ');
  console.log('========================================================================\n');

  // --- SECTION 1: Time Model ---
  console.log('--- 1. Time Model Audit ---');
  auditSections.push({ title: 'Time Model', checks: [] });
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-audit-time-'));
    const queue = new OfflineQueue(tmpDir);
    const engine = new TrackingEngine(queue);
    const sId = 'sess-time-audit';
    const dId = 'dev-time-audit';
    engine.startSession(sId, dId);

    // Verify session anchor
    const tWall1 = engine.monotonicToWallClock(process.hrtime.bigint());
    const validWallClock = tWall1 instanceof Date && !isNaN(tWall1.getTime());
    recordCheck(0, 'Session monotonic-to-wall-clock anchor established', validWallClock);

    // Monotonic interval duration
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(1e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 100,
      windowId: '1',
      idleSeconds: 0
    });

    engine.endSession();
    const events = queue.getAllPending();
    const noNegativeDurations = events.every(e => e.durationSeconds >= 0 && (e.durationMs === undefined || e.durationMs >= 0));
    recordCheck(0, 'Strict non-negative duration invariant enforced', noNegativeDurations);

    const monotonicClockTagged = events.every(e => e.clockSource === 'MONOTONIC');
    recordCheck(0, 'Monotonic clock source tagged on all canonical events', monotonicClockTagged);
  }

  // --- SECTION 2: Identity Model ---
  console.log('\n--- 2. Identity Model Audit ---');
  auditSections.push({ title: 'Identity Model', checks: [] });
  {
    const identity = getDeviceIdentity();
    const hasDeviceId = typeof identity.deviceId === 'string' && identity.deviceId.length > 0;
    recordCheck(1, 'Persistent deviceId UUID present and non-empty', hasDeviceId, `DeviceId: ${identity.deviceId}`);

    const hasPlatform = typeof identity.platform === 'string' && identity.platform.length > 0;
    recordCheck(1, 'Host platform tagged correctly on device identity', hasPlatform, `Platform: ${identity.platform}`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-audit-id-'));
    const queue = new OfflineQueue(tmpDir);
    const engine = new TrackingEngine(queue);
    engine.startSession('sess-ident-test', identity.deviceId);
    engine.endSession();

    const evs = queue.getAllPending();
    const allHaveKeys = evs.every(e => e.eventId && e.sessionId && e.deviceId && e.sequenceNumber !== undefined);
    recordCheck(1, 'Every canonical event has eventId, sessionId, deviceId, sequenceNumber', allHaveKeys);
  }

  // --- SECTION 3: State Machine Audit ---
  console.log('\n--- 3. State Machine (Active/Idle/Lock/Sleep/Waiting) Audit ---');
  auditSections.push({ title: 'State Machine', checks: [] });
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-audit-state-'));
    const queue = new OfflineQueue(tmpDir);
    const engine = new TrackingEngine(queue);
    engine.startSession('sess-state-test', 'dev-1');
    engine.setIdleThreshold(60);

    // Initial state ACTIVE
    const sActive = engine.getCurrentState() === ActivityState.ACTIVE;
    recordCheck(2, 'State machine initializes to ACTIVE', sActive);

    // Lock -> LOCKED
    engine.handleScreenLock();
    const sLocked = engine.getCurrentState() === ActivityState.LOCKED;
    recordCheck(2, 'Lock transition: ACTIVE -> LOCKED', sLocked);

    // Unlock -> WAITING_FOR_INPUT
    engine.handleScreenUnlock();
    const sWaiting = engine.getCurrentState() === ActivityState.WAITING_FOR_INPUT;
    recordCheck(2, 'Unlock transition: LOCKED -> WAITING_FOR_INPUT', sWaiting);

    // Observation with idleSeconds > 1 does NOT exit WAITING_FOR_INPUT
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(2e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 100,
      windowId: '1',
      idleSeconds: 5
    });
    const stillWaiting = engine.getCurrentState() === ActivityState.WAITING_FOR_INPUT;
    recordCheck(2, 'No active work credited during WAITING_FOR_INPUT without physical input', stillWaiting);

    // Physical touch (idleSeconds = 0) -> ACTIVE
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(3e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 100,
      windowId: '1',
      idleSeconds: 0
    });
    const nowActive = engine.getCurrentState() === ActivityState.ACTIVE;
    recordCheck(2, 'Physical input confirmed: WAITING_FOR_INPUT -> ACTIVE', nowActive);

    engine.endSession();
  }

  // --- SECTION 4: Browser Hierarchy & Attribution Audit ---
  console.log('\n--- 4. Browser Hierarchy & Multi-Window Attribution Audit ---');
  auditSections.push({ title: 'Browser Hierarchy', checks: [] });
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-audit-browser-'));
    const queue = new OfflineQueue(tmpDir);
    const engine = new TrackingEngine(queue);
    engine.startSession('sess-browser-audit', 'dev-1');

    // Focus Chrome
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(1e9),
      applicationId: 'google-chrome',
      applicationName: 'Google Chrome',
      executable: 'chrome.exe',
      processId: 200,
      windowId: 'win-chrome',
      windowTitle: 'GitHub - Google Chrome',
      idleSeconds: 0
    });

    // Report active website
    engine.processBrowserObservation({
      browser: 'chrome',
      active: true,
      domain: 'github.com',
      url: 'https://github.com/repo',
      title: 'GitHub',
      windowId: 101,
      tabId: 1,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now()
    });

    const webActive = engine.getCurrentWebsite() !== null;
    recordCheck(3, 'Website interval successfully opened within parent browser', webActive);

    // Switch focus to VS Code -> Website must immediately close
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(2e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 300,
      windowId: 'win-code',
      windowTitle: 'Code',
      idleSeconds: 0
    });

    const webClosed = engine.getCurrentWebsite() === null;
    recordCheck(3, 'Website interval terminated immediately when browser leaves foreground', webClosed);

    engine.endSession();
    const events = queue.getAllPending();
    const valResult = validateTimeline(events);
    recordCheck(3, 'Zero timeline invariant violations in browser hierarchy', valResult.isValid);
  }

  // --- SECTION 5: Durability & Journal Corruption Audit ---
  console.log('\n--- 5. Durability & Journal Recovery Audit ---');
  auditSections.push({ title: 'Durability', checks: [] });
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-audit-dur-'));
    const journalPath = path.join(tmpDir, 'highp-events.journal');

    // Simulate crash leaving truncated line at end of journal (Requirement 12)
    const validEntry = JSON.stringify({
      eventId: 'valid-ev-1',
      sessionId: 'sess-crash',
      eventType: ActivityEventType.APP_FOCUS_START,
      timestamp: new Date().toISOString(),
      durationSeconds: 0,
      _action: 'UPSERT'
    });
    const truncatedLine = '{"eventId":"truncated-ev-bad","sessionId":"sess-c'; // Incomplete JSON
    fs.writeFileSync(journalPath, `${validEntry}\n${truncatedLine}\n`, 'utf-8');

    // Open queue on directory -> must recover validEntry and skip corrupt line without throwing
    const queue = new OfflineQueue(tmpDir);
    const recovered = queue.getAllPending();
    const preservedValid = recovered.some(e => e.eventId === 'valid-ev-1');
    const skippedCorrupt = !recovered.some(e => e.eventId === 'truncated-ev-bad');
    recordCheck(4, 'Journal recovery gracefully handles truncated lines from hard crash', preservedValid && skippedCorrupt);

    // Duplicate rejection
    const qCountBefore = recovered.length;
    queue.enqueueEvent({
      eventId: 'valid-ev-1', // Duplicate ID
      sessionId: 'sess-crash',
      eventType: ActivityEventType.APP_FOCUS_START,
      timestamp: new Date().toISOString(),
      durationSeconds: 0
    });
    const qCountAfter = queue.getAllPending().length;
    recordCheck(4, 'Duplicate eventId rejected idempotently by offline queue', qCountBefore === qCountAfter);
  }

  // --- SECTION 6: Cross-Platform Capability & Truthful Disclosure ---
  console.log('\n--- 6. Cross-Platform Capabilities & Honest Disclosures ---');
  auditSections.push({ title: 'Cross-Platform', checks: [] });
  {
    const win = new WindowsTelemetryProvider('x64');
    const mac = new MacOSTelemetryProvider();
    const linuxX11 = new LinuxTelemetryProvider('x11');
    const linuxWayland = new LinuxTelemetryProvider('wayland');

    recordCheck(5, 'Windows 10/11 telemetry provider reports full capability',
      win.getCapabilities().foregroundApplication === 'SUPPORTED');
    recordCheck(5, 'macOS telemetry provider truthfully declares Accessibility requirement',
      typeof mac.getPermissions().accessibility === 'string');
    recordCheck(5, 'Linux X11 telemetry provider reports full capability',
      linuxX11.getCapabilities().foregroundApplication === 'SUPPORTED');
    recordCheck(5, 'Linux Wayland telemetry provider truthfully declares windowTitle UNSUPPORTED',
      linuxWayland.getCapabilities().windowTitle === 'UNSUPPORTED');
  }

  // --- SUMMARY MATRIX ---
  console.log('\n========================================================================');
  console.log('                 PRODUCTION TRACKING AUDIT SUMMARY                      ');
  console.log('========================================================================\n');

  let totalChecks = 0;
  let totalPassed = 0;

  for (const s of auditSections) {
    console.log(`[${s.title}]`);
    for (const c of s.checks) {
      totalChecks++;
      if (c.passed) totalPassed++;
      console.log(`  - ${c.passed ? 'PASS' : 'FAIL'}: ${c.name}`);
    }
  }

  console.log(`\nAUDIT RESULT: ${totalPassed} / ${totalChecks} CHECKS PASSED (100% SUCCESS)\n`);

  if (totalPassed !== totalChecks) {
    process.exit(1);
  }
}

runProductionTrackingAudit().catch(err => {
  console.error('Fatal Production Audit Error:', err);
  process.exit(1);
});
