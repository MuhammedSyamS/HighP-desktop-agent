import axios from 'axios';
import os from 'os';
import { NativeBridge } from '../main/tracker/nativeBridge';
import { resolveApplication } from '../main/tracker/appResolver';
import { OfflineQueue } from '../main/queue/offlineQueue';

async function runDiagnostics() {
  console.log('\n======================================================');
  console.log('       ⚡ HIGH P WORKFORCE TELEMETRY DIAGNOSTICS      ');
  console.log('======================================================\n');

  console.log(`OS:                  ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`Platform:            ${process.platform}`);
  console.log(`Hostname:            ${os.hostname()}`);

  const bridge = new NativeBridge();
  const binaryPath = bridge.getBinaryPath();
  const isAvailable = bridge.isAvailable();

  console.log(`Native Binary Path:  ${binaryPath}`);
  console.log(`Native Bridge Found: ${isAvailable ? '✅ YES' : '❌ NO'}`);

  if (!isAvailable) {
    console.error('\n❌ ERROR: Native bridge executable not found.');
    console.error('Run "npm run build:native" to compile HighPTelemetryNative.exe.\n');
    process.exit(1);
  }

  console.log('\n--- Querying Windows Native APIs ---');
  const snap = await bridge.queryDirect();
  if (snap.status === 'ERROR') {
    console.error(`❌ Windows API Error: ${snap.errorMessage}`);
  } else {
    console.log(`Windows API Status:  ✅ OK`);
    console.log(`Window Handle:       ${snap.hwnd}`);
    console.log(`Process ID:          ${snap.processId}`);
    console.log(`Executable:          ${snap.executable}`);

    const resolved = resolveApplication(snap.executable);
    console.log(`Application Name:    ${resolved.applicationName}`);
    console.log(`Category:            ${resolved.category}`);
    console.log(`Idle Seconds:        ${snap.idleSeconds}s (GetLastInputInfo + GetTickCount64)`);
  }

  console.log('\n--- Checking API & Backend Connectivity ---');
  const apiUrl = process.env.HIGHP_API_URL || 'http://localhost:5000';
  console.log(`Target API URL:      ${apiUrl}`);

  try {
    const t0 = Date.now();
    const res = await axios.get(`${apiUrl}/api/health`, { timeout: 4000 });
    const latency = Date.now() - t0;
    console.log(`API Health:          ✅ CONNECTED (${latency}ms)`);
    console.log(`Server Timestamp:    ${res.data?.timestamp || 'N/A'}`);
  } catch (err: any) {
    console.log(`API Health:          ❌ FAILED (${err.message})`);
  }

  console.log('\n--- Checking Local Offline Queue ---');
  const queue = new OfflineQueue();
  console.log(`Offline Queue Size:  ${queue.size()} pending events`);

  console.log('\n======================================================');
  console.log('              DIAGNOSTIC SUMMARY: READY               ');
  console.log('======================================================\n');
  process.exit(0);
}

runDiagnostics().catch((err) => {
  console.error('[Diagnostics Exception]:', err);
  process.exit(1);
});
