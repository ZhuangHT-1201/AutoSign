export type ConnectionMode = 'auto' | 'direct' | 'webvpn';
export type ResolvedConnectionMode = 'direct' | 'webvpn';
export type ViewName = 'overview' | 'schedule' | 'attendance';

export interface Term {
  code: string;
  name: string;
  selected: boolean;
  index: number;
}

export interface Week {
  startDate: string;
  endDate: string;
  term: string;
  current: boolean;
  number: number;
  name: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  serialNo?: string;
  credit?: string;
  beginTime?: string;
  endTime?: string;
  beginSection?: number;
  endSection?: number;
  location?: string;
  teachers?: string;
  teachingTarget?: string;
  color?: string;
  dayOfWeek?: number;
  weekNumbers?: number[];
}

export interface SigninClass {
  courseId: string;
  courseName: string;
  beginTime: string;
  endTime: string;
  status: 0 | 1;
}

export interface Profile {
  displayName: string;
  studentId?: string;
  authenticatedAt: string;
}

export interface CachedSchedule {
  terms: Term[];
  selectedTermCode: string;
  weeks: Week[];
  selectedWeek: number;
  courses: Course[];
  cachedAt: string;
}

export interface AppSnapshot {
  profile: Profile | null;
  mode: ResolvedConnectionMode;
  terms: Term[];
  selectedTermCode: string;
  weeks: Week[];
  selectedWeek: number;
  courses: Course[];
  signins: SigninClass[];
  cachedAt: string | null;
  isOffline: boolean;
}

export interface DemoData {
  terms: Term[];
  weeks: Week[];
  courses: Course[];
  signins: SigninClass[];
  profile: Profile;
}
