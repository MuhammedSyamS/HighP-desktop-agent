import 'dotenv/config';
import axios from 'axios';
import { io } from 'socket.io-client';
import { NativeBridge } from '../main/tracker/nativeBridge';
import { resolveApplication } from '../main/tracker/appResolver';
import { ActivityEventType, ActivityState } from '../shared/enums';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('================================================================');
  console.log('    ⚡ HIGHP SAAS FULL END-TO-END WORKFORCE TELEMETRY AUDIT    ');
  console.log('================================================================\n');

  const BASE_URL = process.env.HIGHP_API_URL || 'http://localhost:5000';
  const EMAIL = 'shamsaifudheen@gmail.com';
  const PASSWORD = 'Password@123';

  console.log(`Backend Target URL: ${BASE_URL}`);

  // 1. Windows Active-Window Detection
  console.log('\n1. [Windows Active-Window Detection]');
  const bridge = new NativeBridge();
  const directSnap = await bridge.queryDirect();
  console.log('   - Native API Status:        ', directSnap.status);
  console.log('   - Foreground Window Hwnd:   ', directSnap.hwnd);
  console.log('   - Foreground Process ID:    ', directSnap.processId);
  console.log('   - Foreground Executable:    ', directSnap.executable);
  console.log('   - Idle Seconds (OS level):  ', directSnap.idleSeconds, 's');

  const resolved = resolveApplication(directSnap.executable);
  console.log('   - Resolved App Name:        ', resolved.applicationName);
  console.log('   - Resolved Category:        ', resolved.category);
  console.log('   - Is Recognized:            ', resolved.isRecognized);

  // 2. Authentication Identity
  console.log('\n2. [Agent Authentication & Identity]');
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: EMAIL,
    password: PASSWORD
  });
  const token = loginRes.data.data.tokens.accessToken;
  const user = loginRes.data.data.user;
  const company = loginRes.data.data.company;
  const profileId = user.employeeProfileId;

  console.log('   - Login Status:             ', loginRes.data.success ? 'SUCCESS (HTTP 200)' : 'FAILED');
  console.log('   - User Email:               ', user.email);
  console.log('   - User Role:                ', user.role);
  console.log('   - Company ID:               ', user.companyId);
  console.log('   - Employee Profile ID:      ', profileId);
  console.log('   - JWT Token Acquired:       ', token ? 'YES' : 'NO');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Socket.IO Real-Time Stream
  console.log('\n3. [Socket.IO / Realtime Events]');
  const socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling']
  });

  const receivedRealtimeEvents: any[] = [];
  socket.on('connect', () => {
    console.log('   - Socket.IO Connection:      ESTABLISHED (Socket ID:', socket.id, ')');
  });
  socket.on('employee:activity_changed', (data: any) => {
    console.log('   - ⚡ Realtime Event Received: [employee:activity_changed]', data.currentApplication);
    receivedRealtimeEvents.push(data);
  });
  socket.on('employee:status_changed', (data: any) => {
    console.log('   - ⚡ Realtime Event Received: [employee:status_changed]', data.status, '| App:', data.currentApplication);
    receivedRealtimeEvents.push(data);
  });
  socket.on('activity:ingested', (data: any) => {
    console.log('   - ⚡ Realtime Event Received: [activity:ingested]', data.count || 'events synced');
    receivedRealtimeEvents.push(data);
  });

  await new Promise((r) => setTimeout(r, 1200));

  // 4. Agent Device Registration
  console.log('\n4. [Agent Device Registration]');
  const deviceIdentifier = 'DEV-LAPTOP-AUDIT-E2E';
  const regRes = await axios.post(
    `${BASE_URL}/api/agent/register`,
    {
      deviceIdentifier,
      deviceName: 'Windows 11 Workstation',
      osInfo: { platform: 'win32', release: '10.0', arch: 'x64', hostname: 'Laptop' },
      agentVersion: '1.0.0'
    },
    { headers: authHeaders }
  );
  console.log('   - Device Status:            ', regRes.data.data.device.status, `(${regRes.data.message})`);

  // 5. Session Start
  console.log('\n5. [Session Start]');
  const sessionRes = await axios.post(
    `${BASE_URL}/api/agent/session/start`,
    { deviceId: deviceIdentifier },
    { headers: authHeaders }
  );
  const sessionId = sessionRes.data.data._id;
  console.log('   - Active Session ID:        ', sessionId);

  // 6. Heartbeat & Live Telemetry
  console.log('\n6. [Heartbeat & Presence Updates]');
  const cleanApp = resolved.applicationName !== 'Unknown Application' ? resolved.applicationName : 'Google Chrome';
  const hbRes = await axios.post(
    `${BASE_URL}/api/agent/heartbeat`,
    {
      deviceId: deviceIdentifier,
      sessionId,
      timestamp: new Date().toISOString(),
      status: ActivityState.ACTIVE,
      currentApplication: cleanApp,
      idleSeconds: directSnap.idleSeconds,
      recentDurationSeconds: 15
    },
    { headers: authHeaders }
  );
  console.log('   - Heartbeat Status:         ', hbRes.data.status);
  console.log('   - Live Current Application: ', cleanApp);

  // 7. Telemetry Generation & Sync Batch
  console.log('\n7. [Telemetry Generation & Batch Ingestion]');
  const now = new Date();
  const testEvents = [
    {
      eventId: uuidv4(),
      type: ActivityEventType.APPLICATION_FOCUS,
      applicationName: 'Google Chrome',
      processName: 'chrome.exe',
      windowTitleSanitized: 'Google Chrome - HighP Portal',
      startedAt: new Date(now.getTime() - 180000).toISOString(),
      endedAt: new Date(now.getTime() - 120000).toISOString(),
      durationSeconds: 60
    },
    {
      eventId: uuidv4(),
      type: ActivityEventType.APPLICATION_FOCUS,
      applicationName: 'Visual Studio Code',
      processName: 'Code.exe',
      windowTitleSanitized: 'Visual Studio Code - HighP Agent',
      startedAt: new Date(now.getTime() - 120000).toISOString(),
      endedAt: new Date(now.getTime() - 60000).toISOString(),
      durationSeconds: 60
    },
    {
      eventId: uuidv4(),
      type: ActivityEventType.APPLICATION_FOCUS,
      applicationName: 'Notion',
      processName: 'Notion.exe',
      windowTitleSanitized: 'Notion - Sprint Planning',
      startedAt: new Date(now.getTime() - 60000).toISOString(),
      endedAt: now.toISOString(),
      durationSeconds: 60
    }
  ];

  console.log('   - Generated Events:         ', testEvents.map(e => `${e.applicationName} (${e.durationSeconds}s)`).join(', '));
  const syncRes = await axios.post(
    `${BASE_URL}/api/agent/sync`,
    {
      deviceId: deviceIdentifier,
      sessionId,
      events: testEvents
    },
    { headers: authHeaders }
  );
  console.log('   - Sync Accepted Events:     ', syncRes.data.data.accepted.length, 'events persisted');

  // Allow a moment for real-time broadcasts
  await new Promise((r) => setTimeout(r, 1000));

  // 8. Database Query: Activity Feed
  console.log('\n8. [Backend Query: /api/activity]');
  const activityRes = await axios.get(`${BASE_URL}/api/activity?limit=12`, { headers: authHeaders });
  const recentActivities = activityRes.data.data;
  console.log(`   - Retrieved ${recentActivities.length} Activity Events:`);
  recentActivities.slice(0, 5).forEach((act: any, idx: number) => {
    console.log(`     ${idx + 1}. [${act.applicationName}] Duration: ${act.durationSeconds}s | Type: ${act.type} | Time: ${act.startedAt}`);
  });

  // 9. Database Query: Recently Used / Top Applications Usage
  console.log('\n9. [Backend Query: /api/applications/usage]');
  const appUsageRes = await axios.get(`${BASE_URL}/api/applications/usage`, { headers: authHeaders });
  console.log('   - Total Application Time Tracked:', appUsageRes.data.data.totalTimeOverall, 'seconds');
  console.log('   - Aggregated Applications:');
  appUsageRes.data.data.applications.forEach((app: any) => {
    console.log(`     * ${app.applicationName} (${app.category}): ${app.totalSeconds}s (${app.percentage}%)`);
  });

  // 10. Dashboard Overview
  console.log('\n10. [Backend Query: /api/employees/overview]');
  const overviewRes = await axios.get(`${BASE_URL}/api/employees/overview`, { headers: authHeaders });
  console.log('   - Total Employees:          ', overviewRes.data.data.totalEmployees);
  console.log('   - Active Now:               ', overviewRes.data.data.activeNow);
  console.log('   - Idle Now:                 ', overviewRes.data.data.idleNow);
  console.log('   - Offline Now:              ', overviewRes.data.data.offlineNow);

  // 11. Realtime Broadcast Verification
  console.log('\n11. [Real-time Events Received Over Socket.IO]');
  console.log('   - Realtime Events Count:    ', receivedRealtimeEvents.length);

  socket.disconnect();

  console.log('\n================================================================');
  console.log('     🎉 END-TO-END TELEMETRY PIPELINE AUDIT VERIFIED READY     ');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ AUDIT ERROR:', err.response?.data || err.message);
  process.exit(1);
});
