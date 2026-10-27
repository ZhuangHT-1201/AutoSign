import {
  Check,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  RefreshCw,
  TimerReset,
} from 'lucide-react';
import type { SigninClass } from '../types';
import { formatFullDate } from '../lib/date';

interface AttendancePageProps {
  signins: SigninClass[];
  offline: boolean;
  loading: boolean;
  error: string;
  signingCourseId: string | null;
  onRefresh: () => void;
  onSignin: (courseId: string) => void;
}

export function AttendancePage({
  signins,
  offline,
  loading,
  error,
  signingCourseId,
  onRefresh,
  onSignin,
}: AttendancePageProps) {
  const pending = signins.filter((item) => item.status === 0);
  const signed = signins.filter((item) => item.status === 1);

  return (
    <div className="page page--attendance">
      <header className="page-heading">
        <div>
          <h1>课堂签到</h1>
          <p className="page-heading__sub">{formatFullDate(new Date())}</p>
        </div>
        <button className="refresh-button" onClick={onRefresh} disabled={loading || offline}>
          <RefreshCw size={17} className={loading ? 'spin' : ''} />
          刷新状态
        </button>
      </header>

      <section className="attendance-summary">
        <div className="attendance-summary__main">
          <span className="attendance-summary__icon"><MapPin size={24} /></span>
          <div>
            <p>今日签到</p>
            <h2>{pending.length ? `还有 ${pending.length} 节课待处理` : signins.length ? '全部签到已完成' : '签到课程尚未发布'}</h2>
          </div>
        </div>
        <div className="attendance-summary__stats">
          <div><strong>{pending.length}</strong><span>待签到</span></div>
          <i />
          <div><strong>{signed.length}</strong><span>已完成</span></div>
          <i />
          <div><strong>{signins.length}</strong><span>全部课堂</span></div>
        </div>
      </section>

      <section className="surface-card attendance-list-card attendance-list-card--wide">
          <header className="section-heading">
            <div><span>今日课堂</span><small>{signins.length} 条签到记录</small></div>
            <span className="live-label"><i /> 实时状态</span>
          </header>

          {offline ? (
            <div className="attendance-empty">
              <span><RefreshCw size={27} /></span>
              <h3>离线模式不可签到</h3>
            </div>
          ) : loading && !signins.length ? (
            <div className="attendance-empty"><LoaderCircle className="spin" size={26} /><h3>正在查询签到课程</h3></div>
          ) : error && !signins.length ? (
            <div className="attendance-empty">
              <span><RefreshCw size={27} /></span>
              <h3>无法获取签到</h3>
              <p>{error}</p>
              <button className="wide-quiet-button" onClick={onRefresh}>重试 <RefreshCw size={14} /></button>
            </div>
          ) : signins.length ? (
            <div className="attendance-items">
              {signins.map((item) => (
                <article className={`attendance-item ${item.status === 1 ? 'attendance-item--done' : ''}`} key={item.courseId}>
                  <div className="attendance-item__time">
                    <strong>{item.beginTime || '--:--'}</strong>
                    <span>{item.endTime || '--:--'}</span>
                  </div>
                  <div className="attendance-item__mark">
                    {item.status === 1 ? <Check size={19} /> : <MapPin size={19} />}
                  </div>
                  <div className="attendance-item__copy">
                    <strong>{item.courseName}</strong>
                    <p>
                      {item.status === 1
                        ? '签到成功'
                        : '未签到'}
                    </p>
                  </div>
                  {item.status === 1 ? (
                    <span className="signed-chip"><CheckCircle2 size={15} /> 已签到</span>
                  ) : (
                    <button
                      className="signin-button"
                      onClick={() => onSignin(item.courseId)}
                      disabled={Boolean(signingCourseId)}
                    >
                      {signingCourseId === item.courseId ? <LoaderCircle size={16} className="spin" /> : <MapPin size={16} />}
                      {signingCourseId === item.courseId ? '签到中' : '立即签到'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="attendance-empty">
              <span><TimerReset size={27} /></span>
              <h3>今天暂无签到课程</h3>
              <button className="wide-quiet-button" onClick={onRefresh}>刷新 <RefreshCw size={14} /></button>
            </div>
          )}
      </section>
    </div>
  );
}
