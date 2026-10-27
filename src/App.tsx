import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Home,
  MapPinCheck,
  Settings2,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BootScreen } from './components/BootScreen';
import { CourseDetailDialog } from './components/CourseDetailDialog';
import { LoginScreen } from './components/LoginScreen';
import { Logo } from './components/Logo';
import { SettingsDialog } from './components/SettingsDialog';
import { Toast, type ToastState } from './components/Toast';
import { platformLabel } from './lib/bridge';
import { createDemoData } from './lib/demo';
import {
  clearLocalData,
  clearScheduleCache,
  loadMode,
  loadPreference,
  loadProfile,
  loadSchedule,
  saveMode,
  savePreference,
  saveProfile,
  saveSchedule,
} from './lib/storage';
import { selectedWeek as findSelectedWeek } from './lib/parsers';
import { OverviewPage } from './pages/OverviewPage';
import { SchedulePage } from './pages/SchedulePage';
import { AttendancePage } from './pages/AttendancePage';
import { CampusError, CampusService, type CampusSession } from './services/campus';
import type {
  CachedSchedule,
  ConnectionMode,
  Course,
  Profile,
  ResolvedConnectionMode,
  SigninClass,
  Term,
  ViewName,
  Week,
} from './types';

type Phase = 'booting' | 'login' | 'workspace';

const NAV_ITEMS: Array<{
  value: ViewName;
  label: string;
  icon: typeof Home;
}> = [
  { value: 'overview', label: '概览', icon: Home },
  { value: 'schedule', label: '课表', icon: CalendarDays },
  { value: 'attendance', label: '签到', icon: MapPinCheck },
];

function readableError(error: unknown): string {
  if (error instanceof CampusError) return error.message;
  if (error instanceof Error) return error.message;
  return '操作失败，请稍后重试。';
}

function emptyCachedState(): CachedSchedule | null {
  return loadSchedule();
}

