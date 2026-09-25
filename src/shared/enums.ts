export enum ActivityState {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  BREAK = 'BREAK',
  OFFLINE = 'OFFLINE'
}

export enum ActivityEventType {
  APPLICATION_FOCUS = 'APPLICATION_FOCUS',
  IDLE_INTERVAL = 'IDLE_INTERVAL',
  SYSTEM_LOCK = 'SYSTEM_LOCK'
}

export enum BreakReason {
  LUNCH = 'LUNCH',
  PERSONAL = 'PERSONAL',
  MEETING = 'MEETING',
  COFFEE = 'COFFEE',
  OTHER = 'OTHER'
}
