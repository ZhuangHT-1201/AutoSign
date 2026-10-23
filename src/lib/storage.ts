import type { CachedSchedule, ConnectionMode, Profile, ResolvedConnectionMode } from '../types';

const CACHE_KEY = 'classmark.schedule.v1';
const PROFILE_KEY = 'classmark.profile.v1';
const MODE_KEY = 'classmark.mode.v1';
const PREFERENCE_KEY = 'classmark.mode-preference.v1';

export function saveSchedule(cache: CachedSchedule): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function loadSchedule(): CachedSchedule | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedSchedule) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveMode(mode: ResolvedConnectionMode): void {
  localStorage.setItem(MODE_KEY, mode);
}

export function loadMode(): ResolvedConnectionMode {
  return localStorage.getItem(MODE_KEY) === 'webvpn' ? 'webvpn' : 'direct';
}

export function savePreference(mode: ConnectionMode): void {
  localStorage.setItem(PREFERENCE_KEY, mode);
}

export function loadPreference(): ConnectionMode {
  const value = localStorage.getItem(PREFERENCE_KEY);
  return value === 'direct' || value === 'webvpn' ? value : 'auto';
}

export function clearLocalData(keepSchedule = true): void {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(PREFERENCE_KEY);
  if (!keepSchedule) localStorage.removeItem(CACHE_KEY);
}

export function clearScheduleCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
