import {
  Check,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
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
          <p className="page-heading__date">CLASS CHECK-IN</p>
          <h1>课堂签到</h1>
          <p className="page-heading__sub">{formatFullDate(new Date())} · 状态由学校课堂系统实时返回</p>
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
            <span>请在规定时间和范围内完成签到，系统会校验你的实际位置。</span>
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

      <div className="attendance-columns">
        <section className="surface-card attendance-list-card">
          <header className="section-heading">
            <div><span>今日课堂</span><small>{signins.length} 条签到记录</small></div>
            <span className="live-label"><i /> 实时状态</span>
          </header>

          {offline ? (
            <div className="attendance-empty">
              <span><ShieldCheck size={27} /></span>
              <h3>离线状态无法签到</h3>
              <p>重新连接校园账号后即可刷新课堂状态并完成签到。</p>
            </div>
          ) : loading && !signins.length ? (
            <div className="attendance-empty"><LoaderCircle className="spin" size={26} /><h3>正在查询签到课程</h3><p>请稍候，正在连接课堂服务。</p></div>
          ) : error && !signins.length ? (
            <div className="attendance-empty">
              <span><ShieldCheck size={27} /></span>
              <h3>签到状态暂时不可用</h3>
              <p>{error}</p>
              <button className="wide-quiet-button" onClick={onRefresh}>重试连接 <RefreshCw size={14} /></button>
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
                        ? '签到成功，状态已同步'
                        : '当前开放签到，请在教室内完成操作'}
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
              <p>老师发布签到后，刷新这里即可看到。</p>
              <button className="wide-quiet-button" onClick={onRefresh}>重新查询 <RefreshCw size={14} /></button>
            </div>
          )}
        </section>

        <aside className="attendance-aside">
          <section className="checkin-tip">
            <span><ShieldCheck size={22} /></span>
            <h3>签到小提示</h3>
            <ul>
              <li><Clock3 size={15} /> 仅在课堂开放时段内操作</li>
              <li><MapPin size={15} /> 请处于老师设置的位置范围</li>
              <li><RefreshCw size={15} /> 若失败，刷新后再次确认状态</li>
            </ul>
          </section>
          <section className="policy-note">
            <span>合规使用</span>
            <p>本功能仅代你向学校课堂服务提交本人签到，不提供代签、虚拟定位或绕过校验的能力。</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
