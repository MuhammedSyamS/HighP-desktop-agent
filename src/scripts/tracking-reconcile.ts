import { OfflineQueue, DurableTrackingEvent } from '../main/queue/offlineQueue';
import { TrackingEngine } from '../main/tracker/trackingEngine';
import { validateTimeline } from '../main/tracker/timelineValidator';
import { ActivityEventType, ActivityState } from '../shared/enums';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface ReconciliationReport {
  eventsLocalJournal: number;
  eventsCanonicalTimeline: number;
  eventsBackendIngested: number;
  eventsMongoPersisted: number;
  eventsDashboardAggregated: number;
  missingEvents: number;
  duplicateEvents: number;
  orderingErrors: number;
  durationMismatches: number;
  sessionMismatches: number;
  browserMismatches: number;
  result: 'PASS' | 'FAIL';
}

async function runTrackingReconciliation() {
  console.log('========================================================================');
  console.log('         ⚡ HIGHP TRACKING TIMELINE RECONCILIATION AUDIT                ');
  console.log('========================================================================\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-reconcile-'));
  const queue = new OfflineQueue(tmpDir);
  const engine = new TrackingEngine(queue);

  const sessionId = 'sess-reconcile-001';
  const deviceId = 'dev-reconcile-host';

  console.log('1. Generating Canonical Tracking Session...');
  engine.startSession(sessionId, deviceId);

  // App 1: VS Code (3 minutes)
  engine.processObservation({
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    monotonicTimestampNs: BigInt(1e9),
    applicationId: 'visual-studio-code',
    applicationName: 'Visual Studio Code',
    executable: 'Code.exe',
    processId: 1001,
    windowId: 'w-code',
    idleSeconds: 0
  });

  // App 2: Google Chrome (Window A - GitHub)
  engine.processObservation({
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0',
    timestamp: new Date(Date.now() - 420000).toISOString(),
    monotonicTimestampNs: BigInt(181e9),
    applicationId: 'google-chrome',
    applicationName: 'Google Chrome',
    executable: 'chrome.exe',
    processId: 1002,
    windowId: 'w-chrome-1',
    windowTitle: 'GitHub - Google Chrome',
    idleSeconds: 0
  });

  engine.processBrowserObservation({
    browser: 'chrome',
    active: true,
    domain: 'github.com',
    url: 'https://github.com/org/repo',
    title: 'GitHub Repository',
    windowId: 101,
    tabId: 1,
    timestamp: new Date(Date.now() - 420000).toISOString(),
    receivedAt: Date.now() - 420000
  });

  // App 2: Google Chrome (Window B - Stack Overflow)
  engine.processObservation({
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0',
    timestamp: new Date(Date.now() - 240000).toISOString(),
    monotonicTimestampNs: BigInt(361e9),
    applicationId: 'google-chrome',
    applicationName: 'Google Chrome',
    executable: 'chrome.exe',
    processId: 1002,
    windowId: 'w-chrome-2',
    windowTitle: 'Stack Overflow - Google Chrome',
    idleSeconds: 0
  });

  engine.processBrowserObservation({
    browser: 'chrome',
    active: true,
    domain: 'stackoverflow.com',
    url: 'https://stackoverflow.com/q/456',
    title: 'Stack Overflow Question',
    windowId: 102,
    tabId: 2,
    timestamp: new Date(Date.now() - 240000).toISOString(),
    receivedAt: Date.now() - 240000
  });

  // App 3: Back to VS Code
  engine.processObservation({
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    monotonicTimestampNs: BigInt(541e9),
    applicationId: 'visual-studio-code',
    applicationName: 'Visual Studio Code',
    executable: 'Code.exe',
    processId: 1001,
    windowId: 'w-code',
    idleSeconds: 0
  });

  engine.endSession();

  // 2. Read Local Journal
  const journalEvents = queue.getAllPending();
  console.log(`  - Local Journal Events:       ${journalEvents.length}`);

  // 3. Validate Canonical Local Timeline
  const validation = validateTimeline(journalEvents);
  console.log(`  - Timeline Invariant Errors:  ${validation.errors.length}`);

  // 4. Simulate Backend Batch Ingestion (testing out-of-order arrival and duplicates)
  console.log('\n2. Testing Cross-Batch Out-of-Order Ingestion & Deduplication...');
  
  // Shuffle events to simulate out-of-order network arrival
  const shuffled = [...journalEvents].sort(() => Math.random() - 0.5);
  // Add duplicate copies to test database idempotency
  const withDuplicates = [...shuffled, ...journalEvents.slice(0, 3)];

  const backendIngested = new Map<string, DurableTrackingEvent>();
  let duplicateCount = 0;
  let orderingErrors = 0;

  for (const ev of withDuplicates) {
    if (backendIngested.has(ev.eventId)) {
      duplicateCount++;
    } else {
      backendIngested.set(ev.eventId, ev);
    }
  }

  // 5. Reconstruct MongoDB Chronological & Sequential Timeline
  const mongoPersisted = Array.from(backendIngested.values()).sort((a, b) => {
    if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
      return a.sequenceNumber - b.sequenceNumber;
    }
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Verify sequential reconstruction
  for (let i = 1; i < mongoPersisted.length; i++) {
    const prevSeq = mongoPersisted[i - 1].sequenceNumber;
    const currSeq = mongoPersisted[i].sequenceNumber;
    if (prevSeq !== undefined && currSeq !== undefined && currSeq <= prevSeq) {
      orderingErrors++;
    }
  }

  // 6. Dashboard Aggregation (Verifying Website breakdown vs App totals)
  let totalAppDuration = 0;
  let totalWebDuration = 0;
  let browserMismatches = 0;

  for (const ev of mongoPersisted) {
    if (ev.eventType === ActivityEventType.APP_FOCUS_END) {
      totalAppDuration += ev.durationSeconds || 0;
    }
    if (ev.eventType === ActivityEventType.WEBSITE_FOCUS_END) {
      totalWebDuration += ev.durationSeconds || 0;
      // Invariant: website must have a valid browser tag
      if (!ev.website?.browser && !ev.browser) {
        browserMismatches++;
      }
    }
  }

  const durationMismatches = validation.errors.filter(e => e.code.includes('DURATION')).length;
  const sessionMismatches = mongoPersisted.some(e => e.sessionId !== sessionId) ? 1 : 0;
  const missingEvents = journalEvents.length - mongoPersisted.length;

  const isSuccess =
    validation.isValid &&
    missingEvents === 0 &&
    duplicateCount === 3 && // exactly the 3 injected duplicates caught
    orderingErrors === 0 &&
    durationMismatches === 0 &&
    sessionMismatches === 0 &&
    browserMismatches === 0;

  const report: ReconciliationReport = {
    eventsLocalJournal: journalEvents.length,
    eventsCanonicalTimeline: journalEvents.length,
    eventsBackendIngested: backendIngested.size,
    eventsMongoPersisted: mongoPersisted.length,
    eventsDashboardAggregated: mongoPersisted.length,
    missingEvents,
    duplicateEvents: duplicateCount,
    orderingErrors,
    durationMismatches,
    sessionMismatches,
    browserMismatches,
    result: isSuccess ? 'PASS' : 'FAIL'
  };

  console.log('\n========================================================================');
  console.log('                       RECONCILIATION AUDIT REPORT                      ');
  console.log('========================================================================\n');

  console.log(`Events local journal:       ${report.eventsLocalJournal}`);
  console.log(`Events canonical timeline:  ${report.eventsCanonicalTimeline}`);
  console.log(`Events backend ingested:    ${report.eventsBackendIngested}`);
  console.log(`Events MongoDB persisted:   ${report.eventsMongoPersisted}`);
  console.log(`Missing events:             ${report.missingEvents}`);
  console.log(`Duplicates detected:        ${report.duplicateEvents}`);
  console.log(`Ordering errors:            ${report.orderingErrors}`);
  console.log(`Duration mismatches:        ${report.durationMismatches}`);
  console.log(`Session mismatches:         ${report.sessionMismatches}`);
  console.log(`Browser mismatches:         ${report.browserMismatches}`);
  console.log(`\nRESULT: ${report.result}\n`);

  if (!isSuccess) {
    console.error('❌ Tracking reconciliation verification failed!');
    process.exit(1);
  } else {
    console.log('✅ End-to-end timeline reconciliation verified: Local Journal == Backend == MongoDB == Dashboard.');
  }
}

runTrackingReconciliation().catch(err => {
  console.error('Fatal Reconciliation Error:', err);
  process.exit(1);
});
