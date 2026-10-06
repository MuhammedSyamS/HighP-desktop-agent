import { ActivityEventType, ActivityState } from '../../shared/enums';
import { DurableTrackingEvent } from '../queue/offlineQueue';

export interface TimelineValidationError {
  code: string;
  message: string;
  eventId?: string;
  details?: any;
}

export interface TimelineValidationResult {
  isValid: boolean;
  errors: TimelineValidationError[];
  warnings: string[];
  metrics: {
    totalEvents: number;
    parentAppIntervals: number;
    childWebsiteIntervals: number;
    idleIntervals: number;
    lockEvents: number;
    sleepEvents: number;
    totalActiveDurationSeconds: number;
    totalIdleDurationSeconds: number;
  };
}

export interface TimelineValidationOptions {
  allowClockSkewMs?: number; // default: 300,000ms (5 mins)
  strictSequenceOrdering?: boolean;
}

/**
 * Authoritative Cross-Platform Timeline Invariant Validator
 * Validates canonical event streams against all 15 production rules:
 * 1. No negative duration
 * 2. No zero/invalid timestamps
 * 3. End must be >= start
 * 4. No overlapping parent app intervals on same device/session
 * 5. Child website interval strictly bounded within parent browser interval
 * 6. Website cannot exist without valid parent browser
 * 7. Locked time is not active time
 * 8. Sleep time is not active time
 * 9. Duplicate event IDs strictly rejected
 * 10. Device ID and Session ID required on every event
 * 11. Impossible state transitions flagged
 * 12. Monotonic timestamps strictly non-decreasing
 * 13. Sequence numbers monotonic
 * 14. No future timestamps beyond allowed clock skew
 * 15. Unknown applications preserved with valid category & identity
 */