export default function App() {
  const serviceRef = useRef(new CampusService());
  const restorePromiseRef = useRef<Promise<CampusSession> | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>('booting');
  const [modePreference, setModePreference] = useState<ConnectionMode>(() => loadPreference());
  const [mode, setMode] = useState<ResolvedConnectionMode>(() => loadMode());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermCode, setSelectedTermCode] = useState('');
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [courses, setCourses] = useState<Course[]>([]);
  const [signins, setSignins] = useState<SigninClass[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [cachedSchedule, setCachedSchedule] = useState<CachedSchedule | null>(() => emptyCachedState());
  const [cacheProfile, setCacheProfile] = useState<Profile | null>(() => loadProfile());
  const [view, setView] = useState<ViewName>('overview');
  const [offline, setOffline] = useState(false);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [weekLoading, setWeekLoading] = useState(false);
  const [signinLoading, setSigninLoading] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [signingCourseId, setSigningCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, tone: ToastState['tone'] = 'info') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3_800);
  };

  const persistSession = (session: CampusSession) => {
    const timestamp = new Date().toISOString();
    const cache: CachedSchedule = {
      terms: session.terms,
      selectedTermCode: session.selectedTerm,
      weeks: session.weeks,
      selectedWeek: session.selectedWeek,
      courses: session.courses,
      cachedAt: timestamp,
    };
    saveSchedule(cache);
    saveProfile(session.profile);
    saveMode(session.mode);
    setSelectedTermCode(session.selectedTerm);
    setSelectedWeek(session.selectedWeek);
    setCachedSchedule(cache);
    setCacheProfile(session.profile);
    setCachedAt(timestamp);
  };

  const applySession = (session: CampusSession) => {
    serviceRef.current.mode = session.mode;
    serviceRef.current.source = session.source;
    setProfile(session.profile);
    setMode(session.mode);
    setTerms(session.terms);
    setWeeks(session.weeks);
    setCourses(session.courses);
    setSelectedTermCode(session.selectedTerm);
    setSelectedWeek(session.selectedWeek);
    setOffline(false);
    setDemo(false);
    setError('');
    setSigninError('');
    setView('overview');
    setPhase('workspace');
    persistSession(session);
  };

  const hydrateSignins = async (): Promise<boolean> => {
    setSigninLoading(true);
    try {
      const next = await serviceRef.current.loadSignins();
      setSignins(next);
      setSigninError('');
      return true;
    } catch (signinError) {
      setSignins([]);
      const message = readableError(signinError);
      setSigninError(message);
      if (signinError instanceof CampusError && signinError.kind === 'permission') {
        showToast(signinError.message, 'error');
      }
      return false;
    } finally {
      setSigninLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const savedProfile = loadProfile();
    const savedMode = loadMode();
    const savedCache = loadSchedule();
    setCacheProfile(savedProfile);
    setCachedSchedule(savedCache);
    if (!savedProfile) {
      setPhase('login');
      return;
    }

    const restore = async () => {
      try {
        if (!restorePromiseRef.current) {
          restorePromiseRef.current = serviceRef.current.resume(savedMode);
        }
        const session = await restorePromiseRef.current;
        if (!active) return;
        applySession(session);
        void hydrateSignins();
      } catch {
        if (!active) return;
        setError(savedCache ? '登录状态已失效，请重新连接校园账号。' : '无法恢复校园会话，请重新登录。');
        setPhase('login');
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const handleConnect = async () => {
    setBusy(true);
    setError('');
    savePreference(modePreference);
    try {
      const session = await serviceRef.current.connect(modePreference);
      applySession(session);
      void hydrateSignins();
    } catch (connectError) {
      const message = readableError(connectError);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = () => {
    const data = createDemoData();
    const current = findSelectedWeek(data.weeks);
    const timestamp = new Date().toISOString();
    setProfile(data.profile);
    setTerms(data.terms);
    setWeeks(data.weeks);
    setCourses(data.courses);
    setSignins(data.signins);
    setSigninError('');
    setSelectedTermCode(data.terms[0].code);
    setSelectedWeek(current?.number ?? 1);
    setCachedAt(timestamp);
    setOffline(false);
    setDemo(true);
    setError('');
    setView('overview');
    setPhase('workspace');
    showToast('演示模式', 'info');
  };

  const handleOffline = () => {
    const cache = loadSchedule();
    if (!cache) {
      showToast('这台设备上还没有离线课表', 'error');
      return;
    }
    setProfile(loadProfile());
    setMode(loadMode());
    setTerms(cache.terms);
    setWeeks(cache.weeks);
    setCourses(cache.courses);
    setSelectedTermCode(cache.selectedTermCode);
    setSelectedWeek(cache.selectedWeek);
    setCachedAt(cache.cachedAt);
    setSignins([]);
    setSigninError('');
    setOffline(true);
    setDemo(false);
    setError('');
    setView('overview');
    setPhase('workspace');
  };

  const updateCache = (
    nextCourses: Course[],
    nextTermCode = selectedTermCode,
    nextWeek = selectedWeek,
    nextWeeks = weeks,
  ) => {
    if (offline || demo) return;
    const timestamp = new Date().toISOString();
    const cache: CachedSchedule = {
      terms,
      selectedTermCode: nextTermCode,
      weeks: nextWeeks,
      selectedWeek: nextWeek,
      courses: nextCourses,
      cachedAt: timestamp,
    };
    saveSchedule(cache);
    setCachedSchedule(cache);
    setCachedAt(timestamp);
  };

  const handleWeekChange = async (weekNumber: number) => {
    if (weekNumber < 1 || weekNumber > (weeks.at(-1)?.number ?? 1) || weekNumber === selectedWeek) return;
    if (offline || demo) {
      if (offline) {
        showToast('离线模式只保留了上次同步的一周课表', 'info');
      } else {
        setSelectedWeek(weekNumber);
      }
      return;
    }
    setWeekLoading(true);
    try {
      const next = await serviceRef.current.loadWeek(selectedTermCode, weekNumber);
      setSelectedWeek(weekNumber);
      setCourses(next);
      updateCache(next, selectedTermCode, weekNumber);
    } catch (weekError) {
      showToast(readableError(weekError), 'error');
    } finally {
      setWeekLoading(false);
    }
  };

  const handleTermChange = async (termCode: string) => {
    if (termCode === selectedTermCode) return;
    if (offline || demo) {
      showToast('请重新连接校园账号后切换学期', 'info');
      return;
    }
    setWeekLoading(true);
    try {
      const nextTerms = terms.map((term) => ({ ...term, selected: term.code === termCode }));
      const nextWeeks = await serviceRef.current.loadWeeks(termCode);
      const target = findSelectedWeek(nextWeeks);
      if (!target) throw new CampusError('这个学期还没有周次信息。', 'data');
      const nextCourses = await serviceRef.current.loadWeek(termCode, target.number);
      setTerms(nextTerms);
      setWeeks(nextWeeks);
      setSelectedTermCode(termCode);
      setSelectedWeek(target.number);
      setCourses(nextCourses);
      updateCache(nextCourses, termCode, target.number, nextWeeks);
    } catch (termError) {
      showToast(readableError(termError), 'error');
    } finally {
      setWeekLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (demo) {
      setCachedAt(new Date().toISOString());
      showToast('演示数据已刷新', 'success');
      return;
    }
    if (offline) {
      showToast('离线模式无法同步，请重新登录', 'error');
      return;
    }
    setBusy(true);
    try {
      const session = await serviceRef.current.resume(mode);
      applySession(session);
      await hydrateSignins();
      showToast('课表与签到状态已同步', 'success');
    } catch (refreshError) {
      showToast(readableError(refreshError), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshSignins = async () => {
    if (demo) {
      setSignins((current) => [...current]);
      showToast('演示签到状态已刷新', 'success');
      return;
    }
    if (offline) {
      showToast('离线模式无法查询签到状态', 'error');
      return;
    }
    const refreshed = await hydrateSignins();
    if (refreshed) showToast('签到状态已刷新', 'success');
  };

  const handleSignin = async (courseId: string) => {
    if (demo) {
      setSignignDemo(courseId);
      return;
    }
    setSigningCourseId(courseId);
    try {
      const result = await serviceRef.current.signIn(courseId);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        setSigninError('');
        setSignins((current) =>
          current.map((item) => (item.courseId === courseId ? { ...item, status: 1 } : item)),
        );
      }
    } catch (signinError) {
      showToast(readableError(signinError), 'error');
    } finally {
      setSigningCourseId(null);
    }
  };

  const setSignignDemo = (courseId: string) => {
    setSignins((current) =>
      current.map((item) => (item.courseId === courseId ? { ...item, status: 1 } : item)),
    );
    showToast('演示签到成功', 'success');
  };

  const handleLogout = async () => {
    setSettingsOpen(false);
    setBusy(true);
    try {
      if (!demo) await serviceRef.current.logout();
    } catch {
      // Local UI state is cleared regardless of the upstream logout result.
    }
    clearLocalData(false);
    setProfile(null);
    setTerms([]);
    setWeeks([]);
    setCourses([]);
    setSignins([]);
    setSigninError('');
    setCachedSchedule(null);
    setCacheProfile(null);
    setSelectedTermCode('');
    setSelectedWeek(1);
    setCachedAt(null);
    setOffline(false);
    setDemo(false);
    setError('');
    setPhase('login');
    setView('overview');
    setBusy(false);
  };

  const handleClearCache = () => {
    clearScheduleCache();
    setCachedSchedule(null);
    setCachedAt(null);
    setSettingsOpen(false);
    showToast('离线缓存已清除', 'success');
  };

  if (phase === 'booting') return <BootScreen />;

  if (phase === 'login') {
    return (
      <>
        <LoginScreen
          modePreference={modePreference}
          onModeChange={(nextMode) => {
            setModePreference(nextMode);
            savePreference(nextMode);
          }}
          onConnect={handleConnect}
          onDemo={handleDemo}
          onOffline={handleOffline}
          canOpenOffline={Boolean(cachedSchedule)}
          offlineProfile={cacheProfile}
          busy={busy}
          error={error}
          platform={platformLabel()}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  const currentWeek = weeks.find((week) => week.number === selectedWeek);
  const navigate = (nextView: ViewName) => {
    setView(nextView);
    const liveCurrentWeek = weeks.find((week) => week.current);
    if (
      nextView === 'overview' &&
      !offline &&
      !demo &&
      liveCurrentWeek &&
      liveCurrentWeek.number !== selectedWeek
    ) {
      void handleWeekChange(liveCurrentWeek.number);
    }
  };
  const page =
    view === 'overview' ? (
      <OverviewPage
        profile={profile}
        mode={mode}
        week={currentWeek}
        courses={courses}
        signins={signins}
        cachedAt={cachedAt}
        offline={offline}
        refreshing={busy}
        onRefresh={handleRefresh}
        onNavigate={navigate}
        onCourseClick={setSelectedCourse}
      />
    ) : view === 'schedule' ? (
      <SchedulePage
        terms={terms}
        selectedTermCode={selectedTermCode}
        weeks={weeks}
        selectedWeek={selectedWeek}
        courses={courses}
        offline={offline}
        loading={weekLoading}
        onTermChange={handleTermChange}
        onWeekChange={handleWeekChange}
        onCourseClick={setSelectedCourse}
        onRefresh={handleRefresh}
      />
    ) : (
      <AttendancePage
        signins={signins}
        offline={offline}
        loading={signinLoading}
        error={signinError}
        signingCourseId={signingCourseId}
        onRefresh={handleRefreshSignins}
        onSignin={handleSignin}
      />
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <Logo />
          <span className={`sidebar__session ${offline ? 'is-offline' : ''}`}>
            {offline ? <WifiOff size={13} /> : <Wifi size={13} />}
            {offline ? '离线' : mode === 'webvpn' ? 'WebVPN' : '直连'}
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          <p>你的校园</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                className={view === item.value ? 'is-active' : ''}
                onClick={() => navigate(item.value)}
              >
                <span><Icon size={19} strokeWidth={2} /></span>
                {item.label}
                {item.value === 'attendance' && signins.some((signin) => signin.status === 0) && <i />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar__focus">
          <span>本周</span>
          <strong>{currentWeek?.name ?? '本周'}</strong>
          <p>{courses.length ? `已安排 ${courses.length} 节课程` : '还没有课程安排'}</p>
          <div className="focus-dots">
            {Array.from({ length: 7 }, (_, index) => (
              <i key={index} className={courses.some((course) => course.dayOfWeek === index + 1) ? 'has-course' : ''} />
            ))}
          </div>
        </div>

        <div className="sidebar__bottom">
          {demo && <span className="demo-ribbon"><Sparkles size={13} /> 演示模式</span>}
          <button className="profile-button" onClick={() => setSettingsOpen(true)}>
            <span className="profile-button__avatar">{(profile?.displayName ?? '课').slice(0, 1)}</span>
            <span><strong>{profile?.displayName ?? '校园用户'}</strong><small>{profile?.studentId ?? '个人账户'}</small></span>
            <Settings2 size={18} />
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <Logo compact />
        <div>
          {demo && <span className="demo-ribbon"><Sparkles size={12} /> 演示</span>}
          <button className="mobile-avatar" onClick={() => setSettingsOpen(true)}>{(profile?.displayName ?? '课').slice(0, 1)}</button>
        </div>
      </header>

      <div className="app-content">{page}</div>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.value} className={view === item.value ? 'is-active' : ''} onClick={() => navigate(item.value)}>
              <span>
                <Icon size={20} />
                {item.value === 'attendance' && signins.some((signin) => signin.status === 0) && <i />}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <CourseDetailDialog course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      <SettingsDialog
        open={settingsOpen}
        profile={profile}
        mode={mode}
        week={currentWeek}
        cachedAt={cachedAt}
        offline={offline}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
        onClearData={handleClearCache}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
