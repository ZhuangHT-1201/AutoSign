import { describe, expect, it } from 'vitest';
import {
  addDays,
  getDayCourses,
  minuteOfDay,
  nextCourse,
  parseLocalDate,
  startOfWeek,
  toCompactDate,
  toIsoDate,
  weekDates,
} from '../src/lib/date';
import type { Course, Week } from '../src/types';

describe('date helpers', () => {
  it('uses local calendar dates without UTC shifts', () => {
    const date = parseLocalDate('2026-10-23');
    expect(toIsoDate(date)).toBe('2026-10-23');
    expect(toCompactDate(date)).toBe('20261023');
    expect(addDays(date, 2).getDate()).toBe(25);
  });

  it('starts weeks on Monday and forges exactly seven labels', () => {
    const monday = startOfWeek(new Date(2026, 9, 23));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(19);
    const week: Week = {
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      term: 'term',
      current: true,
      number: 6,
      name: '第6周',
    };
    expect(weekDates(week).map((date) => date.getDate())).toEqual([19, 20, 21, 22, 23, 24, 25]);
  });
});

describe('course timing', () => {
  const courses: Course[] = [
    {
      id: 'morning',
      code: 'A',
      name: '早课',
      dayOfWeek: 5,
      beginSection: 1,
      endSection: 2,
      beginTime: '08:00',
      endTime: '09:35',
    },
    {
      id: 'afternoon',
      code: 'B',
      name: '午课',
      dayOfWeek: 5,
      beginSection: 6,
      endSection: 7,
      beginTime: '14:00',
      endTime: '15:35',
    },
  ];

  it('finds the next unfinished course', () => {
    const now = new Date(2026, 9, 23, 10, 0);
    expect(nextCourse(courses, now)?.id).toBe('afternoon');
    expect(getDayCourses(courses, now)).toHaveLength(2);
    expect(minuteOfDay('14:35')).toBe(875);
  });
});
