import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Compass,
  MapPin,
  RefreshCw,
  Sparkles,
  TimerReset,
} from 'lucide-react';
import type { Profile, ResolvedConnectionMode, SigninClass, ViewName, Week, Course } from '../types';
import {
  formatFullDate,
  formatMonthDay,
  getDayCourses,
  minuteOfDay,
  nextCourse,
  parseLocalDate,
  weekDates,
} from '../lib/date';

interface OverviewPageProps {
  profile: Profile | null;
  mode: ResolvedConnectionMode;
  week: Week | undefined;
  courses: Course[];
  signins: SigninClass[];
  cachedAt: string | null;
  offline: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onNavigate: (view: ViewName) => void;
  onCourseClick: (course: Course) => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function OverviewPage({
  profile,
  mode,
  week,
  courses,
  signins,
  cachedAt,
  offline,
  refreshing,
  onRefresh,
  onNavigate,
  onCourseClick,
}: OverviewPageProps) {
  const now = new Date();
  const dates = weekDates(week, now);
  const today = dates.find((date) => date.toDateString() === now.toDateString()) ?? now;
  const dayCourses = getDayCourses(courses, today);
  const next = nextCourse(courses, now);
  const pending = signins.filter((item) => item.status === 0);
  const signed = signins.filter((item) => item.status === 1);
  const totalMinutes = dayCourses.reduce((sum, course) => {
    const begin = minuteOfDay(course.beginTime);
    const end = minuteOfDay(course.endTime);
    return sum + (begin !== null && end !== null ? Math.max(0, end - begin) : 90);
  }, 0);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const progressCourses = dayCourses.filter((course) => (minuteOfDay(course.endTime) ?? 0) < nowMinute);
  const dayProgress = dayCourses.length ? Math.round((progressCourses.length / dayCourses.length) * 100) : 0;

  return (
    <div className="page page--overview">
      <header className="page-heading page-heading--overview">
        <div>
          <p className="page-heading__date">{formatFullDate(now)}</p>
          <h1>{greeting()}，{profile?.displayName ?? '同学'}</h1>
          <p className="page-heading__sub">
            {dayCourses.length ? `今天有 ${dayCourses.length} 节课` : '今天没有课程'}
          </p>
        </div>
        <div className="heading-actions">
          <span className={`connection-chip ${offline ? 'connection-chip--offline' : ''}`}>
            <span />
            {offline ? '离线课表' : mode === 'webvpn' ? 'WebVPN 已连接' : '校园直连'}
          </span>
          <button className="icon-button soft" onClick={onRefresh} disabled={refreshing || offline} aria-label="刷新课表">
            <RefreshCw size={19} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </header>

      <section className="timeline-hero">
        <div className="timeline-hero__texture" />
        <div className="timeline-hero__main">
          <div className="timeline-hero__tag">
            <Sparkles size={15} />
            {week?.name ?? '本周'} · {week ? formatMonthDay(parseLocalDate(week.startDate)) : formatMonthDay(now)}
          </div>
          <h2>{next ? '下一节课' : dayCourses.length ? '今日课程已结束' : '今天没有课程'}</h2>
          {next ? (
            <button className="hero-course" onClick={() => onCourseClick(next)}>
              <span className="hero-course__time">
                <strong>{next.beginTime ?? '--:--'}</strong>
                <small>{next.endTime ?? '--:--'}</small>
              </span>
              <span className="hero-course__rule" />
              <span className="hero-course__copy">
                <strong>{next.name}</strong>
                <small>
                  <MapPin size={14} /> {next.location || '地点待公布'}
                </small>
              </span>
              <ArrowRight size={19} className="hero-course__arrow" />
            </button>
          ) : null}
        </div>
        <aside className="timeline-hero__aside">
          <div className="day-ring" style={{ '--progress': `${dayProgress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{dayProgress}%</strong><span>今日进度</span></div>
          </div>
          <p>{pending.length ? `${pending.length} 节课等待签到` : signins.length ? '今日签到已完成' : '暂无签到课程'}</p>
          <button onClick={() => onNavigate('attendance')}>
            {offline ? '查看签到状态' : '打开签到'}
            <ArrowRight size={15} />
          </button>
        </aside>
      </section>

      <section className="stat-row">
        <article className="stat-card">
          <span className="stat-card__icon stat-card__icon--green"><CalendarDays size={20} /></span>
          <div><small>本周课程</small><strong>{new Set(courses.map((course) => course.id)).size}<em> 节</em></strong></div>
          <span className="stat-card__caption">分布在这一周</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__icon stat-card__icon--blue"><Clock3 size={20} /></span>
          <div><small>今日课堂</small><strong>{Math.floor(totalMinutes / 60)}<em> 小时</em> {totalMinutes % 60}<em> 分</em></strong></div>
          <span className="stat-card__caption">课堂时长</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__icon stat-card__icon--orange"><TimerReset size={20} /></span>
          <div><small>签到进度</small><strong>{signed.length}<em> / </em>{signins.length || 0}</strong></div>
          <span className="stat-card__caption">{pending.length ? '还有课堂待处理' : '状态清楚'}</span>
        </article>
      </section>

      <div className="overview-columns">
        <section className="surface-card today-card">
          <header className="section-heading">
            <div><span>今日课程</span><small>{dayCourses.length ? '按上课时间排序' : '轻松的一天'}</small></div>
            <button className="text-button" onClick={() => onNavigate('schedule')}>完整课表 <ArrowRight size={15} /></button>
          </header>
          <div className="today-list">
            {dayCourses.length ? dayCourses.map((course, index) => (
              <button className="today-item" key={course.id} onClick={() => onCourseClick(course)}>
                <span className="today-item__time">
                  <strong>{course.beginTime ?? '--:--'}</strong>
                  <small>{course.endTime ?? '--:--'}</small>
                </span>
                <span className="today-item__line">
                  <i style={{ background: course.color }} />
                  {index < dayCourses.length - 1 && <b />}
                </span>
                <span className="today-item__card">
                  <strong>{course.name}</strong>
                  <small><MapPin size={13} /> {course.location || '地点待公布'}</small>
                </span>
                <span className="today-item__section">第 {course.beginSection ?? '?'} 节</span>
              </button>
            )) : (
              <div className="calm-empty">
                <span><Compass size={24} /></span>
                <div><strong>今天没有课程安排</strong><p>用这段时间阅读、运动，或者发一会儿呆。</p></div>
              </div>
            )}
          </div>
        </section>

        <aside className="side-stack">
          <section className="surface-card signin-mini">
            <header className="section-heading">
              <div><span>课堂签到</span></div>
              <span className={`status-dot-label ${pending.length ? 'status-dot-label--warm' : ''}`}>
                <i /> {pending.length ? `${pending.length} 待签到` : '状态正常'}
              </span>
            </header>
            {signins.length ? (
              <div className="signin-mini__body">
                <div className="signin-mini__mark"><MapPin size={22} /></div>
                <div>
                  <strong>{pending[0]?.courseName ?? signins[0].courseName}</strong>
                  <p>{pending.length ? `${pending[0].beginTime} — ${pending[0].endTime}` : '签到已完成'}</p>
                </div>
              </div>
            ) : (
              <div className="signin-mini__empty">暂无签到课程</div>
            )}
            <button className="wide-quiet-button" onClick={() => onNavigate('attendance')}>
              查看全部签到 <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>

      <p className="last-updated">
        {offline ? '当前显示本地快照' : '最近同步'}
        {cachedAt ? ` · ${new Date(cachedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}
      </p>
    </div>
  );
}
