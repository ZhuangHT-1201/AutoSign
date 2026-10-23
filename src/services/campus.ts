import type {
  ConnectionMode,
  Course,
  Profile,
  ResolvedConnectionMode,
  SigninClass,
  Term,
  Week,
} from '../types';
import {
  bridgeRequest,
  clearNativeSession,
  openOfficialAuth,
  type BridgeRequestInput,
  type BridgeResponse,
} from '../lib/bridge';
import {
  coursesForWeek,
  looksLikeLoginPage,
  parseCourses,
  parseJsonPayload,
  parseProfile,
  parseSigninAction,
  parseSigninClasses,
  parseSigninLoginName,
  parseTerms,
  parseWeeks,
  selectedWeek,
} from '../lib/parsers';
import { toCompactDate, toIsoDate } from '../lib/date';
import { toWebVpnUrl } from '../lib/webvpn';

const BYXT_BASE = 'https://byxt.buaa.edu.cn/jwapp/sys/homeapp';
const ICASS_BASE = 'https://iclass.buaa.edu.cn';
const GSMIS_BASE = 'https://gsmis.buaa.edu.cn/gsapp/sys/wdkbapp';
const UC_BASE = 'https://uc.buaa.edu.cn';

export type ScheduleSource = 'undergraduate' | 'graduate';

export interface CampusSession {
  profile: Profile;
  mode: ResolvedConnectionMode;
  source: ScheduleSource;
  terms: Term[];
  weeks: Week[];
  selectedTerm: string;
  selectedWeek: number;
  courses: Course[];
}

interface SigninSession {
  userId: string;
  sessionId: string;
}

export class CampusError extends Error {
  readonly kind: 'auth' | 'network' | 'data' | 'permission' | 'unknown';

  constructor(message: string, kind: CampusError['kind'] = 'unknown') {
    super(message);
    this.name = 'CampusError';
    this.kind = kind;
  }
}

function messageForError(error: unknown): string {
  if (error instanceof CampusError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return '连接超时，请检查网络或切换到 WebVPN 模式。';
  }
  if (/ENOTFOUND|ECONNREFUSED|ERR_NETWORK|Failed to fetch|socket/i.test(message)) {
    return '无法连接校园服务，请检查网络或切换到 WebVPN 模式。';
  }
  return message || '操作失败，请稍后重试。';
}

function refreshHeaders(referer: string): Record<string, string> {
  return {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: referer,
  };
}

export class CampusService {
  mode: ResolvedConnectionMode | null = null;
  source: ScheduleSource | null = null;
  private signinSession: SigninSession | null = null;
  private termCache = new Map<string, Week[]>();
  private graduateCourseCache = new Map<string, Course[]>();
  private graduateStarts = new Map<string, Date>();

  private upstream(rawUrl: string): string {
    return this.mode === 'webvpn' ? toWebVpnUrl(rawUrl) : rawUrl;
  }

  private referer(): string {
    return this.upstream(`${BYXT_BASE}/index.html`);
  }

  private async request(input: Omit<BridgeRequestInput, 'url'> & { url: string }): Promise<BridgeResponse> {
    try {
      const response = await bridgeRequest({
        timeoutMs: 12_000,
        redirect: true,
        ...input,
        url: this.upstream(input.url),
      });
      if (response.status >= 400) {
        throw new CampusError(`校园服务返回 HTTP ${response.status}。`, 'network');
      }
      return response;
    } catch (error) {
      if (error instanceof CampusError) throw error;
      throw new CampusError(messageForError(error), 'network');
    }
  }

  private async json(input: BridgeRequestInput & { url: string }) {
    const response = await this.request(input);
    if (looksLikeLoginPage(response.body, response.url)) {
      throw new CampusError('登录状态已失效，请重新登录。', 'auth');
    }
    return { payload: parseJsonPayload(response.body), response };
  }

  async resolveMode(preference: ConnectionMode): Promise<ResolvedConnectionMode> {
    if (preference === 'direct' || preference === 'webvpn') {
      this.mode = preference;
      return preference;
    }
    try {
      const response = await bridgeRequest({
        url: `${BYXT_BASE}/api/home/currentUser.do`,
        method: 'HEAD',
        timeoutMs: 4_000,
        redirect: false,
      });
      this.mode =
        (response.status >= 200 && response.status < 400) ||
        response.status === 401 ||
        response.status === 403
          ? 'direct'
          : 'webvpn';
    } catch {
      this.mode = 'webvpn';
    }
    return this.mode;
  }

