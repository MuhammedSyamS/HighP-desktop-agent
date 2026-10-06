import os from 'os';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface DeviceIdentity {
  deviceId: string;
  platform: string;
  architecture: string;
  hostname: string;
  createdAt: string;
}

let cachedIdentity: DeviceIdentity | null = null;

export function getDeviceIdentity(storageDir?: string): DeviceIdentity {
  if (cachedIdentity && !storageDir) {
    return cachedIdentity;
  }

  const baseDir = storageDir || path.join(os.homedir(), '.highp-agent');
  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch {}
  }

  const idFile = path.join(baseDir, 'highp-device-identity.json');
  let deviceId: string;
  let createdAt: string;

  if (fs.existsSync(idFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(idFile, 'utf-8'));
      deviceId = data.deviceId || `dev-${uuidv4()}`;
      createdAt = data.createdAt || new Date().toISOString();
    } catch {
      deviceId = `dev-${uuidv4()}`;
      createdAt = new Date().toISOString();
    }
  } else {
    deviceId = `dev-${uuidv4()}`;
    createdAt = new Date().toISOString();
    try {
      fs.writeFileSync(idFile, JSON.stringify({ deviceId, createdAt }), 'utf-8');
    } catch {}
  }

  cachedIdentity = {
    deviceId,
    platform: process.platform,
    architecture: os.arch(),
    hostname: os.hostname(),
    createdAt
  };

  return cachedIdentity;
}
