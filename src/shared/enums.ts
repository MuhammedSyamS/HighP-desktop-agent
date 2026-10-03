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

export enum ApplicationCategory {
  ALL = 'All',
  DEVELOPMENT = 'Development',
  DESIGN = 'Design',
  COMMUNICATION = 'Communication',
  BROWSERS = 'Browsers',
  PRODUCTIVITY = 'Productivity',
  MARKETING = 'Marketing',
  PROJECT_MANAGEMENT = 'Project Management',
  FILE_MANAGEMENT = 'File Management',
  MEDIA = 'Media',
  OTHER = 'Other'
}