  async hasSession(mode: ResolvedConnectionMode): Promise<boolean> {
    this.mode = mode;
    try {
      const { payload } = await this.json({
        url: `${BYXT_BASE}/api/home/currentUser.do`,
        timeoutMs: 5_000,
      });
      return Object.keys(payload).length > 0;
    } catch {
      return false;
    }
  }

  async connect(preference: ConnectionMode): Promise<CampusSession> {
    const mode = await this.resolveMode(preference);
    const startUrl = this.upstream(`${BYXT_BASE}/index.html`);
    const result = await openOfficialAuth({
      startUrl,
      successMarkers: [
        '/jwapp/sys/homeapp',
        '/jwapp/sys/byrhmhsy',
        'gsmis.buaa.edu.cn/gsapp/sys',
      ],
      title: '北京航空航天大学 · 统一身份认证',
    });
    if (!result.success || result.cancelled) {
      throw new CampusError('已取消登录。', 'auth');
    }

    try {
      return await this.loadSessionData(mode);
    } catch (firstError) {
      if (firstError instanceof CampusError && firstError.kind === 'auth') {
        throw firstError;
      }
      throw firstError;
    }
  }

  async resume(mode: ResolvedConnectionMode): Promise<CampusSession> {
    this.mode = mode;
    return this.loadSessionData(mode);
  }

  private async loadSessionData(mode: ResolvedConnectionMode): Promise<CampusSession> {
    this.mode = mode;
    this.source = null;
    this.signinSession = null;
    this.termCache.clear();
    this.graduateCourseCache.clear();
    this.graduateStarts.clear();

    const { payload: currentUser } = await this.json({
      url: `${BYXT_BASE}/api/home/currentUser.do`,
    });

    let userInfo: Record<string, unknown> | null = null;
    try {
      const response = await this.request({
        url: `${UC_BASE}/api/uc/userinfo`,
        timeoutMs: 6_000,
      });
      if (!looksLikeLoginPage(response.body, response.url)) {
        userInfo = parseJsonPayload(response.body);
      }
    } catch {
      // The schedule service is the source of truth for connectivity.
    }
    const profile = parseProfile(userInfo, currentUser);

    try {
      return await this.loadUndergraduate(profile, mode);
    } catch (undergraduateError) {
      try {
        return await this.loadGraduate(profile, mode);
      } catch {
        if (undergraduateError instanceof CampusError) throw undergraduateError;
        throw new CampusError('课表加载失败，请稍后重试。', 'data');
      }
    }
  }

  private async loadUndergraduate(
    profile: Profile,
    mode: ResolvedConnectionMode,
  ): Promise<CampusSession> {
    const { payload } = await this.json({
      url: `${BYXT_BASE}/api/home/student/schoolCalendars.do`,
      headers: refreshHeaders(this.referer()),
    });
    const terms = parseTerms(payload);
    if (!terms.length) throw new CampusError('当前学期列表为空。', 'data');
    const selectedTerm = terms[0].code;
    const weeks = await this.loadWeeks(selectedTerm);
    const week = selectedWeek(weeks);
    if (!week) throw new CampusError('当前学期尚未生成周次。', 'data');
    const courses = await this.loadUndergraduateWeek(selectedTerm, week.number);
    this.source = 'undergraduate';
    return {
      profile: { ...profile, authenticatedAt: new Date().toISOString() },
      mode,
      source: 'undergraduate',
      terms,
      weeks,
      selectedTerm,
      selectedWeek: week.number,
      courses,
    };
  }

