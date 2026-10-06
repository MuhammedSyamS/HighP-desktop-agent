import { ITelemetryProvider, PlatformType } from '../telemetryProvider';
import { WindowsTelemetryProvider } from './windowsTelemetryProvider';
import { MacOSTelemetryProvider } from './macosTelemetryProvider';
import { LinuxTelemetryProvider } from './linuxTelemetryProvider';

export function createTelemetryProvider(overridePlatform?: PlatformType): ITelemetryProvider {
  const currentPlatform = overridePlatform || (process.platform as PlatformType);

  switch (currentPlatform) {
    case 'win32':
      return new WindowsTelemetryProvider();
    case 'darwin':
      return new MacOSTelemetryProvider();
    case 'linux':
      return new LinuxTelemetryProvider();
    default:
      console.warn(`[TelemetryProvider] Platform '${currentPlatform}' is not fully supported; falling back to Linux provider.`);
      return new LinuxTelemetryProvider();
  }
}