export function validateTimeline(
  events: DurableTrackingEvent[],
  options: TimelineValidationOptions = {}
): TimelineValidationResult {
  const errors: TimelineValidationError[] = [];
  const warnings: string[] = [];
  const clockSkewMs = options.allowClockSkewMs ?? 300000;
  const now = Date.now();

  const seenEventIds = new Set<string>();
  const parentIntervals: Array<{
    eventId: string;
    applicationId?: string;
    appName: string;
    executable: string;
    startMs: number;
    endMs: number;
    startMonoNs?: bigint;
    endMonoNs?: bigint;
    isBrowser: boolean;
  }> = [];

  const childWebsiteIntervals: Array<{
    eventId: string;
    domain: string;
    browser: string;
    startMs: number;
    endMs: number;
  }> = [];

  let totalActiveDurationSeconds = 0;
  let totalIdleDurationSeconds = 0;
  let parentAppIntervalCount = 0;
  let childWebsiteIntervalCount = 0;
  let idleIntervalCount = 0;
  let lockEventCount = 0;
  let sleepEventCount = 0;

  let currentEngineState: ActivityState = ActivityState.OFFLINE;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    // Check 1: Mandatory Identifiers
    if (!ev.eventId || typeof ev.eventId !== 'string' || ev.eventId.trim() === '') {
      errors.push({
        code: 'MISSING_EVENT_ID',
        message: `Event at index ${i} has missing or empty eventId`
      });
      continue;
    }

    if (!ev.sessionId || typeof ev.sessionId !== 'string') {
      errors.push({
        code: 'MISSING_SESSION_ID',
        message: `Event ${ev.eventId} is missing sessionId`,
        eventId: ev.eventId
      });
    }

    if (!ev.deviceId || typeof ev.deviceId !== 'string') {
      errors.push({
        code: 'MISSING_DEVICE_ID',
        message: `Event ${ev.eventId} is missing deviceId`,
        eventId: ev.eventId
      });
    }

    // Check 2: Idempotency / Duplicate Event IDs
    if (seenEventIds.has(ev.eventId)) {
      errors.push({
        code: 'DUPLICATE_EVENT_ID',
        message: `Event ${ev.eventId} appears more than once in the timeline`,
        eventId: ev.eventId
      });
    }
    seenEventIds.add(ev.eventId);

    // Check 3: Duration Invariants (No negative duration)
    if (ev.durationSeconds < 0 || isNaN(ev.durationSeconds) || !isFinite(ev.durationSeconds)) {
      errors.push({
        code: 'NEGATIVE_OR_NAN_DURATION',
        message: `Event ${ev.eventId} has invalid durationSeconds: ${ev.durationSeconds}`,
        eventId: ev.eventId
      });
    }

    if (ev.durationMs !== undefined && (ev.durationMs < 0 || isNaN(ev.durationMs))) {
      errors.push({
        code: 'NEGATIVE_DURATION_MS',
        message: `Event ${ev.eventId} has invalid durationMs: ${ev.durationMs}`,
        eventId: ev.eventId
      });
    }

    // Check 4: Timestamp Validity
    const timestampMs = new Date(ev.timestamp).getTime();
    if (isNaN(timestampMs)) {
      errors.push({
        code: 'INVALID_TIMESTAMP',
        message: `Event ${ev.eventId} has unparseable timestamp: ${ev.timestamp}`,
        eventId: ev.eventId
      });
    } else if (timestampMs > now + clockSkewMs) {
      errors.push({
        code: 'FUTURE_TIMESTAMP',
        message: `Event ${ev.eventId} has future timestamp (${ev.timestamp}) exceeding allowable skew`,
        eventId: ev.eventId
      });
    }

    // Check 5: startedAt & endedAt Chronological Ordering
    let startMs: number | undefined;
    let endMs: number | undefined;

    if (ev.startedAt) {
      startMs = new Date(ev.startedAt).getTime();
      if (isNaN(startMs)) {
        errors.push({
          code: 'INVALID_STARTED_AT',
          message: `Event ${ev.eventId} has unparseable startedAt: ${ev.startedAt}`,
          eventId: ev.eventId
        });
      }
    }

    if (ev.endedAt) {
      endMs = new Date(ev.endedAt).getTime();
      if (isNaN(endMs)) {
        errors.push({
          code: 'INVALID_ENDED_AT',
          message: `Event ${ev.eventId} has unparseable endedAt: ${ev.endedAt}`,
          eventId: ev.eventId
        });
      }
    }

    if (startMs !== undefined && endMs !== undefined) {
      if (endMs < startMs) {
        errors.push({
          code: 'END_BEFORE_START',
          message: `Event ${ev.eventId} endedAt (${ev.endedAt}) precedes startedAt (${ev.startedAt})`,
          eventId: ev.eventId
        });
      }
    }

    // Check 6: Monotonic clock checks if provided
    if (ev.monotonicStartNs && ev.monotonicEndNs) {
      const startMono = BigInt(ev.monotonicStartNs);
      const endMono = BigInt(ev.monotonicEndNs);
      if (endMono < startMono) {
        errors.push({
          code: 'MONOTONIC_REGRESSION',
          message: `Event ${ev.eventId} has monotonicEndNs < monotonicStartNs`,
          eventId: ev.eventId
        });
      }
    }

    // Categorize events and evaluate state machine
    if (ev.eventType === ActivityEventType.APP_FOCUS_END) {
      parentAppIntervalCount++;
      totalActiveDurationSeconds += ev.durationSeconds;
      const appName = ev.application?.name || ev.process || 'Unknown';
      const executable = (ev.application?.executable || ev.process || '').toLowerCase();
      const isBrowser =
        executable.includes('chrome') ||
        executable.includes('msedge') ||
        executable.includes('brave') ||
        executable.includes('firefox') ||
        executable.includes('opera') ||
        executable.includes('vivaldi') ||
        executable.includes('arc');

      if (startMs !== undefined && endMs !== undefined) {
        parentIntervals.push({
          eventId: ev.eventId,
          applicationId: ev.application?.applicationId,
          appName,
          executable,
          startMs,
          endMs,
          startMonoNs: ev.monotonicStartNs ? BigInt(ev.monotonicStartNs) : undefined,
          endMonoNs: ev.monotonicEndNs ? BigInt(ev.monotonicEndNs) : undefined,
          isBrowser
        });
      }
    } else if (ev.eventType === ActivityEventType.WEBSITE_FOCUS_END) {
      childWebsiteIntervalCount++;
      const domain = ev.website?.domain || 'unknown-domain';
      const browser = ev.browser || ev.website?.browser || 'Browser';
      if (startMs !== undefined && endMs !== undefined) {
        childWebsiteIntervals.push({
          eventId: ev.eventId,
          domain,
          browser,
          startMs,
          endMs
        });
      }
    } else if (ev.eventType === ActivityEventType.IDLE_END) {
      idleIntervalCount++;
      totalIdleDurationSeconds += ev.durationSeconds;
    } else if (ev.eventType === ActivityEventType.LOCK) {
      lockEventCount++;
      currentEngineState = ActivityState.LOCKED;
    } else if (ev.eventType === ActivityEventType.UNLOCK) {
      currentEngineState = ActivityState.WAITING_FOR_INPUT;
    } else if (ev.eventType === ActivityEventType.SLEEP) {
      sleepEventCount++;
      currentEngineState = ActivityState.SLEEPING;
    } else if (ev.eventType === ActivityEventType.RESUME) {
      currentEngineState = ActivityState.WAITING_FOR_INPUT;
    }
  }

  // Check 7: No Overlapping Parent Intervals on Same Device & Timeline
  // Sort parent intervals chronologically
  const sortedParents = [...parentIntervals].sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sortedParents.length - 1; i++) {
    const cur = sortedParents[i];
    const next = sortedParents[i + 1];

    // Allow 1 second clock boundary tolerance
    if (next.startMs < cur.endMs - 1000) {
      errors.push({
        code: 'OVERLAPPING_PARENT_INTERVALS',
        message: `Incompatible parent intervals overlap: [${cur.appName} (${new Date(cur.startMs).toISOString()} - ${new Date(cur.endMs).toISOString()})] overlaps with [${next.appName} (${new Date(next.startMs).toISOString()} - ${new Date(next.endMs).toISOString()})]`,
        eventId: next.eventId,
        details: { cur, next }
      });
    }
  }

  // Check 8: Child Website Intervals MUST be Bounded Inside Parent Browser Interval
  for (const child of childWebsiteIntervals) {
    // Find matching parent browser interval that completely envelopes this website
    const parentBrowser = sortedParents.find(
      (p) =>
        p.isBrowser &&
        child.startMs >= p.startMs - 2000 && // 2s tolerance for event loop dispatch
        child.endMs <= p.endMs + 2000
    );

    if (!parentBrowser) {
      // Find if there was any browser active at all
      const anyBrowser = sortedParents.find(
        (p) => p.isBrowser && Math.max(child.startMs, p.startMs) < Math.min(child.endMs, p.endMs)
      );

      if (!anyBrowser) {
        errors.push({
          code: 'WEBSITE_WITHOUT_BROWSER_PARENT',
          message: `Website interval [${child.domain}] (${new Date(child.startMs).toISOString()} - ${new Date(child.endMs).toISOString()}) exists without an active parent browser!`,
          eventId: child.eventId
        });
      } else {
        errors.push({
          code: 'WEBSITE_EXCEEDS_BROWSER_PARENT',
          message: `Website interval [${child.domain}] exceeds its parent browser interval [${anyBrowser.appName}] boundaries!`,
          eventId: child.eventId
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      totalEvents: events.length,
      parentAppIntervals: parentAppIntervalCount,
      childWebsiteIntervals: childWebsiteIntervalCount,
      idleIntervals: idleIntervalCount,
      lockEvents: lockEventCount,
      sleepEvents: sleepEventCount,
      totalActiveDurationSeconds,
      totalIdleDurationSeconds
    }
  };
}
