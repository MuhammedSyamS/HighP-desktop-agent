const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const binDir = path.resolve(__dirname, '../bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const srcFile = path.resolve(__dirname, '../src/native/HighPTelemetryNative.cs');
const outFile = path.resolve(__dirname, '../bin/HighPTelemetryNative.exe');

if (process.platform !== 'win32') {
  console.log(`[Native Build] Non-Windows platform (${process.platform}): Skipping C# native bridge compilation.`);
  process.exit(0);
}

if (!fs.existsSync(cscPath)) {
  console.warn(`[Native Build] Notice: csc.exe not found at ${cscPath}. If HighPTelemetryNative.exe already exists, build will continue.`);
  if (fs.existsSync(outFile)) {
    process.exit(0);
  }
  process.exit(1);
}

if (!fs.existsSync(srcFile)) {
  console.error(`[Native Build] Source file not found at ${srcFile}`);
  process.exit(1);
}

if (fs.existsSync(outFile)) {
  const srcStat = fs.statSync(srcFile);
  const outStat = fs.statSync(outFile);
  if (outStat.mtime >= srcStat.mtime) {
    console.log('[Native Build] HighPTelemetryNative.exe is up to date.');
    process.exit(0);
  }
}

console.log(`[Native Build] Compiling ${srcFile} -> ${outFile}`);
const result = spawnSync(cscPath, ['/target:exe', '/optimize+', `/out:${outFile}`, srcFile], {
  stdio: 'inherit'
});

if (result.error || result.status !== 0) {
  if (fs.existsSync(outFile)) {
    console.warn('[Native Build] Notice: HighPTelemetryNative.exe is in use by running process; existing binary will be used.');
    process.exit(0);
  }
  console.error('[Native Build] Failed to compile native bridge.');
  process.exit(result.status || 1);
}

console.log('[Native Build] Successfully compiled HighPTelemetryNative.exe');