  async loadWeeks(termCode: string): Promise<Week[]> {
    const cached = this.termCache.get(termCode);
    if (cached) return cached;
    if (this.source === 'graduate') {
      const courses = await this.loadGraduateCourses(termCode);
      const maxWeek = Math.max(
        0,
        ...courses.flatMap((course) => course.weekNumbers ?? [0]),
      );
      const today = new Date();
      const semesterStart = this.graduateStarts.get(termCode) ?? this.defaultMonday(today);
      const weeks = Array.from({ length: maxWeek }, (_, index) => {
        const start = new Date(semesterStart);
        start.setDate(start.getDate() + index * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const iso = toIsoDate(today);
        return {
          startDate: toIsoDate(start),
          endDate: toIsoDate(end),
          term: termCode,
          current: iso >= toIsoDate(start) && iso <= toIsoDate(end),
          number: index + 1,
          name: `第${index + 1}周`,
        };
      });
      this.termCache.set(termCode, weeks);
      return weeks;
    }
    const { payload } = await this.json({
      url: `${BYXT_BASE}/api/home/getTermWeeks.do?termCode=${encodeURIComponent(termCode)}`,
      headers: refreshHeaders(this.referer()),
    });
    const weeks = parseWeeks(payload);
    this.termCache.set(termCode, weeks);
    return weeks;
  }

  private async loadUndergraduateWeek(termCode: string, week: number): Promise<Course[]> {
    const body = new URLSearchParams({
      termCode,
      type: 'week',
      week: String(week),
    }).toString();
    const { payload } = await this.json({
      url: `${BYXT_BASE}/api/home/student/getMyScheduleDetail.do`,
      method: 'POST',
      headers: {
        ...refreshHeaders(this.referer()),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body,
    });
    return parseCourses(payload);
  }

  async loadWeek(termCode: string, week: number): Promise<Course[]> {
    if (this.source === 'graduate') {
      const courses = await this.loadGraduateCourses(termCode);
      return coursesForWeek(courses, week);
    }
    return this.loadUndergraduateWeek(termCode, week);
  }

  private async loadGraduate(
    profile: Profile,
    mode: ResolvedConnectionMode,
  ): Promise<CampusSession> {
    this.source = 'graduate';
    const terms = await this.loadGraduateTerms();
    if (!terms.length) throw new CampusError('没有找到可用的研究生课表学期。', 'data');
    const selectedTerm = terms[0].code;
    const courses = await this.loadGraduateCourses(selectedTerm);
    const maxWeek = Math.max(0, ...courses.flatMap((course) => course.weekNumbers ?? [0]));
    const baseMonday = this.graduateStarts.get(selectedTerm) ?? this.defaultMonday(new Date());
    const today = new Date();
    const weeks: Week[] = Array.from({ length: maxWeek }, (_, index) => {
      const start = new Date(baseMonday);
      start.setDate(start.getDate() + index * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const iso = toIsoDate(today);
      return {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        term: selectedTerm,
        current: iso >= toIsoDate(start) && iso <= toIsoDate(end),
        number: index + 1,
        name: `第${index + 1}周`,
      };
    });
    this.termCache.set(selectedTerm, weeks);
    const week =
      selectedWeek(weeks) ??
      ({
        number: 1,
        startDate: toIsoDate(baseMonday),
        endDate: toIsoDate(new Date(baseMonday.getTime() + 6 * 86400000)),
        term: selectedTerm,
        current: false,
        name: '第1周',
      } satisfies Week);
    return {
      profile,
      mode,
      source: 'graduate',
      terms,
      weeks,
      selectedTerm,
      selectedWeek: week.number,
      courses: coursesForWeek(courses, week.number),
    };
  }

  private async loadGraduateTerms(): Promise<Term[]> {
    const { payload } = await this.json({
      url: `${GSMIS_BASE}/modules/xskcb/kfdxnxqcx.do`,
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: this.upstream(`${GSMIS_BASE}/*default/index.do`),
      },
    });
    const root = payload.datas as Record<string, unknown> | undefined;
    const data = root?.kfdxnxqcx as Record<string, unknown> | undefined;
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return rows
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      .map((row, index) => ({
        code: String(row.XNXQDM ?? ''),
        name: String(row.XNXQDM_DISPLAY ?? row.XNXQDM ?? ''),
        selected: index === 0,
        index,
      }))
      .filter((term) => /^\d{4}[123]$/.test(term.code))
      .sort((a, b) => b.code.localeCompare(a.code))
      .map((term, index) => ({ ...term, selected: index === 0, index }));
  }

  private async loadGraduateCourses(termCode: string): Promise<Course[]> {
    const cached = this.graduateCourseCache.get(termCode);
    if (cached) return cached;
    const body = new URLSearchParams({
      ZC: '',
      XNXQDM: termCode,
      XH: '',
      XQDM: '',
    }).toString();
    const { payload } = await this.json({
      url: `${GSMIS_BASE}/bykb/loadXskbData.do`,
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: this.upstream(`${GSMIS_BASE}/*default/index.do`),
      },
      body,
    });
    const courses = this.parseGraduateCourses(payload, termCode);
    this.graduateCourseCache.set(termCode, courses);
    return courses;
  }

  private parseGraduateCourses(payload: Record<string, unknown>, termCode: string): Course[] {
    const rwList = Array.isArray(payload.rwList) ? payload.rwList : [];
    const jgList = Array.isArray(payload.jgList) ? payload.jgList : [];
    const jcfaList = Array.isArray(payload.jcfaList) ? payload.jcfaList : [];
    const courseInfo = new Map<string, Record<string, unknown>>();
    for (const value of rwList) {
      if (typeof value !== 'object' || value === null) continue;
      const course = value as Record<string, unknown>;
      if (String(course.XNXQDM ?? '') !== termCode) continue;
      courseInfo.set(String(course.BJDM ?? ''), course);
    }
    const slots = new Map<string, { start: string; end: string }>();
    for (const schemeValue of jcfaList) {
      if (typeof schemeValue !== 'object' || schemeValue === null) continue;
      const scheme = schemeValue as Record<string, unknown>;
      const schemeId = String(scheme.JCFADM ?? '');
      for (const slotValue of Array.isArray(scheme.skjcList) ? scheme.skjcList : []) {
        if (typeof slotValue !== 'object' || slotValue === null) continue;
        const slot = slotValue as Record<string, unknown>;
        slots.set(`${schemeId}:${Number(slot.DM)}`, {
          start: this.numberToTime(Number(slot.KSSJ)),
          end: this.numberToTime(Number(slot.JSSJ)),
        });
      }
    }

    const output: Course[] = [];
    const semesterStarts: Date[] = [];
    for (const value of jgList) {
      if (typeof value !== 'object' || value === null) continue;
      const row = value as Record<string, unknown>;
      const classId = String(row.BJDM ?? '');
      const course = courseInfo.get(classId);
      if (!course) continue;
      const weekMask = String(row.ZCBH ?? '');
      const weekNumbers = [...weekMask]
        .map((flag, index) => (flag === '1' ? index + 1 : 0))
        .filter(Boolean);
      if (!weekNumbers.length) continue;
      const firstTeachingDate = String(course.SCSKRQ ?? '');
      if (/^\d{4}-\d{2}-\d{2}/.test(firstTeachingDate)) {
        const firstDate = new Date(`${firstTeachingDate.slice(0, 10)}T00:00:00`);
        const dayOfWeek = Number(row.XQ);
        const offset = (weekNumbers[0] - 1) * 7 + dayOfWeek - 1;
        const candidate = new Date(firstDate);
        candidate.setDate(candidate.getDate() - offset);
        if (!Number.isNaN(candidate.getTime())) semesterStarts.push(candidate);
      }
      const schemeId = String(row.JCFADM ?? '');
      const beginSection = Number(row.KSJCDM);
      const endSection = Number(row.JSJCDM);
      const beginTime =
        slots.get(`${schemeId}:${beginSection}`)?.start ??
        this.numberToTime(Number(row.KSSJ));
      const endTime =
        slots.get(`${schemeId}:${endSection}`)?.end ?? this.numberToTime(Number(row.JSSJ));
      const name = String(row.KCMC ?? course.KCMC ?? '未命名课程');
      output.push({
        id: `${classId}-${row.XQ}-${beginSection}-${weekMask}`,
        code: String(row.KCDM ?? course.KCDM ?? ''),
        name,
        serialNo: classId,
        credit: course.XF ? String(course.XF) : undefined,
        beginTime,
        endTime,
        beginSection,
        endSection,
        location: String(row.JASMC ?? '') || undefined,
        teachers: [row.ZCMC, row.JGJSXM].filter(Boolean).map(String).join(' ') || undefined,
        color: undefined,
        dayOfWeek: Number(row.XQ),
        weekNumbers,
      });
    }
    const uniqueStarts = semesterStarts.filter(
      (candidate, index, all) =>
        all.findIndex((item) => toIsoDate(item) === toIsoDate(candidate)) === index,
    );
    if (uniqueStarts.length === 1) this.graduateStarts.set(termCode, uniqueStarts[0]);
    return output.sort(
      (a, b) =>
        (a.dayOfWeek ?? 9) - (b.dayOfWeek ?? 9) ||
        (a.beginSection ?? 99) - (b.beginSection ?? 99),
    );
  }

  private defaultMonday(date: Date): Date {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private numberToTime(value: number): string {
    const hour = Math.floor(value / 100);
    const minute = value % 100;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  async loadSignins(): Promise<SigninClass[]> {
    const session = await this.ensureSigninSession();
    const response = await this.request({
      url: `${ICASS_BASE}:8347/app/course/get_stu_course_sched.action?id=${encodeURIComponent(session.userId)}&dateStr=${toCompactDate(new Date())}`,
      headers: { sessionId: session.sessionId },
    });
    if (looksLikeLoginPage(response.body, response.url)) {
      this.signinSession = null;
      return [];
    }
    try {
      return parseSigninClasses(parseJsonPayload(response.body));
    } catch {
      return [];
    }
  }

  private async ensureSigninSession(): Promise<SigninSession> {
    if (this.signinSession) return this.signinSession;
    const rawEntry = `${ICASS_BASE}:8346/?type=jumpMyCenter`;
    const entry = await this.request({
      url: rawEntry,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const loginName = parseSigninLoginName(entry.url);
    if (!loginName) {
      throw new CampusError('课堂服务尚未完成授权，请重新登录后再试。', 'auth');
    }
    const loginUrl = `${ICASS_BASE}:8347/app/user/login.action?password=&phone=${encodeURIComponent(loginName)}&userLevel=1&verificationType=2&verificationUrl=`;
    const login = await this.request({ url: loginUrl });
    const payload = parseJsonPayload(login.body);
    const status = String(payload.STATUS ?? '').toLowerCase();
    if (status && !['0', '200', 'success'].includes(status)) {
      throw new CampusError(
        typeof payload.ERRMSG === 'string' ? payload.ERRMSG : '课堂服务登录失败，请在官网检查账号状态。',
        'permission',
      );
    }
    const result = payload.result as Record<string, unknown> | undefined;
    const userId = String(result?.id ?? '');
    const sessionId = String(result?.sessionId ?? '');
    if (!userId || !sessionId) {
      throw new CampusError('课堂服务没有返回有效会话，请重新登录。', 'auth');
    }
    this.signinSession = { userId, sessionId };
    return this.signinSession;
  }

  async signIn(courseId: string): Promise<{ success: boolean; message: string }> {
    const session = await this.ensureSigninSession();
    const timestampUrl =
      this.mode === 'webvpn'
        ? `${ICASS_BASE}:8347/app/common/get_timestamp.action`
        : `http://iclass.buaa.edu.cn:8081/app/common/get_timestamp.action`;
    const timestampResponse = await this.request({ url: timestampUrl });
    const timestampPayload = parseJsonPayload(timestampResponse.body);
    const timestamp = String(timestampPayload.timestamp ?? '');
    if (!timestamp) throw new CampusError('未获取到签到服务器时间。', 'data');

    const actionUrl =
      this.mode === 'webvpn'
        ? `${ICASS_BASE}:8347/app/course/stu_scan_sign.action?courseSchedId=${encodeURIComponent(courseId)}&timestamp=${encodeURIComponent(timestamp)}`
        : `http://iclass.buaa.edu.cn:8081/eschool/app/course/stu_scan_sign.action?courseSchedId=${encodeURIComponent(courseId)}&timestamp=${encodeURIComponent(timestamp)}`;
    const action = await this.request({
      url: actionUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        sessionId: session.sessionId,
      },
      body: new URLSearchParams({ id: session.userId }).toString(),
    });
    return parseSigninAction(parseJsonPayload(action.body));
  }

  async logout(): Promise<void> {
    this.signinSession = null;
    this.termCache.clear();
    this.graduateCourseCache.clear();
    await clearNativeSession();
  }
}

export { coursesForWeek };
