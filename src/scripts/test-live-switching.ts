import 'dotenv/config';
import { resolveApplication } from '../main/tracker/appResolver';
import { NativeBridge } from '../main/tracker/nativeBridge';

async function testLiveSwitchingPipeline() {
  console.log('\n======================================================');
  console.log('  🧪 HIGH P AGENT - LIVE REAL-TIME SWITCHING TEST     ');
  console.log('======================================================\n');

  const testCases = [
    {
      app: 'VS Code',
      exe: 'Code.exe',
      path: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
      title: 'agentService.ts - HighP Agent - Visual Studio Code',
      expectedName: 'Visual Studio Code',
      expectedCategory: 'Development',
      expectedState: 'TRACKED'
    },
    {
      app: 'Google Chrome',
      exe: 'chrome.exe',
      path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      title: 'HighP Workforce Portal - Google Chrome',
      expectedName: 'Google Chrome',
      expectedCategory: 'Browsers',
      expectedState: 'TRACKED'
    },
    {
      app: 'Microsoft Edge',
      exe: 'msedge.exe',
      path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      title: 'Documentation - Microsoft Edge',
      expectedName: 'Microsoft Edge',
      expectedCategory: 'Browsers',
      expectedState: 'TRACKED'
    },
    {
      app: 'Spotify',
      exe: 'Spotify.exe',
      path: 'C:\\Users\\Admin\\AppData\\Roaming\\Spotify\\Spotify.exe',
      title: 'Notion - Misleading Title in Spotify',
      expectedName: 'Spotify',
      expectedCategory: 'Media',
      expectedState: 'IGNORED'
    },
    {
      app: 'Notion',
      exe: 'Notion.exe',
      path: 'C:\\Users\\Admin\\AppData\\Local\\Programs\\Notion\\Notion.exe',
      title: 'Notion Workspace - Projects',
      expectedName: 'Notion',
      expectedCategory: 'Productivity',
      expectedState: 'TRACKED'
    },
    {
      app: 'Figma',
      exe: 'Figma.exe',
      path: 'C:\\Users\\Admin\\AppData\\Local\\Figma\\Figma.exe',
      title: 'HighP UX Mockups - Figma',
      expectedName: 'Figma',
      expectedCategory: 'Design',
      expectedState: 'TRACKED'
    },
    {
      app: 'Slack',
      exe: 'slack.exe',
      path: 'C:\\Users\\Admin\\AppData\\Local\\slack\\slack.exe',
      title: '#general - Highphaus Slack',
      expectedName: 'Slack',
      expectedCategory: 'Communication',
      expectedState: 'TRACKED'
    },
    {
      app: 'Windows File Explorer',
      exe: 'explorer.exe',
      path: 'C:\\Windows\\explorer.exe',
      title: 'Documents',
      expectedName: 'Windows File Explorer',
      expectedCategory: 'File Management',
      expectedState: 'TRACKED'
    },
    {
      app: 'Unknown Custom App',
      exe: 'custom_internal_tool.exe',
      path: 'C:\\InternalApps\\custom_internal_tool.exe',
      title: 'Internal Tool v2.0',
      expectedName: 'Custom_internal_tool',
      expectedCategory: 'Other',
      expectedState: 'UNKNOWN'
    }
  ];

  let allPassed = true;

  console.log('--- Step 1: Testing Application Resolution Matrix ---');
  for (const tc of testCases) {
    const res = resolveApplication(tc.exe, tc.path, 1234, [], tc.title);
    const passName = res.name === tc.expectedName;
    const passCat = res.category === tc.expectedCategory;
    const passState = res.trackingState === tc.expectedState;

    if (passName && passCat && passState) {
      console.log(`✅ PASS: ${tc.app.padEnd(22)} → ${res.name} (${res.category}) [${res.trackingState}]`);
    } else {
      console.error(`❌ FAIL: ${tc.app.padEnd(22)} expected ${tc.expectedName}/${tc.expectedCategory}/${tc.expectedState} but got ${res.name}/${res.category}/${res.trackingState}`);
      allPassed = false;
    }
  }

  console.log('\n--- Step 2: Testing Multi-Window Identity Preservation (Intra-App Tab/Split Switching) ---');
  const chromeWin1 = resolveApplication('chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 1001);
  const chromeWin2 = resolveApplication('chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 1002);

  const isSame =
    chromeWin1.name === chromeWin2.name &&
    chromeWin1.executableName.toLowerCase() === chromeWin2.executableName.toLowerCase() &&
    chromeWin1.tracked === chromeWin2.tracked &&
    chromeWin1.category === chromeWin2.category;

  if (isSame) {
    console.log(`✅ PASS: Switching between Chrome Window 1 (PID 1001) & Window 2 (PID 1002) preserves session without splitting.`);
  } else {
    console.error(`❌ FAIL: Chrome multi-window check failed.`);
    allPassed = false;
  }

  console.log('\n--- Step 3: Testing Application Transition Flow ---');
  const transitions = [
    { from: 'Code.exe', to: 'chrome.exe', nameFrom: 'Visual Studio Code', nameTo: 'Google Chrome', stateTo: 'TRACKED' },
    { from: 'chrome.exe', to: 'Spotify.exe', nameFrom: 'Google Chrome', nameTo: 'Spotify', stateTo: 'IGNORED' },
    { from: 'Spotify.exe', to: 'Notion.exe', nameFrom: 'Spotify', nameTo: 'Notion', stateTo: 'TRACKED' },
    { from: 'Notion.exe', to: 'Code.exe', nameFrom: 'Notion', nameTo: 'Visual Studio Code', stateTo: 'TRACKED' }
  ];

  for (const tr of transitions) {
    const resFrom = resolveApplication(tr.from);
    const resTo = resolveApplication(tr.to);

    const changed = resFrom.name !== resTo.name;
    const correctTarget = resTo.name === tr.nameTo && resTo.trackingState === tr.stateTo;

    if (changed && correctTarget) {
      console.log(`✅ PASS [Transition]: ${tr.nameFrom} → ${tr.nameTo} (State: ${resTo.trackingState})`);
    } else {
      console.error(`❌ FAIL [Transition]: ${tr.nameFrom} → ${tr.nameTo}`);
      allPassed = false;
    }
  }

  console.log('\n--- Step 4: Testing Live Native Bridge Query ---');
  const bridge = new NativeBridge();
  const freshSnap = await bridge.getFreshSnapshot();
  console.log(`Current Foreground Window on Windows:`);
  console.log(`- HWND:           ${freshSnap.hwnd}`);
  console.log(`- PID:            ${freshSnap.processId}`);
  console.log(`- Executable:     ${freshSnap.executable}`);
  console.log(`- ExecutablePath: ${freshSnap.executablePath}`);
  console.log(`- WindowTitle:    ${freshSnap.windowTitle}`);
  console.log(`- IdleSeconds:    ${freshSnap.idleSeconds}s`);
  console.log(`- Timestamp:      ${freshSnap.timestamp}`);

  const liveResolved = resolveApplication(freshSnap.executable, freshSnap.executablePath, freshSnap.processId);
  console.log(`Authoritative Resolution:`);
  console.log(`- Application:    ${liveResolved.name}`);
  console.log(`- Category:       ${liveResolved.category}`);
  console.log(`- Tracking State: ${liveResolved.trackingState}`);

  if (freshSnap.status === 'OK' && freshSnap.processId > 0) {
    console.log(`✅ PASS: Real Windows Native Bridge returns valid live telemetry with ISO timestamp.`);
  } else {
    console.error(`❌ FAIL: Native bridge did not return a valid process.`);
    allPassed = false;
  }

  console.log('\n======================================================');
  if (allPassed) {
    console.log('🎉 ALL REAL-TIME APPLICATION SWITCHING TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('======================================================\n');
}

testLiveSwitchingPipeline().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
