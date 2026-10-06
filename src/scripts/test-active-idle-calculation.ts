import { TrackingEngine } from '../main/tracker/trackingEngine';
import { OfflineQueue } from '../main/queue/offlineQueue';
import { ActivityState, ActivityEventType } from '../shared/enums';
import fs from 'fs';
import os from 'os';
import path from 'path';

function check(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(msg);
  }
}

async function testActiveIdleCalculation() {
  console.log('========================================================================');
  console.log('       TESTING ACTIVE & IDLE TIME ACCURACY AND REALLOCATION             ');
  console.log('========================================================================\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'highp-idle-calc-'));
  const queue = new OfflineQueue(tmpDir);
  const engine = new TrackingEngine(queue);
  const IDLE_THRESHOLD = 60; // 60s threshold
  engine.setIdleThreshold(IDLE_THRESHOLD);

  let agentActiveSeconds: number = 0;
  let agentIdleSeconds: number = 0;

  // Wire up the engine callbacks exactly as AgentService does
  engine.setOnIdleTransition((retroIdleSec) => {
    const falseActiveSec = Math.max(0, retroIdleSec - 1);
    const adjusted = Math.min(agentActiveSeconds, falseActiveSec);
    agentActiveSeconds = Math.max(0, agentActiveSeconds - adjusted);
    agentIdleSeconds += retroIdleSec;
  });

  const sessionId = 'sess-calc-test';
  engine.startSession(sessionId, 'dev-test');

  // Step 1: Simulating 120s of active work in VS Code (t=0 to t=120)...
  console.log('Step 1: Simulating 120s of active work in VS Code...');
  for (let s = 0; s < 120; s++) {
    // Active observation every second
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(s) * BigInt(1e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1001,
      windowId: 'win-1',
      idleSeconds: 0
    });

    if (engine.getCurrentState() === ActivityState.ACTIVE) {
      agentActiveSeconds += 1;
    }
  }

  check(agentActiveSeconds === 120, 'Active seconds should be 120');
  check(agentIdleSeconds === 0, 'Idle seconds should be 0');
  console.log(`  -> At t=120s: Active=${agentActiveSeconds}s, Idle=${agentIdleSeconds}s [OK]`);

  // Step 2: User walks away (inactive for 60 seconds)
  // For the first 59 seconds, idleSeconds < 60, state is still ACTIVE
  console.log('\nStep 2: User stops physical input. Simulating seconds 1 to 59 of inactivity...');
  for (let s = 1; s <= 59; s++) {
    const prevState = engine.getCurrentState();
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(120 + s) * BigInt(1e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1001,
      windowId: 'win-1',
      idleSeconds: s
    });

    const currentState = engine.getCurrentState();
    if (currentState === ActivityState.ACTIVE) {
      agentActiveSeconds += 1;
    } else if (currentState === ActivityState.IDLE) {
      if (prevState === ActivityState.IDLE) agentIdleSeconds += 1;
    }
  }

  // At second 59, activeSeconds has accumulated to 179s (temporarily unconfirmed)
  check(agentActiveSeconds === 179, 'Active seconds temporarily reached 179s before threshold');
  check(agentIdleSeconds === 0, 'Idle seconds still 0 before threshold');
  console.log(`  -> At t=179s (59s idle): Active=${agentActiveSeconds}s, Idle=${agentIdleSeconds}s [OK]`);

  // Step 3: Second 60 - Inactivity crosses threshold!
  console.log('\nStep 3: At second 60, inactivity crosses threshold (idleSeconds=60)...');
  const prevBeforeThreshold = engine.getCurrentState();
  engine.processObservation({
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0',
    timestamp: new Date().toISOString(),
    monotonicTimestampNs: BigInt(180) * BigInt(1e9),
    applicationId: 'visual-studio-code',
    applicationName: 'Visual Studio Code',
    executable: 'Code.exe',
    processId: 1001,
    windowId: 'win-1',
    idleSeconds: 60
  });

  const currAfterThreshold = engine.getCurrentState();
  check(currAfterThreshold === ActivityState.IDLE, 'State transitioned to IDLE');

  if (currAfterThreshold === ActivityState.IDLE && prevBeforeThreshold === ActivityState.IDLE) {
    agentIdleSeconds += 1;
  }

  // Active seconds MUST have rolled back from 179s to 120s!
  // Idle seconds MUST have rolled forward from 0s to 60s!
  check(agentActiveSeconds === 120, 'Active seconds must retroactively roll back to 120s');
  check(agentIdleSeconds === 60, 'Idle seconds must retroactively roll forward to 60s');
  console.log(`  -> At t=180s (threshold met): Active=${agentActiveSeconds}s, Idle=${agentIdleSeconds}s`);
  console.log('  -> RETROACTIVE REALLOCATION SUCCESSFUL: Active rolled back by 59s, Idle credited with full 60s!');

  // Step 4: User stays idle for another 30 seconds (seconds 61 to 90 of idle)
  console.log('\nStep 4: User stays idle for 30 more seconds...');
  for (let s = 61; s <= 90; s++) {
    const prevState = engine.getCurrentState();
    engine.processObservation({
      platform: 'win32',
      architecture: 'x64',
      osRelease: '10.0',
      timestamp: new Date().toISOString(),
      monotonicTimestampNs: BigInt(120 + s) * BigInt(1e9),
      applicationId: 'visual-studio-code',
      applicationName: 'Visual Studio Code',
      executable: 'Code.exe',
      processId: 1001,
      windowId: 'win-1',
      idleSeconds: s
    });

    const currentState = engine.getCurrentState();
    if (currentState === ActivityState.ACTIVE) {
      agentActiveSeconds += 1;
    } else if (currentState === ActivityState.IDLE) {
      if (prevState === ActivityState.IDLE) agentIdleSeconds += 1;
    }
  }

  check(agentActiveSeconds === 120, 'Active seconds remains unchanged at 120s while idle');
  check(agentIdleSeconds === 90, 'Idle seconds correctly advanced to 90s');
  console.log(`  -> At t=210s (90s total idle): Active=${agentActiveSeconds}s, Idle=${agentIdleSeconds}s [OK]`);

  // Step 5: User returns and moves mouse at t=210
  console.log('\nStep 5: User resumes physical input (idleSeconds=0)...');
  engine.processObservation({
    platform: 'win32',
    architecture: 'x64',
    osRelease: '10.0',
    timestamp: new Date().toISOString(),
    monotonicTimestampNs: BigInt(210) * BigInt(1e9),
    applicationId: 'visual-studio-code',
    applicationName: 'Visual Studio Code',
    executable: 'Code.exe',
    processId: 1001,
    windowId: 'win-1',
    idleSeconds: 0
  });

  check(engine.getCurrentState() === ActivityState.ACTIVE, 'State resumed to ACTIVE');
  agentActiveSeconds += 1;

  console.log(`  -> At t=210s (resumed): Active=${agentActiveSeconds}s, Idle=${agentIdleSeconds}s [OK]`);
  check(agentActiveSeconds === 121, 'Active seconds resumed ticking to 121s');
  check(agentIdleSeconds === 90, 'Idle seconds locked at 90s');

  // Step 6: Validate offline queue events
  engine.endSession();
  const events = queue.getAllPending();
  const appEndEvents = events.filter(e => e.eventType === ActivityEventType.APP_FOCUS_END);
  const idleEndEvents = events.filter(e => e.eventType === ActivityEventType.IDLE_END);

  console.log('\nStep 6: Validating timeline events in offline journal:');
  console.log(`  - App End events:  ${appEndEvents.length}`);
  console.log(`  - Idle End events: ${idleEndEvents.length}`);

  const initialAppDur = appEndEvents[0]?.durationSeconds;
  const idleDur = idleEndEvents[0]?.durationSeconds;

  console.log(`  - Initial App duration: ${initialAppDur}s (expected 120s)`);
  console.log(`  - Total Idle duration:   ${idleDur}s (expected 90s)`);

  check(initialAppDur === 120, 'Initial app interval duration must be exactly 120s');
  check(idleDur === 90, 'Idle interval duration must be exactly 90s');

  console.log('\n========================================================================');
  console.log('  ✅ ALL ACTIVE AND IDLE TIME CALCULATION TESTS PASSED (100% ACCURATE)   ');
  console.log('========================================================================');

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

testActiveIdleCalculation().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
