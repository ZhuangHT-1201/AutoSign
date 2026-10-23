import type { Course, Week } from '../types';

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const SHORT_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toCompactDate(date: Date): string {
  return toIsoDate(date).replaceAll('-', '');
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function weekDates(week: Week | undefined, fallback = new Date()): Date[] {
  const start = week?.startDate ? parseLocalDate(week.startDate) : startOfWeek(fallback);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatFullDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_NAMES[date.getDay()]}`;
}

export function weekdayName(date: Date, short = false): string {
  return (short ? SHORT_WEEKDAYS : WEEKDAY_NAMES)[date.getDay()];
}

export function minuteOfDay(time: string | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function currentMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function relativeWeekLabel(week: Week | undefined): string {
  if (!week) return '本周';
  return `${week.name} · ${formatMonthDay(parseLocalDate(week.startDate))} 开始`;
}

export function getDayCourses(courses: Course[], date: Date): Course[] {
  const day = date.getDay() || 7;
  return courses
    .filter((course) => course.dayOfWeek === day)
    .sort((a, b) => (a.beginSection ?? 99) - (b.beginSection ?? 99));
}

export function nextCourse(courses: Course[], now = new Date()): Course | null {
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const today = getDayCourses(courses, now);
  return (
    today.find((course) => {
      const end = minuteOfDay(course.endTime);
      return end === null || end >= nowMinute;
    }) ?? null
  );
}
