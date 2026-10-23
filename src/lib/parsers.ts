import type { Course, Profile, SigninClass, Term, Week } from '../types';
import { fromWebVpnUrl } from './webvpn';

type JsonRecord = Record<string, unknown>;

const COURSE_COLORS = [
  '#2c7a6b',
  '#5c70c9',
  '#c17953',
  '#7b6aa8',
  '#3f8587',
  '#a65d72',
  '#6d8b50',
  '#526e9e',
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(asString(value));
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseJsonPayload(raw: string): JsonRecord {
  const text = raw.trim();
  const withoutPrefix = text.replace(/^\)\]\}',?\s*/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutPrefix);
  } catch {
    throw new Error('校园系统返回了无法识别的数据，请稍后重试。');
  }
  if (!isRecord(parsed)) throw new Error('校园系统返回的数据格式异常。');
  return parsed;
}

export function looksLikeLoginPage(raw: string, finalUrl = ''): boolean {
  if (/sso\.buaa\.edu\.cn\/login/i.test(finalUrl)) return true;
  const sample = raw.slice(0, 2500);
  return (
    /name=["']execution["']/i.test(sample) ||
    /统一身份认证/.test(sample) ||
    /CAS Login/i.test(sample)
  );
}

export function parseTerms(payload: JsonRecord): Term[] {
  const records = asArray(payload.datas).filter(isRecord);
  const terms = records
    .map((term, index) => ({
      code: asString(term.itemCode) ?? '',
      name: asString(term.itemName) ?? asString(term.itemCode) ?? '',
      selected: term.selected === true || String(term.selected) === '1',
      index: asNumber(term.itemIndex) ?? index,
    }))
    .filter((term) => Boolean(term.code));

  const selectedIndex = terms.findIndex((term) => term.selected);
  if (selectedIndex > 0) {
    const [selected] = terms.splice(selectedIndex, 1);
    terms.unshift(selected);
  }
  return terms.map((term, index) => ({
    ...term,
    selected: selectedIndex >= 0 ? index === 0 : index === 0,
    index,
  }));
}

export function parseWeeks(payload: JsonRecord): Week[] {
  const records = asArray(payload.datas).filter(isRecord);
  return records
    .map((week) => ({
      startDate: (asString(week.startDate) ?? '').slice(0, 10),
      endDate: (asString(week.endDate) ?? '').slice(0, 10),
      term: asString(week.term) ?? '',
      current: week.curWeek === true || String(week.curWeek) === '1',
      number: asNumber(week.serialNumber) ?? 0,
      name: asString(week.name) ?? '',
    }))
    .filter((week) => week.number > 0)
    .sort((a, b) => a.number - b.number);
}

function colorFor(name: string, preferred?: string): string {
  if (preferred && /^#[0-9a-f]{6}$/i.test(preferred)) return preferred;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COURSE_COLORS[hash % COURSE_COLORS.length];
}

export function parseCourses(payload: JsonRecord): Course[] {
  const data = asRecord(payload.datas);
  const records = asArray(data.arrangedList).filter(isRecord);
  return records
    .map((course, index) => {
      const name = asString(course.courseName) ?? '未命名课程';
      const teachers = asString(course.weeksAndTeachers);
      return {
        id: `${asString(course.courseCode) ?? 'course'}-${asString(course.courseSerialNo) ?? index}-${asNumber(course.dayOfWeek) ?? 0}-${asNumber(course.beginSection) ?? index}`,
        code: asString(course.courseCode) ?? '',
        name,
        serialNo: asString(course.courseSerialNo),
        credit: asString(course.credit),
        beginTime: asString(course.beginTime),
        endTime: asString(course.endTime),
        beginSection: asNumber(course.beginSection),
        endSection: asNumber(course.endSection),
        location: asString(course.placeName),
        teachers,
        teachingTarget: asString(course.teachingTarget),
        color: colorFor(name, asString(course.color)),
        dayOfWeek: asNumber(course.dayOfWeek),
      } satisfies Course;
    })
    .sort(
      (a, b) =>
        (a.dayOfWeek ?? 9) - (b.dayOfWeek ?? 9) ||
        (a.beginSection ?? 99) - (b.beginSection ?? 99),
    );
}

export function parseSigninClasses(payload: JsonRecord): SigninClass[] {
  const status = String(payload.STATUS ?? '');
  if (status && !['0', '200', 'success'].includes(status.toLowerCase())) {
    return [];
  }
  return asArray(payload.result)
    .filter(isRecord)
    .map((item) => ({
      courseId: asString(item.id) ?? '',
      courseName: asString(item.courseName) ?? '未命名课程',
      beginTime: asString(item.classBeginTime) ?? '',
      endTime: asString(item.classEndTime) ?? '',
      status: (String(item.signStatus) === '1' ? 1 : 0) as SigninClass['status'],
    }))
    .filter((item) => Boolean(item.courseId));
}

export function parseSigninLoginName(rawUrl: string): string | null {
  const plainUrl = fromWebVpnUrl(rawUrl);
  for (const candidate of [rawUrl, plainUrl]) {
    try {
      const parsed = new URL(candidate);
      const logins = parsed.searchParams.getAll('loginName');
      const value = logins.find((item) => item.trim());
      if (value) return value;
    } catch {
      // Try the embedded query below.
    }
    const embedded = /[?&]loginName=([^&#]+)/i.exec(candidate);
    if (embedded) {
      try {
        return decodeURIComponent(embedded[1]);
      } catch {
        return embedded[1];
      }
    }
  }
  return null;
}

export function parseSigninAction(payload: JsonRecord): {
  success: boolean;
  message: string;
} {
  const status = String(payload.STATUS ?? '');
  const result = asRecord(payload.result);
  const success =
    ['0', '200', 'success'].includes(status.toLowerCase()) &&
    String(result.stuSignStatus) === '1';
  const rawMessage = asString(payload.ERRMSG);
  if (success) return { success: true, message: rawMessage || '签到成功' };
  if (rawMessage?.includes('已签到') || rawMessage?.includes('已经签到')) {
    return { success: false, message: '今天已经签过到了' };
  }
  if (rawMessage?.includes('未开始')) {
    return { success: false, message: '签到尚未开始' };
  }
  if (rawMessage?.includes('已结束')) {
    return { success: false, message: '本次签到已经结束' };
  }
  if (rawMessage?.includes('范围')) {
    return { success: false, message: '当前位置不在可签到范围内' };
  }
  if (rawMessage?.includes('不是上课时间')) {
    return { success: false, message: '当前不是上课时间' };
  }
  return { success: false, message: '签到未成功，请稍后重试' };
}

export function parseProfile(
  userInfo: JsonRecord | null,
  currentUser: JsonRecord | null,
): Profile {
  const data = asRecord(userInfo?.data);
  const candidates = [data, asRecord(userInfo), asRecord(currentUser?.data), asRecord(currentUser)];
  const keys = (record: JsonRecord, names: string[]) => {
    for (const name of names) {
      const value = asString(record[name]);
      if (value) return value;
    }
    return undefined;
  };

  let displayName = '';
  let studentId = '';
  for (const record of candidates) {
    displayName ||=
      keys(record, ['name', 'realName', 'xm', 'userName', 'USERNAME', 'displayName']) ?? '';
    studentId ||=
      keys(record, ['schoolid', 'schoolId', 'studentId', 'studentNo', 'username', 'xh']) ?? '';
  }
  return {
    displayName: displayName || '校园用户',
    studentId: studentId || undefined,
    authenticatedAt: new Date().toISOString(),
  };
}

export function selectedWeek(weeks: Week[], today = new Date()): Week | undefined {
  const isoDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return (
    weeks.find((week) => week.current) ??
    weeks.find((week) => week.startDate <= isoDate && week.endDate >= isoDate) ??
    weeks[0]
  );
}

export function coursesForWeek(courses: Course[], weekNumber: number): Course[] {
  return courses.filter(
    (course) => !course.weekNumbers || course.weekNumbers.includes(weekNumber),
  );
}
